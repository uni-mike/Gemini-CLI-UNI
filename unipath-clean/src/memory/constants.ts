/**
 * Token Budget Constants
 * Hard limits and budget allocations for DeepSeek-R1-0528
 */

export const TOKEN_LIMITS = {
  // Hard limits from DeepSeek-R1-0528
  MAX_INPUT: 128000,
  MAX_OUTPUT: 32768,
  MAX_TOTAL: 160768,
  
  // Output mode caps (includes reasoning)
  MODES: {
    DIRECT: {
      maxTokens: 1000,
      reasoningCap: 200
    },
    CONCISE: {
      maxTokens: 6000,
      reasoningCap: 5000
    },
    DEEP: {
      maxTokens: 15000,
      reasoningCap: 12000
    }
  },
  
  // Input budget allocation targets
  INPUT_BUDGET: {
    EPHEMERAL: 5000,      // Recent turns + working diff
    RETRIEVED: 40000,     // Retrieved chunks from DB
    KNOWLEDGE: 2000,      // Preferences, architecture notes
    QUERY: 2000,          // User command/prompt
    BUFFER: 10000,        // Safety buffer
    get TOTAL() {
      return this.EPHEMERAL + this.RETRIEVED + this.KNOWLEDGE + this.QUERY + this.BUFFER;
    }
  },
  
  // Output budget allocation targets
  OUTPUT_BUDGET: {
    REASONING: 5000,      // Internal reasoning (hidden)
    CODE: 12000,          // Generated code/diffs
    EXPLANATION: 1000,    // Optional explanation
    BUFFER: 2000,         // Safety buffer
    get TOTAL() {
      return this.REASONING + this.CODE + this.EXPLANATION + this.BUFFER;
    }
  }
} as const;

export const CHUNK_SIZES = {
  // Code chunking
  CODE: {
    MIN: 300,
    MAX: 800,
    OVERLAP: 100
  },
  // Documentation chunking
  DOCS: {
    MIN: 400,
    MAX: 800,
    OVERLAP: 50
  },
  // Git diff chunking
  DIFF: {
    MAX_PER_FILE: 500,
    CONTEXT_LINES: 3
  }
} as const;

export const RETRIEVAL_CONFIG = {
  // Initial top-K for retrieval
  INITIAL_K: 12,
  // Maximum K to expand to
  MAX_K: 30,
  // Similarity threshold
  MIN_SIMILARITY: 0.7,
  // Recency boost factor
  RECENCY_WEIGHT: 0.2,
  // File proximity boost
  PROXIMITY_WEIGHT: 0.3
} as const;

export const SESSION_CONFIG = {
  // Session snapshot frequency
  SNAPSHOT_INTERVAL: 3,  // Every N operations
  // Max session snapshots to keep
  MAX_SNAPSHOTS: 20,
  // Log rotation
  MAX_LOGS: 10,
  MAX_LOG_SIZE_MB: 50
} as const;

export const DB_CONFIG = {
  // Database file names
  DB_NAME: 'flexicli.db',
  // Project metadata
  META_FILE: 'meta.json',
  // Schema version
  SCHEMA_VERSION: 1
} as const;

export type OperatingMode = 'direct' | 'concise' | 'deep';