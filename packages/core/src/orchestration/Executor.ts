import { Task, ExecutionContext, ToolCall } from './types';
import { EventEmitter } from 'events';

export class Executor extends EventEmitter {
  private toolRegistry: Map<string, any>;
  private activeExecutions: Map<string, AbortController>;

  constructor() {
    super();
    this.toolRegistry = new Map();
    this.activeExecutions = new Map();
  }

  async execute(task: Task, context: ExecutionContext): Promise<any> {
    console.log(`🔧 Executor: Starting task ${task.id}: ${task.description}`);
    
    const abortController = new AbortController();
    this.activeExecutions.set(task.id, abortController);
    
    try {
      // Parse task description to identify required tools
      const toolCalls = this.identifyToolCalls(task.description);
      task.toolCalls = toolCalls;
      
      // Execute tool calls sequentially
      const results = [];
      for (const toolCall of toolCalls) {
        if (abortController.signal.aborted) {
          throw new Error('Task execution aborted');
        }
        
        const result = await this.executeToolCall(toolCall, context, abortController.signal);
        results.push(result);
        
        this.emit('toolComplete', { taskId: task.id, tool: toolCall.name, result });
      }
      
      return this.aggregateResults(results);
      
    } catch (error) {
      console.error(`❌ Executor: Task ${task.id} failed:`, error);
      throw error;
    } finally {
      this.activeExecutions.delete(task.id);
    }
  }

  private identifyToolCalls(description: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    const lowerDesc = description.toLowerCase();
    
    // Map task patterns to tool calls
    const toolPatterns = [
      {
        patterns: ['search for', 'find', 'look for', 'grep'],
        tool: 'search_file_content',
        extractArgs: (desc: string) => {
          const match = desc.match(/(?:search|find|look)\s+(?:for\s+)?['"]?([^'"]+)['"]?/i);
          return { pattern: match?.[1] || desc };
        }
      },
      {
        patterns: ['read file', 'open file', 'view file'],
        tool: 'read_file',
        extractArgs: (desc: string) => {
          const match = desc.match(/(?:read|open|view)\s+(?:file\s+)?(\S+)/i);
          return { file_path: match?.[1] || '' };
        }
      },
      {
        patterns: ['write to', 'create file', 'save to'],
        tool: 'write_file',
        extractArgs: (desc: string) => {
          const match = desc.match(/(?:write|create|save)\s+(?:to\s+)?(?:file\s+)?(\S+)/i);
          return { file_path: match?.[1] || '', content: '' };
        }
      },
      {
        patterns: ['edit file', 'modify', 'update file', 'change'],
        tool: 'edit_file',
        extractArgs: (desc: string) => {
          const match = desc.match(/(?:edit|modify|update|change)\s+(?:file\s+)?(\S+)/i);
          return { file_path: match?.[1] || '' };
        }
      },
      {
        patterns: ['run', 'execute', 'shell', 'command'],
        tool: 'shell',
        extractArgs: (desc: string) => {
          const match = desc.match(/(?:run|execute)\s+['"]?([^'"]+)['"]?/i);
          return { command: match?.[1] || desc };
        }
      },
      {
        patterns: ['install', 'npm install', 'pip install'],
        tool: 'shell',
        extractArgs: (desc: string) => {
          const match = desc.match(/((?:npm|pip|yarn)\s+install\s+\S+)/i);
          return { command: match?.[1] || `npm install ${desc.split(' ').pop()}` };
        }
      },
      {
        patterns: ['test', 'run tests', 'npm test'],
        tool: 'shell',
        extractArgs: (desc: string) => {
          const match = desc.match(/(?:run\s+)?test[s]?\s*(\S+)?/i);
          return { command: match?.[1] || 'npm test' };
        }
      },
      {
        patterns: ['web search', 'search online', 'google'],
        tool: 'web_search',
        extractArgs: (desc: string) => {
          const match = desc.match(/(?:search|google)\s+(?:for\s+)?['"]?([^'"]+)['"]?/i);
          return { query: match?.[1] || desc };
        }
      },
      {
        patterns: ['list files', 'ls', 'directory'],
        tool: 'ls',
        extractArgs: (desc: string) => {
          const match = desc.match(/(?:list|ls)\s+(?:files\s+)?(?:in\s+)?(\S+)?/i);
          return { path: match?.[1] || '.' };
        }
      }
    ];
    
    // Find matching patterns
    for (const { patterns, tool, extractArgs } of toolPatterns) {
      if (patterns.some(p => lowerDesc.includes(p))) {
        toolCalls.push({
          name: tool,
          args: extractArgs(description)
        });
        break; // Only match first pattern
      }
    }
    
    // If no pattern matched, create a generic search task
    if (toolCalls.length === 0) {
      toolCalls.push({
        name: 'search_file_content',
        args: { pattern: description.split(' ').slice(0, 3).join(' ') }
      });
    }
    
    return toolCalls;
  }

  private async executeToolCall(
    toolCall: ToolCall, 
    context: ExecutionContext,
    signal: AbortSignal
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      console.log(`  🔧 Executing ${toolCall.name} with args:`, toolCall.args);
      
      // Get tool from registry
      const tool = this.toolRegistry.get(toolCall.name);
      
      if (!tool) {
        // Fallback to mock execution for testing
        return await this.mockToolExecution(toolCall, signal);
      }
      
      // Execute with timeout and abort signal
      const result = await this.executeWithSignal(
        () => tool.execute(toolCall.args),
        signal,
        context.timeout
      );
      
      toolCall.result = result;
      toolCall.duration = Date.now() - startTime;
      
      return result;
      
    } catch (error) {
      toolCall.duration = Date.now() - startTime;
      throw error;
    }
  }

  private async mockToolExecution(toolCall: ToolCall, signal: AbortSignal): Promise<any> {
    // Simulate tool execution for testing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));
    
    if (signal.aborted) {
      throw new Error('Execution aborted');
    }
    
    // Return mock results based on tool type
    switch (toolCall.name) {
      case 'read_file':
        return `Mock content of ${toolCall.args.file_path}`;
      case 'write_file':
        return `File written to ${toolCall.args.file_path}`;
      case 'search_file_content':
        return `Found 3 matches for "${toolCall.args.pattern}"`;
      case 'shell':
        return `Command executed: ${toolCall.args.command}`;
      case 'web_search':
        return `Search results for: ${toolCall.args.query}`;
      case 'ls':
        return ['file1.ts', 'file2.ts', 'README.md'];
      default:
        return `Tool ${toolCall.name} executed successfully`;
    }
  }

  private executeWithSignal<T>(
    fn: () => Promise<T>,
    signal: AbortSignal,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout;
      
      const cleanup = () => {
        clearTimeout(timeoutId);
        signal.removeEventListener('abort', onAbort);
      };
      
      const onAbort = () => {
        cleanup();
        reject(new Error('Execution aborted'));
      };
      
      const onTimeout = () => {
        cleanup();
        reject(new Error(`Execution timeout after ${timeout}ms`));
      };
      
      signal.addEventListener('abort', onAbort);
      timeoutId = setTimeout(onTimeout, timeout);
      
      fn()
        .then(result => {
          cleanup();
          resolve(result);
        })
        .catch(error => {
          cleanup();
          reject(error);
        });
    });
  }

  private aggregateResults(results: any[]): any {
    // Combine results into a single response
    if (results.length === 0) return null;
    if (results.length === 1) return results[0];
    
    return {
      success: true,
      results: results,
      summary: `Executed ${results.length} operations successfully`
    };
  }

  // Public methods for tool registration
  
  public registerTool(name: string, tool: any): void {
    this.toolRegistry.set(name, tool);
    console.log(`✅ Registered tool: ${name}`);
  }

  public abortTask(taskId: string): void {
    const controller = this.activeExecutions.get(taskId);
    if (controller) {
      controller.abort();
      console.log(`🛑 Aborted task: ${taskId}`);
    }
  }

  public getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys());
  }
}