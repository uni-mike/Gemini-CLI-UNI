/**
 * Bash Tool
 * Execute shell commands
 */

import { Tool, ToolParams, ToolResult } from './base.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class BashTool extends Tool {
  name = 'bash';
  description = 'Execute bash commands';
  
  async execute(params: ToolParams): Promise<ToolResult> {
    const command = params.command as string;
    
    if (!command) {
      return {
        success: false,
        error: 'Command is required'
      };
    }
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024 // 10MB
      });
      
      return {
        success: true,
        output: stdout + (stderr ? `\nSTDERR: ${stderr}` : '')
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        output: error.stdout || error.stderr
      };
    }
  }
  
  validate(params: ToolParams): boolean {
    return typeof params.command === 'string';
  }
}