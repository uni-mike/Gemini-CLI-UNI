/**
 * Formatter for tool execution results
 * Provides rich, informative summaries like Claude Code
 */

import { AnsiColors, colorize, ColorThemes } from './AnsiColors.js';
import { DiffFormatter } from './DiffFormatter.js';

export class ResultFormatter {
  private diffFormatter = new DiffFormatter();

  /**
   * Format tool result based on tool type and content
   */
  formatResult(
    functionName: string, 
    args: any, 
    result: string, 
    originalContent?: string
  ): string {
    // File read operations
    if (this.isReadOperation(functionName)) {
      return this.formatReadResult(result);
    }
    
    // File write operations
    if (this.isWriteOperation(functionName)) {
      return this.formatWriteResult(args, result);
    }
    
    // File update/replace operations
    if (this.isUpdateOperation(functionName)) {
      return this.formatUpdateResult(args, originalContent);
    }
    
    // Shell command operations
    if (this.isShellOperation(functionName)) {
      return this.formatShellResult(result);
    }
    
    // Web search operations
    if (this.isWebSearchOperation(functionName)) {
      return this.formatWebSearchResult(result);
    }
    
    // Search/grep operations
    if (this.isSearchOperation(functionName)) {
      return this.formatSearchResult(result);
    }
    
    // Generic result
    return this.formatGenericResult(result);
  }

  private isReadOperation(name: string): boolean {
    return /read_file|read-file/i.test(name);
  }

  private isWriteOperation(name: string): boolean {
    return /write_file|write-file/i.test(name);
  }

  private isUpdateOperation(name: string): boolean {
    return /replace|edit|update/i.test(name);
  }

  private isShellOperation(name: string): boolean {
    return /shell|run_shell_command|bash/i.test(name);
  }

  private isWebSearchOperation(name: string): boolean {
    return /web_search|web-search/i.test(name);
  }

  private isSearchOperation(name: string): boolean {
    return /grep|search|find/i.test(name);
  }

  private formatReadResult(result: string): string {
    const lines = result.split('\n');
    
    if (lines.length <= 3) {
      return lines.join('\n     ');
    }
    
    return `Read ${lines.length} lines (ctrl+r to expand)`;
  }

  private formatWriteResult(args: any, result: string): string {
    const file = args.file_path || args.absolute_path || '';
    const fileName = file.split('/').pop() || 'file';
    const content = args.content || '';
    const lines = content.split('\n');
    
    if (lines.length <= 5) {
      // Show full content for small files
      const preview = lines.map((line: string, i: number) => 
        `     ${colorize((i + 1).toString().padStart(4), AnsiColors.gray)}  ${line.substring(0, 70)}`
      ).join('\n');
      return `Created ${fileName} with ${lines.length} lines\n${preview}`;
    } else {
      // Show preview for larger files
      const preview = lines.slice(0, 3).map((line: string, i: number) => 
        `     ${colorize((i + 1).toString().padStart(4), AnsiColors.gray)}  ${line.substring(0, 70)}`
      ).join('\n');
      const remaining = lines.length - 3;
      return `Created ${fileName} with ${lines.length} lines\n${preview}\n     ${colorize(`… +${remaining} lines (ctrl+r to expand)`, AnsiColors.dim)}`;
    }
  }

  private formatUpdateResult(args: any, originalContent?: string): string {
    const file = args.file_path || args.path || '';
    const fileName = file.split('/').pop() || 'file';
    const oldText = args.old_text || args.old_string || originalContent || '';
    const newText = args.new_text || args.new_string || '';
    
    if (oldText && newText) {
      return this.diffFormatter.generateDiff(oldText, newText, fileName);
    }
    
    return `Updated ${fileName}`;
  }

  private formatShellResult(result: string): string {
    const lines = result.split('\n').filter(l => l.trim());
    
    if (lines.length === 0) {
      return ColorThemes.success('✓ Command completed');
    }
    
    if (lines.length <= 3) {
      // Show all lines for short output
      return lines.map(line => `     ${line.substring(0, 80)}`).join('\n');
    }
    
    // Show first few lines and count for long output
    const preview = lines.slice(0, 3).map(line => 
      `     ${line.substring(0, 80)}`
    ).join('\n');
    const remaining = lines.length - 3;
    return `${preview}\n     ${colorize(`… +${remaining} lines (ctrl+r to expand)`, AnsiColors.dim)}`;
  }

  private formatWebSearchResult(result: string): string {
    const resultCount = (result.match(/\d+\./g) || []).length;
    
    if (resultCount === 0) {
      return 'No results found';
    }
    
    const lines = result.split('\n');
    const output: string[] = [];
    
    // Look for direct answer or price
    const answerLine = lines.find(l => 
      l.toLowerCase().includes('answer:') || 
      l.toLowerCase().includes('price:') ||
      l.includes('USD') && l.includes('$')
    );
    
    if (answerLine) {
      // Clean up and highlight the answer
      const answer = answerLine.replace(/.*?(answer:|price:)/i, '').trim();
      output.push(colorize('💰 ' + answer, AnsiColors.green));
      output.push('');
    }
    
    // Show top 3 sources concisely
    let resultNum = 0;
    let currentResult: string[] = [];
    
    for (const line of lines) {
      if (line.match(/^\d+\./)) {
        // Process previous result if exists
        if (currentResult.length > 0 && resultNum <= 3) {
          const title = currentResult[0].replace(/^\d+\./, '').trim();
          const source = currentResult.find(l => l.includes('Source:'))?.replace('📰 Source:', '').trim() || '';
          const snippet = currentResult.find(l => !l.includes('Source:') && !l.includes('http') && l.length > 20);
          
          if (source) {
            output.push(`  ${colorize('•', AnsiColors.dim)} ${source}: ${snippet ? snippet.substring(0, 60) + '...' : title.substring(0, 60)}`);
          }
        }
        
        resultNum++;
        currentResult = [line];
      } else if (line.trim()) {
        currentResult.push(line);
      }
    }
    
    // Process last result
    if (currentResult.length > 0 && resultNum <= 3) {
      const source = currentResult.find(l => l.includes('Source:'))?.replace('📰 Source:', '').trim() || '';
      const snippet = currentResult.find(l => !l.includes('Source:') && !l.includes('http') && l.length > 20);
      
      if (source) {
        output.push(`  ${colorize('•', AnsiColors.dim)} ${source}: ${snippet ? snippet.substring(0, 60) + '...' : ''}`);
      }
    }
    
    if (resultCount > 3) {
      output.push(colorize(`  • ${resultCount - 3} more sources`, AnsiColors.dim));
    }
    
    return output.join('\n');
  }

  private formatSearchResult(result: string): string {
    const matches = result.split('\n').filter(l => l.trim());
    
    if (matches.length === 0) {
      return 'No matches found';
    }
    
    if (matches.length <= 2) {
      return matches.join('\n     ');
    }
    
    return `Found ${matches.length} matches (ctrl+r to expand)`;
  }

  private formatGenericResult(result: string): string {
    if (result.toLowerCase().includes('success')) {
      return ColorThemes.success('✓ Success');
    }
    
    if (result.toLowerCase().includes('error')) {
      return ColorThemes.error(`✗ ${result.substring(0, 50)}`);
    }
    
    const lines = result.split('\n');
    if (lines.length > 3) {
      const remaining = lines.length - 1;
      return `${lines[0].substring(0, 60)}\n     ${colorize(`… +${remaining} lines`, AnsiColors.dim)}`;
    }
    
    return result.substring(0, 80) + (result.length > 80 ? '...' : '');
  }
}