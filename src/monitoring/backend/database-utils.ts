/**
 * Database Utilities
 * Connection pooling and retry logic for SQLite
 */

import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import { ProjectManager } from '../../memory/project-manager.js';

export interface DatabaseConfig {
  maxRetries?: number;
  retryDelay?: number;
  connectionLimit?: number;
  queryTimeout?: number;
}

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private prisma: PrismaClient;
  private config: DatabaseConfig;
  
  private constructor(config?: DatabaseConfig) {
    this.config = {
      maxRetries: 3,
      retryDelay: 100,
      connectionLimit: 10,
      queryTimeout: 5000,
      ...config
    };
    
    // Use ProjectManager for consistent database path resolution
    const projectManager = new ProjectManager();
    const dbPath = projectManager.getDbPath();
    const dbUrl = `file:${dbPath}`;
    
    this.prisma = new PrismaClient({
      datasources: {
        db: { url: dbUrl }
      },
      log: process.env.DEBUG ? ['query', 'error', 'warn'] : ['error']
    });
    
    // Set pragmas for better SQLite performance
    this.initializePragmas();
  }
  
  static getInstance(config?: DatabaseConfig): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection(config);
    }
    return DatabaseConnection.instance;
  }
  
  private async initializePragmas(): Promise<void> {
    try {
      // Optimize SQLite for better concurrency
      await this.prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL');
      await this.prisma.$executeRawUnsafe('PRAGMA busy_timeout = 5000');
      await this.prisma.$executeRawUnsafe('PRAGMA synchronous = NORMAL');
      await this.prisma.$executeRawUnsafe('PRAGMA cache_size = -64000'); // 64MB cache
      await this.prisma.$executeRawUnsafe('PRAGMA temp_store = MEMORY');
      console.log('✅ Database pragmas initialized for optimal performance');
    } catch (error) {
      console.warn('Failed to set database pragmas:', error);
    }
  }
  
  /**
   * Execute a database operation with retry logic
   */
  async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt < this.config.maxRetries!; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a retryable error
        if (this.isRetryableError(error)) {
          if (attempt < this.config.maxRetries! - 1) {
            const delay = this.config.retryDelay! * Math.pow(2, attempt); // Exponential backoff
            console.log(`Database operation failed (attempt ${attempt + 1}/${this.config.maxRetries}), retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // Non-retryable error or max retries reached
        throw error;
      }
    }
    
    throw lastError;
  }
  
  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message || error.code || '';
    
    // SQLite busy/locked errors
    if (errorMessage.includes('SQLITE_BUSY') ||
        errorMessage.includes('database is locked') ||
        errorMessage.includes('SQLITE_LOCKED')) {
      return true;
    }
    
    // Prisma connection errors
    if (errorMessage.includes('P1001') || // Can't reach database
        errorMessage.includes('P1002') || // Database timeout
        errorMessage.includes('P1008')) { // Operations timed out
      return true;
    }
    
    return false;
  }
  
  /**
   * Execute a transaction with retry logic
   */
  async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return this.withRetry(async () => {
      return await this.prisma.$transaction(fn, {
        maxWait: this.config.queryTimeout,
        timeout: this.config.queryTimeout! * 2
      });
    });
  }
  
  /**
   * Batch write operations for better performance
   */
  async batchWrite<T>(
    model: string,
    data: T[],
    batchSize: number = 100
  ): Promise<void> {
    const modelDelegate = (this.prisma as any)[model];
    if (!modelDelegate) {
      throw new Error(`Model ${model} not found`);
    }
    
    // Process in batches
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      await this.withRetry(async () => {
        await modelDelegate.createMany({
          data: batch,
          skipDuplicates: true
        });
      });
    }
  }
  
  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    tables: Record<string, number>;
    dbSize: number;
    walSize: number;
  }> {
    const stats: any = {
      tables: {},
      dbSize: 0,
      walSize: 0
    };
    
    try {
      // Get row counts for each table
      const tables = ['session', 'chunk', 'gitCommit', 'executionLog', 'project'];
      
      for (const table of tables) {
        const modelDelegate = (this.prisma as any)[table];
        if (modelDelegate) {
          stats.tables[table] = await modelDelegate.count();
        }
      }
      
      // Get database file sizes
      const fs = await import('fs/promises');
      const projectManager = new ProjectManager();
      const dbPath = projectManager.getDbPath();
      const walPath = `${dbPath}-wal`;
      
      try {
        const dbStat = await fs.stat(dbPath);
        stats.dbSize = dbStat.size;
      } catch {}
      
      try {
        const walStat = await fs.stat(walPath);
        stats.walSize = walStat.size;
      } catch {}
      
    } catch (error) {
      console.warn('Failed to get database stats:', error);
    }
    
    return stats;
  }
  
  /**
   * Optimize database (VACUUM and ANALYZE)
   */
  async optimize(): Promise<void> {
    try {
      console.log('🔧 Optimizing database...');
      await this.prisma.$executeRawUnsafe('VACUUM');
      await this.prisma.$executeRawUnsafe('ANALYZE');
      console.log('✅ Database optimized');
    } catch (error) {
      console.warn('Failed to optimize database:', error);
    }
  }
  
  /**
   * Get the Prisma client instance
   */
  getClient(): PrismaClient {
    return this.prisma;
  }
  
  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// Singleton export
export const db = DatabaseConnection.getInstance();

// Helper function for retrying operations
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>
): Promise<T> {
  return db.withRetry(operation);
}