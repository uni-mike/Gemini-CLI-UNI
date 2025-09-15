/**
 * Shared Database Manager - Coordinates PrismaClient usage across modules
 *
 * This solves the database lock issue by ensuring all modules use the same
 * PrismaClient instance instead of creating separate connections.
 *
 * Features:
 * - Single PrismaClient instance per project
 * - Proper connection lifecycle management
 * - Shared across CacheManager, MemoryManager, and other components
 * - Graceful shutdown handling
 */

import { PrismaClient } from '@prisma/client';
import { ProjectManager } from './project-manager.js';
import { AgentLockManager } from './agent-lock.js';

export class SharedDatabaseManager {
  private static instance: SharedDatabaseManager;
  private prisma: PrismaClient | null = null;
  private projectManager: ProjectManager;
  private agentLock: AgentLockManager;
  private isInitialized = false;

  private constructor() {
    this.projectManager = new ProjectManager();
    this.agentLock = AgentLockManager.getInstance(this.projectManager.getProjectRoot());

    // Setup graceful shutdown
    process.on('SIGINT', () => this.disconnect());
    process.on('SIGTERM', () => this.disconnect());
    process.on('exit', () => this.disconnect());
  }

  static getInstance(): SharedDatabaseManager {
    if (!SharedDatabaseManager.instance) {
      SharedDatabaseManager.instance = new SharedDatabaseManager();
    }
    return SharedDatabaseManager.instance;
  }

  /**
   * Initialize database connection with agent lock
   */
  async initialize(sessionId: string): Promise<boolean> {
    if (this.isInitialized && this.prisma) {
      return true;
    }

    try {
      // Acquire agent lock first
      const lockAcquired = await this.agentLock.acquireLock(sessionId);
      if (!lockAcquired) {
        console.log('⚠️ Another agent is running. Database access denied.');
        return false;
      }

      // Initialize project manager WITHOUT database lookup (to avoid circular dependency)
      // We'll handle project lookup after PrismaClient is ready

      // Create single PrismaClient instance
      const dbPath = this.projectManager.getDbPath();
      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: `file:${dbPath}`
          }
        },
        log: process.env.DEBUG ? ['query', 'error', 'warn'] : ['error']
      });

      // Test connection
      await this.prisma.$connect();
      console.log(`🗄️ Shared database connected: ${dbPath}`);

      // Initialize CacheManager with shared database connection
      const { cacheManager } = await import('../cache/CacheManager.js');
      cacheManager.setPrisma(this.prisma);

      this.isInitialized = true;
      return true;

    } catch (error) {
      console.error('Failed to initialize shared database:', error);
      await this.disconnect();
      return false;
    }
  }

  /**
   * Get PrismaClient instance (must call initialize first)
   */
  getPrisma(): PrismaClient {
    if (!this.prisma || !this.isInitialized) {
      throw new Error('Shared database not initialized. Call initialize() first.');
    }
    return this.prisma;
  }

  /**
   * Get project manager instance
   */
  getProjectManager(): ProjectManager {
    return this.projectManager;
  }

  /**
   * Get agent lock manager instance
   */
  getAgentLock(): AgentLockManager {
    return this.agentLock;
  }

  /**
   * Check if database is initialized and ready
   */
  isReady(): boolean {
    return this.isInitialized && this.prisma !== null && this.agentLock.hasLock();
  }

  /**
   * Execute database operation with error handling
   */
  async executeWithRetry<T>(
    operation: (prisma: PrismaClient) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T | null> {
    if (!this.isReady()) {
      throw new Error('Database not ready. Call initialize() first.');
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation(this.prisma!);
      } catch (error: any) {
        lastError = error;
        console.warn(`Database operation failed (attempt ${attempt}/${maxRetries}):`, error.message);

        // Don't retry on certain errors
        if (error.code === 'P2024' || error.message.includes('UNIQUE constraint')) {
          throw error;
        }

        // Wait before retry
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    console.error('Database operation failed after all retries:', lastError);
    return null;
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    isReady: boolean;
    hasLock: boolean;
    projectId: string;
    dbPath: string;
    lockInfo: any;
  }> {
    return {
      isReady: this.isReady(),
      hasLock: this.agentLock.hasLock(),
      projectId: this.projectManager.getProjectId(),
      dbPath: this.projectManager.getDbPath(),
      lockInfo: this.agentLock.getLockStats()
    };
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    try {
      if (this.prisma) {
        await this.prisma.$disconnect();
        console.log('🗄️ Shared database disconnected');
        this.prisma = null;
      }

      this.agentLock.releaseLock();
      this.isInitialized = false;

    } catch (error) {
      console.warn('Error during database disconnect:', error);
    }
  }

  /**
   * Force cleanup (for recovery scenarios)
   */
  async forceCleanup(): Promise<void> {
    console.log('🔨 Force cleaning up database connections...');

    try {
      if (this.prisma) {
        await this.prisma.$disconnect();
        this.prisma = null;
      }
    } catch (error) {
      console.warn('Error disconnecting Prisma:', error);
    }

    this.agentLock.forceRelease();
    this.isInitialized = false;

    console.log('✅ Force cleanup completed');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    database: boolean;
    lock: boolean;
    project: boolean;
    overall: boolean;
  }> {
    const health = {
      database: false,
      lock: false,
      project: false,
      overall: false
    };

    try {
      // Check database connection
      if (this.prisma) {
        await this.prisma.$queryRaw`SELECT 1`;
        health.database = true;
      }

      // Check agent lock
      health.lock = this.agentLock.hasLock();

      // Check project manager
      try {
        this.projectManager.getMetadata();
        health.project = true;
      } catch (error) {
        health.project = false;
      }

      health.overall = health.database && health.lock && health.project;

    } catch (error) {
      console.warn('Health check failed:', error);
    }

    return health;
  }
}

// Export singleton instance
export const sharedDatabase = SharedDatabaseManager.getInstance();