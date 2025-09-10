/**
 * Persistent Retrieval Layer
 * SQLite-backed storage with vector similarity search
 */

import { PrismaClient, Chunk } from '@prisma/client';
import { EmbeddingsManager } from '../embeddings.js';
import { TokenBudgetManager } from '../token-budget.js';
import { RETRIEVAL_CONFIG } from '../constants.js';

export interface RetrievalOptions {
  topK?: number;
  minSimilarity?: number;
  fileFilter?: string[];
  recencyBoost?: boolean;
  proximityBoost?: boolean;
}

export interface RetrievedChunk {
  id: string;
  content: string;
  path: string;
  similarity: number;
  tokenCount: number;
  metadata?: any;
}

export class RetrievalLayer {
  private prisma: PrismaClient;
  private embeddings: EmbeddingsManager;
  private tokenBudget: TokenBudgetManager;
  private projectId: string;
  
  constructor(
    prisma: PrismaClient,
    embeddings: EmbeddingsManager,
    tokenBudget: TokenBudgetManager,
    projectId: string
  ) {
    this.prisma = prisma;
    this.embeddings = embeddings;
    this.tokenBudget = tokenBudget;
    this.projectId = projectId;
  }
  
  /**
   * Store a chunk with embedding
   */
  async storeChunk(
    path: string,
    content: string,
    chunkType: 'code' | 'doc' | 'diff',
    metadata?: {
      language?: string;
      commitHash?: string;
      lineStart?: number;
      lineEnd?: number;
      [key: string]: any;
    }
  ): Promise<string> {
    const tokenCount = this.tokenBudget.countTokens(content);
    const embedding = await this.embeddings.embed(content);
    const embeddingBuffer = this.embeddings.embeddingToBuffer(embedding);
    
    const chunk = await this.prisma.chunk.create({
      data: {
        projectId: this.projectId,
        path,
        content,
        chunkType,
        tokenCount,
        embedding: Buffer.from(embeddingBuffer),
        language: metadata?.language,
        commitHash: metadata?.commitHash,
        lineStart: metadata?.lineStart,
        lineEnd: metadata?.lineEnd,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    });
    
    return chunk.id;
  }
  
  /**
   * Batch store multiple chunks
   */
  async storeChunks(
    chunks: Array<{
      path: string;
      content: string;
      chunkType: 'code' | 'doc' | 'diff';
      metadata?: any;
    }>
  ): Promise<string[]> {
    // Generate embeddings in batch
    const contents = chunks.map(c => c.content);
    const embeddings = await this.embeddings.embedBatch(contents);
    
    // Prepare data for batch insert
    const data = chunks.map((chunk, i) => ({
      projectId: this.projectId,
      path: chunk.path,
      content: chunk.content,
      chunkType: chunk.chunkType,
      tokenCount: this.tokenBudget.countTokens(chunk.content),
      embedding: Buffer.from(this.embeddings.embeddingToBuffer(embeddings[i])),
      language: chunk.metadata?.language,
      commitHash: chunk.metadata?.commitHash,
      lineStart: chunk.metadata?.lineStart,
      lineEnd: chunk.metadata?.lineEnd,
      metadata: chunk.metadata ? JSON.stringify(chunk.metadata) : null
    }));
    
    // Use transaction for batch insert
    const created = await this.prisma.$transaction(
      data.map(d => this.prisma.chunk.create({ data: d }))
    );
    
    return created.map(c => c.id);
  }
  
  /**
   * Retrieve similar chunks
   */
  async retrieve(
    query: string,
    options: RetrievalOptions = {}
  ): Promise<RetrievedChunk[]> {
    const {
      topK = RETRIEVAL_CONFIG.INITIAL_K,
      minSimilarity = RETRIEVAL_CONFIG.MIN_SIMILARITY,
      fileFilter,
      recencyBoost = true,
      proximityBoost = true
    } = options;
    
    // Generate query embedding
    const queryEmbedding = await this.embeddings.embed(query);
    
    // Fetch all chunks for this project (with optional file filter)
    const chunks = await this.prisma.chunk.findMany({
      where: {
        projectId: this.projectId,
        ...(fileFilter && fileFilter.length > 0 ? {
          path: { in: fileFilter }
        } : {})
      },
      orderBy: { updatedAt: 'desc' }
    });
    
    if (chunks.length === 0) {
      return [];
    }
    
    // Calculate similarities
    const scored = chunks.map(chunk => {
      const chunkEmbedding = this.embeddings.bufferToEmbedding(Buffer.from(chunk.embedding));
      let similarity = this.embeddings.cosineSimilarity(queryEmbedding, chunkEmbedding);
      
      // Apply recency boost
      if (recencyBoost) {
        const ageInDays = (Date.now() - chunk.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
        const recencyFactor = Math.exp(-ageInDays / 7); // Decay over a week
        similarity += similarity * recencyFactor * RETRIEVAL_CONFIG.RECENCY_WEIGHT;
      }
      
      // Apply proximity boost if we have focus files
      if (proximityBoost && fileFilter && fileFilter.length > 0) {
        const isInFocus = fileFilter.includes(chunk.path);
        if (isInFocus) {
          similarity += similarity * RETRIEVAL_CONFIG.PROXIMITY_WEIGHT;
        }
      }
      
      return {
        chunk,
        similarity: Math.min(1, similarity) // Cap at 1
      };
    });
    
    // Filter by minimum similarity
    const filtered = scored.filter(s => s.similarity >= minSimilarity);
    
    // Sort by similarity
    filtered.sort((a, b) => b.similarity - a.similarity);
    
    // Take top K
    const topChunks = filtered.slice(0, topK);
    
    // Convert to result format
    return topChunks.map(({ chunk, similarity }) => ({
      id: chunk.id,
      content: chunk.content,
      path: chunk.path,
      similarity,
      tokenCount: chunk.tokenCount,
      metadata: chunk.metadata ? JSON.parse(chunk.metadata) : undefined
    }));
  }
  
  /**
   * Retrieve chunks within token budget
   */
  async retrieveWithinBudget(
    query: string,
    maxTokens: number,
    options: RetrievalOptions = {}
  ): Promise<RetrievedChunk[]> {
    // Start with initial K
    let k = options.topK || RETRIEVAL_CONFIG.INITIAL_K;
    let chunks = await this.retrieve(query, { ...options, topK: k });
    
    // Calculate total tokens
    let totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);
    
    // If within budget, try to get more
    while (totalTokens < maxTokens && k < RETRIEVAL_CONFIG.MAX_K) {
      k = Math.min(k * 2, RETRIEVAL_CONFIG.MAX_K);
      const moreChunks = await this.retrieve(query, { ...options, topK: k });
      
      // Recalculate with more chunks
      totalTokens = moreChunks.reduce((sum, c) => sum + c.tokenCount, 0);
      
      if (totalTokens <= maxTokens) {
        chunks = moreChunks;
      } else {
        // Too many, trim to fit
        break;
      }
    }
    
    // Trim chunks to fit budget
    const result: RetrievedChunk[] = [];
    let usedTokens = 0;
    
    for (const chunk of chunks) {
      if (usedTokens + chunk.tokenCount <= maxTokens) {
        result.push(chunk);
        usedTokens += chunk.tokenCount;
      } else {
        // Try to fit partial chunk
        const remainingTokens = maxTokens - usedTokens;
        if (remainingTokens > 100) { // Only include if meaningful
          const trimmed = this.tokenBudget.trimToFit(chunk.content, remainingTokens);
          result.push({
            ...chunk,
            content: trimmed,
            tokenCount: this.tokenBudget.countTokens(trimmed)
          });
        }
        break;
      }
    }
    
    return result;
  }
  
  /**
   * Update chunk content and re-embed
   */
  async updateChunk(chunkId: string, newContent: string): Promise<void> {
    const tokenCount = this.tokenBudget.countTokens(newContent);
    const embedding = await this.embeddings.embed(newContent);
    const embeddingBuffer = this.embeddings.embeddingToBuffer(embedding);
    
    await this.prisma.chunk.update({
      where: { id: chunkId },
      data: {
        content: newContent,
        tokenCount,
        embedding: embeddingBuffer
      }
    });
  }
  
  /**
   * Delete chunks by path
   */
  async deleteChunksByPath(path: string): Promise<void> {
    await this.prisma.chunk.deleteMany({
      where: {
        projectId: this.projectId,
        path
      }
    });
  }
  
  /**
   * Get chunk by ID
   */
  async getChunk(chunkId: string): Promise<Chunk | null> {
    return await this.prisma.chunk.findUnique({
      where: { id: chunkId }
    });
  }
  
  /**
   * Clear all chunks for project
   */
  async clearAll(): Promise<void> {
    await this.prisma.chunk.deleteMany({
      where: { projectId: this.projectId }
    });
  }
}