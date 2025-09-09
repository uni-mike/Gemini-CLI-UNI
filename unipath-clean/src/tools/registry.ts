/**
 * Tool Registry
 * Manages all available tools
 */

import { Tool, ToolResult } from './base';
import { EventEmitter } from 'events';

export class ToolRegistry extends EventEmitter {
  private tools: Map<string, Tool> = new Map();
  
  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
    this.emit('tool-registered', tool.name);
  }
  
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }
  
  list(): string[] {
    return Array.from(this.tools.keys());
  }
  
  async execute(name: string, params: any): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool "${name}" not found`
      };
    }
    
    if (!tool.validate(params)) {
      return {
        success: false,
        error: `Invalid parameters for tool "${name}"`
      };
    }
    
    this.emit('tool-start', { name, params });
    
    try {
      const result = await tool.execute(params);
      this.emit('tool-complete', { name, result });
      return result;
    } catch (error) {
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
      this.emit('tool-error', { name, error: errorResult.error });
      return errorResult;
    }
  }
}

export const globalRegistry = new ToolRegistry();