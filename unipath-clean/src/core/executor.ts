/**
 * Executor - Executes tasks using tools
 * Part of the orchestration Trio: Planner -> Executor -> Orchestrator
 */

import { EventEmitter } from 'events';
import { Task, TaskPlan } from './planner';
import { toolManager } from '../tools/tool-manager';

export interface ExecutionContext {
  workingDirectory: string;
  environment: Record<string, string>;
  previousResults?: any[];
  createdFiles?: string[];  // Track files created in previous tasks
  taskHistory?: Array<{     // Track task execution history
    taskId: string;
    description: string;
    result: any;
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
  
  constructor() {
    super();
    this.activeExecutions = new Map();
  }

  async executeTask(task: Task, context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    this.emit('task-start', { task, context });
    
    const abortController = new AbortController();
    this.activeExecutions.set(task.id, abortController);
    
    try {
      let result: any;
      const toolsUsed: string[] = [];
      
      // Simple task - no tools needed
      if (task.type === 'simple' && (!task.tools || task.tools.length === 0)) {
        this.emit('task-simple', { task });
        result = { response: task.description };
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
      
      this.emit('task-error', executionResult);
      return executionResult;
      
    } finally {
      this.activeExecutions.delete(task.id);
    }
  }

  async executePlan(plan: TaskPlan, context: ExecutionContext): Promise<ExecutionResult[]> {
    this.emit('plan-start', { plan, context });
    const results: ExecutionResult[] = [];
    
    // Initialize tracking arrays
    const createdFiles: string[] = [];
    const taskHistory: Array<{ taskId: string; description: string; result: any }> = [];
    
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
        
        // Track task history
        taskHistory.push({
          taskId: task.id,
          description: task.description,
          result: result.output
        });
        
        // Stop on failure unless configured otherwise
        if (!result.success) {
          this.emit('plan-error', { plan, failedTask: task, error: result.error });
          break;
        }
      }
    }
    
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
      
      this.emit('tool-execute', { taskId: task.id, tool: toolName });
      
      // Parse tool arguments from task description
      const args = this.parseToolArguments(toolName, task.description, context);
      
      // Execute tool using advanced tool manager
      const result = await toolManager.executeTool(toolName, args);
      
      this.emit('tool-result', { taskId: task.id, tool: toolName, result });
      
      if (!result.success) {
        throw new Error(`Tool ${toolName} failed: ${result.error}`);
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

  private parseToolArguments(
    toolName: string, 
    description: string,
    context: ExecutionContext
  ): any {
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
          args.content = this.extractContent(description, context);
        }
        break;
        
      case 'write_file':
        args.file_path = this.extractFilePath(description);
        args.content = this.extractContent(description, context);
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
        if (description.toLowerCase().includes('search')) {
          args.action = 'search';
          args.query = this.extractQuery(description);
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
    // Extract file path from description
    const match = description.match(/['"`]([^'"`]+\.[a-z]+)['"`]/i) ||
                  description.match(/(?:file|called?)\s+(\S+\.[a-z]+)/i) ||
                  description.match(/(\S+\.txt)/i) ||
                  description.match(/(\S+\.js|\.ts|\.json|\.md)/i);
    
    // Special case for "it" referring to previously created file
    if (!match && description.toLowerCase().includes('it')) {
      // Look for file reference in context
      return 'test.txt'; // Default to common test file name
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

  private extractContent(description: string, context: ExecutionContext): string {
    // Extract content from description or use previous results
    const match = description.match(/(?:with|content|containing)\s+['"`]([^'"`]+)['"`]/i);
    if (match) return match[1];
    
    if (context.previousResults && context.previousResults.length > 0) {
      return context.previousResults[context.previousResults.length - 1];
    }
    
    return '';
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
}