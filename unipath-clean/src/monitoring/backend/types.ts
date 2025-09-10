/**
 * Monitoring System Types
 */

export interface MetricPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

export interface TokenMetrics {
  input: {
    ephemeral: number;
    retrieved: number;
    knowledge: number;
    query: number;
    buffer: number;
    total: number;
    limit: number;
  };
  output: {
    reasoning: number;
    code: number;
    explanation: number;
    buffer: number;
    total: number;
    limit: number;
  };
  mode: 'direct' | 'concise' | 'deep';
}

export interface MemoryLayerStatus {
  name: string;
  type: 'ephemeral' | 'retrieval' | 'knowledge' | 'execution' | 'git';
  tokensUsed: number;
  tokenLimit: number;
  itemCount: number;
  lastAccessed: Date;
  status: 'active' | 'idle' | 'error';
  details?: any;
}

export interface SessionMetrics {
  sessionId: string;
  projectId: string;
  projectName: string;
  mode: string;
  status: 'active' | 'completed' | 'crashed';
  startedAt: Date;
  endedAt?: Date;
  turnCount: number;
  totalTokensUsed: number;
  snapshotCount: number;
  tasksCompleted: number;
  toolsUsed: string[];
}

export interface PipelineStage {
  id: string;
  name: string;
  type: 'planner' | 'executor' | 'orchestrator' | 'memory' | 'llm';
  status: 'idle' | 'processing' | 'completed' | 'error';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  input?: any;
  output?: any;
  error?: string;
}

export interface ToolExecution {
  id: string;
  toolName: string;
  timestamp: Date;
  duration: number;
  success: boolean;
  input: any;
  output?: any;
  error?: string;
  tokensUsed?: number;
}

export interface RetrievalMetrics {
  queryId: string;
  query: string;
  timestamp: Date;
  chunksRetrieved: number;
  topSimilarity: number;
  avgSimilarity: number;
  tokensUsed: number;
  duration: number;
  filesAccessed: string[];
}

export interface GitContextMetrics {
  commitsIndexed: number;
  lastIndexed: Date;
  totalDiffSize: number;
  embeddingsGenerated: number;
  queryCount: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'error';
  uptime: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  diskUsage: {
    dbSize: number;
    cacheSize: number;
    logsSize: number;
  };
  apiHealth: {
    deepseek: 'online' | 'offline' | 'degraded';
    embeddings: 'online' | 'offline' | 'degraded';
    lastCheck: Date;
  };
  errors: Array<{
    timestamp: Date;
    component: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

export interface FlowNode {
  id: string;
  type: 'input' | 'process' | 'output' | 'decision';
  data: {
    label: string;
    status: 'idle' | 'active' | 'completed' | 'error';
    metrics?: any;
    description?: string;
  };
  position: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  label?: string;
  style?: any;
}

export interface MonitoringEvent {
  id: string;
  type: 'pipeline' | 'memory' | 'tool' | 'session' | 'error' | 'performance';
  timestamp: Date;
  component: string;
  action: string;
  data: any;
}