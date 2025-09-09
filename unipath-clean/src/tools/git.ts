/**
 * Git Tool
 * Git operations
 */

import { Tool, ToolParams, ToolResult } from './base.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitTool extends Tool {
  name = 'git';
  description = 'Execute git commands';
  
  async execute(params: ToolParams): Promise<ToolResult> {
    const { action, message, branch, files } = params;
    
    if (!action) {
      return {
        success: false,
        error: 'Action is required (status, add, commit, push, pull, branch, etc.)'
      };
    }
    
    try {
      let command = 'git ';
      
      switch (action) {
        case 'status':
          command += 'status --short';
          break;
          
        case 'add':
          if (!files) {
            return { success: false, error: 'Files parameter required for add' };
          }
          command += `add ${Array.isArray(files) ? files.join(' ') : files}`;
          break;
          
        case 'commit':
          if (!message) {
            return { success: false, error: 'Message parameter required for commit' };
          }
          command += `commit -m "${message}"`;
          break;
          
        case 'push':
          command += `push${branch ? ` origin ${branch}` : ''}`;
          break;
          
        case 'pull':
          command += `pull${branch ? ` origin ${branch}` : ''}`;
          break;
          
        case 'branch':
          command += 'branch -a';
          break;
          
        case 'log':
          command += 'log --oneline -10';
          break;
          
        case 'diff':
          command += 'diff';
          break;
          
        default:
          // Allow raw git commands
          command += action;
      }
      
      const { stdout, stderr } = await execAsync(command, {
        encoding: 'utf8',
        maxBuffer: 5 * 1024 * 1024
      });
      
      return {
        success: true,
        output: stdout || stderr || 'Command executed successfully'
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
    return typeof params.action === 'string';
  }
}