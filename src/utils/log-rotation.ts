/**
 * Log Rotation Manager
 * Handles automatic log file rotation based on size and age
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream, createWriteStream, existsSync } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';

export interface LogRotationOptions {
  maxFileSize?: number; // Max size in bytes before rotation (default: 10MB)
  maxFiles?: number; // Max number of rotated files to keep (default: 5)
  maxAge?: number; // Max age in days before deletion (default: 30)
  compress?: boolean; // Compress rotated files (default: true)
}

export class LogRotationManager {
  private static instance: LogRotationManager;
  private options: Required<LogRotationOptions>;
  private rotationInterval: NodeJS.Timeout | null = null;
  private logsDir: string;

  private constructor() {
    this.options = {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      maxAge: 30,
      compress: true
    };

    // Set logs directory
    const projectRoot = this.findProjectRoot();
    this.logsDir = path.join(projectRoot, '.flexicli', 'logs');
  }

  private findProjectRoot(): string {
    let currentDir = process.cwd();
    while (currentDir !== '/') {
      if (existsSync(path.join(currentDir, '.git'))) {
        return currentDir;
      }
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break;
      currentDir = parentDir;
    }
    return process.cwd();
  }

  static getInstance(): LogRotationManager {
    if (!LogRotationManager.instance) {
      LogRotationManager.instance = new LogRotationManager();
    }
    return LogRotationManager.instance;
  }

  /**
   * Initialize automatic rotation
   */
  async initialize(options?: LogRotationOptions): Promise<void> {
    if (options) {
      this.options = { ...this.options, ...options };
    }

    // Check and rotate on startup
    await this.checkAndRotate();

    // Schedule periodic checks (every hour)
    this.rotationInterval = setInterval(async () => {
      await this.checkAndRotate();
    }, 60 * 60 * 1000); // 1 hour

    console.log('📊 Log rotation manager initialized');
  }

  /**
   * Check all log files and rotate if necessary
   */
  async checkAndRotate(): Promise<void> {
    try {
      const files = await fs.readdir(this.logsDir);
      const logFiles = files.filter(f => f.endsWith('.log'));

      for (const file of logFiles) {
        const filePath = path.join(this.logsDir, file);
        await this.rotateIfNeeded(filePath);
      }

      // Clean up old rotated files
      await this.cleanupOldFiles();
    } catch (error) {
      console.error('Log rotation check failed:', error);
    }
  }

  /**
   * Rotate a specific log file if it exceeds size limit
   */
  private async rotateIfNeeded(filePath: string): Promise<void> {
    try {
      const stat = await fs.stat(filePath);

      // Check if file exceeds max size
      if (stat.size > this.options.maxFileSize) {
        await this.rotateFile(filePath);
      }
    } catch (error) {
      // File might not exist yet
    }
  }

  /**
   * Rotate a log file
   */
  private async rotateFile(filePath: string): Promise<void> {
    const basename = path.basename(filePath, '.log');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedName = `${basename}.${timestamp}.log`;
    const rotatedPath = path.join(this.logsDir, rotatedName);

    try {
      // Rename current log file
      await fs.rename(filePath, rotatedPath);

      // Compress if enabled
      if (this.options.compress) {
        await this.compressFile(rotatedPath);
        await fs.unlink(rotatedPath); // Remove uncompressed version
      }

      console.log(`📁 Rotated log file: ${basename}.log → ${rotatedName}${this.options.compress ? '.gz' : ''}`);

      // Create new empty log file
      await fs.writeFile(filePath, '');
    } catch (error) {
      console.error(`Failed to rotate log file ${filePath}:`, error);
    }
  }

  /**
   * Compress a file using gzip
   */
  private async compressFile(filePath: string): Promise<void> {
    const source = createReadStream(filePath);
    const destination = createWriteStream(`${filePath}.gz`);
    const gzip = createGzip();

    await pipeline(source, gzip, destination);
  }

  /**
   * Clean up old rotated files
   */
  private async cleanupOldFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.logsDir);
      const rotatedFiles = files.filter(f =>
        f.includes('.20') && (f.endsWith('.log') || f.endsWith('.log.gz'))
      );

      // Sort by timestamp (newest first)
      rotatedFiles.sort().reverse();

      // Keep only maxFiles
      const filesToDelete = rotatedFiles.slice(this.options.maxFiles);

      // Also check age
      const cutoffTime = Date.now() - (this.options.maxAge * 24 * 60 * 60 * 1000);

      for (const file of files) {
        const filePath = path.join(this.logsDir, file);
        const stat = await fs.stat(filePath);

        // Delete if too old or beyond max file count
        if (stat.mtime.getTime() < cutoffTime || filesToDelete.includes(file)) {
          await fs.unlink(filePath);
          console.log(`🗑️ Deleted old log file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old log files:', error);
    }
  }

  /**
   * Manually trigger rotation for all logs
   */
  async rotateAll(): Promise<void> {
    try {
      const files = await fs.readdir(this.logsDir);
      const logFiles = files.filter(f => f.endsWith('.log'));

      for (const file of logFiles) {
        const filePath = path.join(this.logsDir, file);
        await this.rotateFile(filePath);
      }
    } catch (error) {
      console.error('Failed to rotate all logs:', error);
    }
  }

  /**
   * Get rotation statistics
   */
  async getStats(): Promise<{
    activeLogSize: number;
    rotatedFiles: number;
    totalSize: number;
    oldestFile?: Date;
    newestFile?: Date;
  }> {
    try {
      const files = await fs.readdir(this.logsDir);
      let activeLogSize = 0;
      let rotatedFiles = 0;
      let totalSize = 0;
      let oldestTime: number | undefined;
      let newestTime: number | undefined;

      for (const file of files) {
        const filePath = path.join(this.logsDir, file);
        const stat = await fs.stat(filePath);

        if (file.endsWith('.log') && !file.includes('.20')) {
          activeLogSize += stat.size;
        } else if (file.includes('.20')) {
          rotatedFiles++;
        }

        totalSize += stat.size;

        if (!oldestTime || stat.mtime.getTime() < oldestTime) {
          oldestTime = stat.mtime.getTime();
        }
        if (!newestTime || stat.mtime.getTime() > newestTime) {
          newestTime = stat.mtime.getTime();
        }
      }

      return {
        activeLogSize,
        rotatedFiles,
        totalSize,
        oldestFile: oldestTime ? new Date(oldestTime) : undefined,
        newestFile: newestTime ? new Date(newestTime) : undefined
      };
    } catch (error) {
      return {
        activeLogSize: 0,
        rotatedFiles: 0,
        totalSize: 0
      };
    }
  }

  /**
   * Shutdown rotation manager
   */
  shutdown(): void {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
    }
  }
}

// Export singleton instance
export const logRotation = LogRotationManager.getInstance();