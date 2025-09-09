export enum TaskStatus {
  PENDING = 'pending',
  PLANNING = 'planning',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  RETRYING = 'retrying'
}

export enum Role {
  PLANNER = 'planner',
  EXECUTOR = 'executor',
  ORCHESTRATOR = 'orchestrator'
}

export interface Task {
  id: string;
  description: string;
  dependencies: string[];
  status: TaskStatus;
  retryCount: number;
  maxRetries: number;
  timeoutMs: number;
  startTime?: number;
  endTime?: number;
  result?: any;
  error?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  args: any;
  result?: any;
  duration?: number;
}

export interface TaskPlan {
  id: string;
  originalPrompt: string;
  tasks: Task[];
  totalEstimatedTime: number;
  complexity: 'simple' | 'moderate' | 'complex';
  parallelizable: boolean;
}

export interface ExecutionContext {
  taskId: string;
  attempt: number;
  startTime: number;
  timeout: number;
  abortSignal?: AbortSignal;
}

export interface OrchestratorConfig {
  maxConcurrentTasks: number;
  defaultTimeoutMs: number;
  maxRetries: number;
  progressCallback?: (progress: Progress) => void;
  healthCheckInterval: number;
  aiModel?: any;
}

export interface Progress {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  currentTasks: string[];
  estimatedTimeRemaining: number;
  healthStatus: 'healthy' | 'degraded' | 'stuck';
}