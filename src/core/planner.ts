/**
 * Planner - Analyzes prompts and creates execution plans
 * Part of the orchestration Trio: Planner -> Executor -> Orchestrator
 */

import { EventEmitter } from 'events';
import { DeepSeekClient } from '../llm/deepseek-client.js';
import { globalRegistry } from '../tools/registry.js';
import { Tool } from '../tools/base.js';
import { PromptTemplates } from '../prompts/prompts.js';
import { MemoryManager } from '../memory/memory-manager.js';

export interface Task {
  id: string;
  description: string;
  type: 'simple' | 'tool' | 'multi-step';
  tools?: string[];
  arguments?: Record<string, any>; // AI-provided arguments for each tool
  dependencies?: string[];
  priority: number;
  command?: string; // Optional direct command for bash tasks
  file_path?: string; // Optional direct file path for file operations
}

export interface TaskPlan {
  id: string;
  originalPrompt: string;
  tasks: Task[];
  complexity: 'simple' | 'moderate' | 'complex';
  parallelizable: boolean;
  isConversation?: boolean;
  conversationResponse?: string;
}

export class Planner extends EventEmitter {
  private client: DeepSeekClient;
  private memoryManager: MemoryManager | null = null;

  constructor(config?: any) {
    super();
    this.client = new DeepSeekClient({
      model: config?.getModel() || 'DeepSeek-V3.1', // Ensure correct model is used
      timeout: 120000 // 120 seconds for complex prompts - matches orchestrator/executor
    });

    // Forward token usage events from DeepSeek client
    this.client.on('token-usage', (usage: any) => {
      console.log('📊 [PLANNER] Token usage from DeepSeek:', usage);
      this.emit('token-usage', usage);
    });

    // Handle retry events for better user feedback
    this.client.on('retry', (data: any) => {
      this.emit('status', `🔄 Planning API retry (${data.attempt}/${data.maxRetries})...`);
    });

    // Handle timeout events
    this.client.on('timeout', (data: any) => {
      this.emit('status', `⏱️ Planning timeout - ${data.message}`);
    });

    // Handle error events with proper feedback
    this.client.on('error', (error: any) => {
      if (!error.willRetry) {
        this.emit('status', `❌ Planning error: ${error.message}`);
      }
    });
  }

  /**
   * Set memory manager for context-aware planning
   */
  setMemoryManager(memoryManager: MemoryManager): void {
    this.memoryManager = memoryManager;
  }

  async createPlan(prompt: string): Promise<TaskPlan> {
    this.emit('planning-start', { prompt });
    this.emit('status', '🤔 Analyzing request...');

    // Use memory context if available for better planning
    let contextualPrompt = prompt;
    if (this.memoryManager) {
      try {
        const promptComponents = await this.memoryManager.buildPrompt(prompt);
        // Add context for better task decomposition
        contextualPrompt = `${promptComponents.ephemeral}\n\n${promptComponents.knowledge}\n\nRequest: ${prompt}`;
      } catch (error) {
        console.warn('Failed to build memory context for planning:', error);
        // Continue with original prompt
      }
    }
    
    try {
      // Get all available tools from registry
      const availableTools = globalRegistry.getTools();

      // Use enhanced JSON approach with forced JSON output
      // Pass tools to the prompt instead of as function parameters
      const taskPlanResponse = await this.client.chat(
        [{ role: 'user', content: PromptTemplates.taskDecomposition(contextualPrompt, availableTools) }],
        [], // Don't pass tools as functions - we inject them in the prompt
        true // forceJson = true
      );
      
      if (process.env.DEBUG === 'true') {
        console.log('🔍 Task decomposition JSON response:', taskPlanResponse);
      }
      
      // Parse structured JSON response with retry logic
      let parsedPlan: any;
      try {
        parsedPlan = JSON.parse(taskPlanResponse);
      } catch (parseError) {
        console.error('❌ Failed to parse JSON on first attempt:', parseError);
        console.log('🔍 Raw response:', taskPlanResponse);

        // Try a simpler retry prompt without asking DeepSeek to think about design vs implementation
        console.log('🔄 Retrying with simplified prompt...');
        const simplePrompt = `TASK: ${contextualPrompt}\n\nCreate a JSON plan with this exact format:\n{"type":"tasks","plan":[{"id":"step1","description":"action","tool":"write_file","file_path":"exact/path","content":"file content"}]}\n\nReturn ONLY valid JSON, no explanations:`;

        const retryResponse = await this.client.chat(
          [{ role: 'user', content: simplePrompt }],
          [],
          true
        );

        try {
          parsedPlan = JSON.parse(retryResponse);
          console.log('✅ Retry successful');
        } catch (retryError) {
          console.error('❌ Retry also failed:', retryError);
          console.log('🔍 Retry response:', retryResponse);
          throw new Error('DeepSeek returned invalid JSON after retry');
        }
      }
      
      // Handle conversation vs. task response
      if (parsedPlan.type === 'conversation') {
        // Return a special conversation plan
        return {
          id: `conversation_${Date.now()}`,
          originalPrompt: prompt,
          tasks: [],
          complexity: 'simple' as const,
          parallelizable: true,
          isConversation: true,
          conversationResponse: parsedPlan.response
        };
      }
      
      // Handle both old 'tasks' and new 'plan' format for backward compatibility
      const taskArray = parsedPlan.tasks || parsedPlan.plan;
      if (!taskArray || !Array.isArray(taskArray)) {
        throw new Error('Invalid JSON structure - missing tasks/plan array');
      }

      // Convert to internal Task format
      const tasks = this.convertJsonToTasks(taskArray);
      
      // Identify dependencies
      this.identifyDependencies(tasks);
      
      const plan: TaskPlan = {
        id: `plan_${Date.now()}`,
        originalPrompt: prompt,
        tasks,
        complexity: this.analyzeComplexity(prompt),
        parallelizable: this.canParallelize(tasks)
      };
      
      this.emit('status', `📋 Created plan with ${tasks.length} task${tasks.length !== 1 ? 's' : ''}`);
      this.emit('planning-complete', plan);
      return plan;
      
    } catch (error) {
      // NEVER USE EMERGENCY FALLBACK! Let the orchestrator handle failures by rerouting to AI.
      // Proper error handling: throw error back to orchestrator for AI-based retry/rerouting
      console.error('Planning failed - rerouting to orchestrator for AI-based retry:', error);
      throw error; // Orchestrator should handle this with proper AI-based recovery
    }
  }
  
  private parsePlanResponse(response: string): any {
    try {
      // Extract JSON from response - handle code blocks too
      const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || 
                        response.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonStr);
        
        if (process.env.DEBUG === 'true') {
          console.log('🔍 Parsed plan data:', JSON.stringify(parsed, null, 2));
        }
        
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse plan JSON:', e);
      if (process.env.DEBUG === 'true') {
        console.warn('Response was:', response);
      }
    }
    
    // DeepSeek failed to provide JSON - use the fallback planner
    console.warn('⚠️ DeepSeek did not provide valid JSON plan, using fallback planner');
    return null; // Will trigger createBasicPlan
  }
  
  private createBasicPlan(prompt: string): TaskPlan {
    // Fallback basic planning
    const complexity = this.analyzeComplexity(prompt);
    const tasks = this.decomposeTasks(prompt, complexity);
    this.identifyDependencies(tasks);
    
    return {
      id: `plan_${Date.now()}`,
      originalPrompt: prompt,
      tasks,
      complexity,
      parallelizable: this.canParallelize(tasks)
    };
  }

  private analyzeComplexity(prompt: string): 'simple' | 'moderate' | 'complex' {
    const wordCount = prompt.split(/\s+/).length;
    
    // Multi-step indicators
    const multiStepIndicators = [
      'then', 'after', 'next', 'finally', 'and then',
      'first', 'second', 'third', 'lastly'
    ];
    
    const hasMultipleSteps = multiStepIndicators.some(indicator => 
      prompt.toLowerCase().includes(indicator)
    );
    
    // Tool indicators
    const toolIndicators = [
      'create', 'write', 'read', 'execute', 'run',
      'search', 'fetch', 'modify', 'edit', 'check'
    ];
    
    const needsTools = toolIndicators.some(indicator => 
      prompt.toLowerCase().includes(indicator)
    );
    
    if (hasMultipleSteps || (needsTools && wordCount > 20)) {
      return 'complex';
    } else if (needsTools || wordCount > 15) {
      return 'moderate';
    }
    return 'simple';
  }

  private decomposeTasks(prompt: string, complexity: string): Task[] {
    const tasks: Task[] = [];
    
    // Simple response - no tools needed
    if (complexity === 'simple' && !this.needsTools(prompt)) {
      tasks.push({
        id: `task_${Date.now()}`,
        description: prompt,
        type: 'simple',
        priority: 1
      });
      return tasks;
    }
    
    // Extract individual operations from prompt
    const operations = this.extractOperations(prompt);
    
    operations.forEach((op, index) => {
      const tools = this.identifyRequiredTools(op);
      tasks.push({
        id: `task_${Date.now()}_${index}`,
        description: op,
        type: tools.length > 0 ? 'tool' : 'simple',
        tools,
        priority: index + 1
      });
    });
    
    // If no specific operations found, create single task
    if (tasks.length === 0) {
      const tools = this.identifyRequiredTools(prompt);
      tasks.push({
        id: `task_${Date.now()}`,
        description: prompt,
        type: tools.length > 0 ? 'tool' : 'simple',
        tools,
        priority: 1
      });
    }
    
    return tasks;
  }

  private extractOperations(prompt: string): string[] {
    const operations: string[] = [];
    
    // Split by common separators
    const separators = [
      ' then ',
      ' and then ',
      ', then ',
      '. Then ',
      ' after that ',
      ' next ',
      ' finally '
    ];
    
    let remaining = prompt;
    for (const sep of separators) {
      if (remaining.includes(sep)) {
        const parts = remaining.split(sep);
        if (parts.length > 1) {
          operations.push(parts[0]);
          remaining = parts.slice(1).join(sep);
        }
      }
    }
    
    // Add remaining part
    if (remaining && remaining.trim() !== prompt) {
      operations.push(remaining);
    }
    
    // If no splitting occurred, return original
    if (operations.length === 0) {
      return [prompt];
    }
    
    return operations;
  }

  private identifyRequiredTools(operation: string): string[] {
    // Basic tool identification based on keywords
    const tools: string[] = [];
    const op = operation.toLowerCase();
    
    // File operations
    if (op.includes('create') || op.includes('write') || op.includes('save')) {
      tools.push('file');
    }
    if (op.includes('read') || op.includes('open') || op.includes('load') || op.includes('list')) {
      tools.push('file');
    }
    
    // Shell operations
    if (op.includes('execute') || op.includes('run') || op.includes('command') || 
        op.includes('ls') || op.includes('npm') || op.includes('node')) {
      tools.push('bash');
    }
    
    // Edit operations
    if (op.includes('edit') || op.includes('modify') || op.includes('change') || 
        op.includes('update') || op.includes('replace')) {
      tools.push('edit');
    }
    
    // Search operations
    if (op.includes('search') || op.includes('find') || op.includes('grep')) {
      tools.push('grep');
    }
    
    // Web operations
    if (op.includes('web') || op.includes('internet') || op.includes('online') || 
        op.includes('fetch') || op.includes('download') || 
        op.includes('price') || op.includes('current') || op.includes('latest')) {
      tools.push('web');
    }
    
    // Git operations
    if (op.includes('git') || op.includes('commit') || op.includes('push') || 
        op.includes('pull') || op.includes('branch')) {
      tools.push('git');
    }
    
    return [...new Set(tools)]; // Remove duplicates
  }

  private needsTools(prompt: string): boolean {
    return this.identifyRequiredTools(prompt).length > 0;
  }

  private identifyDependencies(tasks: Task[]): void {
    // Simple dependency detection - tasks depend on previous tasks
    for (let i = 1; i < tasks.length; i++) {
      const currentTask = tasks[i];
      const previousTask = tasks[i - 1];
      
      // If current task mentions result/output/it, depends on previous
      if (currentTask.description.toLowerCase().includes('it') ||
          currentTask.description.toLowerCase().includes('result') ||
          currentTask.description.toLowerCase().includes('output')) {
        currentTask.dependencies = [previousTask.id];
      }
    }
  }

  private canParallelize(tasks: Task[]): boolean {
    // Can parallelize if no dependencies
    return tasks.every(task => !task.dependencies || task.dependencies.length === 0);
  }
  
  private parseTaskList(response: string): string[] {
    // Parse natural language task list from DeepSeek
    const lines = response.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // Extract numbered or bulleted tasks
    const tasks: string[] = [];
    
    for (const line of lines) {
      // Match patterns like "1. Task", "- Task", "* Task"
      const match = line.match(/^(?:\d+\.|[-*•])\s*(.+)$/);
      if (match) {
        tasks.push(match[1].trim());
      } else if (line.length > 10 && !line.includes('example') && !line.includes('becomes:')) {
        // Include any reasonable-length line that's not an example
        tasks.push(line);
      }
    }
    
    // Fallback if no structured tasks found
    if (tasks.length === 0) {
      tasks.push('Complete the requested task');
    }
    
    return tasks;
  }
  
  private async createStructuredTasks(descriptions: string[]): Promise<Task[]> {
    const tasks: Task[] = [];
    
    for (let i = 0; i < descriptions.length; i++) {
      const description = descriptions[i];
      const tools = this.identifyRequiredTools(description);
      
      // Generate appropriate arguments based on tools
      let taskArgs: Record<string, any> = {};
      
      if (tools.includes('file')) {
        // Extract filename from description
        const filename = this.extractFilename(description);
        taskArgs.file = {
          action: 'write',
          path: filename,
          content: '' // Will be filled by executor
        };
      }
      
      if (tools.includes('bash')) {
        taskArgs.bash = {
          command: this.extractCommand(description)
        };
      }
      
      tasks.push({
        id: `task_${Date.now()}_${i}`,
        description,
        type: tools.length > 0 ? 'tool' : 'simple',
        tools,
        arguments: taskArgs,
        priority: i + 1
      });
    }
    
    return tasks;
  }
  
  private extractFilename(description: string): string {
    // Extract filename from task description
    const patterns = [
      /create\s+([a-zA-Z0-9_.-]+\.[a-zA-Z]{2,4})/i,
      /([a-zA-Z0-9_.-]+\.json)/i,
      /([a-zA-Z0-9_.-]+\.js)/i,
      /([a-zA-Z0-9_.-]+\.ts)/i,
      /package\.json/i,
      /server\.js/i,
      /readme\.md/i
    ];
    
    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }
    
    // Fallback filename
    if (description.toLowerCase().includes('package')) return 'package.json';
    if (description.toLowerCase().includes('server')) return 'server.js';
    if (description.toLowerCase().includes('auth')) return 'auth.js';
    if (description.toLowerCase().includes('middleware')) return 'middleware/auth.js';
    if (description.toLowerCase().includes('route')) return 'routes/api.js';
    
    return 'file.js';
  }
  
  private extractCommand(description: string): string {
    // Extract bash command from description
    if (description.toLowerCase().includes('install')) return 'npm install';
    if (description.toLowerCase().includes('run')) return 'npm run start';
    if (description.toLowerCase().includes('test')) return 'npm test';
    if (description.toLowerCase().includes('list') || description.toLowerCase().includes('check')) return 'ls -la';
    
    return 'echo "Task completed"';
  }
  
  private convertJsonToTasks(jsonTasks: any[]): Task[] {
    // Convert JSON tasks to internal Task format
    return jsonTasks.map((jsonTask, index) => {
      // CRITICAL FIX: Handle both DeepSeek formats - 'tool' field (preferred) and legacy 'type' field
      const specifiedTool = jsonTask.tool; // DeepSeek provides this directly
      const tools = jsonTask.tools || (specifiedTool ? [specifiedTool] : this.identifyRequiredTools(jsonTask.description));

      // Build arguments based on task type and tools
      let taskArgs: Record<string, any> = {};

      if (process.env.DEBUG === 'true') {
        console.log(`🔍 Converting task: tool="${specifiedTool}", type="${jsonTask.type}", inferred tools: [${tools.join(', ')}]`);
      }

      // Handle bash/command tasks - check both 'tool' and legacy 'type' fields
      if ((specifiedTool === 'bash' || jsonTask.type === 'command') && (tools.includes('bash') || specifiedTool === 'bash')) {
        taskArgs.bash = {
          command: jsonTask.command || this.extractCommand(jsonTask.description)
        };
        // Ensure bash is in tools array
        if (!tools.includes('bash')) {
          tools.push('bash');
        }
      }

      // Handle write_file tasks - check both 'tool' and legacy 'type' fields
      if ((specifiedTool === 'write_file' || jsonTask.type === 'file') && (tools.includes('write_file') || specifiedTool === 'write_file')) {
        taskArgs.write_file = {
          file_path: jsonTask.file_path || jsonTask.filename || this.extractFilename(jsonTask.description),
          content: jsonTask.content || null // Use provided content or trigger generation
        };
        // Ensure write_file is in tools array
        if (!tools.includes('write_file')) {
          tools.push('write_file');
        }
      }

      // Handle generic file tasks (fallback)
      if ((specifiedTool === 'file' || jsonTask.type === 'file') && tools.includes('file')) {
        taskArgs.file = {
          action: 'write',
          path: jsonTask.filename || this.extractFilename(jsonTask.description),
          content: jsonTask.content || null // Use provided content or trigger generation
        };
      }

      if (process.env.DEBUG === 'true') {
        console.log(`🔍 Final task arguments:`, JSON.stringify(taskArgs, null, 2));
      }

      return {
        id: `task_${Date.now()}_${index}`,
        description: jsonTask.description,
        type: tools.length > 0 ? 'tool' : 'simple',
        tools,
        arguments: taskArgs,
        priority: index + 1
      } as Task;
    });
  }
  
  // EMERGENCY FALLBACK METHODS REMOVED!
  // DO NOT ADD createEmergencyPlan() OR ANY HARDCODED FALLBACK METHODS!
  //
  // Proper error handling flow:
  // 1. Planner fails -> throw error to orchestrator
  // 2. Orchestrator catches error -> retry with different prompt/approach via AI
  // 3. If retry fails -> orchestrator can try alternative AI models or simpler prompts
  // 4. Never use hardcoded/rule-based fallbacks - always route through AI agents
  //
  // This ensures the system remains autonomous and AI-driven at all levels.
}