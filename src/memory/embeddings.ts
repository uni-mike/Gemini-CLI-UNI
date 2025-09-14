/**
 * Embeddings Manager
 * Handles Azure OpenAI embeddings integration
 */

import { OpenAI } from 'openai';
import * as crypto from 'crypto';
import { cacheManager } from '../cache/CacheManager.js';

export class EmbeddingsManager {
  private client: OpenAI;
  private deployment: string;
  
  constructor() {
    // Initialize Azure OpenAI client
    const endpoint = process.env.EMBEDDING_API_ENDPOINT || '';
    const deployment = process.env.EMBEDDING_API_DEPLOYMENT || 'text-embedding-3-large';
    
    // Ensure endpoint has trailing slash before adding path
    const baseURL = endpoint.endsWith('/') 
      ? `${endpoint}openai/deployments/${deployment}`
      : `${endpoint}/openai/deployments/${deployment}`;
    
    this.client = new OpenAI({
      apiKey: process.env.EMBEDDING_API_KEY || '',
      baseURL,
      defaultQuery: { 'api-version': process.env.EMBEDDING_API_API_VERSION || '2024-02-01' },
      defaultHeaders: {
        'api-key': process.env.EMBEDDING_API_KEY || ''
      }
    });
    
    this.deployment = deployment;
  }
  
  /**
   * Generate embedding for text
   */
  async embed(text: string): Promise<Float32Array> {
    // Check cache
    const cacheKey = `embed_${this.hashText(text)}`;
    const cached = cacheManager.get<number[]>(cacheKey);
    if (cached) {
      return new Float32Array(cached);
    }
    
    try {
      const response = await this.client.embeddings.create({
        input: text,
        model: this.deployment
      });
      
      const embedding = new Float32Array(response.data[0].embedding);
      
      // Normalize the embedding
      const normalized = this.normalize(embedding);
      
      // Cache it
      cacheManager.set(cacheKey, Array.from(normalized), {
        ttl: 7 * 24 * 60 * 60 * 1000 // 7 days TTL
      });
      
      return normalized;
    } catch (error) {
      console.warn('Embedding generation failed, using fallback:', error);
      return this.fallbackEmbedding(text);
    }
  }
  
  /**
   * Batch embed multiple texts
   */
  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    // Filter out already cached
    const uncached: { text: string; index: number }[] = [];
    const results: Float32Array[] = new Array(texts.length);
    
    for (let i = 0; i < texts.length; i++) {
      const cacheKey = `embed_${this.hashText(texts[i])}`;
      const cached = cacheManager.get<number[]>(cacheKey);
      if (cached) {
        results[i] = new Float32Array(cached);
      } else {
        uncached.push({ text: texts[i], index: i });
      }
    }
    
    if (uncached.length === 0) {
      return results;
    }
    
    try {
      // Batch API call for uncached texts
      const response = await this.client.embeddings.create({
        input: uncached.map(u => u.text),
        model: this.deployment
      });
      
      // Process and cache results
      for (let i = 0; i < uncached.length; i++) {
        const embedding = new Float32Array(response.data[i].embedding);
        const normalized = this.normalize(embedding);
        
        const { text, index } = uncached[i];
        const cacheKey = `embed_${this.hashText(text)}`;
        cacheManager.set(cacheKey, Array.from(normalized), {
          ttl: 7 * 24 * 60 * 60 * 1000 // 7 days TTL
        });
        results[index] = normalized;
      }
      
      return results;
    } catch (error) {
      console.warn('Batch embedding failed, using fallback:', error);
      
      // Fallback for failed items
      for (const { text, index } of uncached) {
        results[index] = this.fallbackEmbedding(text);
      }
      
      return results;
    }
  }
  
  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimension');
    }
    
    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
    }
    
    // Since embeddings are normalized, magnitude is 1
    return dotProduct;
  }
  
  /**
   * Find most similar embeddings
   */
  findSimilar(
    query: Float32Array,
    candidates: { id: string; embedding: Float32Array }[],
    topK: number = 10,
    minSimilarity: number = 0.7
  ): Array<{ id: string; similarity: number }> {
    const scores = candidates.map(candidate => ({
      id: candidate.id,
      similarity: this.cosineSimilarity(query, candidate.embedding)
    }));
    
    // Filter by minimum similarity
    const filtered = scores.filter(s => s.similarity >= minSimilarity);
    
    // Sort by similarity (descending)
    filtered.sort((a, b) => b.similarity - a.similarity);
    
    // Return top K
    return filtered.slice(0, topK);
  }
  
  /**
   * Normalize embedding to unit length
   */
  private normalize(embedding: Float32Array): Float32Array {
    let magnitude = 0;
    for (let i = 0; i < embedding.length; i++) {
      magnitude += embedding[i] * embedding[i];
    }
    magnitude = Math.sqrt(magnitude);
    
    if (magnitude === 0) {
      return embedding;
    }
    
    const normalized = new Float32Array(embedding.length);
    for (let i = 0; i < embedding.length; i++) {
      normalized[i] = embedding[i] / magnitude;
    }
    
    return normalized;
  }
  
  /**
   * Generate hash for text (for caching)
   */
  private hashText(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }
  
  /**
   * Fallback embedding using simple keyword extraction
   */
  private fallbackEmbedding(text: string): Float32Array {
    // Simple fallback: create a sparse embedding based on keywords
    const dimensions = 1536; // Match text-embedding-3-large dimensions
    const embedding = new Float32Array(dimensions);
    
    // Extract tokens (simple word splitting)
    const tokens = text.toLowerCase().split(/\W+/).filter(t => t.length > 2);
    
    // Hash each token to a dimension
    for (const token of tokens) {
      const hash = this.simpleHash(token);
      const index = hash % dimensions;
      embedding[index] = 1;
    }
    
    return this.normalize(embedding);
  }
  
  /**
   * Simple hash function for fallback
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  /**
   * Clear embedding cache
   */
  clearCache(): void {
    cacheManager.clear();
  }
  
  /**
   * Convert embedding to/from buffer for storage
   */
  embeddingToBuffer(embedding: Float32Array): Buffer {
    return Buffer.from(embedding.buffer);
  }
  
  bufferToEmbedding(buffer: Buffer): Float32Array {
    return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  }
  
  /**
   * Load cached embeddings from disk on startup
   */
  private async loadCacheFromDisk(): Promise<void> {
    try {
      await this.filePersistence.initialize();
      // Cache will be loaded on-demand when embeddings are requested
      console.log('📂 Embeddings file cache initialized');
    } catch (error) {
      console.warn('Failed to initialize embeddings file cache:', error);
    }
  }
  
  /**
   * Save current cache state to disk
   */
  async persistCache(): Promise<void> {
    try {
      // Cache manager handles its own persistence
      console.log('💾 Cache persistence handled by CacheManager');
    } catch (error) {
      console.warn('Failed to persist embeddings cache:', error);
    }
  }
}