/**
 * Git Tool
 * Git operations
 */

import { Tool, ToolParams, ToolResult, ParameterSchema } from './base.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitTool extends Tool {
  name = 'git';
  description = 'Execute git version control commands';
  
  parameterSchema: ParameterSchema[] = [
    { name: 'action', type: 'string', required: false, enum: ['status', 'add', 'commit', 'push', 'pull', 'branch', 'checkout', 'log', 'diff'], description: 'Git command to execute' },
    { name: 'description', type: 'string', required: false, description: 'Task description to parse for safe git action' },
    { name: 'message', type: 'string', required: false, description: 'Commit message (required for commit)' },
    { name: 'branch', type: 'string', required: false, description: 'Branch name (for push/pull/checkout)' },
    { name: 'files', type: 'string', required: false, description: 'Files to add (for add command)' }
  ];
  
  async execute(params: ToolParams): Promise<ToolResult> {
    const { action, description, message, branch, files } = params;

    // If no action provided, parse from description with safety-first approach
    let gitAction = action;
    if (!gitAction && description) {
      gitAction = this.parseGitAction(description);
    }

    if (!gitAction) {
      return {
        success: false,
        error: 'Action is required (status, add, commit, push, pull, branch, etc.)'
      };
    }
    
    try {
      let command = 'git ';
      
      switch (gitAction) {
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
          command += gitAction;
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
    return typeof params.action === 'string' || typeof params.description === 'string';
  }

  /**
   * Parse git action from description with safety-first approach
   * Prioritizes read-only operations over dangerous write operations
   */
  private parseGitAction(description: string): string {
    const desc = description.toLowerCase();

    // CRITICAL: Prioritize safe read-only actions over dangerous write actions
    // Check for history/log queries FIRST
    if (desc.includes('history') || desc.includes('timeline') ||
        (desc.includes('commit') && (desc.includes('history') || desc.includes('log') || desc.includes('show') || desc.includes('check')))) {
      return 'log';
    }
    if (desc.includes('log')) {
      return 'log';
    }
    if (desc.includes('diff') || desc.includes('changes')) {
      return 'diff';
    }
    if (desc.includes('status') || desc.includes('state')) {
      return 'status';
    }
    if (desc.includes('branch')) {
      return 'branch';
    }

    // Only match dangerous actions with very explicit intent
    if (desc.includes('add') && (desc.includes('file') || desc.includes('stage'))) {
      return 'add';
    }
    if (desc.includes('commit') && desc.includes('message') && !desc.includes('history')) {
      return 'commit';
    }
    if (desc.includes('push') && desc.includes('origin')) {
      return 'push';
    }
    if (desc.includes('pull') && desc.includes('origin')) {
      return 'pull';
    }

    // Safe default
    return 'status';
  }
}