/**
 * RipGrep Tool for advanced searching
 */

import { Tool, ToolResult, ParameterSchema } from './base.js';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { processCleanup } from '../utils/process-cleanup.js';

export class RipGrepTool extends Tool {
  name = 'rg';
  description = 'Fast text search with ripgrep';
  
  parameterSchema: ParameterSchema[] = [
    { name: 'pattern', type: 'string', required: true, description: 'Search pattern (regex)' },
    { name: 'path', type: 'string', required: false, default: '.', description: 'Path to search' },
    { name: 'case_insensitive', type: 'boolean', required: false, default: false, description: 'Case insensitive search' },
    { name: 'word_regexp', type: 'boolean', required: false, default: false, description: 'Match whole words only' },
    { name: 'fixed_strings', type: 'boolean', required: false, default: false, description: 'Treat pattern as literal string' },
    { name: 'type', type: 'string', required: false, description: 'File type filter (e.g., js, py, rust)' },
    { name: 'glob', type: 'string', required: false, description: 'Include files matching glob' },
    { name: 'max_count', type: 'number', required: false, description: 'Max matches per file' }
  ];

  private findRipgrep(): string {
    // Try common locations for ripgrep
    const locations = [
      'rg', // Try PATH first
      '/usr/local/bin/rg',
      '/opt/homebrew/bin/rg',
      '/usr/bin/rg',
      // Claude Code vendor location
      '/Users/mike.admon/.nvm/versions/node/v20.18.3/lib/node_modules/@anthropic-ai/claude-code/vendor/ripgrep/arm64-darwin/rg'
    ];

    for (const location of locations) {
      try {
        if (location === 'rg') {
          // Test if rg is in PATH
          execSync('which rg', { stdio: 'ignore' });
          return 'rg';
        } else if (existsSync(location)) {
          return location;
        }
      } catch {
        continue;
      }
    }

    // If nothing found, return 'rg' and let spawn handle the error
    return 'rg';
  }

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
        // Try to find ripgrep in common locations
        const rgBinary = this.findRipgrep();
        const child = spawn(rgBinary, rgArgs);

        // Register with process cleanup manager
        processCleanup.register(child);

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