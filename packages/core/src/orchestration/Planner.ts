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
    
    // ALWAYS use AI decomposition for non-simple tasks
    if (this.aiModel && !this.isDecomposing && complexity !== 'simple') {
      console.log('🧠 Using AI-powered task decomposition');
      const aiTasks = await this.aiDecomposition(prompt);
      
      // Only fall back if AI completely failed
      if (aiTasks.length === 0) {
        console.error('❌ AI decomposition failed completely, using emergency fallback');
        // Emergency fallback - at least split on "then"
        const parts = prompt.split(/\s+then\s+/i);
        return parts.map((part, index) => ({
          id: uuidv4(),
          description: part.trim(),
          dependencies: index > 0 ? [parts[index-1]] : [],
          status: TaskStatus.PENDING,
          retryCount: 0,
          maxRetries: 2,
          timeoutMs: 30000,
          toolCalls: []
        }));
      }
      
      return aiTasks;
    }
    
    // For simple tasks, just create one task
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

  private async createSimpleTasks(prompt: string): Promise<Task[]> {
    // Start with a single task
    const initialTask: Task = {
      id: uuidv4(),
      description: prompt,
      dependencies: [],
      status: TaskStatus.PENDING,
      retryCount: 0,
      maxRetries: 2,
      timeoutMs: 30000,
      toolCalls: []
    };
    
    // Use recursive decomposition to ensure it's truly atomic
    const atomicTasks = await this.ensureAtomicTasks([initialTask]);
    
    return atomicTasks;
  }

  private async aiDecomposition(prompt: string): Promise<Task[]> {
    // Set recursion protection
    this.isDecomposing = true;
    
    try {
      if (!this.aiModel) {
        return await this.createSimpleTasks(prompt);
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
        setTimeout(() => reject(new Error('AI decomposition timeout')), 30000)  // 30 seconds for complex prompts
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
      
      return await this.parseAIResponse(response, prompt);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('🧠 AI decomposition failed, will retry with simpler prompt:', errorMessage);
      
      // Retry with simpler prompt
      try {
        const simplePrompt = `Break this into steps: ${prompt}`;
        const response = await this.aiModel.sendMessageStream(simplePrompt);
        let fullResponse = '';
        for await (const chunk of response) {
          fullResponse += chunk;
        }
        return await this.parseAIResponse(fullResponse, prompt);
      } catch (retryError) {
        // Return empty array - will be handled by caller
        console.error('🧠 AI decomposition retry also failed:', retryError);
        return [];
      }
    } finally {
      // Always reset recursion protection
      this.isDecomposing = false;
    }
  }

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

  private async parseAIResponse(response: string, originalPrompt: string): Promise<Task[]> {
    console.log('🧠 Parsing AI decomposition response:', response.substring(0, 200) + '...');
    const tasks: Task[] = [];
    
    // First, strip DeepSeek thinking tags if present
    let cleanResponse = response;
    if (response.includes('<think>')) {
      // Extract content after thinking process
      const afterThink = response.split('</think>').pop() || response;
      cleanResponse = afterThink.trim();
      
      // Also try to extract from thinking content if it contains steps
      const thinkContent = response.match(/<think>([\s\S]*?)<\/think>/)?.[1] || '';
      if (thinkContent.includes('Steps:') || thinkContent.includes('1.')) {
        const stepsMatch = thinkContent.match(/Steps:[\s\S]*/)?.[0] || thinkContent;
        cleanResponse = stepsMatch;
      }
    }
    
    // Helper to clean task descriptions
    const cleanTaskDescription = (desc: string): string => {
      // Remove step numbers at start
      desc = desc.replace(/^(?:step\s+)?\d+[\.:]\s*/i, '');
      // Remove trailing metadata like "-> This is a distinct step"
      desc = desc.replace(/\s*->\s*.*$/i, '');
      // Remove dependency notes
      desc = desc.replace(/\s*\(.*?depends on.*?\)/gi, '');
      desc = desc.replace(/\s*This depends on.*$/i, '');
      // Remove time estimates
      desc = desc.replace(/\s*\d+\s*minutes?.*$/i, '');
      // Remove parenthetical notes
      desc = desc.replace(/\s*\([^)]*\)/g, '');
      // Clean up quotes
      desc = desc.replace(/^["']|["']$/g, '');
      // Normalize whitespace
      desc = desc.replace(/\s+/g, ' ').trim();
      return desc;
    };
    
    try {
      // First try to parse as JSON array (preferred format)
      let jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const tasksData = JSON.parse(jsonMatch[0]);
        if (Array.isArray(tasksData)) {
          for (const taskData of tasksData) {
            const rawDesc = taskData.description || taskData.task || taskData.name || 'Unknown task';
            tasks.push({
              id: uuidv4(),
              description: cleanTaskDescription(rawDesc),
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
    
    // Parse numbered list format (also handle cleaned response)
    const lines = cleanResponse.split('\n');
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
          description: cleanTaskDescription(description),
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
      
      // RECURSIVE DECOMPOSITION - ensure all tasks are atomic
      const atomicTasks = await this.ensureAtomicTasks(tasks);
      
      this.identifyDependencies(atomicTasks);
      return atomicTasks;
    }
    
    // If AI fails, create a single task and let AI recovery handle it
    console.warn('🧠 AI parsing failed, creating single task for AI recovery');
    const singleTask: Task = {
      id: uuidv4(),
      description: originalPrompt,
      dependencies: [],
      status: TaskStatus.PENDING,
      retryCount: 0,
      maxRetries: 3,
      timeoutMs: 60000,
      toolCalls: []
    };
    
    // Still ensure it's atomic
    const atomicTasks = await this.ensureAtomicTasks([singleTask]);
    this.identifyDependencies(atomicTasks);
    return atomicTasks;
  }
  
  /**
   * Ensure all tasks are atomic by recursively decomposing compound tasks
   */
  private async ensureAtomicTasks(tasks: Task[]): Promise<Task[]> {
    const atomicTasks: Task[] = [];
    
    for (const task of tasks) {
      // Check if task contains multiple steps
      if (this.isCompoundTask(task.description)) {
        console.log(`🔄 Decomposing compound task: ${task.description.substring(0, 100)}...`);
        
        // Recursively decompose this task
        const subtasks = await this.decomposeCompoundTask(task);
        
        // Recursively ensure subtasks are also atomic
        const atomicSubtasks = await this.ensureAtomicTasks(subtasks);
        
        atomicTasks.push(...atomicSubtasks);
      } else {
        // Task is already atomic
        atomicTasks.push(task);
      }
    }
    
    return atomicTasks;
  }
  
  /**
   * Check if a task description contains multiple steps
   */
  private isCompoundTask(description: string): boolean {
    const compoundIndicators = [
      /\bthen\b/i,
      /\bafter that\b/i,
      /\bfinally\b/i,
      /\bfollowed by\b/i,
      /\bnext\b/i,
      /\bsubsequently\b/i,
      /\b,\s*(then|after|finally)\b/i
    ];
    
    return compoundIndicators.some(pattern => pattern.test(description));
  }
  
  /**
   * Decompose a compound task into atomic subtasks
   */
  private async decomposeCompoundTask(task: Task): Promise<Task[]> {
    const subtasks: Task[] = [];
    const description = task.description;
    
    // Split on common conjunctions while preserving order
    const parts = description.split(/\s+(?:then|after that|finally|followed by|next|subsequently)\s+/i);
    
    if (parts.length > 1) {
      let previousTaskId: string | null = null;
      
      for (const part of parts) {
        const cleanPart = part.trim();
        if (cleanPart.length < 3) continue; // Skip empty parts
        
        const subtaskId = uuidv4();
        subtasks.push({
          id: subtaskId,
          description: cleanPart,
          dependencies: previousTaskId ? [previousTaskId] : task.dependencies,
          status: TaskStatus.PENDING,
          retryCount: 0,
          maxRetries: task.maxRetries,
          timeoutMs: this.estimateTimeout(cleanPart),
          toolCalls: []
        });
        previousTaskId = subtaskId;
      }
    } else {
      // Also split on commas if they separate distinct actions
      const commaParts = description.split(/,\s+(?=\w+\s+)/);
      
      if (commaParts.length > 1) {
        for (const part of commaParts) {
          const cleanPart = part.trim();
          if (cleanPart.length < 3) continue;
          
          subtasks.push({
            id: uuidv4(),
            description: cleanPart,
            dependencies: task.dependencies,
            status: TaskStatus.PENDING,
            retryCount: 0,
            maxRetries: task.maxRetries,
            timeoutMs: this.estimateTimeout(cleanPart),
            toolCalls: []
          });
        }
      } else {
        // Task is actually atomic, return as is
        return [task];
      }
    }
    
    return subtasks.length > 0 ? subtasks : [task];
  }
  
}