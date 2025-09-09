/**
 * RipGrep Tool for advanced searching
 */

import { Tool, ToolResult } from './base.js';
import { spawn } from 'child_process';

export class RipGrepTool extends Tool {
  name = 'rg';
  description = 'Fast text search with ripgrep';
  
  async execute(args: any): Promise<ToolResult> {
    try {
      const pattern = args.pattern || args.query;
      
      if (!pattern) {
        return {
          success: false,
          error: 'pattern parameter is required'
        };
      }
      
      const rgArgs = [pattern];
      
      // Add path if specified
      if (args.path) {
        rgArgs.push(args.path);
      }
      
      // Add common flags
      if (args.case_insensitive) rgArgs.push('--ignore-case');
      if (args.line_numbers) rgArgs.push('--line-number');
      if (args.context) rgArgs.push(`--context=${args.context}`);
      if (args.only_matching) rgArgs.push('--only-matching');
      if (args.files_with_matches) rgArgs.push('--files-with-matches');
      if (args.json) rgArgs.push('--json');
      if (args.type) rgArgs.push(`--type=${args.type}`);
      
      return new Promise((resolve) => {
        const child = spawn('rg', rgArgs);
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        child.on('close', (code) => {
          if (code === 0) {
            resolve({
              success: true,
              output: stdout.trim()
            });
          } else if (code === 1) {
            // ripgrep returns 1 when no matches found
            resolve({
              success: true,
              output: 'No matches found'
            });
          } else {
            resolve({
              success: false,
              error: stderr || `ripgrep exited with code ${code}`
            });
          }
        });
        
        child.on('error', (error) => {
          resolve({
            success: false,
            error: `Failed to execute ripgrep: ${error.message}`
          });
        });
      });
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}