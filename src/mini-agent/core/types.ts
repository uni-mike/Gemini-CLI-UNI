/**
 * Mini-Agent Core Types
 * Comprehensive TypeScript interfaces for the mini-agent system
 */

import { ToolResult } from '../../tools/base.js';
import { Message } from '../../llm/provider.js';

// Task delegation from supervisor to mini-agent
export interface MiniAgentTask {
  id: string;
  type: 'search' | 'migration' | 'analysis' | 'refactor' | 'test' | 'documentation' | 'general';
  prompt: string;
  context: ScopedMemoryContext;
  tools: ToolPermissions;
  maxIterations?: number;
  timeoutMs?: number;
  priority?: 'low' | 'normal' | 'high';
  parentId: string;
  metadata?: Record<string, any>;
}

// Progress reporting from mini-agent to supervisor
export interface MiniAgentProgress {
  agentId: string;
  parentId: string;
  status: 'spawning' | 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled';
  currentTool?: string;
  currentAction?: string;
  toolsUsed: ToolUsageLog[];
  output?: string;
  error?: string;
  metadata: {
    tokensUsed: number;
    executionTime: number;
    iterationCount: number;
    memorySize: number;
    startTime: number;
    lastUpdate: number;
  };
}

// Context scoping for memory isolation
export interface ScopedMemoryContext {
  relevantFiles: string[];
  searchPatterns: string[];
  domainKnowledge: string[];
  excludedContext: string[];
  maxTokens: number;
  projectContext?: string;
  sessionId: string;
  parentContext?: string;
}

// Tool permission system
export interface ToolPermissions {
  allowed: string[];
  restricted: string[];
  readOnly: boolean;
  networkAccess: boolean;
  fileSystemAccess: 'read' | 'write' | 'none';
  dangerousOperations: boolean;
  gitOperations: boolean;
  maxToolCalls: number;
}

// Tool usage logging
export interface ToolUsageLog {
  toolName: string;
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  result?: ToolResult;
}

// Event types for mini-agent orchestration
export type MiniAgentEvent =
  | { type: 'SPAWN_REQUESTED'; task: MiniAgentTask; timestamp: number }
  | { type: 'AGENT_SPAWNED'; agentId: string; parentId: string; timestamp: number }
  | { type: 'PROGRESS_UPDATE'; agentId: string; progress: MiniAgentProgress; timestamp: number }
  | { type: 'TOOL_EXECUTED'; agentId: string; tool: string; result: ToolResult; timestamp: number }
  | { type: 'AGENT_COMPLETED'; agentId: string; result: any; timestamp: number }
  | { type: 'AGENT_FAILED'; agentId: string; error: string; timestamp: number }
  | { type: 'CLEANUP_INITIATED'; agentId: string; timestamp: number }
  | { type: 'AGENT_DESTROYED'; agentId: string; timestamp: number }
  | { type: 'HEALTH_CHECK'; agentId: string; health: HealthStatus; timestamp: number };

// Execution pool configuration
export interface ExecutionPool {
  maxConcurrency: number;              // Maximum parallel agents (default: 10)
  queueSize: number;                   // Task queue capacity (default: 100)
  resourceThrottling: {
    maxTokensPerAgent: number;         // Individual agent token limit
    maxTotalTokens: number;            // Pool-wide token limit
    timeoutMs: number;                 // Timeout per agent
    maxMemoryMB: number;               // Memory limit per agent
  };
  batchStrategy: 'parallel' | 'sequential' | 'adaptive';
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
    exponentialBackoff: boolean;
  };
}

// Health monitoring
export interface HealthCheck {
  heartbeatInterval: number;           // Health check frequency
  metrics: HealthMetrics;
  alertThresholds: AlertThresholds;
  enabled: boolean;
}

export interface HealthMetrics {
  tokensUsed: number;
  executionTime: number;
  toolInvocations: number;
  memoryFootprint: number;
  errorCount: number;
  successRate: number;
  avgResponseTime: number;
}

export interface AlertThresholds {
  tokenExhaustion: number;             // Percentage threshold for token usage
  longRunning: number;                 // Execution time warning threshold
  highErrorRate: number;               // Error rate threshold
  memoryExhaustion: number;            // Memory usage threshold
}

export interface HealthStatus {
  agentId: string;
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  metrics: HealthMetrics;
  alerts: string[];
  lastCheck: number;
}

// Security policy
export interface SecurityPolicy {
  toolRestrictions: {
    dangerous: string[];               // Tools that require special permissions
    readOnly: string[];                // Safe read-only tools
    writeAllowed: string[];            // Tools allowed to modify files
  };
  contextSandboxing: {
    isolateMemory: boolean;            // Prevent cross-agent memory access
    preventCrossAgent: boolean;        // Prevent agent-to-agent communication
    encryptSensitive: boolean;         // Encrypt sensitive context data
  };
  resourceLimits: {
    maxFileReads: number;              // Maximum file read operations
    maxFileWrites: number;             // Maximum file write operations
    maxToolCalls: number;              // Maximum tool invocations
    networkCallsAllowed: boolean;      // Allow network operations
    maxExecutionTime: number;          // Maximum execution time
  };
}

// Mini-agent instance state
export interface MiniAgentInstance {
  id: string;
  parentId: string;
  task: MiniAgentTask;
  status: MiniAgentProgress['status'];
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  conversation: Message[];
  toolsUsed: ToolUsageLog[];
  memoryContext: ScopedMemoryContext;
  permissions: ToolPermissions;
  health: HealthStatus;
}

// Agent spawner configuration
export interface SpawnerConfig {
  templates: Record<string, AgentTemplate>;
  defaultTimeout: number;
  defaultMaxIterations: number;
  securityPolicy: SecurityPolicy;
  executionPool: ExecutionPool;
}

// Agent template for different task types
export interface AgentTemplate {
  type: MiniAgentTask['type'];
  promptTemplate: string;
  defaultTools: string[];
  defaultPermissions: Partial<ToolPermissions>;
  maxTokens: number;
  specialization: string;
  examples?: string[];
}

// State aggregation result
export interface AggregatedState {
  totalAgents: number;
  activeAgents: number;
  completedAgents: number;
  failedAgents: number;
  totalTokensUsed: number;
  totalExecutionTime: number;
  results: Record<string, any>;
  errors: string[];
  summary: string;
}

// Event bus interface
export interface EventBus {
  emit<T extends MiniAgentEvent>(event: T): void;
  on<T extends MiniAgentEvent>(eventType: T['type'], handler: (event: T) => void): void;
  off<T extends MiniAgentEvent>(eventType: T['type'], handler: (event: T) => void): void;
  once<T extends MiniAgentEvent>(eventType: T['type'], handler: (event: T) => void): void;
  removeAllListeners(eventType?: MiniAgentEvent['type']): void;
}

// Configuration from environment
export interface MiniAgentConfig {
  enabled: boolean;
  maxConcurrentAgents: number;
  defaultTimeoutMs: number;
  enableHealthChecks: boolean;
  enableMetrics: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  securityMode: 'strict' | 'permissive' | 'development';
}