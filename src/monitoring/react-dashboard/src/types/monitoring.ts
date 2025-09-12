export type Tab = 'overview' | 'pipeline' | 'memory' | 'sessions' | 'tools';

export interface MonitoringData {
  overview: {
    tokenUsage: number;
    activeTasks: number;
    memoryChunks: number;
    throughput: number;
    serverStatus: 'online' | 'offline';
    uptime: number;
  };
  memory: {
    totalChunks: number;
    activeChunks: number;
    memoryUsage: number;
    storageSize: number;
    chunkTypes: { [key: string]: number };
  };
  sessions: Array<{
    id: string;
    status: string;
    createdAt: string;
    tokensUsed: number;
    chunksCreated: number;
  }>;
  pipeline: {
    steps: Array<{
      name: string;
      status: string;
      executions: number;
      avgDuration: number;
    }>;
  };
}

export interface PipelineStep {
  name: string;
  status: string;
  executions: number;
  avgDuration: number;
}

export interface MemoryData {
  totalChunks: number;
  activeChunks: number;
  memoryUsage: number;
  storageSize: number;
  chunkTypes: { [key: string]: number };
}

export interface SessionData {
  id: string;
  status: string;
  createdAt: string;
  tokensUsed: number;
  chunksCreated: number;
}

export interface Tool {
  name: string;
  status: 'active' | 'inactive';
  executions: number;
  description: string;
}

export interface ToolCategory {
  category: string;
  tools: number;
  healthy: number;
  issues: number;
}