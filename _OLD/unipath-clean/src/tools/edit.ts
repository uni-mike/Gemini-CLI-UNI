/**
 * Edit Tool
 * Modify files with string replacement
 */

import { Tool, ToolParams, ToolResult, ParameterSchema } from './base.js';
import { readFile, writeFile } from 'fs/promises';

export class EditTool extends Tool {
  name = 'edit';
  description = 'Edit files by replacing text';
  
  parameterSchema: ParameterSchema[] = [
    { name: 'path', type: 'string', required: true, description: 'File path to edit' },
    { name: 'oldText', type: 'string', required: true, description: 'Text to replace' },
    { name: 'newText', type: 'string', required: true, description: 'Replacement text' }
  ];
  
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
      
      // Generate git-diff style output
      const oldLines = content.split('\n');
      const newLines = newContent.split('\n');
      
      // Find the line numbers where changes occurred
      let diffOutput = `Updated ${path}\n`;
      let lineNum = 0;
      let changesShown = 0;
      const maxChanges = 5; // Show max 5 changed sections
      
      for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
        lineNum++;
        if (oldLines[i] !== newLines[i] && changesShown < maxChanges) {
          // Show context (1 line before if available)
          if (i > 0 && oldLines[i-1] === newLines[i-1]) {
            diffOutput += `       ${lineNum - 1}    ${oldLines[i-1]}\n`;
          }
          
          // Show the change
          if (i < oldLines.length) {
            diffOutput += `       ${lineNum} -  ${oldLines[i]}\n`;
          }
          if (i < newLines.length) {
            diffOutput += `       ${lineNum} +  ${newLines[i]}\n`;
          }
          
          // Show context (1 line after if available)
          if (i + 1 < oldLines.length && i + 1 < newLines.length && oldLines[i+1] === newLines[i+1]) {
            diffOutput += `       ${lineNum + 1}    ${oldLines[i+1]}\n`;
          }
          
          changesShown++;
        }
      }
      
      if (changesShown >= maxChanges) {
        diffOutput += `       ... (more changes)\n`;
      }
      
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
  
  validate(params: ToolParams): boolean {
    return !!(params.path && params.oldText && params.newText !== undefined);
  }
}