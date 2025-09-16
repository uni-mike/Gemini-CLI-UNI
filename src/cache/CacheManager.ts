/**
 * CacheManager - Database-based caching with LRU in-memory layer
 * Features: FIFO cleanup, age-based expiration, proper database persistence
 */

import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { sharedDatabase } from '../memory/shared-database.js';

export interface CacheOptions {
  max?: number; // Maximum number of items
  maxSize?: number; // Maximum size in bytes
  ttl?: number; // Time to live in milliseconds
  updateAgeOnGet?: boolean; // Reset TTL on access
  allowStale?: boolean; // Return stale values while fetching
  sizeCalculation?: (value: any, key: string) => number;
}

export class CacheManager {
  private static instance: CacheManager;
  private cache: LRUCache<string, any>;
  private keyToOriginal: Map<string, string> = new Map(); // Track original keys for embeddings
  private prisma: PrismaClient;
  private persistInterval: NodeJS.Timeout | null = null;
  private projectId: string = 'default'; // Will be set dynamically

  private constructor() {
    // Database will be initialized via setPrisma() method when SharedDatabase is ready
    this.prisma = null as any; // Will be set by SharedDatabase via setPrisma()

    // Initialize LRU cache with sensible defaults
    this.cache = new LRUCache<string, any>({
      max: 500, // Maximum 500 items
      maxSize: 50 * 1024 * 1024, // 50MB max size
      ttl: 1000 * 60 * 60 * 24 * 3, // 3 days default TTL
      updateAgeOnGet: true, // Keep frequently accessed items
      allowStale: true, // Return stale while revalidating

      // Calculate size for memory management
      sizeCalculation: (value: any) => {
        if (typeof value === 'string') return value.length;
        if (Buffer.isBuffer(value)) return value.length;
        if (value instanceof Float32Array) return value.length * 4;
        return JSON.stringify(value).length;
      },

      // Dispose callback for cleanup
      dispose: (value: any, key: string) => {
        console.debug(`Cache evicted: ${key}`);
      }
    });

    // Note: loadPersistedCache() will be called in setPrisma() once database is ready

    // Persist cache periodically (every 5 minutes) and cleanup old entries
    this.persistInterval = setInterval(() => {
      this.persistCache().catch(console.error);
      this.cleanupExpiredEntries().catch(console.error);
    }, 5 * 60 * 1000);
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Initialize database connection via shared database manager
   */
  setPrisma(prismaClient: PrismaClient): void {
    this.prisma = prismaClient;
    console.log('📦 CacheManager connected to shared database');

    // Load persisted cache now that database is ready
    this.loadPersistedCache().catch(console.error);
  }

  /**
   * Generate cache key from input
   */
  private getCacheKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  /**
   * Set value in cache
   */
  set(key: string, value: any, options?: CacheOptions): void {
    const cacheKey = this.getCacheKey(key);

    // Track original key for embeddings persistence
    if (key.startsWith('embed_')) {
      this.keyToOriginal.set(cacheKey, key);

      // Immediately persist embeddings to database
      if (this.prisma && this.projectId) {
        this.persistSingleEmbedding(key, value).catch(error => {
          console.warn('Failed to persist embedding:', error);
        });
      }
    }

    this.cache.set(cacheKey, value, {
      ttl: options?.ttl,
      size: options?.sizeCalculation?.(value, key)
    });
  }

  /**
   * Get value from cache
   */
  get<T = any>(key: string): T | undefined {
    const cacheKey = this.getCacheKey(key);
    return this.cache.get(cacheKey) as T | undefined;
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    const cacheKey = this.getCacheKey(key);
    return this.cache.has(cacheKey);
  }

  /**
   * Delete from cache
   */
  delete(key: string): boolean {
    const cacheKey = this.getCacheKey(key);
    return this.cache.delete(cacheKey);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      calculatedSize: this.cache.calculatedSize,
      maxSize: this.cache.maxSize,
      itemCount: this.cache.size,
      hitRate: this.cache.size > 0 ?
        (this.cache as any).hits / ((this.cache as any).hits + (this.cache as any).misses) : 0
    };
  }

  /**
   * Persist a single embedding immediately to database
   */
  private async persistSingleEmbedding(key: string, value: any): Promise<void> {
    if (!this.prisma || !this.projectId) return;

    try {
      const now = new Date();
      const valueStr = JSON.stringify(value);
      const size = valueStr.length;
      const ttl = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days

      await this.prisma.cache.upsert({
        where: { cacheKey: this.getCacheKey(key) },
        update: {
          value: valueStr,
          size,
          lastAccess: now,
          ttl,
          accessCount: { increment: 1 }
        },
        create: {
          projectId: this.projectId,
          cacheKey: this.getCacheKey(key),
          originalKey: key,
          value: valueStr,
          category: 'embedding',
          size,
          ttl
        }
      });

      // Force commit to database
      await this.prisma.$queryRaw`PRAGMA wal_checkpoint(TRUNCATE)`;

      console.debug(`💾 Persisted embedding to database: ${key.substring(0, 20)}...`);
    } catch (error) {
      console.error(`Failed to persist embedding ${key}:`, error);
    }
  }

  /**
   * Persist critical cache entries to database with FIFO and aging
   */
  private async persistCache(): Promise<void> {
    // Skip if database not initialized yet
    if (!this.prisma) {
      console.debug('💾 Database not ready, skipping cache persistence');
      return;
    }

    try {
      const now = new Date();
      const criticalEntries: Array<{key: string, value: any, category: string}> = [];

      for (const [hashedKey, value] of this.cache.entries()) {
        // Check if this is an embedding using original key mapping
        const originalKey = this.keyToOriginal.get(hashedKey);
        if (originalKey && originalKey.startsWith('embed_')) {
          criticalEntries.push({
            key: originalKey,
            value: value,
            category: 'embedding'
          });
        }
      }

      // Upsert cache entries to database
      for (const entry of criticalEntries) {
        const valueStr = JSON.stringify(entry.value);
        const size = valueStr.length;
        const ttl = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000)); // 3 days from now

        await this.prisma.cache.upsert({
          where: { cacheKey: this.getCacheKey(entry.key) },
          update: {
            value: valueStr,
            size,
            lastAccess: now,
            ttl,
            accessCount: { increment: 1 }
          },
          create: {
            projectId: this.projectId,
            cacheKey: this.getCacheKey(entry.key),
            originalKey: entry.key,
            value: valueStr,
            category: entry.category,
            size,
            ttl
          }
        });
      }

      // Enforce FIFO limit: keep only most recent 1000 entries per project
      const totalCount = await this.prisma.cache.count({ where: { projectId: this.projectId } });
      if (totalCount > 1000) {
        const toDelete = totalCount - 1000;
        const oldestEntries = await this.prisma.cache.findMany({
          where: { projectId: this.projectId },
          orderBy: { createdAt: 'asc' },
          take: toDelete,
          select: { id: true }
        });

        if (oldestEntries.length > 0) {
          await this.prisma.cache.deleteMany({
            where: {
              id: { in: oldestEntries.map(e => e.id) }
            }
          });
          console.log(`🗑️ FIFO cleanup: removed ${oldestEntries.length} old cache entries`);
        }
      }

      if (criticalEntries.length > 0) {
        console.log(`💾 Persisted ${criticalEntries.length} cache entries to database`);
      }
    } catch (error) {
      console.error('Failed to persist cache to database:', error);
    }
  }

  /**
   * Load persisted cache from database
   */
  private async loadPersistedCache(): Promise<void> {
    // Skip if database not initialized yet
    if (!this.prisma) {
      console.debug('📂 Database not ready, skipping cache restoration');
      return;
    }

    try {
      // First, set up project ID (could come from environment or be determined dynamically)
      this.projectId = process.env.PROJECT_ID || await this.getDefaultProjectId();

      const cacheEntries = await this.prisma.cache.findMany({
        where: {
          projectId: this.projectId,
          ttl: { gt: new Date() } // Only load non-expired entries
        },
        orderBy: { lastAccess: 'desc' } // Most recently accessed first
      });

      let restoredCount = 0;
      for (const entry of cacheEntries) {
        try {
          const value = JSON.parse(entry.value);
          const hashedKey = this.getCacheKey(entry.originalKey);

          // Restore to in-memory cache
          this.cache.set(hashedKey, value, {
            ttl: entry.ttl.getTime() - Date.now() // Remaining TTL
          });

          // Restore key mapping for embeddings
          if (entry.originalKey.startsWith('embed_')) {
            this.keyToOriginal.set(hashedKey, entry.originalKey);
          }

          // Update access time in database
          await this.prisma.cache.update({
            where: { id: entry.id },
            data: {
              lastAccess: new Date(),
              accessCount: { increment: 1 }
            }
          });

          restoredCount++;
        } catch (parseError) {
          console.warn(`Failed to restore cache entry ${entry.id}:`, parseError);
        }
      }

      console.log(`📂 Restored ${restoredCount} cache entries from database`);
    } catch (error) {
      console.warn('Failed to load persisted cache from database:', error);
      console.log('📂 Starting with fresh cache');
    }
  }

  /**
   * Cleanup expired entries from database (age-based)
   */
  private async cleanupExpiredEntries(): Promise<void> {
    try {
      const deletedCount = await this.prisma.cache.deleteMany({
        where: {
          OR: [
            { ttl: { lt: new Date() } }, // Expired entries
            {
              // Entries older than 7 days regardless of TTL
              createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            },
            {
              // Entries not accessed in 3 days (access-based cleanup)
              lastAccess: { lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }
            }
          ]
        }
      });

      if (deletedCount.count > 0) {
        console.log(`🧹 Cleaned up ${deletedCount.count} expired/old cache entries`);
      }
    } catch (error) {
      console.warn('Failed to cleanup expired cache entries:', error);
    }
  }

  /**
   * Get default project ID from database
   */
  private async getDefaultProjectId(): Promise<string> {
    try {
      const project = await this.prisma.project.findFirst();
      return project?.id || 'default-project';
    } catch (error) {
      return 'default-project';
    }
  }

  /**
   * Set project ID for cache operations
   */
  setProjectId(projectId: string): void {
    this.projectId = projectId;
  }

  /**
   * Get cache statistics from database
   */
  async getDatabaseStats() {
    // Return null if database not initialized yet
    if (!this.prisma) {
      console.debug('📊 Database not ready, returning null stats');
      return null;
    }

    try {
      const stats = await this.prisma.cache.aggregate({
        where: { projectId: this.projectId },
        _count: { id: true },
        _sum: { size: true, accessCount: true },
        _avg: { accessCount: true, size: true }
      });

      const byCategory = await this.prisma.cache.groupBy({
        by: ['category'],
        where: { projectId: this.projectId },
        _count: { id: true },
        _sum: { size: true }
      });

      return {
        totalEntries: stats._count.id || 0,
        totalSize: stats._sum.size || 0,
        avgAccessCount: stats._avg.accessCount || 0,
        avgSize: stats._avg.size || 0,
        byCategory
      };
    } catch (error) {
      console.warn('Failed to get database cache stats:', error);
      return null;
    }
  }

  /**
   * Force immediate persistence (useful for testing and ensuring data is saved)
   */
  async forcePersist(): Promise<void> {
    await this.persistCache();
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    if (this.persistInterval) {
      clearInterval(this.persistInterval);
    }
    await this.persistCache();
    await this.cleanupExpiredEntries();
    await this.prisma.$disconnect();
    this.cache.clear();
  }
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance();