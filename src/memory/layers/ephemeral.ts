/**
 * Ephemeral Memory Layer
 * Short-term, session-scoped memory with LRU cache
 */

import { LRUCache } from 'lru-cache';
import { TokenBudgetManager } from '../token-budget.js';

export interface Turn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokenCount: number;
}

export interface WorkingContext {
  currentFile?: string;
  workingDiff?: string;
  focusFiles: string[];
  lastError?: string;
}

export interface EphemeralState {
  turns: Turn[];
  workingContext: WorkingContext;
  totalTokens: number;
}

export class EphemeralMemory {
  private cache: LRUCache<string, any>;
  private turns: Turn[] = [];
  private workingContext: WorkingContext = {
    focusFiles: []
  };
  private tokenBudget: TokenBudgetManager;
  private maxTurns: number = 10;
  
  constructor(tokenBudget: TokenBudgetManager) {
    this.tokenBudget = tokenBudget;
    
    // LRU cache for transient data
    this.cache = new LRUCache({
      max: 100, // Max 100 items
      ttl: 1000 * 60 * 15, // 15 minutes TTL
      updateAgeOnGet: true,
      updateAgeOnHas: true
    });
  }
  
  /**
   * Add a conversation turn
   */
  addTurn(role: 'user' | 'assistant' | 'system', content: string): void {
    const tokenCount = this.tokenBudget.countTokens(content);
    const turn: Turn = {
      role,
      content,
      timestamp: new Date(),
      tokenCount
    };
    
    this.turns.push(turn);
    
    // Trim old turns if exceeding limits
    this.trimTurns();
  }
  
  /**
   * Trim turns to fit within token budget
   */
  private trimTurns(): void {
    // Keep at most maxTurns
    if (this.turns.length > this.maxTurns) {
      this.turns = this.turns.slice(-this.maxTurns);
    }
    
    // Trim further if exceeding token budget
    let totalTokens = this.turns.reduce((sum, turn) => sum + turn.tokenCount, 0);
    const maxTokens = this.tokenBudget.getRemainingBudget('ephemeral');
    
    while (totalTokens > maxTokens && this.turns.length > 2) {
      const removed = this.turns.shift();
      if (removed) {
        totalTokens -= removed.tokenCount;
      }
    }
  }
  
  /**
   * Update working context
   */
  updateWorkingContext(context: Partial<WorkingContext>): void {
    this.workingContext = {
      ...this.workingContext,
      ...context
    };
    
    // Limit focus files
    if (this.workingContext.focusFiles.length > 10) {
      this.workingContext.focusFiles = this.workingContext.focusFiles.slice(-10);
    }
  }
  
  /**
   * Get recent turns within token budget
   */
  getRecentTurns(maxTokens?: number): Turn[] {
    const limit = maxTokens || this.tokenBudget.getRemainingBudget('ephemeral');
    const result: Turn[] = [];
    let totalTokens = 0;
    
    // Add turns from most recent backwards
    for (let i = this.turns.length - 1; i >= 0; i--) {
      const turn = this.turns[i];
      if (totalTokens + turn.tokenCount <= limit) {
        result.unshift(turn);
        totalTokens += turn.tokenCount;
      } else {
        break;
      }
    }
    
    return result;
  }
  
  /**
   * Get formatted context for prompt
   */
  getFormattedContext(): string {
    const turns = this.getRecentTurns();
    const parts: string[] = [];
    
    // Add working context if present
    if (this.workingContext.currentFile) {
      parts.push(`Working on: ${this.workingContext.currentFile}`);
    }
    
    if (this.workingContext.focusFiles.length > 0) {
      parts.push(`Focus files: ${this.workingContext.focusFiles.join(', ')}`);
    }
    
    if (this.workingContext.workingDiff) {
      const diffPreview = this.tokenBudget.trimToFit(
        this.workingContext.workingDiff,
        500
      );
      parts.push(`Current changes:\n${diffPreview}`);
    }
    
    // Add conversation history
    if (turns.length > 0) {
      parts.push('\nRecent conversation:');
      for (const turn of turns) {
        parts.push(`${turn.role}: ${turn.content}`);
      }
    }
    
    return parts.join('\n');
  }
  
  /**
   * Cache a value
   */
  set(key: string, value: any): void {
    this.cache.set(key, value);
  }
  
  /**
   * Get cached value
   */
  get(key: string): any {
    return this.cache.get(key);
  }
  
  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  /**
   * Get current state for persistence
   */
  getState(): EphemeralState {
    return {
      turns: this.turns,
      workingContext: this.workingContext,
      totalTokens: this.turns.reduce((sum, turn) => sum + turn.tokenCount, 0)
    };
  }
  
  /**
   * Restore state from snapshot
   */
  restoreState(state: EphemeralState): void {
    this.turns = state.turns.map(t => ({
      ...t,
      timestamp: new Date(t.timestamp)
    }));
    this.workingContext = state.workingContext;
    this.trimTurns(); // Ensure still within budget
  }
  
  /**
   * Clear all ephemeral memory
   */
  clear(): void {
    this.turns = [];
    this.workingContext = { focusFiles: [] };
    this.cache.clear();
  }
  
  /**
   * Get token usage
   */
  getTokenUsage(): number {
    return this.turns.reduce((sum, turn) => sum + turn.tokenCount, 0);
  }
}