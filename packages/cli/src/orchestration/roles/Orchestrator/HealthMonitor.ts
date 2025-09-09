import type { Task } from '../../types.js';
import { EventEmitter } from 'events';

export class HealthMonitor extends EventEmitter {
  private lastProgressTime: number = Date.now();
  private healthCheckTimer?: NodeJS.Timeout;
  private stuckDetectionTimer?: NodeJS.Timeout;

  start(checkInterval: number = 5000): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, checkInterval);

    this.stuckDetectionTimer = setInterval(() => {
      this.emit('stuckCheck');
    }, 10000);
  }

  stop(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.stuckDetectionTimer) {
      clearInterval(this.stuckDetectionTimer);
    }
  }

  updateProgress(): void {
    this.lastProgressTime = Date.now();
  }

  performHealthCheck(): 'healthy' | 'degraded' | 'stuck' {
    const now = Date.now();
    const timeSinceProgress = now - this.lastProgressTime;
    
    let healthStatus: 'healthy' | 'degraded' | 'stuck' = 'healthy';
    
    if (timeSinceProgress > 60000) {
      healthStatus = 'stuck';
      console.warn('⚠️ No progress in 60 seconds, may be stuck');
      this.emit('alert', { status: 'stuck', timeSinceProgress });
    } else if (timeSinceProgress > 30000) {
      healthStatus = 'degraded';
      this.emit('alert', { status: 'degraded', timeSinceProgress });
    }

    this.emit('health', { status: healthStatus, timeSinceProgress });
    return healthStatus;
  }

  detectStuckTasks(activeTasks: Map<string, Task>): Task[] {
    const now = Date.now();
    const stuckTasks: Task[] = [];
    
    for (const [taskId, task] of activeTasks) {
      if (task.startTime) {
        const runtime = now - task.startTime;
        
        if (runtime > task.timeoutMs * 1.5) {
          console.warn(`⚠️ Task ${taskId} appears stuck (running for ${runtime}ms)`);
          stuckTasks.push(task);
        }
      }
    }
    
    return stuckTasks;
  }
}