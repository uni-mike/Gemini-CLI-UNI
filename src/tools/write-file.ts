/**
 * Write File Tool with advanced features
 */

import { Tool, ToolResult, ParameterSchema } from './base.js';
import { writeFile, mkdir, access, readFile } from 'fs/promises';
import { dirname, extname } from 'path';
import { constants } from 'fs';
import { MemoryManager } from '../memory/memory-manager.js';

// Global memory manager access
declare global {
  var memoryManager: MemoryManager | undefined;
}

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

      // Store chunk for semantic retrieval if memory manager is available
      await this.storeCodeChunk(filePath, content);

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

  /**
   * Store code chunk for semantic retrieval
   * @param filePath File path
   * @param content File content
   */
  private async storeCodeChunk(filePath: string, content: string): Promise<void> {
    try {
      if (global.memoryManager && content.trim().length > 50) {
        const fileExt = extname(filePath).toLowerCase();

        // Determine language from file extension
        const languageMap: Record<string, string> = {
          '.ts': 'typescript',
          '.tsx': 'typescript',
          '.js': 'javascript',
          '.jsx': 'javascript',
          '.py': 'python',
          '.java': 'java',
          '.cpp': 'cpp',
          '.c': 'c',
          '.cs': 'csharp',
          '.php': 'php',
          '.rb': 'ruby',
          '.go': 'go',
          '.rs': 'rust',
          '.kt': 'kotlin',
          '.swift': 'swift',
          '.html': 'html',
          '.css': 'css',
          '.scss': 'scss',
          '.md': 'markdown',
          '.json': 'json',
          '.yml': 'yaml',
          '.yaml': 'yaml',
          '.xml': 'xml',
          '.sql': 'sql'
        };

        const language = languageMap[fileExt] || 'text';
        const chunkType = ['.md', '.txt', '.json', '.yml', '.yaml'].includes(fileExt) ? 'doc' : 'code';

        // Store the chunk with metadata
        await global.memoryManager.storeChunk(
          filePath,
          content,
          chunkType as 'code' | 'doc' | 'diff',
          {
            language,
            file_extension: fileExt,
            line_count: content.split('\n').length,
            char_count: content.length,
            created_by: 'write_file_tool',
            created_at: new Date().toISOString()
          }
        );
      }
    } catch (error: any) {
      // Don't fail the file write if chunk storage fails
      console.warn(`📦 [WRITE_FILE] Warning: Failed to store chunk for ${filePath}:`, error.message);
    }
  }
}