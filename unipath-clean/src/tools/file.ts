/**
 * File Operations Tool
 * Read, write, edit files
 */

import { Tool, ToolParams, ToolResult } from './base.js';
import { readFile, writeFile } from 'fs/promises';

export class FileTool extends Tool {
  name = 'file';
  description = 'File operations';
  
  async execute(params: ToolParams): Promise<ToolResult> {
    const { action, path, content } = params;
    
    try {
      switch (action) {
        case 'read':
          const data = await readFile(path as string, 'utf8');
          return { success: true, output: data };
          
        case 'write':
          await writeFile(path as string, content as string, 'utf8');
          return { success: true, output: `File written: ${path}` };
          
        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}