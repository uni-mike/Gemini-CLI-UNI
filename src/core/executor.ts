/**
 * Executor - Executes tasks using tools
 * Part of the orchestration Trio: Planner -> Executor -> Orchestrator
 */

import { EventEmitter } from 'events';
import { Task, TaskPlan } from './planner.js';
import { globalRegistry } from '../tools/registry.js';
import { DeepSeekClient } from '../llm/deepseek-client.js';

export interface ExecutionContext {
  workingDirectory: string;
  environment: Record<string, string>;
  previousResults?: any[];
  
  // Complete action tracking to prevent duplicates and maintain state
  createdFiles: string[];           // Files created
  modifiedFiles: string[];          // Files modified
  deletedFiles: string[];           // Files deleted
  executedCommands: string[];       // Bash commands executed
  webSearches: string[];            // Web searches performed
  toolExecutions: Map<string, any>; // All tool executions with results
  
  taskHistory: Array<{              // Complete task execution history
    taskId: string;
    description: string;
    timestamp: Date;
    toolsUsed: string[];
    result: any;
    duration: number;
  }>;
}

export interface ExecutionResult {
  taskId: string;
  success: boolean;
  output?: any;
  error?: string;
  toolsUsed: string[];
  duration: number;
}

export class Executor extends EventEmitter {
  private activeExecutions: Map<string, AbortController>;
  private client: DeepSeekClient;
  
  constructor() {
    super();
    this.activeExecutions = new Map();
    this.client = new DeepSeekClient();
    
    // Forward token usage events from DeepSeek client
    this.client.on('token-usage', (usage: any) => {
      console.log('📊 [EXECUTOR] Token usage from DeepSeek:', usage);
      this.emit('token-usage', usage);
    });
  }

  async executeTask(task: Task, context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    this.emit('task-start', { task, context });
    this.emit('status', `⏺ Executing: ${task.description}`);
    
    const abortController = new AbortController();
    this.activeExecutions.set(task.id, abortController);
    
    try {
      let result: any;
      const toolsUsed: string[] = [];
      
      // Simple task - no tools needed
      if (task.type === 'simple' && (!task.tools || task.tools.length === 0)) {
        this.emit('task-simple', { task });
        result = task.description; // Return string, not object
      } 
      // Tool-based task
      else if (task.tools && task.tools.length > 0) {
        result = await this.executeWithTools(task, context, abortController.signal);
        toolsUsed.push(...task.tools);
      }
      // Multi-step task
      else if (task.type === 'multi-step') {
        result = await this.executeMultiStep(task, context, abortController.signal);
      }
      
      const executionResult: ExecutionResult = {
        taskId: task.id,
        success: true,
        output: result,
        toolsUsed,
        duration: Date.now() - startTime
      };
      
      this.emit('status', `✅ Completed: ${task.description}`);
      this.emit('task-complete', executionResult);
      return executionResult;
      
    } catch (error: any) {
      const executionResult: ExecutionResult = {
        taskId: task.id,
        success: false,
        error: error.message,
        toolsUsed: [],
        duration: Date.now() - startTime
      };
      
      this.emit('status', `❌ Failed: ${task.description}`);
      this.emit('task-error', executionResult);
      return executionResult;
      
    } finally {
      this.activeExecutions.delete(task.id);
    }
  }

  async executePlan(plan: TaskPlan, context: ExecutionContext): Promise<ExecutionResult[]> {
    this.emit('plan-start', { plan, context });
    this.emit('status', `🚀 Executing ${plan.tasks.length} task${plan.tasks.length !== 1 ? 's' : ''}...`);
    const results: ExecutionResult[] = [];
    
    // Initialize tracking arrays
    const createdFiles: string[] = [];
    const taskHistory: Array<{ 
      taskId: string; 
      description: string; 
      timestamp: Date;
      toolsUsed: string[];
      result: any;
      duration: number;
    }> = [];
    
    // Execute tasks based on dependencies
    if (plan.parallelizable) {
      // Execute all tasks in parallel
      const promises = plan.tasks.map(task => this.executeTask(task, context));
      const parallelResults = await Promise.all(promises);
      results.push(...parallelResults);
    } else {
      // Execute tasks sequentially
      for (const task of plan.tasks) {
        // Wait for dependencies if any
        if (task.dependencies && task.dependencies.length > 0) {
          await this.waitForDependencies(task.dependencies, results);
        }
        
        // Update context with previous results and created files
        const updatedContext = {
          ...context,
          previousResults: results.map(r => r.output),
          createdFiles: [...createdFiles],
          taskHistory: [...taskHistory]
        };
        
        const result = await this.executeTask(task, updatedContext);
        results.push(result);
        
        // Track created files
        if (result.success && result.output) {
          // Extract created file from output if it's a file creation task
          const fileMatch = result.output.toString().match(/File written: (.+)/) ||
                           result.output.toString().match(/Created: (.+)/) ||
                           (task.description.includes('create') && task.description.match(/(\S+\.txt|\S+\.js|\S+\.md)/));
          if (fileMatch) {
            const fileName = fileMatch[1] || fileMatch[0];
            createdFiles.push(fileName);
            console.log(`  📁 Tracked file: ${fileName}`);
          }
        }
        
        // Track task history with all required fields
        taskHistory.push({
          taskId: task.id,
          description: task.description,
          timestamp: new Date(),
          toolsUsed: result.toolsUsed || [],
          result: result.output,
          duration: result.duration || 0
        });
        
        // Stop on failure unless configured otherwise
        if (!result.success) {
          this.emit('plan-error', { plan, failedTask: task, error: result.error });
          break;
        }
      }
    }
    
    this.emit('status', `🎯 Plan execution complete: ${results.filter(r => r.success).length}/${results.length} succeeded`);
    this.emit('plan-complete', { plan, results });
    return results;
  }

  private async executeWithTools(
    task: Task, 
    context: ExecutionContext, 
    signal: AbortSignal
  ): Promise<any> {
    const results: any[] = [];
    
    for (const toolName of task.tools || []) {
      if (signal.aborted) {
        throw new Error('Task execution aborted');
      }
      
      // Use AI-provided arguments if available, otherwise parse from description
      let args = task.arguments?.[toolName];
      
      if (!args) {
        args = await this.parseToolArguments(toolName, task.description, context);
      } else {
        // Fix field names for write_file tool - AI provides filename/content but tool expects file_path/content
        if (toolName === 'write_file') {
          if (args.filename && !args.file_path) {
            args.file_path = args.filename;
            delete args.filename;
          }
          // Ensure content is properly set from task, not from previous results
          if (!args.content || args.content === null || args.content === '') {
            args.content = await this.generateFileContent(task.description);
          }
        }
        // Check if file content needs generation 
        if (toolName === 'file' && (!args.content || args.content === null || args.content === '')) {
          args.content = await this.generateFileContent(task.description);
        }
        
        if (process.env.DEBUG === 'true') {
          console.log('🔍 Using AI-provided arguments (content generated if needed):', JSON.stringify({...args, content: args.content ? `${args.content.substring(0, 100)}...` : 'empty'}, null, 2));
        }
      }
      
      // Map tool names to user-friendly display names
      const displayName = this.getToolDisplayName(toolName, args);
      this.emit('tool-execute', { taskId: task.id, tool: toolName, name: toolName, args });
      this.emit('status', `🔧 Using tool: ${displayName}`);
      
      // Execute tool using registry directly (toolManager may not be initialized)
      let result = await globalRegistry.execute(toolName, args);
      
      this.emit('tool-result', { taskId: task.id, tool: toolName, name: toolName, result });
      
      if (!result.success) {
        // Emit failure for recovery
        this.emit('tool-failure', { taskId: task.id, tool: toolName, error: result.error });
        
        // Try recovery strategy
        const recovered = await this.tryRecovery(toolName, args, result.error || '', context);
        if (recovered.success) {
          result = recovered;
        } else {
          throw new Error(`Tool ${toolName} failed: ${result.error}`);
        }
      }
      
      results.push(result.output);
    }
    
    return results.length === 1 ? results[0] : results;
  }

  private async executeMultiStep(
    task: Task,
    context: ExecutionContext,
    signal: AbortSignal
  ): Promise<any> {
    // For multi-step tasks, break down and execute sequentially
    // This is a simplified version - in production would use Planner
    this.emit('multi-step', { task });
    
    const steps = task.description.split(/then|after that|next/i);
    const results: any[] = [];
    
    for (const step of steps) {
      if (signal.aborted) {
        throw new Error('Task execution aborted');
      }
      
      const stepTask: Task = {
        id: `${task.id}_step_${results.length}`,
        description: step.trim(),
        type: 'simple',
        tools: this.identifyTools(step),
        priority: results.length + 1
      };
      
      const stepResult = await this.executeTask(stepTask, {
        ...context,
        previousResults: results
      });
      
      results.push(stepResult.output);
    }
    
    return results;
  }

  private async parseToolArguments(
    toolName: string, 
    description: string,
    context: ExecutionContext
  ): Promise<any> {
    // Parse arguments based on tool type and description
    const args: any = {};
    
    switch (toolName) {
      case 'file':
        // Detect action (read/write)
        if (description.toLowerCase().includes('read')) {
          args.action = 'read';
          args.path = this.extractFilePathWithContext(description, context);
        } else if (description.toLowerCase().includes('create') || 
                   description.toLowerCase().includes('write')) {
          args.action = 'write';
          args.path = this.extractFilePath(description);
          args.content = await this.extractContent(description, context) || '';
        }
        break;
        
      case 'write_file':
        args.file_path = this.extractFilePath(description);
        args.content = await this.extractContent(description, context);
        break;
        
      case 'read_file':
        args.file_path = this.extractFilePathWithContext(description, context);
        break;
        
      case 'bash':
        args.command = this.extractCommand(description);
        break;
        
      case 'edit':
        args.path = this.extractFilePath(description);
        args.oldText = this.extractOldText(description);
        args.newText = this.extractNewText(description);
        break;
        
      case 'grep':
        args.pattern = this.extractPattern(description);
        args.path = this.extractPath(description) || '.';
        break;
        
      case 'rg':
        args.pattern = this.extractPattern(description);
        args.path = this.extractPath(description) || '.';
        break;
        
      case 'smart_edit':
        args.file_path = this.extractFilePath(description);
        args.operation = 'replace'; // Default operation
        break;
        
      case 'glob':
        args.pattern = this.extractPattern(description) || '*';
        args.path = this.extractPath(description) || '.';
        break;
        
      case 'ls':
        args.path = this.extractPath(description) || '.';
        break;
        
      case 'web':
        // Default to search for price queries and general questions
        if (description.toLowerCase().includes('price') || 
            description.toLowerCase().includes('current') ||
            description.toLowerCase().includes('what is') ||
            !description.includes('http')) {
          args.action = 'search';
          args.query = description; // Use full description as query
        } else {
          args.action = 'fetch';
          args.url = this.extractUrl(description);
        }
        break;
        
      case 'git':
        args.action = this.extractGitAction(description);
        if (args.action === 'commit') {
          args.message = this.extractCommitMessage(description);
        }
        break;
    }
    
    return args;
  }

  private identifyTools(description: string): string[] {
    const tools: string[] = [];
    const desc = description.toLowerCase();
    
    if (desc.includes('file') || desc.includes('create') || desc.includes('write') || desc.includes('read')) {
      tools.push('file');
    }
    if (desc.includes('run') || desc.includes('execute') || desc.includes('command')) {
      tools.push('bash');
    }
    if (desc.includes('edit') || desc.includes('modify') || desc.includes('change')) {
      tools.push('edit');
    }
    if (desc.includes('search') || desc.includes('grep') || desc.includes('find')) {
      tools.push('grep');
    }
    if (desc.includes('web') || desc.includes('internet') || desc.includes('fetch')) {
      tools.push('web');
    }
    if (desc.includes('git') || desc.includes('commit') || desc.includes('push')) {
      tools.push('git');
    }
    
    return tools;
  }

  private async waitForDependencies(
    dependencies: string[], 
    results: ExecutionResult[]
  ): Promise<void> {
    // Wait for all dependencies to complete
    const pendingDeps = dependencies.filter(dep => 
      !results.some(r => r.taskId === dep)
    );
    
    if (pendingDeps.length > 0) {
      // In a real implementation, would wait for specific tasks
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private extractFilePath(description: string): string {
    // Extract file path from description with better regex patterns
    const match = description.match(/['"`]([^'"`]+\.[a-z]+)['"`]/i) ||
                  description.match(/(?:file|called?)\s+(\S+\.[a-z]+)/i) ||
                  description.match(/(?:create|write|make)\s+(\S+\.[a-z0-9]+)/i) ||
                  description.match(/(\S+\.html|\.css|\.js|\.ts|\.json|\.md|\.txt)/i);
    
    if (process.env.DEBUG === 'true') {
      console.log(`🔍 extractFilePath: "${description}" -> ${match ? match[1] : 'file.txt'}`);
    }
    
    return match ? match[1] : 'file.txt';
  }
  
  private extractFilePathWithContext(description: string, context: ExecutionContext): string {
    // First try regular extraction
    const explicitPath = this.extractFilePath(description);
    
    // If description contains "it" or "back" or "that file", use most recent created file
    if ((description.toLowerCase().includes('it') || 
         description.toLowerCase().includes('back') ||
         description.toLowerCase().includes('that file') ||
         description.toLowerCase().includes('the file')) &&
        context.createdFiles && context.createdFiles.length > 0) {
      // Return the most recently created file
      const recentFile = context.createdFiles[context.createdFiles.length - 1];
      console.log(`  🔍 Using context file: ${recentFile}`);
      return recentFile;
    }
    
    // If we found an explicit path that's not a generic default, use it
    if (explicitPath !== 'file.txt' && explicitPath !== 'test.txt') {
      return explicitPath;
    }
    
    // Otherwise, check if we have any created files in context
    if (context.createdFiles && context.createdFiles.length > 0) {
      const recentFile = context.createdFiles[context.createdFiles.length - 1];
      console.log(`  🔍 Defaulting to recent file: ${recentFile}`);
      return recentFile;
    }
    
    return explicitPath;
  }

  private async extractContent(description: string, context: ExecutionContext): Promise<string> {
    // Extract content from description or use previous results
    const match = description.match(/(?:with|content|containing)\s+['"`]([^'"`]+)['"`]/i);
    if (match) return match[1];
    
    // Don't use previous results as content - this causes files to have wrong content
    // Instead, generate proper content for the file
    
    // Generate content using DeepSeek for file creation
    return await this.generateFileContent(description);
  }

  private async generateFileContent(description: string): Promise<string> {
    try {
      const contentPrompt = `Generate the code/content for: ${description}

Return only the file content, no explanations or markdown blocks. Make it complete and functional.`;

      // Get all available tools from registry
      const availableTools = globalRegistry.getTools();
      
      const content = await this.client.chat([
        { role: 'user', content: contentPrompt }
      ], availableTools, false); // Use temperature 0 for consistency
      
      return content.trim();
    } catch (error) {
      console.warn(`Failed to generate content for: ${description}`, error);
      return `// TODO: Implement ${description}`;
    }
  }


  private extractCommand(description: string): string {
    // Extract command from description
    const match = description.match(/(?:run|execute)\s+['"`]?([^'"`]+)['"`]?/i);
    return match ? match[1] : 'ls';
  }

  private extractOldText(description: string): string {
    const match = description.match(/(?:replace|change)\s+['"`]([^'"`]+)['"`]/i);
    return match ? match[1] : '';
  }

  private extractNewText(description: string): string {
    const match = description.match(/(?:with|to)\s+['"`]([^'"`]+)['"`]/i);
    return match ? match[1] : '';
  }

  private extractPattern(description: string): string {
    const match = description.match(/(?:for|pattern)\s+['"`]([^'"`]+)['"`]/i);
    return match ? match[1] : '';
  }

  private extractPath(description: string): string {
    const match = description.match(/(?:in|at|from)\s+['"`]?([^'"`\s]+)['"`]?/i);
    return match ? match[1] : '.';
  }

  private extractQuery(description: string): string {
    const match = description.match(/(?:search|for)\s+['"`]?([^'"`]+)['"`]?/i);
    return match ? match[1] : '';
  }

  private extractUrl(description: string): string {
    const match = description.match(/(https?:\/\/[^\s]+)/i);
    return match ? match[1] : '';
  }

  private extractGitAction(description: string): string {
    const actions = ['status', 'add', 'commit', 'push', 'pull', 'branch', 'log', 'diff'];
    for (const action of actions) {
      if (description.toLowerCase().includes(action)) {
        return action;
      }
    }
    return 'status';
  }

  private extractCommitMessage(description: string): string {
    const match = description.match(/(?:message|with)\s+['"`]([^'"`]+)['"`]/i);
    return match ? match[1] : 'Update';
  }

  abortTask(taskId: string): boolean {
    const controller = this.activeExecutions.get(taskId);
    if (controller) {
      controller.abort();
      this.activeExecutions.delete(taskId);
      this.emit('task-aborted', { taskId });
      return true;
    }
    return false;
  }

  abortAll(): void {
    for (const [taskId, controller] of this.activeExecutions) {
      controller.abort();
      this.emit('task-aborted', { taskId });
    }
    this.activeExecutions.clear();
  }
  
  private getToolDisplayName(toolName: string, args: any): string {
    switch (toolName) {
      case 'file':
        if (args.action === 'write') return `Write(${args.path})`;
        if (args.action === 'read') return `Read(${args.path})`;
        return `File(${args.action})`;
      case 'web':
        if (args.action === 'search') return `WebSearch("${args.query}")`;
        if (args.action === 'fetch') return `WebFetch(${args.url})`;
        return `Web(${args.action})`;
      case 'bash':
        const cmd = args.command?.substring(0, 50) || '';
        return `Bash(${cmd}${args.command?.length > 50 ? '...' : ''})`;
      case 'edit':
        return `Edit(${args.path})`;
      case 'grep':
        return `Grep("${args.pattern}")`;
      default:
        return toolName;
    }
  }
  
  private async tryRecovery(toolName: string, args: any, error: string, context: ExecutionContext): Promise<any> {
    this.emit('status', `🔄 Attempting recovery for ${toolName} failure...`);
    
    // Smart recovery strategies based on error type
    if (error.includes('File not found') || error.includes('No such file')) {
      // Try to create parent directory or use alternative path
      if (toolName === 'file' && args.action === 'write') {
        const dir = args.path.substring(0, args.path.lastIndexOf('/'));
        if (dir) {
          await globalRegistry.execute('bash', { command: `mkdir -p ${dir}` });
          // Retry the operation
          return await globalRegistry.execute(toolName, args);
        }
      }
    }
    
    if (error.includes('Permission denied')) {
      // Try with sudo or alternative location
      if (toolName === 'bash') {
        this.emit('status', `⚠️ Permission denied, trying alternative approach...`);
        // Try in temp directory instead
        const tempCmd = args.command.replace(/^\//, '/tmp/');
        return await globalRegistry.execute(toolName, { command: tempCmd });
      }
    }
    
    if (error.includes('timeout') || error.includes('network')) {
      // Retry network operations
      if (toolName === 'web') {
        this.emit('status', `🔄 Retrying network operation...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return await globalRegistry.execute(toolName, args);
      }
    }
    
    // No recovery possible
    return { success: false, error };
  }
}