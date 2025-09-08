import * as fs from 'fs';

export class LargeFileHandler {
  private readonly LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB

  async handleLargeFileOperation(operation: string, filePath: string, options: any = {}): Promise<any> {
    const stats = await fs.promises.stat(filePath);
    
    if (stats.size < this.LARGE_FILE_THRESHOLD) {
      // Normal file handling
      return this.handleNormalFile(operation, filePath, options);
    }

    console.log(`📁 Large file detected (${this.formatBytes(stats.size)}), using streaming...`);
    
    switch (operation) {
      case 'read':
        return this.streamReadLargeFile(filePath, options);
      case 'search':
        return this.streamSearchLargeFile(filePath, options.pattern);
      case 'analyze':
        return this.streamAnalyzeLargeFile(filePath);
      default:
        throw new Error(`Large file operation '${operation}' not supported`);
    }
  }

  private async handleNormalFile(operation: string, filePath: string, options: any): Promise<any> {
    switch (operation) {
      case 'read':
        return fs.promises.readFile(filePath, 'utf8');
      case 'search':
        const content = await fs.promises.readFile(filePath, 'utf8');
        const matches = content.match(new RegExp(options.pattern, 'g'));
        return matches ? matches.length : 0;
      default:
        return 'Operation completed';
    }
  }

  private async streamReadLargeFile(filePath: string, options: any): Promise<string> {
    const { limit = 1000, offset = 0 } = options;
    
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, {
        encoding: 'utf8',
        start: offset,
        end: offset + (limit * 100) // Approximate character limit
      });

      let data = '';
      let lineCount = 0;

      stream.on('data', (chunk: string | Buffer) => {
        const chunkStr = typeof chunk === 'string' ? chunk : chunk.toString();
        data += chunkStr;
        lineCount += (chunkStr.match(/\n/g) || []).length;
        
        if (lineCount >= limit) {
          stream.destroy();
        }
      });

      stream.on('end', () => {
        const lines = data.split('\n').slice(0, limit);
        resolve(lines.join('\n'));
      });

      stream.on('error', reject);
    });
  }

  private async streamSearchLargeFile(filePath: string, pattern: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
      let buffer = '';
      let matchCount = 0;
      const regex = new RegExp(pattern, 'g');

      stream.on('data', (chunk) => {
        buffer += chunk;
        
        // Process complete lines to avoid splitting matches
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          const matches = line.match(regex);
          if (matches) {
            matchCount += matches.length;
          }
        }
      });

      stream.on('end', () => {
        // Process final buffer
        const matches = buffer.match(regex);
        if (matches) {
          matchCount += matches.length;
        }
        resolve(matchCount);
      });

      stream.on('error', reject);
    });
  }

  private async streamAnalyzeLargeFile(filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
      const stats = {
        lines: 0,
        words: 0,
        chars: 0,
        size: 0
      };

      stream.on('data', (chunk: string | Buffer) => {
        const chunkStr = typeof chunk === 'string' ? chunk : chunk.toString();
        stats.chars += chunk.length;
        stats.words += (chunkStr.match(/\S+/g) || []).length;
        stats.lines += (chunkStr.match(/\n/g) || []).length;
      });

      stream.on('end', async () => {
        const fileStats = await fs.promises.stat(filePath);
        stats.size = fileStats.size;
        resolve(stats);
      });

      stream.on('error', reject);
    });
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}