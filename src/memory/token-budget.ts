/**
 * Token Budget Manager
 * Enforces strict token limits and manages allocations
 */

import { TOKEN_LIMITS, OperatingMode } from './constants.js';
import { encode } from 'gpt-tokenizer';

export interface TokenAllocation {
  ephemeral: number;
  retrieved: number;
  knowledge: number;
  query: number;
  buffer: number;
  total: number;
}

export interface TokenUsage {
  input: TokenAllocation;
  output: {
    reasoning: number;
    code: number;
    explanation: number;
    buffer: number;
    total: number;
  };
  mode: OperatingMode;
}

export class TokenBudgetManager {
  private mode: OperatingMode;
  private currentUsage: TokenUsage;
  
  constructor(mode: OperatingMode = 'concise') {
    this.mode = mode;
    this.currentUsage = this.initializeUsage();
  }
  
  private initializeUsage(): TokenUsage {
    return {
      input: {
        ephemeral: 0,
        retrieved: 0,
        knowledge: 0,
        query: 0,
        buffer: 0,
        total: 0
      },
      output: {
        reasoning: 0,
        code: 0,
        explanation: 0,
        buffer: 0,
        total: 0
      },
      mode: this.mode
    };
  }
  
  /**
   * Count tokens in a string
   */
  countTokens(text: string): number {
    try {
      return encode(text).length;
    } catch {
      // Fallback to approximate count
      return Math.ceil(text.length / 4);
    }
  }
  
  /**
   * Check if adding content would exceed budget
   */
  canAddToInput(category: keyof TokenAllocation, content: string): boolean {
    const tokens = this.countTokens(content);
    const budget = TOKEN_LIMITS.INPUT_BUDGET[category.toUpperCase() as keyof typeof TOKEN_LIMITS.INPUT_BUDGET];
    
    if (typeof budget !== 'number') return false;
    
    return this.currentUsage.input[category] + tokens <= budget;
  }
  
  /**
   * Add content to input budget
   */
  addToInput(category: keyof TokenAllocation, content: string): boolean {
    const tokens = this.countTokens(content);
    
    if (!this.canAddToInput(category, content)) {
      return false;
    }
    
    this.currentUsage.input[category] += tokens;
    this.currentUsage.input.total = this.calculateInputTotal();
    return true;
  }
  
  /**
   * Calculate total input tokens
   */
  private calculateInputTotal(): number {
    return Object.entries(this.currentUsage.input)
      .filter(([key]) => key !== 'total')
      .reduce((sum, [_, value]) => sum + value, 0);
  }
  
  /**
   * Get remaining budget for a category
   */
  getRemainingBudget(category: keyof TokenAllocation): number {
    const budget = TOKEN_LIMITS.INPUT_BUDGET[category.toUpperCase() as keyof typeof TOKEN_LIMITS.INPUT_BUDGET];
    if (typeof budget !== 'number') return 0;
    
    return budget - this.currentUsage.input[category];
  }
  
  /**
   * Get output token limit for current mode
   */
  getOutputLimit(): number {
    return TOKEN_LIMITS.MODES[this.mode.toUpperCase() as keyof typeof TOKEN_LIMITS.MODES].maxTokens;
  }
  
  /**
   * Get reasoning token cap for current mode
   */
  getReasoningCap(): number {
    return TOKEN_LIMITS.MODES[this.mode.toUpperCase() as keyof typeof TOKEN_LIMITS.MODES].reasoningCap;
  }
  
  /**
   * Trim content to fit within budget
   */
  trimToFit(content: string, maxTokens: number): string {
    const tokens = this.countTokens(content);
    
    if (tokens <= maxTokens) {
      return content;
    }
    
    // Binary search for the right length
    let low = 0;
    let high = content.length;
    let bestFit = '';
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = content.substring(0, mid);
      const candidateTokens = this.countTokens(candidate);
      
      if (candidateTokens <= maxTokens) {
        bestFit = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    
    return bestFit + '...';
  }
  
  /**
   * Get usage report
   */
  getUsageReport(): string {
    const inputPercent = Math.round((this.currentUsage.input.total / TOKEN_LIMITS.MAX_INPUT) * 100);
    const modeLimit = this.getOutputLimit();
    
    return `Token Usage (${this.mode} mode):
Input: ${this.currentUsage.input.total}/${TOKEN_LIMITS.MAX_INPUT} (${inputPercent}%)
  - Ephemeral: ${this.currentUsage.input.ephemeral}/${TOKEN_LIMITS.INPUT_BUDGET.EPHEMERAL}
  - Retrieved: ${this.currentUsage.input.retrieved}/${TOKEN_LIMITS.INPUT_BUDGET.RETRIEVED}
  - Knowledge: ${this.currentUsage.input.knowledge}/${TOKEN_LIMITS.INPUT_BUDGET.KNOWLEDGE}
  - Query: ${this.currentUsage.input.query}/${TOKEN_LIMITS.INPUT_BUDGET.QUERY}
Output Limit: ${modeLimit} (reasoning cap: ${this.getReasoningCap()})`;
  }
  
  /**
   * Reset usage counters
   */
  reset(): void {
    this.currentUsage = this.initializeUsage();
  }
  
  /**
   * Set operating mode
   */
  setMode(mode: OperatingMode): void {
    this.mode = mode;
    this.currentUsage.mode = mode;
  }
  
  /**
   * Get current usage
   */
  getUsage(category?: string): TokenUsage | number {
    if (category) {
      // Return specific category usage
      if (category in this.currentUsage.input) {
        return this.currentUsage.input[category as keyof TokenAllocation];
      }
      return 0;
    }
    return { ...this.currentUsage };
  }

  /**
   * Get total usage for compatibility
   */
  getTotalUsage(): number {
    return this.currentUsage.input.total;
  }
}