/**
 * Smart Edit Tool with advanced editing capabilities
 */

import { Tool, ToolResult, ParameterSchema } from './base.js';
import { readFile, writeFile } from 'fs/promises';

export class SmartEditTool extends Tool {
  name = 'smart_edit';
  description = 'Advanced file editing with pattern matching and validation';
  
  parameterSchema: ParameterSchema[] = [
    { name: 'file_path', type: 'string', required: true, description: 'File to edit' },
    { name: 'operation', type: 'string', required: false, default: 'replace', enum: ['replace', 'insert', 'append', 'prepend', 'delete'], description: 'Edit operation' },
    { name: 'pattern', type: 'string', required: false, description: 'Pattern to search (for replace/delete)' },
    { name: 'replacement', type: 'string', required: false, description: 'Replacement text' },
    { name: 'text', type: 'string', required: false, description: 'Text to insert/append/prepend' },
    { name: 'line_number', type: 'number', required: false, description: 'Line number for insert operation' },
    { name: 'regex', type: 'boolean', required: false, default: false, description: 'Use regex for pattern matching' },
    { name: 'all', type: 'boolean', required: false, default: false, description: 'Replace all occurrences' }
  ];
  
  async execute(args: any): Promise<ToolResult> {
    try {
      const filePath = args.file_path || args.path;
      const operation = args.operation || 'replace';
      
      if (!filePath) {
        return {
          success: false,
          error: 'file_path parameter is required'
        };
      }
      
      let content = await readFile(filePath, 'utf8');
      const originalContent = content;
      
      switch (operation) {
        case 'replace':
          content = this.performReplace(content, args);
          break;
        case 'insert':
          content = this.performInsert(content, args);
          break;
        case 'delete':
          content = this.performDelete(content, args);
          break;
        case 'append':
          content = this.performAppend(content, args);
          break;
        case 'prepend':
          content = this.performPrepend(content, args);
          break;
        default:
          return {
            success: false,
            error: `Unknown operation: ${operation}`
          };
      }
      
      if (content === originalContent) {
        return {
          success: true,
          output: 'No changes made (pattern not found or no operation needed)'
        };
      }
      
      // Validate before writing if validator provided
      if (args.validate && typeof args.validate === 'function') {
        const validation = args.validate(content);
        if (!validation.valid) {
          return {
            success: false,
            error: `Validation failed: ${validation.error}`
          };
        }
      }
      
      await writeFile(filePath, content, 'utf8');
      
      // Generate git-diff style output
      const diffOutput = this.generateDiffOutput(filePath, originalContent, content, operation);
      
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
  
  private performReplace(content: string, args: any): string {
    const pattern = args.pattern || args.old_text;
    const replacement = args.replacement || args.new_text;
    
    if (!pattern) return content;
    
    if (args.regex) {
      const flags = args.flags || 'g';
      const regex = new RegExp(pattern, flags);
      return content.replace(regex, replacement || '');
    }
    
    if (args.all) {
      return content.split(pattern).join(replacement || '');
    }
    
    return content.replace(pattern, replacement || '');
  }
  
  private performInsert(content: string, args: any): string {
    const text = args.text || '';
    const position = args.position || 'end';
    const line = args.line;
    
    if (line !== undefined) {
      const lines = content.split('\n');
      const insertIndex = Math.max(0, Math.min(line, lines.length));
      lines.splice(insertIndex, 0, text);
      return lines.join('\n');
    }
    
    switch (position) {
      case 'start':
        return text + content;
      case 'end':
        return content + text;
      default:
        return content;
    }
  }
  
  private performDelete(content: string, args: any): string {
    const pattern = args.pattern;
    
    if (!pattern) return content;
    
    if (args.regex) {
      const flags = args.flags || 'g';
      const regex = new RegExp(pattern, flags);
      return content.replace(regex, '');
    }
    
    return content.split(pattern).join('');
  }
  
  private performAppend(content: string, args: any): string {
    const text = args.text || '';
    return content + (content.endsWith('\n') ? '' : '\n') + text;
  }
  
  private performPrepend(content: string, args: any): string {
    const text = args.text || '';
    return text + (text.endsWith('\n') ? '' : '\n') + content;
  }
  
  private getChangeSummary(original: string, modified: string): string {
    const originalLines = original.split('\n').length;
    const modifiedLines = modified.split('\n').length;
    const lineDiff = modifiedLines - originalLines;
    
    if (lineDiff === 0) {
      return 'Content modified';
    } else if (lineDiff > 0) {
      return `Added ${lineDiff} line${lineDiff !== 1 ? 's' : ''}`;
    } else {
      return `Removed ${Math.abs(lineDiff)} line${lineDiff !== -1 ? 's' : ''}`;
    }
  }
  
  private generateDiffOutput(filePath: string, original: string, modified: string, operation: string): string {
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');
    
    let output = `Updated ${filePath} (${operation})\n`;
    
    // For append/prepend, show what was added
    if (operation === 'append' || operation === 'prepend') {
      const addedLines = operation === 'append' 
        ? modifiedLines.slice(originalLines.length)
        : modifiedLines.slice(0, modifiedLines.length - originalLines.length);
      
      const startLine = operation === 'append' ? originalLines.length + 1 : 1;
      addedLines.slice(0, 10).forEach((line, i) => {
        output += `       ${startLine + i} +  ${line}\n`;
      });
      
      if (addedLines.length > 10) {
        output += `       ... (${addedLines.length - 10} more lines added)\n`;
      }
      return output;
    }
    
    // For other operations, show differences
    let changesShown = 0;
    const maxChanges = 5;
    
    for (let i = 0; i < Math.max(originalLines.length, modifiedLines.length); i++) {
      if (originalLines[i] !== modifiedLines[i] && changesShown < maxChanges) {
        // Show context
        if (i > 0 && originalLines[i-1] === modifiedLines[i-1]) {
          output += `       ${i}    ${originalLines[i-1]}\n`;
        }
        
        // Show the change
        if (i < originalLines.length && originalLines[i]) {
          output += `       ${i + 1} -  ${originalLines[i]}\n`;
        }
        if (i < modifiedLines.length && modifiedLines[i]) {
          output += `       ${i + 1} +  ${modifiedLines[i]}\n`;
        }
        
        changesShown++;
      }
    }
    
    if (changesShown >= maxChanges) {
      const totalChanges = this.countDifferences(originalLines, modifiedLines);
      output += `       ... (${totalChanges - maxChanges} more changes)\n`;
    }
    
    return output;
  }
  
  private countDifferences(original: string[], modified: string[]): number {
    let count = 0;
    for (let i = 0; i < Math.max(original.length, modified.length); i++) {
      if (original[i] !== modified[i]) count++;
    }
    return count;
  }
}