/**
 * Smart Edit Tool with advanced editing capabilities
 */

import { Tool, ToolResult } from './base';
import { readFile, writeFile } from 'fs/promises';

export class SmartEditTool extends Tool {
  name = 'smart_edit';
  description = 'Advanced file editing with pattern matching and validation';
  
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
      
      const changes = this.getChangeSummary(originalContent, content);
      
      return {
        success: true,
        output: `File edited successfully. ${changes}`
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
}