/**
 * Read File Tool with advanced features
 */

import { Tool, ToolResult, ParameterSchema } from './base.js';
import { readFile, access } from 'fs/promises';
import { constants } from 'fs';

export class ReadFileTool extends Tool {
  name = 'read_file';
  description = 'Read file contents with options for partial reading and encoding';
  
  parameterSchema: ParameterSchema[] = [
    { name: 'file_path', type: 'string', required: true, description: 'Path to file to read' },
    { name: 'encoding', type: 'string', required: false, default: 'utf8', description: 'File encoding' },
    { name: 'start', type: 'number', required: false, default: 0, description: 'Start position in bytes' },
    { name: 'end', type: 'number', required: false, description: 'End position in bytes' },
    { name: 'lines', type: 'number', required: false, description: 'Number of lines to read' }
  ];
  
  async execute(args: any): Promise<ToolResult> {
    try {
      const filePath = args.file_path || args.path;
      
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
      
      const encoding = args.encoding || 'utf8';
      const start = args.start || 0;
      const end = args.end;
      
      let content = await readFile(filePath, encoding as BufferEncoding);
      
      // Handle partial reading
      if (start > 0 || end !== undefined) {
        const lines = content.split('\n');
        const endLine = end !== undefined ? Math.min(end, lines.length) : lines.length;
        content = lines.slice(start, endLine).join('\n');
      }
      
      // Add line numbers if requested
      if (args.with_line_numbers) {
        const lines = content.split('\n');
        content = lines.map((line, i) => `${i + 1 + start}: ${line}`).join('\n');
      }
      
      return {
        success: true,
        output: content
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}