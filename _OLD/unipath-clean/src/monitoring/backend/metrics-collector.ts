/**
 * Metrics Collector
 * Collects and aggregates metrics from all system components
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import { 
  TokenMetrics, 
  MemoryLayerStatus, 
  SessionMetrics, 
  PipelineStage,
  ToolExecution,
  RetrievalMetrics,
  GitContextMetrics,
  SystemHealth,
  MonitoringEvent
} from './types.js';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { statSync, readdirSync } from 'fs';
import { join } from 'path';

export class MetricsCollector extends EventEmitter {
  private prisma: PrismaClient;
  private metrics: Map<string, any> = new Map();
  private events: MonitoringEvent[] = [];
  private maxEvents = 1000;
  private startTime: Date;
  private pipelineStages: Map<string, PipelineStage> = new Map();
  private activeTools: Map<string, ToolExecution> = new Map();
  
  constructor(prisma: PrismaClient) {
    super();
    this.prisma = prisma;
    this.startTime = new Date();
    this.startCollectionLoop();
  }
  
  /**
   * Start periodic metrics collection
   */
  private startCollectionLoop() {
    // Collect system metrics every 5 seconds
    setInterval(() => {
      this.collectSystemHealth();
    }, 5000);
    
    // Collect database metrics every 30 seconds
    setInterval(() => {
      this.collectDatabaseMetrics();
    }, 30000);
  }
  
  /**
   * Record token usage
   */
  recordTokenUsage(metrics: TokenMetrics) {
    this.metrics.set('currentTokenUsage', metrics);
    
    // Track historical
    const history = this.metrics.get('tokenHistory') || [];
    history.push({
      timestamp: new Date(),
      ...metrics
    });
    
    // Keep last 100 points
    if (history.length > 100) {
      history.shift();
    }
    
    this.metrics.set('tokenHistory', history);
    this.emit('tokenUpdate', metrics);
    this.recordEvent('memory', 'token_usage', metrics);
  }
  
  /**
   * Update memory layer status
   */
  updateMemoryLayer(layer: MemoryLayerStatus) {
    const layers = this.metrics.get('memoryLayers') || new Map();
    layers.set(layer.name, layer);
    this.metrics.set('memoryLayers', layers);
    this.emit('memoryLayerUpdate', layer);
    this.recordEvent('memory', 'layer_update', layer);
  }
  
  /**
   * Track session metrics
   */
  async updateSessionMetrics(sessionId: string) {
    try {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          snapshots: true,
          project: true
        }
      });
      
      if (!session) return;
      
      const metrics: SessionMetrics = {
        sessionId: session.id,
        projectId: session.projectId,
        projectName: session.project.name,
        mode: session.mode,
        status: session.status as any,
        startedAt: session.startedAt,
        endedAt: session.endedAt || undefined,
        turnCount: session.turnCount,
        totalTokensUsed: session.tokensUsed,
        snapshotCount: session.snapshots.length,
        tasksCompleted: 0, // TODO: Track from executor
        toolsUsed: [] // TODO: Track from executor
      };
      
      this.metrics.set('currentSession', metrics);
      this.emit('sessionUpdate', metrics);
      this.recordEvent('session', 'update', metrics);
    } catch (error) {
      console.warn('Failed to update session metrics:', error);
    }
  }
  
  /**
   * Track pipeline stage
   */
  startPipelineStage(stage: Omit<PipelineStage, 'startTime' | 'status'>) {
    const pipelineStage: PipelineStage = {
      ...stage,
      status: 'processing',
      startTime: new Date()
    };
    
    this.pipelineStages.set(stage.id, pipelineStage);
    this.emit('pipelineStageStart', pipelineStage);
    this.recordEvent('pipeline', 'stage_start', pipelineStage);
  }
  
  /**
   * Complete pipeline stage
   */
  completePipelineStage(stageId: string, output?: any, error?: string) {
    const stage = this.pipelineStages.get(stageId);
    if (!stage) return;
    
    stage.endTime = new Date();
    stage.duration = stage.endTime.getTime() - stage.startTime!.getTime();
    stage.status = error ? 'error' : 'completed';
    stage.output = output;
    stage.error = error;
    
    this.emit('pipelineStageComplete', stage);
    this.recordEvent('pipeline', 'stage_complete', stage);
  }
  
  /**
   * Track tool execution
   */
  startToolExecution(tool: Omit<ToolExecution, 'timestamp' | 'duration'>) {
    const execution: ToolExecution = {
      ...tool,
      timestamp: new Date(),
      duration: 0
    };
    
    this.activeTools.set(tool.id, execution);
    this.emit('toolStart', execution);
    this.recordEvent('tool', 'start', execution);
  }
  
  /**
   * Complete tool execution
   */
  completeToolExecution(toolId: string, output?: any, error?: string) {
    const tool = this.activeTools.get(toolId);
    if (!tool) return;
    
    tool.duration = Date.now() - tool.timestamp.getTime();
    tool.success = !error;
    tool.output = output;
    tool.error = error;
    
    this.activeTools.delete(toolId);
    
    // Write to database
    this.writeExecutionLogToDB(tool).catch(err => 
      console.warn('Failed to write execution log:', err)
    );
    
    // Track tool usage stats
    const toolStats = this.metrics.get('toolStats') || new Map();
    const stats = toolStats.get(tool.toolName) || { 
      count: 0, 
      successCount: 0, 
      totalDuration: 0,
      avgDuration: 0
    };
    
    stats.count++;
    if (tool.success) stats.successCount++;
    stats.totalDuration += tool.duration;
    stats.avgDuration = stats.totalDuration / stats.count;
    
    toolStats.set(tool.toolName, stats);
    this.metrics.set('toolStats', toolStats);
    
    this.emit('toolComplete', tool);
    this.recordEvent('tool', 'complete', tool);
  }
  
  /**
   * Track retrieval metrics
   */
  recordRetrieval(metrics: RetrievalMetrics) {
    const retrievals = this.metrics.get('retrievals') || [];
    retrievals.push(metrics);
    
    // Keep last 50
    if (retrievals.length > 50) {
      retrievals.shift();
    }
    
    this.metrics.set('retrievals', retrievals);
    
    // Update aggregates
    const stats = this.metrics.get('retrievalStats') || {};
    stats.totalQueries = (stats.totalQueries || 0) + 1;
    stats.avgChunks = ((stats.avgChunks || 0) * (stats.totalQueries - 1) + metrics.chunksRetrieved) / stats.totalQueries;
    stats.avgSimilarity = ((stats.avgSimilarity || 0) * (stats.totalQueries - 1) + metrics.avgSimilarity) / stats.totalQueries;
    stats.avgDuration = ((stats.avgDuration || 0) * (stats.totalQueries - 1) + metrics.duration) / stats.totalQueries;
    
    this.metrics.set('retrievalStats', stats);
    this.emit('retrievalComplete', metrics);
    this.recordEvent('memory', 'retrieval', metrics);
  }
  
  /**
   * Update git context metrics
   */
  async updateGitMetrics() {
    try {
      const projectId = this.metrics.get('projectId');
      if (!projectId) return;
      
      const commits = await this.prisma.gitCommit.count({
        where: { projectId }
      });
      
      const lastCommit = await this.prisma.gitCommit.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' }
      });
      
      const metrics: GitContextMetrics = {
        commitsIndexed: commits,
        lastIndexed: lastCommit?.createdAt || new Date(),
        totalDiffSize: 0, // TODO: Calculate
        embeddingsGenerated: commits,
        queryCount: 0 // TODO: Track
      };
      
      this.metrics.set('gitMetrics', metrics);
      this.emit('gitMetricsUpdate', metrics);
    } catch (error) {
      console.warn('Failed to update git metrics:', error);
    }
  }
  
  /**
   * Collect system health metrics
   */
  private async collectSystemHealth() {
    try {
      const health: SystemHealth = {
        status: 'healthy',
        uptime: Date.now() - this.startTime.getTime(),
        memoryUsage: this.getMemoryUsage(),
        diskUsage: await this.getDiskUsage(),
        apiHealth: await this.checkAPIHealth(),
        errors: this.getRecentErrors()
      };
      
      // Determine overall status
      if (health.errors.filter(e => e.severity === 'high').length > 0) {
        health.status = 'error';
      } else if (health.memoryUsage.percentage > 80 || health.errors.length > 10) {
        health.status = 'degraded';
      }
      
      this.metrics.set('systemHealth', health);
      this.emit('healthUpdate', health);
    } catch (error) {
      console.warn('Failed to collect system health:', error);
    }
  }
  
  /**
   * Get memory usage
   */
  private getMemoryUsage() {
    const used = process.memoryUsage();
    const total = os.totalmem();
    
    return {
      used: used.heapUsed,
      total: used.heapTotal,
      percentage: (used.heapUsed / used.heapTotal) * 100
    };
  }
  
  /**
   * Get disk usage
   */
  private async getDiskUsage() {
    try {
      const flexicliDir = '.flexicli';
      
      const getDirectorySize = (dir: string): number => {
        try {
          const files = readdirSync(dir);
          return files.reduce((total, file) => {
            const path = join(dir, file);
            const stats = statSync(path);
            return total + (stats.isDirectory() ? getDirectorySize(path) : stats.size);
          }, 0);
        } catch {
          return 0;
        }
      };
      
      return {
        dbSize: statSync(join(flexicliDir, 'flexicli.db')).size || 0,
        cacheSize: getDirectorySize(join(flexicliDir, 'cache')),
        logsSize: getDirectorySize(join(flexicliDir, 'logs'))
      };
    } catch {
      return { dbSize: 0, cacheSize: 0, logsSize: 0 };
    }
  }
  
  /**
   * Check API health
   */
  private async checkAPIHealth() {
    // TODO: Implement actual health checks
    return {
      deepseek: 'online' as const,
      embeddings: 'online' as const,
      lastCheck: new Date()
    };
  }
  
  /**
   * Get recent errors
   */
  private getRecentErrors() {
    return this.events
      .filter(e => e.type === 'error')
      .slice(-20)
      .map(e => ({
        timestamp: e.timestamp,
        component: e.component,
        message: e.data.message || 'Unknown error',
        severity: e.data.severity || 'low' as const
      }));
  }
  
  /**
   * Collect database metrics
   */
  private async collectDatabaseMetrics() {
    try {
      const counts = {
        chunks: await this.prisma.chunk.count(),
        commits: await this.prisma.gitCommit.count(),
        knowledge: await this.prisma.knowledge.count(),
        sessions: await this.prisma.session.count(),
        snapshots: await this.prisma.sessionSnapshot.count(),
        logs: await this.prisma.executionLog.count()
      };
      
      this.metrics.set('databaseCounts', counts);
      this.emit('databaseMetrics', counts);
    } catch (error) {
      console.warn('Failed to collect database metrics:', error);
    }
  }
  
  /**
   * Record monitoring event
   */
  recordEvent(type: MonitoringEvent['type'], action: string, data: any) {
    const event: MonitoringEvent = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      timestamp: new Date(),
      component: this.getCallerComponent(),
      action,
      data
    };
    
    this.events.push(event);
    
    // Trim old events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
    
    this.emit('event', event);
  }
  
  /**
   * Get caller component from stack trace
   */
  private getCallerComponent(): string {
    // Simple heuristic based on current context
    return 'system';
  }
  
  /**
   * Get all current metrics
   */
  getAllMetrics() {
    const result: any = {};
    
    for (const [key, value] of this.metrics.entries()) {
      if (value instanceof Map) {
        result[key] = Array.from(value.entries());
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 100): MonitoringEvent[] {
    return this.events.slice(-limit);
  }
  
  /**
   * Get active tools
   */
  getActiveTools() {
    return Array.from(this.activeTools.values());
  }
  
  /**
   * Clear metrics
   */
  clearMetrics() {
    this.metrics.clear();
    this.events = [];
  }
  
  /**
   * Update session token count
   */
  async updateSessionTokens(tokens: number) {
    try {
      const sessionId = this.metrics.get('currentSessionId');
      if (!sessionId) return;
      
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { 
          tokensUsed: { increment: tokens },
          turnCount: { increment: 1 }
        }
      });
    } catch (error) {
      console.warn('Failed to update session tokens:', error);
    }
  }

  /**
   * Write execution log to database
   */
  async writeExecutionLogToDB(tool: ToolExecution) {
    try {
      const projectId = this.metrics.get('projectId') || await this.ensureProject();
      const sessionId = this.metrics.get('currentSessionId') || await this.ensureSession(projectId);
      
      await this.prisma.executionLog.create({
        data: {
          id: tool.id,
          projectId: projectId,
          sessionId: sessionId,
          type: 'TOOL_EXECUTION',
          tool: tool.toolName,
          input: JSON.stringify(tool.input),
          output: JSON.stringify(tool.output || {}),
          success: tool.success,
          duration: tool.duration,
          errorMessage: tool.error || null
        }
      });
    } catch (error) {
      console.warn('Failed to write execution log to DB:', error);
    }
  }
  
  /**
   * Ensure project exists and return ID
   */
  private async ensureProject(): Promise<string> {
    try {
      const rootPath = process.cwd();
      const project = await this.prisma.project.upsert({
        where: { rootPath },
        update: { updatedAt: new Date() },
        create: {
          rootPath,
          name: 'UNIPATH CLI Session'
        }
      });
      
      this.metrics.set('projectId', project.id);
      return project.id;
    } catch (error) {
      console.warn('Failed to ensure project:', error);
      return 'default-project-id';
    }
  }
  
  /**
   * Ensure session exists and return ID  
   */
  private async ensureSession(projectId: string): Promise<string> {
    try {
      const session = await this.prisma.session.create({
        data: {
          projectId,
          mode: 'CONCISE',
          turnCount: 0,
          tokensUsed: 0,
          status: 'active'
        }
      });
      
      this.metrics.set('currentSessionId', session.id);
      return session.id;
    } catch (error) {
      console.warn('Failed to ensure session:', error);
      return 'default-session-id';
    }
  }
  
}