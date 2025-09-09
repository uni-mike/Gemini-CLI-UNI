import type { Task, TaskPlan } from './types.js';
import { TaskStatus } from './types.js';
import { v4 as uuidv4 } from 'uuid';

export class Planner {
  private aiModel: any; // Will be injected

  constructor(aiModel?: any) {
    this.aiModel = aiModel;
  }

  async createPlan(prompt: string): Promise<TaskPlan> {
    console.log('📝 Planner: Analyzing prompt for task decomposition:', prompt);
    
    // Analyze complexity
    console.log('📝 Planner: Analyzing complexity...');
    const complexity = this.analyzeComplexity(prompt);
    console.log('📝 Planner: Complexity determined:', complexity);
    
    // Decompose into tasks
    console.log('📝 Planner: Starting task decomposition...');
    const tasks = await this.decomposeTasks(prompt, complexity);
    console.log(`📝 Planner: Decomposed into ${tasks.length} tasks:`, tasks.map(t => t.description));
    
    // Identify dependencies
    this.identifyDependencies(tasks);
    
    // Optimize execution order
    const optimizedTasks = this.optimizeTaskOrder(tasks);
    
    const plan: TaskPlan = {
      id: uuidv4(),
      originalPrompt: prompt,
      tasks: optimizedTasks,
      totalEstimatedTime: this.estimateTotalTime(optimizedTasks),
      complexity,
      parallelizable: this.canParallelize(optimizedTasks)
    };

    console.log(`📋 Plan created: ${tasks.length} tasks, complexity: ${complexity}`);
    return plan;
  }

  private analyzeComplexity(prompt: string): 'simple' | 'moderate' | 'complex' {
    const wordCount = prompt.split(/\s+/).length;
    const hasMultipleSteps = /\d+\.|step|first|then|next|finally/i.test(prompt);
    const hasTechnicalTerms = /api|database|deploy|test|implement|refactor/i.test(prompt);
    const hasFileOperations = /read|write|edit|create|delete|file/i.test(prompt);
    
    let complexityScore = 0;
    
    if (wordCount > 100) complexityScore += 2;
    else if (wordCount > 50) complexityScore += 1;
    
    if (hasMultipleSteps) complexityScore += 2;
    if (hasTechnicalTerms) complexityScore += 1;
    if (hasFileOperations) complexityScore += 1;
    
    if (complexityScore >= 4) return 'complex';
    if (complexityScore >= 2) return 'moderate';
    return 'simple';
  }

  private async decomposeTasks(prompt: string, complexity: string): Promise<Task[]> {
    if (complexity === 'simple') {
      return this.createSimpleTasks(prompt);
    }
    
    // For complex tasks, use AI to decompose if available
    if (this.aiModel) {
      return await this.aiDecomposition(prompt);
    }
    
    // Fallback to heuristic decomposition
    return this.heuristicDecomposition(prompt);
  }

  private createSimpleTasks(prompt: string): Task[] {
    return [{
      id: uuidv4(),
      description: prompt,
      dependencies: [],
      status: TaskStatus.PENDING,
      retryCount: 0,
      maxRetries: 2,
      timeoutMs: 30000,
      toolCalls: []
    }];
  }

  private async aiDecomposition(prompt: string): Promise<Task[]> {
    try {
      if (!this.aiModel) {
        return this.heuristicDecomposition(prompt);
      }
      
      // Create a decomposition prompt for the AI model
      const decompositionPrompt = `Break down this task into individual steps that can be executed:

${prompt}

Respond with a numbered list of specific tasks. Each task should be:
- A single, atomic action
- Clear and specific
- Include any dependencies

Example format:
1. Search for Bitcoin price information
2. Create btc-report.txt file with the price data

Now break down the given task:`;
      
      // Call the AI model (assuming it has a sendMessage method)
      let response = '';
      if (typeof this.aiModel.sendMessageStream === 'function') {
        // If it's a DeepSeek client, use streaming
        for await (const chunk of this.aiModel.sendMessageStream(decompositionPrompt)) {
          response += chunk;
        }
      } else if (typeof this.aiModel.complete === 'function') {
        // Generic completion method
        response = await this.aiModel.complete(decompositionPrompt);
      } else {
        // No suitable method found
        return this.heuristicDecomposition(prompt);
      }
      
      return this.parseAIResponse(response, prompt);
    } catch (error) {
      console.warn('AI decomposition failed, using heuristic', error);
      return this.heuristicDecomposition(prompt);
    }
  }

  private heuristicDecomposition(prompt: string): Task[] {
    const tasks: Task[] = [];
    
    // Common patterns
    const patterns = [
      { regex: /search\s+for\s+(\w+)/gi, template: 'Search for $1', timeout: 15000 },
      { regex: /read\s+(?:the\s+)?file\s+(\S+)/gi, template: 'Read file $1', timeout: 5000 },
      { regex: /write\s+(?:to\s+)?(?:the\s+)?file\s+(\S+)/gi, template: 'Write to file $1', timeout: 5000 },
      { regex: /create\s+(?:a\s+)?(?:new\s+)?(\w+)/gi, template: 'Create $1', timeout: 10000 },
      { regex: /test\s+(\w+)/gi, template: 'Test $1', timeout: 30000 },
      { regex: /deploy\s+(?:to\s+)?(\w+)/gi, template: 'Deploy to $1', timeout: 60000 },
      { regex: /install\s+(\S+)/gi, template: 'Install $1', timeout: 30000 },
      { regex: /run\s+(\S+)/gi, template: 'Run $1', timeout: 20000 },
      { regex: /analyze\s+(\w+)/gi, template: 'Analyze $1', timeout: 20000 },
      { regex: /fix\s+(?:the\s+)?(\w+)/gi, template: 'Fix $1', timeout: 30000 }
    ];

    // Extract tasks based on patterns
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(prompt)) !== null) {
        const description = pattern.template.replace('$1', match[1]);
        tasks.push({
          id: uuidv4(),
          description,
          dependencies: [],
          status: TaskStatus.PENDING,
          retryCount: 0,
          maxRetries: 2,
          timeoutMs: pattern.timeout,
          toolCalls: []
        });
      }
    }

    // If no patterns matched, create a single task
    if (tasks.length === 0) {
      tasks.push({
        id: uuidv4(),
        description: prompt.substring(0, 100),
        dependencies: [],
        status: TaskStatus.PENDING,
        retryCount: 0,
        maxRetries: 2,
        timeoutMs: 30000,
        toolCalls: []
      });
    }

    return tasks;
  }

  private identifyDependencies(tasks: Task[]): void {
    // Simple dependency detection based on task order and keywords
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      
      // Tasks that typically depend on previous ones
      if (task.description.toLowerCase().includes('test')) {
        // Tests usually depend on implementation
        for (let j = 0; j < i; j++) {
          if (tasks[j].description.toLowerCase().includes('create') ||
              tasks[j].description.toLowerCase().includes('implement')) {
            task.dependencies.push(tasks[j].id);
          }
        }
      }
      
      if (task.description.toLowerCase().includes('deploy')) {
        // Deploy depends on tests
        for (let j = 0; j < i; j++) {
          if (tasks[j].description.toLowerCase().includes('test')) {
            task.dependencies.push(tasks[j].id);
          }
        }
      }
      
      // File operations might depend on reads
      if (task.description.toLowerCase().includes('write') ||
          task.description.toLowerCase().includes('edit')) {
        for (let j = 0; j < i; j++) {
          if (tasks[j].description.toLowerCase().includes('read')) {
            const fileMatch = task.description.match(/(\S+\.\w+)/);
            const prevFileMatch = tasks[j].description.match(/(\S+\.\w+)/);
            if (fileMatch && prevFileMatch && fileMatch[1] === prevFileMatch[1]) {
              task.dependencies.push(tasks[j].id);
            }
          }
        }
      }
    }
  }

  private optimizeTaskOrder(tasks: Task[]): Task[] {
    // Topological sort based on dependencies
    const sorted: Task[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      if (visiting.has(taskId)) {
        console.warn('Circular dependency detected');
        return;
      }
      
      visiting.add(taskId);
      const task = tasks.find(t => t.id === taskId);
      
      if (task) {
        for (const dep of task.dependencies) {
          visit(dep);
        }
        visited.add(taskId);
        visiting.delete(taskId);
        sorted.push(task);
      }
    };
    
    for (const task of tasks) {
      visit(task.id);
    }
    
    return sorted;
  }

  private estimateTotalTime(tasks: Task[]): number {
    // Calculate based on dependencies and parallelization
    const taskTimes = new Map<string, number>();
    
    for (const task of tasks) {
      let startTime = 0;
      
      // Find the latest completion time of dependencies
      for (const dep of task.dependencies) {
        const depTime = taskTimes.get(dep) || 0;
        startTime = Math.max(startTime, depTime);
      }
      
      taskTimes.set(task.id, startTime + task.timeoutMs);
    }
    
    return Math.max(...Array.from(taskTimes.values()), 0);
  }

  private canParallelize(tasks: Task[]): boolean {
    // Check if there are independent tasks that can run in parallel
    const independentTasks = tasks.filter(t => t.dependencies.length === 0);
    return independentTasks.length > 1;
  }

  private parseAIResponse(response: string, originalPrompt: string): Task[] {
    const tasks: Task[] = [];
    
    // Parse numbered list from AI response
    const lines = response.split('\n');
    const taskPattern = /^\d+\.\s+(.+)/;
    
    for (const line of lines) {
      const match = line.match(taskPattern);
      if (match) {
        const description = match[1].trim();
        
        // Determine timeout based on task type
        let timeout = 30000; // default 30s
        if (description.toLowerCase().includes('search')) timeout = 15000;
        if (description.toLowerCase().includes('create') || description.toLowerCase().includes('write')) timeout = 10000;
        if (description.toLowerCase().includes('test')) timeout = 60000;
        
        tasks.push({
          id: uuidv4(),
          description,
          dependencies: [],
          status: TaskStatus.PENDING,
          retryCount: 0,
          maxRetries: 2,
          timeoutMs: timeout,
          toolCalls: []
        });
      }
    }
    
    // If no tasks were parsed, fall back to heuristic
    if (tasks.length === 0) {
      return this.heuristicDecomposition(originalPrompt);
    }
    
    // Identify dependencies based on task order and content
    this.identifyDependencies(tasks);
    
    return tasks;
  }
}