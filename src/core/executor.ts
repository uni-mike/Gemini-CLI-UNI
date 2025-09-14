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
    this.client = new DeepSeekClient({
      timeout: 120000 // 120 seconds for complex prompts - matches orchestrator/planner
    });

    // Forward token usage events from DeepSeek client
    this.client.on('token-usage', (usage: any) => {
      console.log('📊 [EXECUTOR] Token usage from DeepSeek:', usage);
      this.emit('token-usage', usage);
    });

    // Handle retry events for better user feedback
    this.client.on('retry', (data: any) => {
      this.emit('status', `🔄 Execution API retry (${data.attempt}/${data.maxRetries})...`);
    });

    // Handle timeout events
    this.client.on('timeout', (data: any) => {
      this.emit('status', `⏱️ Execution timeout - ${data.message}`);
    });

    // Handle error events with proper feedback
    this.client.on('error', (error: any) => {
      if (!error.willRetry) {
        this.emit('status', `❌ Execution error: ${error.message}`);
      }
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
      
      // TOOL SELECTION FIX: Use planner-provided arguments if available, otherwise parse from description
      let args = task.arguments?.[toolName];

      if (process.env.DEBUG === 'true') {
        console.log(`🔍 Looking for arguments for tool "${toolName}" in:`, JSON.stringify(task.arguments, null, 2));
      }

      if (!args) {
        // No arguments from planner, fall back to parsing
        if (process.env.DEBUG === 'true') {
          console.log(`🔍 No planner arguments found for "${toolName}", falling back to parsing from: "${task.description}"`);
        }
        args = await this.parseToolArguments(toolName, task.description, context);
      } else {
        // Planner provided arguments - use them with minimal processing
        if (process.env.DEBUG === 'true') {
          console.log(`🔍 Using planner arguments for ${toolName}:`, JSON.stringify(args, null, 2));
        }

        // CRITICAL FIX: For bash tool, ensure command is properly set
        if (toolName === 'bash' && !args.command && args.description) {
          args.command = this.extractCommand(args.description || task.description);
        }

        // Only generate content if explicitly null or empty AND not already provided
        if (toolName === 'write_file' || toolName === 'file') {
          if (args.content === null || (typeof args.content === 'undefined')) {
            if (process.env.DEBUG === 'true') {
              console.log('🔍 Content not provided by planner, generating...');
            }
            args.content = await this.generateFileContent(task.description);
          }
        }

        // CRITICAL FIX: For write_file/file tools, ensure proper file paths from planner
        if ((toolName === 'write_file' || toolName === 'file') && !args.file_path && !args.path) {
          // Extract from planner-provided file_path or path field
          if (task.arguments?.write_file?.file_path) {
            args.file_path = task.arguments.write_file.file_path;
          } else if (task.arguments?.file?.path) {
            args.path = task.arguments.file.path;
          } else {
            // Fall back to parsing from description but with better patterns
            args.file_path = this.extractFilePathFromPlanDescription(task.description);
          }
        }

        if (process.env.DEBUG === 'true') {
          console.log('🔍 Using final arguments:', JSON.stringify({...args, content: args.content ? `${args.content.substring(0, 100)}...` : 'empty'}, null, 2));
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
                  description.match(/(\S+\.(?:html|css|js|ts|json|md|txt))/i);

    if (process.env.DEBUG === 'true') {
      console.log(`🔍 extractFilePath: "${description}" -> ${match ? match[1] : 'file.txt'}`);
    }

    return match ? match[1] : 'file.txt';
  }

  private extractFilePathFromPlanDescription(description: string): string {
    // Enhanced file path extraction for planner-provided descriptions with structured paths
    // Look for structured paths like "WATERING_TEST/backend/package.json"
    const structuredMatch = description.match(/([A-Z_]+\/[^"'\s]+\.[a-z0-9]+)/i) ||
                           description.match(/([a-zA-Z_][a-zA-Z0-9_]*\/[^"'\s]+\.[a-z0-9]+)/i);

    if (structuredMatch) {
      if (process.env.DEBUG === 'true') {
        console.log(`🔍 extractFilePathFromPlanDescription: structured path found: "${structuredMatch[1]}"`);
      }
      return structuredMatch[1];
    }

    // Fall back to regular extraction but with better patterns for project files
    const match = description.match(/['"`]([^'"`]+\.[a-z0-9]+)['"`]/i) ||
                  description.match(/(?:file|path|called?)\s+([^\s]+\.[a-z0-9]+)/i) ||
                  description.match(/(?:create|write|make)\s+([^\s]+\.[a-z0-9]+)/i) ||
                  description.match(/([^\s]+\.(?:js|ts|tsx|jsx|json|md|html|css|txt|yaml|yml))/i);

    if (process.env.DEBUG === 'true') {
      console.log(`🔍 extractFilePathFromPlanDescription: "${description}" -> ${match ? match[1] : 'file.txt'}`);
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
      const contentPrompt = `TASK: ${description}

CRITICAL: Generate ONLY the exact file content specified in the task above.
If the task mentions specific content (like 'console.log("hello")'), use EXACTLY that content.
If the task specifies a file path (like WATERING_TEST/test.js), note the filename but only return the content.

OUTPUT REQUIREMENTS:
- Return ONLY raw file content
- NO explanations, markdown blocks, or comments about the task
- NO code block wrappers
- NO file paths in output
- Follow the EXACT content requirements from the task

File content only:`;

      // Don't pass tools as functions - we have them in the prompt
      const content = await this.client.chat([
        { role: 'user', content: contentPrompt }
      ], [], false, 32000); // Use temperature 0 for consistency, max tokens for code generation
      
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
    // Try to find quoted patterns first
    let match = description.match(/(?:for|pattern)\s+['"`]([^'"`]+)['"`]/i);
    if (match) return match[1];

    // Try to find patterns in common search contexts
    match = description.match(/(?:search|find|grep|look)\s+(?:for\s+)?['"`]([^'"`]+)['"`]/i);
    if (match) return match[1];

    // Try to find file extensions or common patterns
    match = description.match(/\*\.(\w+)/);
    if (match) return `*.${match[1]}`;

    // Try to find any quoted strings as potential patterns
    match = description.match(/['"`]([^'"`]+)['"`]/);
    if (match) return match[1];

    // Try to extract key terms as fallback patterns
    match = description.match(/(?:search|find|grep|look).*?(\w+\.\w+|\w{3,})/i);
    if (match) return match[1];

    // Fallback patterns based on context
    if (description.toLowerCase().includes('react')) return 'react';
    if (description.toLowerCase().includes('component')) return 'component';
    if (description.toLowerCase().includes('function')) return 'function';
    if (description.toLowerCase().includes('class')) return 'class';
    if (description.toLowerCase().includes('test')) return 'test';
    if (description.toLowerCase().includes('error')) return 'error';

    // Last resort: return a safe default pattern
    return '.*';
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