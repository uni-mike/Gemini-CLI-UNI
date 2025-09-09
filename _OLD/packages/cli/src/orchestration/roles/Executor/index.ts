import type { Task, ExecutionContext } from '../../types.js';
import { EventEmitter } from 'events';
import { ToolMapper } from './ToolMapper.js';
import { ToolExecutor } from './ToolExecutor.js';

export class Executor extends EventEmitter {
  private toolMapper: ToolMapper;
  private toolExecutor: ToolExecutor;
  private activeExecutions: Map<string, AbortController>;

  constructor() {
    super();
    this.toolMapper = new ToolMapper();
    this.toolExecutor = new ToolExecutor();
    this.activeExecutions = new Map();
  }

  async execute(task: Task, context: ExecutionContext): Promise<any> {
    console.log(`🔧 Executor: Starting task ${task.id}: ${task.description}`);
    
    const abortController = new AbortController();
    this.activeExecutions.set(task.id, abortController);
    
    try {
      // Parse task description to identify required tools
      const toolCalls = this.toolMapper.identifyToolCalls(task.description);
      task.toolCalls = toolCalls;
      
      // Execute tool calls sequentially
      const results = [];
      for (const toolCall of toolCalls) {
        if (abortController.signal.aborted) {
          throw new Error('Task execution aborted');
        }
        
        const result = await this.toolExecutor.executeToolCall(
          toolCall,
          abortController.signal,
          context.timeout
        );
        
        results.push(result);
        
        this.emit('toolComplete', { 
          taskId: task.id, 
          tool: toolCall.name, 
          result 
        });
      }
      
      return this.aggregateResults(results);
      
    } catch (error) {
      console.error(`❌ Executor: Task ${task.id} failed:`, error);
      throw error;
    } finally {
      this.activeExecutions.delete(task.id);
    }
  }

  private aggregateResults(results: any[]): any {
    if (results.length === 0) return null;
    if (results.length === 1) return results[0];
    
    return {
      success: true,
      results: results,
      summary: `Executed ${results.length} operations successfully`
    };
  }

  public registerTool(name: string, tool: any): void {
    this.toolExecutor.registerTool(name, tool);
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