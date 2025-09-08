import { ToolCall } from '../../types';

export class ToolExecutor {
  private toolRegistry: Map<string, any>;

  constructor() {
    this.toolRegistry = new Map();
  }

  /**
   * Registers a tool implementation
   */
  registerTool(name: string, tool: any): void {
    this.toolRegistry.set(name, tool);
    console.log(`✅ Registered tool: ${name}`);
  }

  /**
   * Executes a tool call with timeout and abort signal
   */
  async executeToolCall(
    toolCall: ToolCall,
    signal: AbortSignal,
    timeout: number
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      console.log(`  🔧 Executing ${toolCall.name} with args:`, toolCall.args);
      
      const tool = this.toolRegistry.get(toolCall.name);
      
      if (!tool) {
        return await this.mockToolExecution(toolCall, signal);
      }
      
      const result = await this.executeWithSignal(
        () => tool.execute(toolCall.args),
        signal,
        timeout
      );
      
      toolCall.result = result;
      toolCall.duration = Date.now() - startTime;
      
      return result;
      
    } catch (error) {
      toolCall.duration = Date.now() - startTime;
      throw error;
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

  private async mockToolExecution(toolCall: ToolCall, signal: AbortSignal): Promise<any> {
    // Simulate tool execution for testing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));
    
    if (signal.aborted) {
      throw new Error('Execution aborted');
    }
    
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

  /**
   * Gets registered tool names
   */
  getRegisteredTools(): string[] {
    return Array.from(this.toolRegistry.keys());
  }
}