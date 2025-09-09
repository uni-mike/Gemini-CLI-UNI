/**
 * Git-diff style formatter for file changes
 * Provides Claude Code-like diff display
 */

import { AnsiColors, colorize } from './AnsiColors.js';

export interface DiffOptions {
  contextLines?: number;
  maxPreviewLines?: number;
  showLineNumbers?: boolean;
}

export class DiffFormatter {
  private readonly defaultOptions: Required<DiffOptions> = {
    contextLines: 2,
    maxPreviewLines: 8,
    showLineNumbers: true,
  };

  /**
   * Generate a git-diff style display for file changes
   */
  generateDiff(
    oldText: string,
    newText: string,
    fileName: string,
    options?: DiffOptions
  ): string {
    const opts = { ...this.defaultOptions, ...options };
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    
    // Find changed line ranges
    const changes = this.findChangedLines(oldLines, newLines);
    
    if (changes.length === 0) {
      return 'No changes detected';
    }
    
    // Generate summary
    const summary = this.generateSummary(fileName, oldLines.length, newLines.length);
    
    // Generate diff preview
    const diffPreview = this.generateDiffPreview(
      oldLines,
      newLines,
      changes,
      opts
    );
    
    return [summary, ...diffPreview].join('\n');
  }

  private findChangedLines(
    oldLines: string[],
    newLines: string[]
  ): Array<{ start: number; end: number }> {
    const changes: Array<{ start: number; end: number }> = [];
    let currentChange: { start: number; end: number } | null = null;
    
    const maxLength = Math.max(oldLines.length, newLines.length);
    
    for (let i = 0; i < maxLength; i++) {
      if (oldLines[i] !== newLines[i]) {
        if (!currentChange) {
          currentChange = { start: i, end: i };
        } else {
          currentChange.end = i;
        }
      } else if (currentChange) {
        changes.push(currentChange);
        currentChange = null;
      }
    }
    
    if (currentChange) {
      changes.push(currentChange);
    }
    
    return changes;
  }

  private generateSummary(
    fileName: string,
    oldLineCount: number,
    newLineCount: number
  ): string {
    const additions = Math.max(0, newLineCount - oldLineCount);
    const deletions = Math.max(0, oldLineCount - newLineCount);
    
    let summary = `Updated ${fileName}`;
    
    if (additions > 0 && deletions > 0) {
      summary += ` with ${additions} addition${additions > 1 ? 's' : ''} and ${deletions} deletion${deletions > 1 ? 's' : ''}`;
    } else if (additions > 0) {
      summary += ` with ${additions} addition${additions > 1 ? 's' : ''}`;
    } else if (deletions > 0) {
      summary += ` with ${deletions} deletion${deletions > 1 ? 's' : ''}`;
    }
    
    return summary;
  }

  private generateDiffPreview(
    oldLines: string[],
    newLines: string[],
    changes: Array<{ start: number; end: number }>,
    opts: Required<DiffOptions>
  ): string[] {
    const diff: string[] = [];
    
    if (changes.length === 0) return diff;
    
    // Get the range to show (first change with context)
    const firstChange = changes[0];
    const startLine = Math.max(0, firstChange.start - opts.contextLines);
    const endLine = Math.min(
      Math.max(oldLines.length, newLines.length),
      firstChange.end + opts.contextLines + 1
    );
    
    // Generate diff lines
    for (let i = startLine; i < Math.min(startLine + opts.maxPreviewLines, endLine); i++) {
      const lineNum = i + 1;
      const oldLine = oldLines[i];
      const newLine = newLines[i];
      
      if (oldLine === newLine && oldLine !== undefined) {
        // Context line
        diff.push(this.formatContextLine(lineNum, oldLine, opts));
      } else {
        if (oldLine !== undefined && newLine !== undefined && oldLine !== newLine) {
          // Changed line
          diff.push(this.formatDeletionLine(lineNum, oldLine, opts));
          diff.push(this.formatAdditionLine(lineNum, newLine, opts));
        } else if (oldLine !== undefined && newLine === undefined) {
          // Deleted line
          diff.push(this.formatDeletionLine(lineNum, oldLine, opts));
        } else if (newLine !== undefined && oldLine === undefined) {
          // Added line
          diff.push(this.formatAdditionLine(lineNum, newLine, opts));
        }
      }
    }
    
    // Add truncation message if needed
    if (endLine - startLine > opts.maxPreviewLines) {
      const remainingLines = endLine - startLine - opts.maxPreviewLines;
      diff.push(
        `     ${colorize(`… +${remainingLines} lines (ctrl+r to expand)`, AnsiColors.dim)}`
      );
    }
    
    return diff;
  }

  private formatContextLine(lineNum: number, content: string, opts: Required<DiffOptions>): string {
    const lineNumStr = opts.showLineNumbers 
      ? colorize(lineNum.toString().padStart(4), AnsiColors.gray) 
      : '';
    return `     ${lineNumStr}  ${content.substring(0, 70)}`;
  }

  private formatAdditionLine(lineNum: number, content: string, opts: Required<DiffOptions>): string {
    const lineNumStr = opts.showLineNumbers 
      ? colorize(lineNum.toString().padStart(4), AnsiColors.gray) 
      : '';
    const marker = colorize('+', AnsiColors.green);
    const text = colorize(content.substring(0, 70), AnsiColors.green);
    return `     ${lineNumStr}${marker} ${text}`;
  }

  private formatDeletionLine(lineNum: number, content: string, opts: Required<DiffOptions>): string {
    const lineNumStr = opts.showLineNumbers 
      ? colorize(lineNum.toString().padStart(4), AnsiColors.gray) 
      : '';
    const marker = colorize('-', AnsiColors.red);
    const text = colorize(content.substring(0, 70), AnsiColors.red);
    return `     ${lineNumStr}${marker} ${text}`;
  }
}