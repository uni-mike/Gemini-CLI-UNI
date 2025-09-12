/**
 * File Operations Tool
 * Read, write, edit files
 */

import { Tool, ToolParams, ToolResult, ParameterSchema } from './base.js';
import { readFile, writeFile } from 'fs/promises';

export class FileTool extends Tool {
  name = 'file';
  description = 'File operations (read, write, create files)';
  
  parameterSchema: ParameterSchema[] = [
    { name: 'action', type: 'string', required: true, enum: ['read', 'write'], description: 'Operation to perform' },
    { name: 'path', type: 'string', required: true, description: 'File path' },
    { name: 'content', type: 'string', required: false, description: 'Content to write (required for write action)' }
  ];
  
  async execute(params: ToolParams): Promise<ToolResult> {
    const { action, path, content } = params;
    
    try {
      switch (action) {
        case 'read':
          const data = await readFile(path as string, 'utf8');
          return { success: true, output: data };
          
        case 'write':
          await writeFile(path as string, content as string, 'utf8');
          
          // Generate git-diff style output for file creation
          const lines = (content as string).split('\n');
          const preview = lines.slice(0, 10).map((line, i) => 
            `       ${i + 1} +  ${line}`
          ).join('\n');
          
          const diffOutput = `Created ${path} with ${lines.length} lines
${preview}${lines.length > 10 ? `\n       ... (${lines.length - 10} more lines)` : ''}`;
          
          return { success: true, output: diffOutput };
          
        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}