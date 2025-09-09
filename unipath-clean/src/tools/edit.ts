/**
 * Edit Tool
 * Modify files with string replacement
 */

import { Tool, ToolParams, ToolResult } from './base.js';
import { readFile, writeFile } from 'fs/promises';

export class EditTool extends Tool {
  name = 'edit';
  description = 'Edit files by replacing text';
  
  async execute(params: ToolParams): Promise<ToolResult> {
    const { path, oldText, newText } = params;
    
    if (!path || !oldText || newText === undefined) {
      return {
        success: false,
        error: 'Missing required parameters: path, oldText, newText'
      };
    }
    
    try {
      // Read file
      const content = await readFile(path as string, 'utf8');
      
      // Check if old text exists
      if (!content.includes(oldText as string)) {
        return {
          success: false,
          error: `Text not found in file: "${oldText}"`
        };
      }
      
      // Replace text
      const newContent = content.replace(oldText as string, newText as string);
      
      // Write file
      await writeFile(path as string, newContent, 'utf8');
      
      return {
        success: true,
        output: `File edited successfully: ${path}`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  validate(params: ToolParams): boolean {
    return !!(params.path && params.oldText && params.newText !== undefined);
  }
}