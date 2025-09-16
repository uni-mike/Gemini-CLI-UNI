/**
 * LifecycleManager - Agent cleanup and resource management
 * Handles mini-agent lifecycle, cleanup, and resource deallocation
 */

import { EventEmitter } from 'events';
import { MiniAgentInstance, MiniAgentProgress, HealthStatus } from './types.js';
import { Config } from '../../config/Config.js';
import { Orchestrator } from '../../core/orchestrator.js';

export interface LifecycleStats {
  totalAgentsCreated: number;
  totalAgentsCompleted: number;
  totalAgentsFailed: number;
  totalAgentsTimeout: number;
  activeAgents: number;
  averageLifetime: number;
  memoryUsage: number;
  cleanupOperations: number;
}

export interface CleanupResult {
  agentId: string;
  success: boolean;
  resourcesFreed: {
    memory: number;
    eventListeners: number;
    timers: number;
    fileHandles: number;
  };
  duration: number;
  errors: string[];
}

export class LifecycleManager extends EventEmitter {
  private config: Config;
  private activeAgents: Map<string, { agentId: string, startTime: number, type: string }> = new Map();
  private agentLifecycles: Map<string, AgentLifecycle> = new Map();
  private cleanupQueue: string[] = [];
  private isCleanupRunning: boolean = false;
  private stats: LifecycleStats = {
    totalAgentsCreated: 0,
    totalAgentsCompleted: 0,
    totalAgentsFailed: 0,
    totalAgentsTimeout: 0,
    activeAgents: 0,
    averageLifetime: 0,
    memoryUsage: 0,
    cleanupOperations: 0
  };
  private cleanupInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: Config) {
    super();
    this.config = config;
    this.startPeriodicCleanup();
    this.startHealthMonitoring();
  }

  /**
   * Register a new mini-agent
   */
  public registerAgent(agentId: string, parentId: string, type: string): void {
    const now = Date.now();

    this.activeAgents.set(agentId, { agentId, startTime: now, type });

    const lifecycle: AgentLifecycle = {
      agentId,
      parentId,
      createdAt: now,
      startedAt: now,
      status: 'spawning',
      taskType: type,
      priority: 'normal',
      resourcesAllocated: {},
      healthChecks: [],
      lastHeartbeat: Date.now()
    };

    this.agentLifecycles.set(agentId, lifecycle);

    // Update stats
    this.stats.totalAgentsCreated++;
    this.stats.activeAgents = this.activeAgents.size;

    this.emit('agent-registered', {
      agentId,
      lifecycle,
      timestamp: Date.now()
    });

    console.debug(`LifecycleManager: Registered agent ${agentId}`);
  }

  private setupAgentEventHandlers(agent: MiniOrchestrator): void {
    const agentId = agent.getInstance().id;

    // Monitor progress updates
    agent.on('progress', (progress: MiniAgentProgress) => {
      this.updateAgentLifecycle(agentId, progress);
    });

    // Monitor health checks
    agent.on('health-check', (health: HealthStatus) => {
      this.recordHealthCheck(agentId, health);
    });

    // Handle completion
    agent.on('completed', () => {
      this.handleAgentCompletion(agentId);
    });

    // Handle errors
    agent.on('error', (error: any) => {
      this.handleAgentError(agentId, error);
    });
  }

  private setupAgentTimeout(agentId: string, timeoutMs: number): void {
    setTimeout(() => {
      const agent = this.activeAgents.get(agentId);
      if (agent && agent.isActive()) {
        this.handleAgentTimeout(agentId);
      }
    }, timeoutMs);
  }

  private updateAgentLifecycle(agentId: string, progress: MiniAgentProgress): void {
    const lifecycle = this.agentLifecycles.get(agentId);
    if (lifecycle) {
      lifecycle.status = progress.status;
      lifecycle.lastHeartbeat = Date.now();

      // Update started time if transitioning to running
      if (progress.status === 'running' && !lifecycle.startedAt) {
        lifecycle.startedAt = Date.now();
      }

      // Update completion time
      if (progress.status === 'completed' || progress.status === 'failed') {
        lifecycle.completedAt = Date.now();
        lifecycle.finalOutput = progress.output;
        lifecycle.errorMessage = progress.error;
      }

      this.agentLifecycles.set(agentId, lifecycle);
    }
  }

  private recordHealthCheck(agentId: string, health: HealthStatus): void {
    const lifecycle = this.agentLifecycles.get(agentId);
    if (lifecycle) {
      lifecycle.healthChecks.push({
        timestamp: health.lastCheck,
        status: health.status,
        metrics: { ...health.metrics },
        alerts: [...health.alerts]
      });

      // Keep only last 10 health checks
      if (lifecycle.healthChecks.length > 10) {
        lifecycle.healthChecks = lifecycle.healthChecks.slice(-10);
      }

      lifecycle.lastHeartbeat = Date.now();
      this.agentLifecycles.set(agentId, lifecycle);
    }
  }

  private handleAgentCompletion(agentId: string): void {
    this.stats.totalAgentsCompleted++;
    this.scheduleCleanup(agentId);

    this.emit('agent-completed', {
      agentId,
      timestamp: Date.now()
    });

    console.debug(`LifecycleManager: Agent ${agentId} completed`);
  }

  private handleAgentError(agentId: string, error: any): void {
    this.stats.totalAgentsFailed++;

    const lifecycle = this.agentLifecycles.get(agentId);
    if (lifecycle) {
      lifecycle.errorMessage = error.message || error;
      lifecycle.completedAt = Date.now();
      this.agentLifecycles.set(agentId, lifecycle);
    }

    this.scheduleCleanup(agentId);

    this.emit('agent-failed', {
      agentId,
      error: error.message || error,
      timestamp: Date.now()
    });

    console.error(`LifecycleManager: Agent ${agentId} failed:`, error);
  }

  private handleAgentTimeout(agentId: string): void {
    this.stats.totalAgentsTimeout++;

    const agent = this.activeAgents.get(agentId);
    if (agent) {
      // Try to gracefully stop the agent
      agent.destroy();
    }

    const lifecycle = this.agentLifecycles.get(agentId);
    if (lifecycle) {
      lifecycle.status = 'timeout';
      lifecycle.completedAt = Date.now();
      lifecycle.errorMessage = 'Agent execution timeout';
      this.agentLifecycles.set(agentId, lifecycle);
    }

    this.scheduleCleanup(agentId);

    this.emit('agent-timeout', {
      agentId,
      timestamp: Date.now()
    });

    console.warn(`LifecycleManager: Agent ${agentId} timed out`);
  }

  private scheduleCleanup(agentId: string): void {
    if (!this.cleanupQueue.includes(agentId)) {
      this.cleanupQueue.push(agentId);
    }

    // Process cleanup immediately if not already running
    if (!this.isCleanupRunning) {
      process.nextTick(() => this.processCleanupQueue());
    }
  }

  private async processCleanupQueue(): Promise<void> {
    if (this.isCleanupRunning || this.cleanupQueue.length === 0) {
      return;
    }

    this.isCleanupRunning = true;

    try {
      while (this.cleanupQueue.length > 0) {
        const agentId = this.cleanupQueue.shift();
        if (agentId) {
          await this.cleanupAgent(agentId);
        }
      }
    } catch (error) {
      console.error('Error processing cleanup queue:', error);
    } finally {
      this.isCleanupRunning = false;
    }
  }

  private async cleanupAgent(agentId: string): Promise<CleanupResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let resourcesFreed = {
      memory: 0,
      eventListeners: 0,
      timers: 0,
      fileHandles: 0
    };

    try {
      const agent = this.activeAgents.get(agentId);
      const lifecycle = this.agentLifecycles.get(agentId);

      if (agent) {
        // Measure resources before cleanup
        const beforeMemory = process.memoryUsage().heapUsed;

        try {
          // Destroy the agent
          agent.destroy();
          resourcesFreed.eventListeners += agent.listenerCount('*');
        } catch (error: any) {
          errors.push(`Agent destruction failed: ${error.message}`);
        }

        // Remove from active agents
        this.activeAgents.delete(agentId);

        // Measure memory after cleanup
        const afterMemory = process.memoryUsage().heapUsed;
        resourcesFreed.memory = Math.max(0, beforeMemory - afterMemory);
      }

      // Update lifecycle status
      if (lifecycle) {
        lifecycle.cleanedAt = Date.now();
        lifecycle.resourcesFreed = resourcesFreed;

        // Calculate lifetime
        const lifetime = (lifecycle.completedAt || Date.now()) - lifecycle.createdAt;
        this.updateAverageLifetime(lifetime);
      }

      // Update stats
      this.stats.activeAgents = this.activeAgents.size;
      this.stats.cleanupOperations++;

      const result: CleanupResult = {
        agentId,
        success: errors.length === 0,
        resourcesFreed,
        duration: Date.now() - startTime,
        errors
      };

      this.emit('agent-cleaned', result);

      console.debug(`LifecycleManager: Cleaned up agent ${agentId}`, {
        success: result.success,
        duration: result.duration,
        resourcesFreed: result.resourcesFreed
      });

      return result;

    } catch (error: any) {
      errors.push(`Cleanup process failed: ${error.message}`);

      const result: CleanupResult = {
        agentId,
        success: false,
        resourcesFreed,
        duration: Date.now() - startTime,
        errors
      };

      this.emit('cleanup-error', result);

      return result;
    }
  }

  private calculateResourceAllocation(instance: MiniAgentInstance): ResourceAllocation {
    const contextSize = JSON.stringify(instance.memoryContext).length;
    const conversationSize = JSON.stringify(instance.conversation).length;

    return {
      memoryBytes: contextSize + conversationSize,
      maxTokens: instance.memoryContext.maxTokens,
      maxToolCalls: instance.permissions.maxToolCalls,
      estimatedCost: this.estimateAgentCost(instance)
    };
  }

  private estimateAgentCost(instance: MiniAgentInstance): number {
    // Rough cost estimation based on token usage and tool calls
    const tokenCost = instance.memoryContext.maxTokens * 0.0001; // $0.0001 per 1k tokens
    const toolCost = instance.permissions.maxToolCalls * 0.01; // $0.01 per tool call
    return tokenCost + toolCost;
  }

  private updateAverageLifetime(newLifetime: number): void {
    const totalCompleted = this.stats.totalAgentsCompleted + this.stats.totalAgentsFailed;
    if (totalCompleted > 0) {
      this.stats.averageLifetime =
        (this.stats.averageLifetime * (totalCompleted - 1) + newLifetime) / totalCompleted;
    }
  }

  private startPeriodicCleanup(): void {
    const cleanupInterval = parseInt(
      this.config.get('MINI_AGENT_CLEANUP_INTERVAL', '60000') // 1 minute
    );

    this.cleanupInterval = setInterval(() => {
      this.performMaintenanceCleanup();
    }, cleanupInterval);
  }

  private startHealthMonitoring(): void {
    const healthInterval = parseInt(
      this.config.get('MINI_AGENT_HEALTH_MONITOR_INTERVAL', '30000') // 30 seconds
    );

    this.healthCheckInterval = setInterval(() => {
      this.checkAgentHealth();
    }, healthInterval);
  }

  private performMaintenanceCleanup(): void {
    const now = Date.now();
    const staleTimeout = parseInt(
      this.config.get('MINI_AGENT_STALE_TIMEOUT', '300000') // 5 minutes
    );

    // Find stale agents (no heartbeat for too long)
    const staleAgents: string[] = [];

    this.agentLifecycles.forEach((lifecycle, agentId) => {
      if (now - lifecycle.lastHeartbeat > staleTimeout) {
        staleAgents.push(agentId);
      }
    });

    // Clean up stale agents
    staleAgents.forEach(agentId => {
      console.warn(`LifecycleManager: Cleaning up stale agent ${agentId}`);
      this.handleAgentTimeout(agentId);
    });

    // Clean up old lifecycle records
    this.cleanupOldLifecycles();

    // Update memory usage stats
    this.updateMemoryStats();

    this.emit('maintenance-cleanup', {
      staleAgentsRemoved: staleAgents.length,
      activeAgents: this.stats.activeAgents,
      memoryUsage: this.stats.memoryUsage,
      timestamp: now
    });
  }

  private cleanupOldLifecycles(): void {
    const maxAge = parseInt(
      this.config.get('MINI_AGENT_LIFECYCLE_MAX_AGE', '86400000') // 24 hours
    );
    const now = Date.now();

    const toDelete: string[] = [];

    this.agentLifecycles.forEach((lifecycle, agentId) => {
      // Only clean up completed lifecycles
      if (lifecycle.cleanedAt && now - lifecycle.cleanedAt > maxAge) {
        toDelete.push(agentId);
      }
    });

    toDelete.forEach(agentId => {
      this.agentLifecycles.delete(agentId);
    });

    if (toDelete.length > 0) {
      console.debug(`LifecycleManager: Cleaned up ${toDelete.length} old lifecycle records`);
    }
  }

  private checkAgentHealth(): void {
    const unhealthyAgents: string[] = [];

    this.activeAgents.forEach((agent, agentId) => {
      const health = agent.getHealth();

      if (health.status === 'critical') {
        unhealthyAgents.push(agentId);
        console.warn(`LifecycleManager: Agent ${agentId} in critical health state`, {
          alerts: health.alerts,
          metrics: health.metrics
        });

        // Consider terminating critically unhealthy agents
        if (health.alerts.length > 3) {
          this.handleAgentError(agentId, new Error('Agent terminated due to critical health'));
        }
      }
    });

    if (unhealthyAgents.length > 0) {
      this.emit('unhealthy-agents', {
        agentIds: unhealthyAgents,
        timestamp: Date.now()
      });
    }
  }

  private updateMemoryStats(): void {
    const memUsage = process.memoryUsage();
    this.stats.memoryUsage = memUsage.heapUsed;
  }

  // Public methods
  public getAgentLifecycle(agentId: string): AgentLifecycle | null {
    return this.agentLifecycles.get(agentId) || null;
  }

  public getActiveAgents(): string[] {
    return Array.from(this.activeAgents.keys());
  }

  public getStats(): LifecycleStats {
    this.updateMemoryStats();
    return { ...this.stats };
  }

  public async forceCleanup(agentId: string): Promise<CleanupResult> {
    return this.cleanupAgent(agentId);
  }

  public async forceCleanupAll(): Promise<CleanupResult[]> {
    const results: CleanupResult[] = [];
    const agentIds = Array.from(this.activeAgents.keys());

    for (const agentId of agentIds) {
      const result = await this.cleanupAgent(agentId);
      results.push(result);
    }

    return results;
  }

  public getAgentsByStatus(status: MiniAgentProgress['status']): string[] {
    const agents: string[] = [];

    this.agentLifecycles.forEach((lifecycle, agentId) => {
      if (lifecycle.status === status) {
        agents.push(agentId);
      }
    });

    return agents;
  }

  public getResourceUsage(): ResourceUsageSummary {
    let totalMemory = 0;
    let totalTokens = 0;
    let totalToolCalls = 0;
    let totalCost = 0;

    this.agentLifecycles.forEach(lifecycle => {
      if (lifecycle.resourcesAllocated) {
        totalMemory += lifecycle.resourcesAllocated.memoryBytes;
        totalTokens += lifecycle.resourcesAllocated.maxTokens;
        totalToolCalls += lifecycle.resourcesAllocated.maxToolCalls;
        totalCost += lifecycle.resourcesAllocated.estimatedCost;
      }
    });

    return {
      totalMemoryBytes: totalMemory,
      totalMaxTokens: totalTokens,
      totalMaxToolCalls: totalToolCalls,
      estimatedTotalCost: totalCost,
      activeAgents: this.stats.activeAgents,
      systemMemoryUsage: process.memoryUsage()
    };
  }

  // Cleanup on shutdown
  public async shutdown(): Promise<void> {
    console.log('LifecycleManager: Shutting down...');

    // Clear intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Force cleanup all active agents
    await this.forceCleanupAll();

    // Clear all data
    this.activeAgents.clear();
    this.agentLifecycles.clear();
    this.cleanupQueue = [];

    this.emit('shutdown-complete', { timestamp: Date.now() });
    this.removeAllListeners();

    console.log('LifecycleManager: Shutdown complete');
  }
}

// Supporting interfaces
interface AgentLifecycle {
  agentId: string;
  parentId: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  cleanedAt?: number;
  status: MiniAgentProgress['status'];
  taskType: string;
  priority: string;
  resourcesAllocated?: ResourceAllocation;
  resourcesFreed?: CleanupResult['resourcesFreed'];
  healthChecks: HealthCheckRecord[];
  lastHeartbeat: number;
  finalOutput?: string;
  errorMessage?: string;
}

interface ResourceAllocation {
  memoryBytes: number;
  maxTokens: number;
  maxToolCalls: number;
  estimatedCost: number;
}

interface HealthCheckRecord {
  timestamp: number;
  status: HealthStatus['status'];
  metrics: HealthStatus['metrics'];
  alerts: string[];
}

interface ResourceUsageSummary {
  totalMemoryBytes: number;
  totalMaxTokens: number;
  totalMaxToolCalls: number;
  estimatedTotalCost: number;
  activeAgents: number;
  systemMemoryUsage: NodeJS.MemoryUsage;
}