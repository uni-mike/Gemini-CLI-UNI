/**
 * Handles parsing of extremely large prompts (100k+ characters)
 * Uses streaming and chunking to prevent memory issues
 */

export class ExtremePromptParser {
  private readonly MAX_PROMPT_SIZE = 1024 * 1024; // 1MB limit
  private readonly CHUNK_SIZE = 10 * 1024; // 10KB chunks
  private readonly MAX_PARSE_TIME = 30000; // 30 second timeout

  async parseExtremePrompt(prompt: string): Promise<string> {
    if (prompt.length < this.MAX_PROMPT_SIZE) {
      return this.parseNormalPrompt(prompt);
    }

    console.log(`📖 Extreme prompt detected (${this.formatBytes(prompt.length)}), using streaming parser...`);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Prompt parsing timeout after ${this.MAX_PARSE_TIME}ms`));
      }, this.MAX_PARSE_TIME);

      try {
        const result = this.streamParsePrompt(prompt);
        clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  private parseNormalPrompt(prompt: string): string {
    return prompt.trim();
  }

  private streamParsePrompt(prompt: string): string {
    const chunks = this.chunkPrompt(prompt);
    const parsedChunks: string[] = [];
    let totalLength = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Parse chunk with safety checks
      const parsedChunk = this.parseChunkSafely(chunk, i);
      
      if (parsedChunk) {
        parsedChunks.push(parsedChunk);
        totalLength += parsedChunk.length;
        
        // Prevent runaway memory usage
        if (totalLength > this.MAX_PROMPT_SIZE * 2) {
          console.warn('⚠️ Parsed content exceeding safe limits, truncating...');
          break;
        }
      }
      
      // Progress indicator for very large prompts
      if (i % 100 === 0 && chunks.length > 1000) {
        console.log(`📖 Parsing progress: ${i + 1}/${chunks.length} chunks (${((i + 1) / chunks.length * 100).toFixed(1)}%)`);
      }
    }

    return parsedChunks.join('\n');
  }

  private chunkPrompt(prompt: string): string[] {
    const chunks: string[] = [];
    
    // Try to chunk by logical boundaries first
    const naturalBreaks = prompt.split(/\n\s*\n/); // Double newlines
    
    if (naturalBreaks.length > 1 && naturalBreaks.every(chunk => chunk.length < this.CHUNK_SIZE * 2)) {
      return naturalBreaks.filter(chunk => chunk.trim().length > 0);
    }
    
    // Fallback to fixed-size chunking
    for (let i = 0; i < prompt.length; i += this.CHUNK_SIZE) {
      let chunkEnd = Math.min(i + this.CHUNK_SIZE, prompt.length);
      
      // Try to break at word boundary
      if (chunkEnd < prompt.length) {
        const lastSpace = prompt.lastIndexOf(' ', chunkEnd);
        const lastNewline = prompt.lastIndexOf('\n', chunkEnd);
        const breakPoint = Math.max(lastSpace, lastNewline);
        
        if (breakPoint > i) {
          chunkEnd = breakPoint;
        }
      }
      
      const chunk = prompt.substring(i, chunkEnd).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
      
      // Update position
      i = chunkEnd - this.CHUNK_SIZE;
    }
    
    return chunks;
  }

  private parseChunkSafely(chunk: string, chunkIndex: number): string | null {
    try {
      // Remove control characters and normalize whitespace
      let cleaned = chunk
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      // Skip empty chunks
      if (cleaned.length === 0) {
        return null;
      }
      
      // Validate chunk isn't corrupted
      if (this.isChunkCorrupted(cleaned)) {
        console.warn(`⚠️ Skipping corrupted chunk ${chunkIndex}`);
        return null;
      }
      
      // Truncate extremely long single lines
      const lines = cleaned.split('\n');
      const processedLines = lines.map(line => {
        if (line.length > 1000) {
          return line.substring(0, 997) + '...';
        }
        return line;
      });
      
      return processedLines.join('\n');
      
    } catch (error) {
      console.warn(`⚠️ Error parsing chunk ${chunkIndex}: ${error}`);
      return null;
    }
  }

  private isChunkCorrupted(chunk: string): boolean {
    // Check for signs of corruption
    const suspiciousPatterns = [
      /\0/,                           // Null bytes
      /[\x00-\x08\x0B\x0C\x0E-\x1F]/, // Control characters
      /(.)\1{50,}/,                   // Excessive repetition
      /[^\x00-\x7F]{100,}/,          // Too many non-ASCII chars in sequence
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(chunk));
  }

  private formatBytes(bytes: number): string {
    const sizes = ['bytes', 'KB', 'MB'];
    if (bytes === 0) return '0 bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Validate prompt before processing
   */
  validatePrompt(prompt: string): { valid: boolean; reason?: string; truncated?: string } {
    // Check for basic issues
    if (!prompt || typeof prompt !== 'string') {
      return { valid: false, reason: 'Prompt must be a non-empty string' };
    }
    
    if (prompt.length === 0) {
      return { valid: false, reason: 'Prompt cannot be empty' };
    }
    
    // Check for extremely large prompts
    if (prompt.length > this.MAX_PROMPT_SIZE * 5) {
      const truncated = prompt.substring(0, this.MAX_PROMPT_SIZE) + '\n\n[TRUNCATED - Original size: ' + this.formatBytes(prompt.length) + ']';
      return { 
        valid: true, 
        reason: 'Prompt was extremely large and has been truncated',
        truncated 
      };
    }
    
    return { valid: true };
  }
}