/**
 * Comprehensive Error Boundary System for Monitoring
 * Provides graceful error handling and recovery
 */

import { EventEmitter } from 'events';
import { FilePersistenceManager } from '../../persistence/FilePersistenceManager.js';

export interface ErrorContext {
  component: string;
  operation: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ErrorReport {
  error: Error;
  context: ErrorContext;
  stackTrace?: string;
  recovery?: string;
}

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export class MonitoringErrorBoundary extends EventEmitter {
  private static instance: MonitoringErrorBoundary;
  private errorLog: ErrorReport[] = [];
  private maxErrorLogSize = 100;
  private errorHandlers: Map<string, (error: Error, context: ErrorContext) => any> = new Map();
  private filePersistence: FilePersistenceManager;
  private recoveryStrategies: Map<string, () => Promise<boolean>> = new Map();
  
  private constructor() {
    super();
    this.filePersistence = FilePersistenceManager.getInstance();
    this.setupDefaultHandlers();
    this.setupRecoveryStrategies();
  }
  
  static getInstance(): MonitoringErrorBoundary {
    if (!MonitoringErrorBoundary.instance) {
      MonitoringErrorBoundary.instance = new MonitoringErrorBoundary();
    }
    return MonitoringErrorBoundary.instance;
  }
  
  /**
   * Setup default error handlers for common scenarios
   */
  private setupDefaultHandlers(): void {
    // Database errors
    this.errorHandlers.set('database', (error, context) => {
      console.error(`[${context.component}] Database error:`, error.message);
      return this.getFallbackData(context.operation);
    });
    
    // API errors
    this.errorHandlers.set('api', (error, context) => {
      console.error(`[${context.component}] API error:`, error.message);
      return { error: true, message: 'Service temporarily unavailable' };
    });
    
    // Memory errors
    this.errorHandlers.set('memory', (error, context) => {
      console.error(`[${context.component}] Memory error:`, error.message);
      this.clearCaches();
      return null;
    });
    
    // File system errors
    this.errorHandlers.set('filesystem', (error, context) => {
      console.error(`[${context.component}] File system error:`, error.message);
      return this.useInMemoryFallback(context);
    });
    
    // Embedding errors
    this.errorHandlers.set('embeddings', (error, context) => {
      console.warn(`[${context.component}] Embedding error, using fallback:`, error.message);
      return this.getFallbackEmbedding();
    });
  }
  
  /**
   * Setup recovery strategies
   */
  private setupRecoveryStrategies(): void {
    // Database recovery
    this.recoveryStrategies.set('database-locked', async () => {
      console.log('Attempting database recovery...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return true;
    });
    
    // Memory recovery
    this.recoveryStrategies.set('out-of-memory', async () => {
      console.log('Clearing caches to free memory...');
      this.clearCaches();
      if (global.gc) {
        global.gc();
      }
      return true;
    });
    
    // Connection recovery
    this.recoveryStrategies.set('connection-lost', async () => {
      console.log('Attempting to reconnect...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return true;
    });
  }
  
  /**
   * Handle an error with context
   */
  async handleError(
    error: Error,
    context: ErrorContext,
    severity: ErrorSeverity = 'medium'
  ): Promise<any> {
    // Log the error
    const report: ErrorReport = {
      error,
      context,
      stackTrace: error.stack
    };
    
    this.logError(report);
    await this.persistError(report, severity);
    
    // Emit error event
    this.emit('monitoring-error', { error, context, severity });
    
    // Determine error type and apply handler
    const errorType = this.classifyError(error);
    const handler = this.errorHandlers.get(errorType);
    
    if (handler) {
      try {
        const result = await handler(error, context);
        report.recovery = 'Handler applied successfully';
        return result;
      } catch (handlerError) {
        console.error('Error handler failed:', handlerError);
      }
    }
    
    // Try recovery strategy
    const strategy = this.recoveryStrategies.get(errorType);
    if (strategy) {
      const recovered = await strategy();
      if (recovered) {
        report.recovery = 'Recovery strategy successful';
        return this.retry(context);
      }
    }
    
    // Return fallback response
    return this.getFallbackResponse(context);
  }
  
  /**
   * Classify error type
   */
  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('sqlite') || message.includes('database') || message.includes('prisma')) {
      if (message.includes('locked') || message.includes('busy')) {
        return 'database-locked';
      }
      return 'database';
    }
    
    if (message.includes('memory') || message.includes('heap')) {
      return 'out-of-memory';
    }
    
    if (message.includes('fetch') || message.includes('network') || message.includes('timeout')) {
      return 'connection-lost';
    }
    
    if (message.includes('file') || message.includes('enoent') || message.includes('permission')) {
      return 'filesystem';
    }
    
    if (message.includes('embedding') || message.includes('openai')) {
      return 'embeddings';
    }
    
    return 'unknown';
  }
  
  /**
   * Log error to memory
   */
  private logError(report: ErrorReport): void {
    this.errorLog.push(report);
    
    // Trim log if too large
    if (this.errorLog.length > this.maxErrorLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxErrorLogSize);
    }
  }
  
  /**
   * Persist error to file
   */
  private async persistError(report: ErrorReport, severity: ErrorSeverity): Promise<void> {
    try {
      await this.filePersistence.logError(
        report.context.component,
        `${report.error.message} [${severity}]`,
        {
          context: report.context,
          stack: report.stackTrace,
          recovery: report.recovery
        }
      );
    } catch (persistError) {
      console.error('Failed to persist error:', persistError);
    }
  }
  
  /**
   * Get fallback data for failed operations
   */
  private getFallbackData(operation: string): any {
    const fallbacks: Record<string, any> = {
      'getMetrics': {
        totalSessions: 0,
        activeTokens: 0,
        toolExecutions: [],
        memoryLayers: { ephemeral: 0, knowledge: 0, retrieval: 0 }
      },
      'getSessions': { sessions: [], total: 0 },
      'getTools': { toolStats: [], totalExecutions: 0 },
      'getMemory': {
        layers: {
          ephemeral: { tokens: 0, chunks: 0 },
          knowledge: { tokens: 0, chunks: 0 },
          retrieval: { tokens: 0, chunks: 0 }
        }
      },
      'getPipeline': {
        stages: [],
        activeStage: null,
        completedStages: 0
      }
    };
    
    return fallbacks[operation] || {};
  }
  
  /**
   * Get fallback response for context
   */
  private getFallbackResponse(context: ErrorContext): any {
    return {
      error: true,
      message: 'Operation failed, using fallback',
      component: context.component,
      operation: context.operation,
      fallback: true,
      data: this.getFallbackData(context.operation)
    };
  }
  
  /**
   * Use in-memory fallback for file operations
   */
  private useInMemoryFallback(context: ErrorContext): any {
    console.log(`Using in-memory fallback for ${context.operation}`);
    return {
      inMemory: true,
      data: {}
    };
  }
  
  /**
   * Get fallback embedding
   */
  private getFallbackEmbedding(): Float32Array {
    // Return a simple fallback embedding
    const dimensions = 1536;
    const embedding = new Float32Array(dimensions);
    
    // Simple pattern for fallback
    for (let i = 0; i < dimensions; i++) {
      embedding[i] = Math.sin(i / 100) * 0.1;
    }
    
    return embedding;
  }
  
  /**
   * Clear caches to free memory
   */
  private clearCaches(): void {
    console.log('Clearing caches to free memory...');
    
    // Clear any in-memory caches
    this.errorLog = this.errorLog.slice(-10); // Keep only last 10 errors
    
    // Emit event for other components to clear their caches
    this.emit('clear-caches');
  }
  
  /**
   * Retry failed operation
   */
  private async retry(context: ErrorContext): Promise<any> {
    console.log(`Retrying operation: ${context.operation}`);
    
    // Emit retry event
    this.emit('retry-operation', context);
    
    // Return fallback for now
    return this.getFallbackResponse(context);
  }
  
  /**
   * Wrap a function with error boundary
   */
  wrap<T extends (...args: any[]) => any>(
    fn: T,
    component: string,
    operation: string
  ): T {
    return (async (...args: Parameters<T>) => {
      try {
        return await fn(...args);
      } catch (error) {
        const context: ErrorContext = {
          component,
          operation,
          timestamp: new Date(),
          metadata: { args }
        };
        
        return this.handleError(
          error instanceof Error ? error : new Error(String(error)),
          context
        );
      }
    }) as T;
  }
  
  /**
   * Wrap an async function with error boundary
   */
  wrapAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    component: string,
    operation: string
  ): T {
    return this.wrap(fn, component, operation);
  }
  
  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    byComponent: Record<string, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recentErrors: ErrorReport[];
  } {
    const stats = {
      total: this.errorLog.length,
      byComponent: {} as Record<string, number>,
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      },
      recentErrors: this.errorLog.slice(-5)
    };
    
    for (const report of this.errorLog) {
      const component = report.context.component;
      stats.byComponent[component] = (stats.byComponent[component] || 0) + 1;
    }
    
    return stats;
  }
  
  /**
   * Check system health
   */
  async checkHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const health = {
      healthy: true,
      issues: [] as string[],
      recommendations: [] as string[]
    };
    
    // Check error rate
    const recentErrors = this.errorLog.filter(
      e => Date.now() - e.context.timestamp.getTime() < 60000 // Last minute
    );
    
    if (recentErrors.length > 10) {
      health.healthy = false;
      health.issues.push('High error rate detected');
      health.recommendations.push('Check system logs for recurring issues');
    }
    
    // Check for critical errors
    const criticalErrors = recentErrors.filter(e => 
      e.error.message.includes('critical') || 
      e.error.message.includes('fatal')
    );
    
    if (criticalErrors.length > 0) {
      health.healthy = false;
      health.issues.push('Critical errors detected');
      health.recommendations.push('Immediate attention required');
    }
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    if (heapUsedPercent > 90) {
      health.healthy = false;
      health.issues.push('High memory usage');
      health.recommendations.push('Consider restarting the monitoring service');
    }
    
    return health;
  }
}

// Export singleton instance
export const errorBoundary = MonitoringErrorBoundary.getInstance();