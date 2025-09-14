/**
 * Grep Tool
 * Search for patterns in files
 */

import { Tool, ToolParams, ToolResult, ParameterSchema } from './base.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GrepTool extends Tool {
  name = 'grep';
  description = 'Search for patterns in files using grep';
  
  parameterSchema: ParameterSchema[] = [
    { name: 'pattern', type: 'string', required: true, description: 'Search pattern (regex supported)' },
    { name: 'path', type: 'string', required: false, default: '.', description: 'File or directory to search' },
    { name: 'flags', type: 'string', required: false, default: '', description: 'Grep flags (e.g., -r for recursive, -i for case-insensitive)' }
  ];
  
  async execute(params: ToolParams): Promise<ToolResult> {
    const { pattern, path = '.', flags = '' } = params;

    if (!pattern || typeof pattern !== 'string' || pattern.trim() === '') {
      return {
        success: false,
        error: 'Pattern is required and must be a non-empty string'
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