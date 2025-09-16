/**
 * Formatter for tool display in Claude Code style
 * Provides consistent, beautiful tool execution displays
 */

import { AnsiColors, colorize } from './AnsiColors.js';

export class ToolDisplayFormatter {
  /**
   * Format tool name and arguments for display
   */
  formatToolCall(functionName: string, args: any): string {
    const displayName = this.getDisplayName(functionName, args);
    return `⏺ ${colorize(displayName, AnsiColors.bold)}`;
  }

  /**
   * Format tool result with proper indentation
   */
  formatToolResult(result: string): string[] {
    const lines = result.split('\n');
    
    if (lines.length === 0) {
      return [`  ⎿  ${colorize('✓', AnsiColors.green)} Done`];
    }
    
    // First line with arrow
    const formatted = [`  ⎿  ${lines[0]}`];
    
    // Additional lines with proper indentation
    for (let i = 1; i < lines.length; i++) {
      formatted.push(lines[i]);
    }
    
    return formatted;
  }

  /**
   * Format error message
   */
  formatToolError(error: string): string {
    return `  ⎿  ${colorize(`✗ Error: ${error}`, AnsiColors.red)}`;
  }

  private getDisplayName(functionName: string, args: any): string {
    // File operations
    if (this.isFileOperation(functionName)) {
      return this.formatFileOperation(functionName, args);
    }
    
    // Shell commands
    if (this.isShellCommand(functionName)) {
      return this.formatShellCommand(args);
    }
    
    // Web operations
    if (this.isWebOperation(functionName)) {
      return this.formatWebOperation(functionName, args);
    }
    
    // Search operations
    if (this.isSearchOperation(functionName)) {
      return this.formatSearchOperation(args);
    }
    
    // Default formatting
    return this.formatDefault(functionName);
  }

  private isFileOperation(name: string): boolean {
    return /read_file|write_file|replace|edit|read-file|write-file/i.test(name);
  }

  private isShellCommand(name: string): boolean {
    return /shell|run_shell_command|run-shell-command|bash/i.test(name);
  }

  private isWebOperation(name: string): boolean {
    return /web_search|web-search|webSearch|web_fetch|web-fetch/i.test(name);
  }

  private isSearchOperation(name: string): boolean {
    return /grep|search|find/i.test(name);
  }

  private formatFileOperation(functionName: string, args: any): string {
    const file = args.file_path || args.absolute_path || args.path || '';
    
    if (functionName.includes('read')) {
      return `Read(${file})`;
    } else if (functionName.includes('write')) {
      return `Write(${file})`;
    } else if (functionName.includes('replace') || functionName.includes('edit')) {
      return `Update(${file})`;
    }
    
    return `File(${file})`;
  }

  private formatShellCommand(args: any): string {
    const cmd = args.command || '';
    
    if (cmd.length <= 60) {
      return `Bash(${cmd})`;
    } else {
      return `Bash(${cmd.substring(0, 57)}...)`;
    }
  }

  private formatWebOperation(functionName: string, args: any): string {
    if (functionName.includes('search')) {
      const query = args.query || args.q || '';
      return `WebSearch(query: "${query}")`;
    } else if (functionName.includes('fetch')) {
      const url = args.url || '';
      return `WebFetch(${url})`;
    }
    
    return 'Web()';
  }

  private formatSearchOperation(args: any): string {
    const pattern = args.pattern || args.query || '';
    const path = args.path || '.';
    
    if (pattern.length > 30) {
      return `Search(pattern: "${pattern.substring(0, 27)}...", path: "${path}")`;
    }
    
    return `Search(pattern: "${pattern}", path: "${path}")`;
  }

  private formatDefault(functionName: string): string {
    // Convert snake_case to Title Case
    const readable = functionName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
    
    return readable;
  }
}