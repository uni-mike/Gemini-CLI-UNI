/**
 * Grep Tool
 * Search for patterns in files
 */

import { Tool, ToolParams, ToolResult } from './base.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GrepTool extends Tool {
  name = 'grep';
  description = 'Search for patterns in files';
  
  async execute(params: ToolParams): Promise<ToolResult> {
    const { pattern, path = '.', flags = '' } = params;
    
    if (!pattern) {
      return {
        success: false,
        error: 'Pattern is required'
      };
    }
    
    try {
      // Use grep or ripgrep if available
      const command = `grep ${flags} "${pattern}" ${path}`;
      const { stdout, stderr } = await execAsync(command, {
        encoding: 'utf8',
        maxBuffer: 5 * 1024 * 1024 // 5MB
      });
      
      return {
        success: true,
        output: stdout || 'No matches found'
      };
    } catch (error: any) {
      // Grep returns exit code 1 when no matches found
      if (error.code === 1) {
        return {
          success: true,
          output: 'No matches found'
        };
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  validate(params: ToolParams): boolean {
    return typeof params.pattern === 'string';
  }
}