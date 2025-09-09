/**
 * Glob Tool for pattern matching
 */

import { Tool, ToolResult } from './base.js';
import { glob } from 'glob';
import { stat } from 'fs/promises';

export class GlobTool extends Tool {
  name = 'glob';
  description = 'Find files matching patterns';
  
  async execute(args: any): Promise<ToolResult> {
    try {
      const pattern = args.pattern || args.glob;
      
      if (!pattern) {
        return {
          success: false,
          error: 'pattern parameter is required'
        };
      }
      
      const options = {
        cwd: args.cwd || process.cwd(),
        dot: args.include_hidden || false,
        ignore: args.ignore || [],
        absolute: args.absolute || false
      };
      
      const matches = await glob(pattern, options);
      
      // Add file details if requested
      if (args.with_details) {
        const details = await Promise.all(
          matches.map(async (file) => {
            try {
              const stats = await stat(file);
              return {
                path: file,
                type: stats.isDirectory() ? 'directory' : 'file',
                size: stats.size,
                modified: stats.mtime
              };
            } catch {
              return {
                path: file,
                type: 'unknown',
                size: 0,
                modified: null
              };
            }
          })
        );
        
        return {
          success: true,
          output: JSON.stringify(details, null, 2)
        };
      }
      
      return {
        success: true,
        output: matches.join('\n')
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}