/**
 * Memory Tool for persistent context
 */

import { Tool, ToolResult } from './base.js';
import { writeFile, readFile, access } from 'fs/promises';
import { constants } from 'fs';

export class MemoryTool extends Tool {
  name = 'memory';
  description = 'Store and retrieve information across sessions';
  private memoryFile = '.unipath-memory.json';
  private memory: Record<string, any> = {};
  
  constructor() {
    super();
    this.loadMemory();
  }
  
  async execute(args: any): Promise<ToolResult> {
    try {
      const action = args.action || 'get';
      const key = args.key;
      
      switch (action) {
        case 'set':
          return this.setMemory(key, args.value);
        case 'get':
          return this.getMemory(key);
        case 'delete':
          return this.deleteMemory(key);
        case 'list':
          return this.listMemory();
        case 'clear':
          return this.clearMemory();
        default:
          return {
            success: false,
            error: `Unknown action: ${action}`
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  private async setMemory(key: string, value: any): Promise<ToolResult> {
    if (!key) {
      return {
        success: false,
        error: 'key parameter is required'
      };
    }
    
    this.memory[key] = {
      value,
      timestamp: new Date().toISOString(),
      type: typeof value
    };
    
    await this.saveMemory();
    
    return {
      success: true,
      output: `Memory set: ${key} = ${JSON.stringify(value)}`
    };
  }
  
  private async getMemory(key?: string): Promise<ToolResult> {
    if (!key) {
      return {
        success: true,
        output: JSON.stringify(this.memory, null, 2)
      };
    }
    
    const item = this.memory[key];
    if (!item) {
      return {
        success: false,
        error: `Memory key not found: ${key}`
      };
    }
    
    return {
      success: true,
      output: JSON.stringify(item.value)
    };
  }
  
  private async deleteMemory(key: string): Promise<ToolResult> {
    if (!key) {
      return {
        success: false,
        error: 'key parameter is required'
      };
    }
    
    if (!(key in this.memory)) {
      return {
        success: false,
        error: `Memory key not found: ${key}`
      };
    }
    
    delete this.memory[key];
    await this.saveMemory();
    
    return {
      success: true,
      output: `Memory deleted: ${key}`
    };
  }
  
  private async listMemory(): Promise<ToolResult> {
    const keys = Object.keys(this.memory);
    const summary = keys.map(key => {
      const item = this.memory[key];
      return {
        key,
        type: item.type,
        timestamp: item.timestamp,
        preview: JSON.stringify(item.value).substring(0, 50)
      };
    });
    
    return {
      success: true,
      output: JSON.stringify(summary, null, 2)
    };
  }
  
  private async clearMemory(): Promise<ToolResult> {
    const count = Object.keys(this.memory).length;
    this.memory = {};
    await this.saveMemory();
    
    return {
      success: true,
      output: `Memory cleared. Removed ${count} items.`
    };
  }
  
  private async loadMemory(): Promise<void> {
    try {
      await access(this.memoryFile, constants.F_OK);
      const content = await readFile(this.memoryFile, 'utf8');
      this.memory = JSON.parse(content);
    } catch {
      // Memory file doesn't exist or is invalid, start fresh
      this.memory = {};
    }
  }
  
  private async saveMemory(): Promise<void> {
    await writeFile(this.memoryFile, JSON.stringify(this.memory, null, 2));
  }
}