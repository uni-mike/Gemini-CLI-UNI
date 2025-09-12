/**
 * Write File Tool with advanced features
 */

import { Tool, ToolResult, ParameterSchema } from './base.js';
import { writeFile, mkdir, access, readFile } from 'fs/promises';
import { dirname } from 'path';
import { constants } from 'fs';

export class WriteFileTool extends Tool {
  name = 'write_file';
  description = 'Write content to files with backup and directory creation';
  
  parameterSchema: ParameterSchema[] = [
    { name: 'file_path', type: 'string', required: true, description: 'Path to file to write' },
    { name: 'content', type: 'string', required: true, description: 'Content to write to file' },
    { name: 'create_backup', type: 'boolean', required: false, default: false, description: 'Create backup before overwriting' },
    { name: 'append', type: 'boolean', required: false, default: false, description: 'Append to file instead of overwriting' },
    { name: 'encoding', type: 'string', required: false, default: 'utf8', description: 'File encoding' }
  ];
  
  async execute(args: any): Promise<ToolResult> {
    try {
      const filePath = args.file_path || args.path;
      const content = args.content || '';
      
      if (!filePath) {
        return {
          success: false,
          error: 'file_path parameter is required'
        };
      }
      
      // Create directory if it doesn't exist
      const dir = dirname(filePath);
      try {
        await access(dir, constants.F_OK);
      } catch {
        await mkdir(dir, { recursive: true });
      }
      
      // Create backup if file exists and backup is requested
      if (args.create_backup) {
        try {
          await access(filePath, constants.F_OK);
          const backupPath = `${filePath}.backup`;
          const originalContent = await readFile(filePath);
          await writeFile(backupPath, originalContent);
        } catch {
          // File doesn't exist, no backup needed
        }
      }
      
      // Write the file
      const encoding = args.encoding || 'utf8';
      await writeFile(filePath, content, encoding as BufferEncoding);
      
      // Verify write
      const written = await readFile(filePath, encoding as BufferEncoding);
      if (written !== content) {
        return {
          success: false,
          error: 'File write verification failed'
        };
      }
      
      // Generate git-diff style output
      const lines = content.split('\n');
      const preview = lines.slice(0, 10).map((line: string, i: number) => 
        `       ${i + 1} +  ${line}`
      ).join('\n');
      
      const diffOutput = `Created ${filePath} with ${lines.length} lines\n${preview}${lines.length > 10 ? `\n       ... (${lines.length - 10} more lines)` : ''}`;
      
      return {
        success: true,
        output: diffOutput
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}