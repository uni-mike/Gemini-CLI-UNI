/**
 * Tree Tool for displaying directory structure
 */

import { Tool, ToolResult, ParameterSchema } from './base.js';
import { spawn } from 'child_process';

export class TreeTool extends Tool {
  name = 'tree';
  description = 'Display directory structure in a tree format';

  parameterSchema: ParameterSchema[] = [
    { name: 'path', type: 'string', required: false, default: '.', description: 'Directory to display tree for' },
    { name: 'depth', type: 'number', required: false, description: 'Maximum depth of tree to display (default: 3)' },
    { name: 'show_hidden', type: 'boolean', required: false, default: false, description: 'Show hidden files and directories' },
    { name: 'dirs_only', type: 'boolean', required: false, default: false, description: 'Show directories only' },
    { name: 'include_node_modules', type: 'boolean', required: false, default: false, description: 'Include node_modules in traversal (WARNING: slow!)' }
  ];

  async execute(params: {
    path?: string;
    depth?: number;
    show_hidden?: boolean;
    dirs_only?: boolean;
    include_node_modules?: boolean;
  }): Promise<ToolResult> {
    const { path = '.', depth = 3, show_hidden = false, dirs_only = false, include_node_modules = false } = params;

    return new Promise((resolve) => {
      // Build tree command arguments
      const args: string[] = [path];

      if (depth) {
        args.push('-L', depth.toString());
      }

      if (show_hidden) {
        args.push('-a');
      }

      if (dirs_only) {
        args.push('-d');
      }

      // Add some useful tree options
      args.push('-F'); // Add file type indicators
      args.push('--charset', 'ascii'); // Use ASCII characters for compatibility

      // Smart exclusion pattern - always exclude dangerous heavy directories
      let excludePattern = '.git|dist|build|coverage|.cache|.npm|.next|.nuxt|.vite|tmp|temp';

      // Only exclude node_modules if not explicitly requested
      if (!include_node_modules) {
        excludePattern += '|node_modules';
      }

      args.push('-I', excludePattern);

      // Add file count and size if not too deep
      if (depth <= 3) {
        args.push('--du', '--dirsfirst');
      }

      // Add warning comment for node_modules inclusion
      if (include_node_modules && depth > 2) {
        console.warn('⚠️  WARNING: Including node_modules with depth > 2 may be very slow!');
      }

      const process = spawn('tree', args, {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let error = '';

      process.stdout?.on('data', (data) => {
        output += data.toString();
      });

      process.stderr?.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            output: output.trim(),
            data: { path, structure: output.trim() }
          });
        } else {
          // If tree command is not available, provide a fallback
          if (error.includes('command not found') || error.includes('not recognized')) {
            resolve({
              success: false,
              error: 'Tree command not available. Install with: brew install tree (macOS) or apt-get install tree (Linux)',
              data: { fallback: 'Use ls -la for basic directory listing' }
            });
          } else {
            resolve({
              success: false,
              error: error.trim() || `Tree command failed with exit code ${code}`,
              data: { code, stderr: error.trim() }
            });
          }
        }
      });

      process.on('error', (err) => {
        resolve({
          success: false,
          error: `Failed to execute tree command: ${err.message}`,
          data: { error: err.message }
        });
      });
    });
  }
}