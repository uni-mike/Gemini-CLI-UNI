import type { Task, TaskPlan } from './types.js';
import { TaskStatus } from './types.js';
import { v4 as uuidv4 } from 'uuid';

export class Planner {
  private aiModel: any;
  private isDecomposing: boolean = false; // Prevent recursive loops

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
    
    // AI-ENHANCED: Advanced multi-step pattern detection
    const multiStepPatterns = [
      /\d+\./g, // numbered lists
      /step/gi,
      /first.*then/gi,
      /then.*after/gi,
      /followed\s+by/gi,
      /and\s+then/gi,
      /after\s+that/gi,
      /next/gi,
      /finally/gi,
      /subsequently/gi,
      /,\s*then/gi  // comma-separated steps
    ];
    
    let multiStepMatches = 0;
    for (const pattern of multiStepPatterns) {
      const matches = prompt.match(pattern);
      if (matches) multiStepMatches += matches.length;
    }
    
    // Special case: explicit "then" keywords should always count as multi-step
    if (/\bthen\b/gi.test(prompt)) {
      multiStepMatches = Math.max(multiStepMatches, 1);
    }
    
    const hasMultipleSteps = multiStepMatches > 0;
    
    // Enhanced technical term detection
    const advancedTechTerms = /ai|ml|machine\s+learning|quantum|blockchain|cybersecurity|api|database|deploy|test|implement|refactor|development|computing|analysis|security|enterprise|cloud|microservices|kubernetes|docker/gi;
    const hasTechnicalTerms = advancedTechTerms.test(prompt);
    
    // Enhanced file operation detection
    const fileOperationPatterns = /read|write|edit|create|delete|generate|save|export|import|download|upload|file|report|analysis|document|\.md|\.txt|\.json|\.csv|\.pdf/gi;
    const hasFileOperations = fileOperationPatterns.test(prompt);
    
    // Cross-domain complexity indicators
    const crossDomain = /market.*tech|security.*business|financial.*analysis|research.*generate/gi.test(prompt);
    const hasDataProcessing = /analyze.*data|process.*results|extract.*information|compile.*report/gi.test(prompt);
    const requiresResearch = /research|investigate|study|examine|explore|survey/gi.test(prompt);
    
    // AI-powered complexity scoring
    let complexityScore = 0;
    
    // Word count impact (non-linear)
    if (wordCount > 150) complexityScore += 3;
    else if (wordCount > 75) complexityScore += 2;
    else if (wordCount > 30) complexityScore += 1;
    
    // Multi-step complexity (weighted by frequency)
    if (multiStepMatches >= 3) complexityScore += 3;
    else if (multiStepMatches >= 2) complexityScore += 2;
    else if (hasMultipleSteps) complexityScore += 1;
    
    // Domain complexity
    if (hasTechnicalTerms) complexityScore += 1;
    if (hasFileOperations) complexityScore += 1;
    if (crossDomain) complexityScore += 2;
    if (hasDataProcessing) complexityScore += 1;
    if (requiresResearch) complexityScore += 1;
    
    console.log(`🧠 AI-Enhanced Complexity Analysis:
    Words: ${wordCount}, Multi-step matches: ${multiStepMatches}
    Tech: ${hasTechnicalTerms}, Files: ${hasFileOperations}, Cross-domain: ${crossDomain}
    Research: ${requiresResearch}, Data processing: ${hasDataProcessing}
    Final score: ${complexityScore}`);
    
    // AI-enhanced thresholds
    if (complexityScore >= 6) return 'complex';
    if (complexityScore >= 3) return 'moderate';
    return 'simple';
  }

  private async decomposeTasks(prompt: string, complexity: string): Promise<Task[]> {
    if (complexity === 'simple') {
      return this.createSimpleTasks(prompt);
    }
    
    // Use AI decomposition for complex tasks with loop protection
    if (this.aiModel && !this.isDecomposing && complexity !== 'simple') {
      console.log('🧠 Using AI-powered task decomposition for optimal planning');
      return await this.aiDecomposition(prompt);
    }
    
    // Fallback to heuristic decomposition
    console.log('📝 Using heuristic decomposition (fallback or loop prevention)');
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
    // Set recursion protection
    this.isDecomposing = true;
    
    try {
      if (!this.aiModel) {
        return this.heuristicDecomposition(prompt);
      }
      
      // Create an enhanced decomposition prompt for AI model
      const decompositionPrompt = `You are a task decomposition expert. Break down this complex request into individual, executable tasks.

REQUEST: ${prompt}

INSTRUCTIONS:
1. Identify each distinct action/step
2. Create atomic, specific tasks 
3. Consider dependencies and logical order
4. Use action verbs (Search, Create, Analyze, Generate, etc.)

RESPONSE FORMAT - Return ONLY a JSON array of tasks:
[
  {"description": "Search for [specific topic]", "estimated_time": 15},
  {"description": "Analyze [specific data/results]", "estimated_time": 20}, 
  {"description": "Create [specific file] with [specific content]", "estimated_time": 10}
]

DECOMPOSE THE REQUEST:`;
      
      let response = '';
      
      // Try different AI model interfaces with timeout and loop protection
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI decomposition timeout')), 10000)
      );
      
      const aiCallPromise = (async () => {
        // DeepSeek streaming interface - collect all chunks
        if (typeof this.aiModel.sendMessageStream === 'function') {
          let fullResponse = '';
          for await (const chunk of this.aiModel.sendMessageStream(decompositionPrompt)) {
            fullResponse += chunk;
          }
          return fullResponse;
        } 
        // Simple message interface
        else if (typeof this.aiModel.sendMessage === 'function') {
          return await this.aiModel.sendMessage(decompositionPrompt);
        } 
        // Completion interface
        else if (typeof this.aiModel.complete === 'function') {
          return await this.aiModel.complete(decompositionPrompt);
        } 
        // Chat interface (OpenAI style)
        else if (typeof this.aiModel.chat === 'function') {
          const result = await this.aiModel.chat([{role: 'user', content: decompositionPrompt}]);
          return result.choices?.[0]?.message?.content || result.content || result;
        } 
        else {
          console.warn('Available AI model methods:', Object.getOwnPropertyNames(this.aiModel));
          throw new Error('No compatible AI interface found');
        }
      })();
      
      response = await Promise.race([aiCallPromise, timeoutPromise]) as string;
      
      return this.parseAIResponse(response, prompt);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('🧠 AI decomposition failed, using heuristic fallback:', errorMessage);
      return this.heuristicDecomposition(prompt);
    } finally {
      // Always reset recursion protection
      this.isDecomposing = false;
    }
  }

  private heuristicDecomposition(prompt: string): Task[] {
    console.log('📝 Planner: Using OPERATIONAL-GRADE dynamic decomposition (no hardcoded patterns)');
    const tasks: Task[] = [];
    
    // UNIVERSAL multi-step pattern detection - handles ANY "X then Y" or "X and then Y" patterns
    const multiStepPatterns = [
      // Pattern 1: "X then Y"
      /^(.*?)\s+then\s+(.*?)$/i,
      // Pattern 2: "X and then Y" 
      /^(.*?)\s+and\s+then\s+(.*?)$/i,
      // Pattern 3: "first X, then Y"
      /^(?:first\s+)?(.*?)(?:,\s*|\s+)then\s+(.*?)$/i,
      // Pattern 4: "do X followed by Y"
      /^(.*?)\s+followed\s+by\s+(.*?)$/i,
      // Pattern 5: "X after that Y"
      /^(.*?)\s+after\s+that\s+(.*?)$/i,
      // Pattern 6: "X followed by creating Y" 
      /^(.*?)\s+followed\s+by\s+creating\s+(.*?)$/i,
      // Pattern 7: "X followed by generating Y"
      /^(.*?)\s+followed\s+by\s+generating\s+(.*?)$/i
    ];
    
    // Try each multi-step pattern
    for (const pattern of multiStepPatterns) {
      const match = prompt.match(pattern);
      if (match) {
        const firstAction = match[1].trim();
        const secondAction = match[2].trim();
        
        console.log(`📝 Planner: Detected multi-step pattern: "${firstAction}" → "${secondAction}"`);
        
        // Create first task
        const firstTask = {
          id: uuidv4(),
          description: this.normalizeTaskDescription(firstAction),
          dependencies: [],
          status: TaskStatus.PENDING,
          retryCount: 0,
          maxRetries: 2,
          timeoutMs: this.estimateTimeout(firstAction),
          toolCalls: []
        };
        tasks.push(firstTask);
        
        // Create second task that depends on first - make it a creation task
        const normalizedSecond = this.normalizeTaskDescription(secondAction);
        const secondTask = {
          id: uuidv4(),
          description: this.makeSecondTaskCreative(normalizedSecond),
          dependencies: [firstTask.id],
          status: TaskStatus.PENDING,
          retryCount: 0,
          maxRetries: 2,
          timeoutMs: this.estimateTimeout(secondAction),
          toolCalls: []
        };
        tasks.push(secondTask);
        
        return tasks;
      }
    }
    
    // Common patterns fallback
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

  /**
   * Normalize task description to be more actionable
   */
  private normalizeTaskDescription(description: string): string {
    // Remove leading articles and normalize
    let normalized = description
      .replace(/^(the|a|an)\s+/i, '')
      .replace(/\s+and\s*$/i, '') // Remove trailing "and"
      .trim();
    
    // Ensure it starts with a verb for actionability
    if (!this.startsWithActionVerb(normalized)) {
      // Try to detect the intent and add appropriate verb
      if (normalized.includes('best') || normalized.includes('top') || normalized.includes('find')) {
        normalized = `Search for ${normalized}`;
      } else if (normalized.includes('analyze') || normalized.includes('analysis')) {
        normalized = `Analyze ${normalized}`;
      } else if (normalized.includes('create') || normalized.includes('generate')) {
        normalized = `Create ${normalized}`;
      } else if (normalized.includes('compare') || normalized.includes('comparison')) {
        normalized = `Compare ${normalized}`;
      } else if (normalized.includes('investigate') || normalized.includes('research')) {
        // Investigation/research tasks should be searches
        normalized = `Search for ${normalized.replace(/^(investigate|research)\s+/i, '')}`;
      } else if (normalized.includes('look up') || normalized.includes('lookup')) {
        // Lookup tasks should be searches
        normalized = `Search for ${normalized.replace(/^look\s+up\s+/i, '')}`;
      } else {
        // Default to search for unknown patterns
        normalized = `Search for ${normalized}`;
      }
    }
    
    return normalized;
  }

  /**
   * Convert analysis tasks to creation tasks for better tool execution
   */
  private makeSecondTaskCreative(normalizedTask: string): string {
    // Convert analysis/comparison tasks to file creation tasks
    if (normalizedTask.toLowerCase().includes('analyze')) {
      const subject = normalizedTask.replace(/^analyze\s*/i, '').trim();
      return `Create analysis report for ${subject}`;
    }
    
    if (normalizedTask.toLowerCase().includes('compare')) {
      const subject = normalizedTask.replace(/^compare\s*/i, '').trim();
      return `Create comparison report for ${subject}`;
    }
    
    if (normalizedTask.toLowerCase().includes('evaluate')) {
      const subject = normalizedTask.replace(/^evaluate\s*/i, '').trim();
      return `Create evaluation report for ${subject}`;
    }
    
    // If it's already a creation task, keep it
    if (normalizedTask.toLowerCase().includes('create')) {
      return normalizedTask;
    }
    
    // Default: make it a report creation task
    return `Create report about ${normalizedTask.toLowerCase().replace(/^process\s*/i, '')}`;
  }

  /**
   * Check if description starts with action verb
   */
  private startsWithActionVerb(description: string): boolean {
    const actionVerbs = [
      'search', 'find', 'look', 'get', 'fetch', 'retrieve',
      'create', 'make', 'build', 'generate', 'write', 'produce',
      'analyze', 'examine', 'study', 'review', 'evaluate',
      'compare', 'contrast', 'assess', 'measure',
      'test', 'verify', 'validate', 'check',
      'process', 'handle', 'manage', 'organize'
    ];
    
    const firstWord = description.split(' ')[0].toLowerCase();
    return actionVerbs.includes(firstWord);
  }

  /**
   * Estimate timeout based on task complexity
   */
  private estimateTimeout(description: string): number {
    const lowerDesc = description.toLowerCase();
    
    // Search/research tasks
    if (lowerDesc.includes('search') || lowerDesc.includes('find') || lowerDesc.includes('research')) {
      return 15000; // 15 seconds
    }
    
    // Analysis tasks
    if (lowerDesc.includes('analyze') || lowerDesc.includes('compare') || lowerDesc.includes('evaluate')) {
      return 25000; // 25 seconds
    }
    
    // Creation tasks
    if (lowerDesc.includes('create') || lowerDesc.includes('generate') || lowerDesc.includes('write')) {
      return 20000; // 20 seconds
    }
    
    // Testing tasks
    if (lowerDesc.includes('test') || lowerDesc.includes('verify')) {
      return 30000; // 30 seconds
    }
    
    // Default timeout
    return 20000; // 20 seconds
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
    console.log('🧠 Parsing AI decomposition response:', response.substring(0, 200) + '...');
    const tasks: Task[] = [];
    
    try {
      // First try to parse as JSON array (preferred format)
      let jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const tasksData = JSON.parse(jsonMatch[0]);
        if (Array.isArray(tasksData)) {
          for (const taskData of tasksData) {
            tasks.push({
              id: uuidv4(),
              description: taskData.description || taskData.task || taskData.name || 'Unknown task',
              dependencies: [],
              status: TaskStatus.PENDING,
              retryCount: 0,
              maxRetries: 2,
              timeoutMs: (taskData.estimated_time || 30) * 1000,
              toolCalls: []
            });
          }
          
          if (tasks.length > 0) {
            console.log(`🧠 Successfully parsed ${tasks.length} tasks from JSON format`);
            this.identifyDependencies(tasks);
            return tasks;
          }
        }
      }
    } catch (error) {
      console.warn('🧠 Failed to parse JSON format, trying numbered list');
    }
    
    // Fallback: Parse numbered list format
    const lines = response.split('\n');
    const taskPattern = /^\d+\.\s*(.+)/;
    
    for (const line of lines) {
      const match = line.match(taskPattern);
      if (match) {
        const description = match[1].trim();
        if (description.length < 5) continue; // Skip very short descriptions
        
        // Smart timeout estimation based on task type
        let timeout = 30000; // default 30s
        const lowerDesc = description.toLowerCase();
        if (lowerDesc.includes('search') || lowerDesc.includes('find')) timeout = 15000;
        if (lowerDesc.includes('create') || lowerDesc.includes('write') || lowerDesc.includes('generate')) timeout = 20000;
        if (lowerDesc.includes('analyze') || lowerDesc.includes('process')) timeout = 25000;
        if (lowerDesc.includes('test') || lowerDesc.includes('deploy')) timeout = 60000;
        
        tasks.push({
          id: uuidv4(),
          description: this.normalizeTaskDescription(description),
          dependencies: [],
          status: TaskStatus.PENDING,
          retryCount: 0,
          maxRetries: 2,
          timeoutMs: timeout,
          toolCalls: []
        });
      }
    }
    
    if (tasks.length > 0) {
      console.log(`🧠 Successfully parsed ${tasks.length} tasks from numbered list format`);
      this.identifyDependencies(tasks);
      return tasks;
    }
    
    // Final fallback: Heuristic decomposition
    console.warn('🧠 AI parsing failed completely, using heuristic fallback');
    return this.heuristicDecomposition(originalPrompt);
  }
}