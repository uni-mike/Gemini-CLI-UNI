/**
 * CacheManager - Efficient in-memory caching with LRU eviction
 * Uses memory-first approach with optional persistence
 */

import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

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
  private persistPath: string;
  private persistInterval: NodeJS.Timeout | null = null;
  
  private constructor() {
    this.persistPath = path.join(process.cwd(), '.flexicli', 'cache.json');
    
    // Initialize LRU cache with sensible defaults
    this.cache = new LRUCache<string, any>({
      max: 500, // Maximum 500 items
      maxSize: 50 * 1024 * 1024, // 50MB max size
      ttl: 1000 * 60 * 60 * 24 * 7, // 7 days default TTL
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
    
    // Load persisted cache on startup
    this.loadPersistedCache().catch(console.error);
    
    // Persist cache periodically (every 5 minutes)
    this.persistInterval = setInterval(() => {
      this.persistCache().catch(console.error);
    }, 5 * 60 * 1000);
  }
  
  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
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
   * Persist critical cache entries to disk
   */
  private async persistCache(): Promise<void> {
    try {
      // Only persist embeddings and critical data
      const criticalEntries: Record<string, any> = {};
      let count = 0;
      
      for (const [key, value] of this.cache.entries()) {
        // Only persist embeddings (they're expensive to regenerate)
        if (key.startsWith('embed_')) {
          criticalEntries[key] = value;
          count++;
          if (count >= 100) break; // Limit persistence
        }
      }
      
      if (Object.keys(criticalEntries).length > 0) {
        await fs.mkdir(path.dirname(this.persistPath), { recursive: true });
        await fs.writeFile(
          this.persistPath,
          JSON.stringify(criticalEntries),
          'utf-8'
        );
      }
    } catch (error) {
      console.error('Failed to persist cache:', error);
    }
  }
  
  /**
   * Load persisted cache from disk
   */
  private async loadPersistedCache(): Promise<void> {
    try {
      const data = await fs.readFile(this.persistPath, 'utf-8');
      const entries = JSON.parse(data);
      
      for (const [key, value] of Object.entries(entries)) {
        // Restore with reduced TTL
        this.cache.set(key, value, {
          ttl: 1000 * 60 * 60 * 24 // 1 day for restored entries
        });
      }
      
      console.log(`Restored ${Object.keys(entries).length} cache entries`);
    } catch (error) {
      // File doesn't exist or is corrupted, ignore
    }
  }
  
  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    if (this.persistInterval) {
      clearInterval(this.persistInterval);
    }
    await this.persistCache();
    this.cache.clear();
  }
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance();