/**
 * Write File Tool with advanced features
 */

import { Tool, ToolResult } from './base';
import { writeFile, mkdir, access, readFile } from 'fs/promises';
import { dirname } from 'path';
import { constants } from 'fs';

export class WriteFileTool extends Tool {
  name = 'write_file';
  description = 'Write content to files with backup and directory creation';
  
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
      
      return {
        success: true,
        output: `File written: ${filePath}`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}