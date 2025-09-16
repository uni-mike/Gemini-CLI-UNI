/**
 * Cat Tool - Display file contents
 * Similar to Unix cat command for viewing files
 */

import { Tool, ToolResult, ParameterSchema } from './base.js';
import { readFile, access } from 'fs/promises';
import { constants } from 'fs';

export class CatTool extends Tool {
  name = 'cat';
  description = 'Display file contents (like Unix cat command)';

  parameterSchema: ParameterSchema[] = [
    { name: 'file_path', type: 'string', required: true, description: 'Path to file to display' },
    { name: 'lines', type: 'number', required: false, description: 'Number of lines to show (default: all)' },
    { name: 'start_line', type: 'number', required: false, description: 'Starting line number (1-based)' }
  ];

  async execute(args: any): Promise<ToolResult> {
    try {
      const filePath = args.file_path;
      const maxLines = args.lines;
      const startLine = args.start_line || 1;

      if (!filePath) {
        return {
          success: false,
          error: 'file_path parameter is required'
        };
      }

      // Check if file exists
      try {
        await access(filePath, constants.F_OK);
      } catch {
        return {
          success: false,
          error: `File not found: ${filePath}`
        };
      }

      // Read file content
      const content = await readFile(filePath, 'utf8');

      // Handle line-based display
      if (maxLines || startLine > 1) {
        const lines = content.split('\n');
        const endLine = maxLines ? Math.min(startLine + maxLines - 1, lines.length) : lines.length;
        const selectedLines = lines.slice(startLine - 1, endLine);

        return {
          success: true,
          output: selectedLines.join('\n'),
          metadata: {
            file_path: filePath,
            total_lines: lines.length,
            displayed_lines: selectedLines.length,
            start_line: startLine,
            end_line: endLine
          }
        };
      }

      // Display full file
      return {
        success: true,
        output: content,
        metadata: {
          file_path: filePath,
          total_lines: content.split('\n').length,
          size_bytes: content.length
        }
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to read file: ${error.message}`,
        output: error.stack
      };
    }
  }

  validate(params: any): boolean {
    return typeof params.file_path === 'string' && params.file_path.length > 0;
  }
}