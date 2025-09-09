import { EventEmitter } from 'events';
import type { 
  Task, 
  TaskPlan, 
  OrchestratorConfig, 
  Progress,
  ExecutionContext 
} from './types.js';
import { TaskStatus } from './types.js';
import { Planner } from './Planner.js';
import { Executor } from './Executor.js';

export class Orchestrator extends EventEmitter {
  private planner: Planner;
  private executor: Executor;
  private config: OrchestratorConfig;
  private activeTasks: Map<string, Task>;
  private taskQueue: Task[];
  private healthCheckTimer?: NodeJS.Timeout;
  private stuckDetectionTimer?: NodeJS.Timeout;
  private lastProgressTime: number = Date.now();
  private completedTaskCount: number = 0;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    super();
    
    this.config = {
      maxConcurrentTasks: config.maxConcurrentTasks || 3,
      defaultTimeoutMs: config.defaultTimeoutMs || 30000,
      maxRetries: config.maxRetries || 2,
      progressCallback: config.progressCallback,
      healthCheckInterval: config.healthCheckInterval || 5000,
      aiModel: (config as any).aiModel
    };

    this.planner = new Planner((config as any).aiModel);
    this.executor = new Executor();
    this.activeTasks = new Map();
    this.taskQueue = [];

    this.startHealthMonitoring();
  }

  async orchestrate(prompt: string): Promise<any> {
    console.log('🎭 Orchestrator: Starting orchestration for prompt:', prompt.substring(0, 100));
    
    try {
      // Phase 1: Planning
      console.log('📋 Orchestrator: Starting planning phase...');
      this.emit('phase', { phase: 'planning', message: 'Analyzing and planning tasks...' });
      
      console.log('📋 Orchestrator: About to call planner.createPlan...');
      const plan = await this.planner.createPlan(prompt);
      
      console.log(`📋 Orchestrator: Created plan with ${plan.tasks.length} tasks`);
      this.emit('plan', plan);

      // Phase 2: Execution
      this.emit('phase', { phase: 'execution', message: 'Executing tasks...' });
      const results = await this.executePlan(plan);

      // Phase 3: Completion
      this.emit('phase', { phase: 'completion', message: 'Orchestration complete' });
      
      return results;
    } catch (error) {
      console.error('🚨 Orchestrator: Fatal error', error);
      this.emit('error', error);
      throw error;
    } finally {
      this.cleanup();
    }
  }

  private async executePlan(plan: TaskPlan): Promise<any[]> {
    const results: any[] = [];
    this.taskQueue = [...plan.tasks];
    
    return new Promise((resolve, reject) => {
      const checkCompletion = () => {
        if (this.taskQueue.length === 0 && this.activeTasks.size === 0) {
          resolve(results);
        }
      };

      const processQueue = async () => {
        while (this.taskQueue.length > 0 && this.activeTasks.size < this.config.maxConcurrentTasks) {
          const task = this.taskQueue.shift()!;
          
          // Check dependencies
          if (this.areDependenciesMet(task, results)) {
            await this.executeTask(task, results);
          } else {
            // Put back in queue if dependencies not met
            this.taskQueue.push(task);
          }
        }
        checkCompletion();
      };

      // Start processing
      processQueue().catch(reject);
      
      // Set up completion monitoring
      this.on('taskComplete', () => {
        processQueue().catch(reject);
      });
    });
  }

  private async executeTask(task: Task, results: any[]): Promise<void> {
    task.status = TaskStatus.EXECUTING;
    task.startTime = Date.now();
    this.activeTasks.set(task.id, task);
    
    this.emit('taskStart', task);
    this.updateProgress();

    // Get previous results for tasks with dependencies
    const previousResults = task.dependencies.length > 0 
      ? results
          .filter(r => task.dependencies.includes(r.taskId))
          .map(r => r.result)
      : [];

    const context: ExecutionContext & { previousResults?: any[] } = {
      taskId: task.id,
      attempt: task.retryCount + 1,
      startTime: task.startTime,
      timeout: task.timeoutMs,
      previousResults  // Pass the dependency results
    };

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(
        () => this.executor.execute(task, context),
        task.timeoutMs
      );

      task.status = TaskStatus.COMPLETED;
      task.endTime = Date.now();
      task.result = result;
      results.push({ taskId: task.id, result });
      
      this.completedTaskCount++;
      this.lastProgressTime = Date.now();
      
      this.emit('taskComplete', task);
      console.log(`✅ Task ${task.id} completed successfully`);
      
    } catch (error) {
      await this.handleTaskError(task, error as Error, results);
    } finally {
      this.activeTasks.delete(task.id);
      this.updateProgress();
    }
  }

  private async handleTaskError(task: Task, error: Error, results: any[]): Promise<void> {
    console.error(`❌ Task ${task.id} failed:`, error.message);
    
    if (task.retryCount < task.maxRetries) {
      task.retryCount++;
      task.status = TaskStatus.RETRYING;
      
      console.log(`🔄 Retrying task ${task.id} (attempt ${task.retryCount + 1}/${task.maxRetries + 1})`);
      this.emit('taskRetry', task);
      
      // Add back to queue for retry
      this.taskQueue.unshift(task);
    } else {
      task.status = TaskStatus.FAILED;
      task.endTime = Date.now();
      task.error = error.message;
      
      this.emit('taskFailed', task);
      results.push({ taskId: task.id, error: error.message });
    }
  }

  private executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Task timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }

  private areDependenciesMet(task: Task, results: any[]): boolean {
    const completedTaskIds = new Set(results.map(r => r.taskId));
    return task.dependencies.every(dep => completedTaskIds.has(dep));
  }

  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    this.stuckDetectionTimer = setInterval(() => {
      this.detectStuckTasks();
    }, 10000);
  }

  private performHealthCheck(): void {
    const now = Date.now();
    const timeSinceProgress = now - this.lastProgressTime;
    
    let healthStatus: 'healthy' | 'degraded' | 'stuck' = 'healthy';
    
    if (timeSinceProgress > 60000 && this.activeTasks.size > 0) {
      healthStatus = 'stuck';
      console.warn('⚠️ Orchestrator: No progress in 60 seconds, may be stuck');
      this.emit('healthAlert', { status: 'stuck', tasks: Array.from(this.activeTasks.values()) });
    } else if (timeSinceProgress > 30000 && this.activeTasks.size > 0) {
      healthStatus = 'degraded';
    }

    this.emit('health', { status: healthStatus, timeSinceProgress });
  }

  private detectStuckTasks(): void {
    const now = Date.now();
    
    for (const [taskId, task] of this.activeTasks) {
      if (task.startTime) {
        const runtime = now - task.startTime;
        
        if (runtime > task.timeoutMs * 1.5) {
          console.warn(`⚠️ Task ${taskId} appears stuck (running for ${runtime}ms)`);
          this.emit('taskStuck', task);
          
          // Force fail the task
          task.status = TaskStatus.TIMEOUT;
          task.endTime = now;
          task.error = 'Task exceeded timeout and was terminated';
          
          this.activeTasks.delete(taskId);
          this.emit('taskTimeout', task);
        }
      }
    }
  }

  private updateProgress(): void {
    const progress: Progress = {
      total: this.taskQueue.length + this.activeTasks.size + this.completedTaskCount,
      completed: this.completedTaskCount,
      failed: 0, // Track this separately if needed
      inProgress: this.activeTasks.size,
      currentTasks: Array.from(this.activeTasks.values()).map(t => t.description),
      estimatedTimeRemaining: this.estimateTimeRemaining(),
      healthStatus: 'healthy'
    };

    if (this.config.progressCallback) {
      this.config.progressCallback(progress);
    }
    
    this.emit('progress', progress);
  }

  private estimateTimeRemaining(): number {
    // Simple estimation based on average task time
    if (this.completedTaskCount === 0) {
      return this.taskQueue.length * this.config.defaultTimeoutMs;
    }
    
    const avgTaskTime = (Date.now() - this.lastProgressTime) / Math.max(1, this.completedTaskCount);
    return (this.taskQueue.length + this.activeTasks.size) * avgTaskTime;
  }

  private cleanup(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.stuckDetectionTimer) {
      clearInterval(this.stuckDetectionTimer);
    }
    
    this.activeTasks.clear();
    this.taskQueue = [];
    this.completedTaskCount = 0;
  }

  // Public methods for external control
  
  public pause(): void {
    this.emit('pause');
    // Implementation to pause execution
  }

  public resume(): void {
    this.emit('resume');
    // Implementation to resume execution
  }

  public abort(): void {
    this.emit('abort');
    this.cleanup();
  }

  public getStatus(): Progress {
    return {
      total: this.taskQueue.length + this.activeTasks.size + this.completedTaskCount,
      completed: this.completedTaskCount,
      failed: 0,
      inProgress: this.activeTasks.size,
      currentTasks: Array.from(this.activeTasks.values()).map(t => t.description),
      estimatedTimeRemaining: this.estimateTimeRemaining(),
      healthStatus: 'healthy'
    };
  }
}