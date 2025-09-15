/**
 * Glob Tool for pattern matching
 */

import { Tool, ToolResult, ParameterSchema } from './base.js';
import { glob } from 'glob';
import { stat } from 'fs/promises';

export class GlobTool extends Tool {
  name = 'glob';
  description = 'Find files matching glob patterns';
  
  parameterSchema: ParameterSchema[] = [
    { name: 'pattern', type: 'string', required: true, description: 'Glob pattern (e.g., **/*.js, src/*.ts)' },
    { name: 'cwd', type: 'string', required: false, description: 'Working directory' },
    { name: 'include_hidden', type: 'boolean', required: false, default: false, description: 'Include hidden files' },
    { name: 'ignore', type: 'object', required: false, description: 'Patterns to ignore' },
    { name: 'absolute', type: 'boolean', required: false, default: false, description: 'Return absolute paths' },
    { name: 'with_details', type: 'boolean', required: false, default: false, description: 'Include file details' }
  ];
  
  async execute(args: any): Promise<ToolResult> {
    try {
      const pattern = args.pattern || args.glob;
      
      if (!pattern) {
        return {
          success: false,
          error: 'pattern parameter is required'
        };
      }

      // Validate pattern format
      if (typeof pattern !== 'string' || pattern.trim().length === 0) {
        return {
          success: false,
          error: 'pattern must be a non-empty string'
        };
      }

      // Basic pattern validation - warn about suspicious patterns
      if (pattern.length < 3 && !pattern.includes('*') && !pattern.includes('?')) {
        console.warn(`⚠️  Suspicious glob pattern: "${pattern}". Did you mean "${pattern}*" or "*${pattern}*"?`);
      }
      
      const options = {
        cwd: args.cwd || process.cwd(),
        dot: args.include_hidden || false,
        ignore: args.ignore || [],
        absolute: args.absolute || false
      };
      
      const matches = await glob(pattern, options);

      // Ensure matches is always an array
      const matchArray = Array.isArray(matches) ? matches : [];

      // Add file details if requested
      if (args.with_details) {
        const details = await Promise.all(
          matchArray.map(async (file) => {
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
        output: matchArray.join('\n')
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}