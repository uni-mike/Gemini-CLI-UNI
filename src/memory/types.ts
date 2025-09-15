/**
 * Memory System Type Definitions
 */

export type OperatingMode = 'concise' | 'direct' | 'deep';

export interface MemoryLayer {
  name: string;
  type: 'ephemeral' | 'retrieval' | 'knowledge' | 'git';
  initialized: boolean;

  initialize(): Promise<void>;
  getContext(query: string): Promise<string>;
  clear(): Promise<void>;
}

export interface ChunkMetadata {
  prompt_hash?: string;
  tools_used?: string[];
  success_rate?: number;
  timestamp?: string;
  [key: string]: any;
}

export interface RetrievedChunk {
  id: string;
  path: string;
  content: string;
  similarity: number;
  metadata?: ChunkMetadata;
}

export interface TokenUsage {
  input: {
    ephemeral: number;
    retrieved: number;
    knowledge: number;
    query: number;
    buffer: number;
    total: number;
  };
  output: {
    reasoning: number;
    code: number;
    explanation: number;
    buffer: number;
    total: number;
  };
  mode: OperatingMode;
}