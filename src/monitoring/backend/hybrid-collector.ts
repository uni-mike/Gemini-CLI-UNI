/**
 * Hybrid Metrics Collector
 * Supports both integrated (direct) and autonomous (detached) modes
 * Can transition from one to the other seamlessly
 */

import { EventEmitter } from 'events';
import { MetricsCollector } from './MetricsCollector.js';
import { AutonomousCollector } from './autonomous-collector.js';
import { PrismaClient } from '@prisma/client';

export type CollectorMode = 'integrated' | 'autonomous' | 'hybrid';

export class HybridCollector extends EventEmitter {
  private mode: CollectorMode;
  private integratedCollector?: MetricsCollector;
  private autonomousCollector?: AutonomousCollector;
  private prisma: PrismaClient;
  private projectRoot: string;
  private metricsBuffer: any[] = [];
  
  constructor(
    prisma: PrismaClient, 
    projectRoot: string,
    mode: CollectorMode = 'hybrid'
  ) {
    super();
    this.prisma = prisma;
    this.projectRoot = projectRoot;
    this.mode = mode;
  }
  
  /**
   * Initialize collector based on mode
   */
  async initialize() {
    console.log(`🎯 Initializing HybridCollector in ${this.mode} mode`);
    
    switch (this.mode) {
      case 'integrated':
        // Only use direct integration
        this.initializeIntegrated();
        break;
        
      case 'autonomous':
        // Only use detached monitoring
        await this.initializeAutonomous();
        break;
        
      case 'hybrid':
        // Use both - integrated for accuracy, autonomous for resilience
        this.initializeIntegrated();
        await this.initializeAutonomous();
        this.setupCrossValidation();
        break;
    }
  }
  
  /**
   * Initialize integrated collector
   */
  private initializeIntegrated() {
    this.integratedCollector = MetricsCollector.getInstance(this.prisma);
    
    // Forward all events
    this.integratedCollector.on('tokenUpdate', (data) => {
      this.emit('metrics:token', { source: 'integrated', data });
      this.bufferMetric('token', data);
    });
    
    this.integratedCollector.on('toolComplete', (data) => {
      this.emit('metrics:tool', { source: 'integrated', data });
      this.bufferMetric('tool', data);
    });
    
    this.integratedCollector.on('pipelineStageComplete', (data) => {
      this.emit('metrics:pipeline', { source: 'integrated', data });
      this.bufferMetric('pipeline', data);
    });
    
    console.log('✅ Integrated collector initialized');
  }
  
  /**
   * Initialize autonomous collector
   */
  private async initializeAutonomous() {
    this.autonomousCollector = new AutonomousCollector({
      projectRoot: this.projectRoot,
      pollInterval: 1000
    });
    
    // Forward all events
    this.autonomousCollector.on('tokenUpdate', (data) => {
      this.emit('metrics:token', { source: 'autonomous', data });
    });
    
    this.autonomousCollector.on('toolUpdate', (data) => {
      this.emit('metrics:tool', { source: 'autonomous', data });
    });
    
    this.autonomousCollector.on('pipelineUpdate', (data) => {
      this.emit('metrics:pipeline', { source: 'autonomous', data });
    });
    
    await this.autonomousCollector.start();
    console.log('✅ Autonomous collector initialized');
  }
  
  /**
   * Setup cross-validation in hybrid mode
   */
  private setupCrossValidation() {
    // Compare metrics from both sources
    this.on('metrics:token', (event) => {
      if (event.source === 'integrated') {
        // Store integrated metric for comparison
        this.metricsBuffer.push({
          type: 'token',
          source: 'integrated',
          data: event.data,
          timestamp: Date.now()
        });
      } else if (event.source === 'autonomous') {
        // Check if autonomous caught this metric
        const integrated = this.metricsBuffer.find(m => 
          m.type === 'token' && 
          Math.abs(m.timestamp - Date.now()) < 5000 // Within 5 seconds
        );
        
        if (integrated) {
          // Both caught it - good!
          this.emit('validation:success', {
            type: 'token',
            integrated: integrated.data,
            autonomous: event.data
          });
        } else {
          // Only autonomous caught it - might be missed by integration
          this.emit('validation:autonomous-only', {
            type: 'token',
            data: event.data
          });
        }
      }
    });
    
    // Clean old buffer entries
    setInterval(() => {
      const cutoff = Date.now() - 30000; // 30 seconds
      this.metricsBuffer = this.metricsBuffer.filter(m => m.timestamp > cutoff);
    }, 10000);
  }
  
  /**
   * Switch modes dynamically
   */
  async switchMode(newMode: CollectorMode) {
    console.log(`🔄 Switching from ${this.mode} to ${newMode} mode`);
    
    // Stop current collectors
    if (this.mode === 'integrated' || this.mode === 'hybrid') {
      // Integrated collector doesn't need explicit stop
      this.integratedCollector = undefined;
    }
    
    if (this.mode === 'autonomous' || this.mode === 'hybrid') {
      if (this.autonomousCollector) {
        await this.autonomousCollector.stop();
        this.autonomousCollector = undefined;
      }
    }
    
    // Switch mode and reinitialize
    this.mode = newMode;
    await this.initialize();
  }
  
  /**
   * Get metrics from appropriate source
   */
  getAllMetrics() {
    if (this.mode === 'integrated') {
      return this.integratedCollector?.getAllMetrics() || {};
    } else if (this.mode === 'autonomous') {
      return this.autonomousCollector?.getAllMetrics() || {};
    } else {
      // Hybrid mode - merge metrics from both sources
      const integrated = this.integratedCollector?.getAllMetrics() || {};
      const autonomous = this.autonomousCollector?.getAllMetrics() || {};
      
      return {
        integrated,
        autonomous,
        merged: this.mergeMetrics(integrated, autonomous)
      };
    }
  }
  
  /**
   * Merge metrics from both sources
   */
  private mergeMetrics(integrated: any, autonomous: any) {
    const merged: any = { ...integrated };
    
    // Prefer integrated metrics but fill gaps with autonomous
    for (const key in autonomous) {
      if (!merged[key] || this.isStale(merged[key])) {
        merged[key] = autonomous[key];
        merged[`${key}_source`] = 'autonomous';
      } else {
        merged[`${key}_source`] = 'integrated';
      }
    }
    
    return merged;
  }
  
  /**
   * Check if metric is stale
   */
  private isStale(metric: any): boolean {
    if (!metric.timestamp) return false;
    const age = Date.now() - new Date(metric.timestamp).getTime();
    return age > 30000; // 30 seconds
  }
  
  /**
   * Buffer metrics for validation
   */
  private bufferMetric(type: string, data: any) {
    this.metricsBuffer.push({
      type,
      source: 'integrated',
      data,
      timestamp: Date.now()
    });
  }
  
  /**
   * Public API matching MetricsCollector for drop-in replacement
   */
  recordTokenUsage(metrics: any) {
    if (this.integratedCollector) {
      this.integratedCollector.recordTokenUsage(metrics);
    }
    // Autonomous will pick it up from logs/DB
  }
  
  updateMemoryLayer(layer: any) {
    if (this.integratedCollector) {
      this.integratedCollector.updateMemoryLayer(layer);
    }
  }
  
  /**
   * Record memory metrics for a specific layer
   */
  recordMemoryMetrics(metrics: {
    layer: string;
    tokens: number;
    size: number;
    chunks?: number;
  }) {
    if (this.integratedCollector) {
      // Store memory metrics in the collector
      const memoryData = {
        layer: metrics.layer,
        tokens: metrics.tokens,
        size: metrics.size,
        chunks: metrics.chunks || 0,
        timestamp: Date.now()
      };
      
      // Emit event for tracking
      this.emit('metrics:memory', { source: 'integrated', data: memoryData });
      this.bufferMetric('memory', memoryData);
      
      // Store in database
      this.storeMemoryMetrics(memoryData);
    }
  }
  
  /**
   * Record overall memory update
   */
  recordMemoryUpdate(update: {
    totalTokens: number;
    layers?: any;
  }) {
    if (this.integratedCollector) {
      const updateData = {
        totalTokens: update.totalTokens,
        layers: update.layers,
        timestamp: Date.now()
      };
      
      this.emit('metrics:memory-update', { source: 'integrated', data: updateData });
      this.bufferMetric('memory-update', updateData);
    }
  }
  
  /**
   * Store memory metrics to database
   */
  private async storeMemoryMetrics(metrics: any) {
    try {
      // Store as execution log with type 'memory'
      await this.prisma.executionLog.create({
        data: {
          projectId: this.projectRoot,
          sessionId: await this.getCurrentSessionId(),
          type: 'memory',
          tool: `memory-${metrics.layer}`,
          output: JSON.stringify(metrics),
          success: true,
          duration: 0
        }
      });
    } catch (error) {
      console.error('Failed to store memory metrics:', error);
    }
  }
  
  /**
   * Get current session ID
   */
  private async getCurrentSessionId(): Promise<string | null> {
    try {
      const session = await this.prisma.session.findFirst({
        where: {
          projectId: this.projectRoot,
          endedAt: null
        },
        orderBy: {
          startedAt: 'desc'
        }
      });
      return session?.id || null;
    } catch (error) {
      return null;
    }
  }
  
  startPipelineStage(stage: any) {
    if (this.integratedCollector) {
      this.integratedCollector.startPipelineStage(stage);
    }
  }
  
  completePipelineStage(stageId: string, output?: any, error?: string) {
    if (this.integratedCollector) {
      this.integratedCollector.completePipelineStage(stageId, output, error);
    }
  }
  
  startToolExecution(tool: any) {
    if (this.integratedCollector) {
      this.integratedCollector.startToolExecution(tool);
    }
  }
  
  completeToolExecution(toolId: string, output?: any, error?: string) {
    if (this.integratedCollector) {
      this.integratedCollector.completeToolExecution(toolId, output, error);
    }
  }
  
  /**
   * Write execution log to database
   */
  async writeExecutionLogToDB(execution: any) {
    if (this.integratedCollector) {
      return await this.integratedCollector.writeExecutionLogToDB(execution);
    }
  }
  
  /**
   * Update session token count
   */
  async updateSessionTokens(tokens: number) {
    if (this.integratedCollector) {
      return await this.integratedCollector.updateSessionTokens(tokens);
    }
  }
  
  /**
   * Get mode info
   */
  getModeInfo() {
    return {
      currentMode: this.mode,
      hasIntegrated: !!this.integratedCollector,
      hasAutonomous: !!this.autonomousCollector,
      bufferSize: this.metricsBuffer.length,
      capabilities: {
        realtime: this.mode === 'integrated' || this.mode === 'hybrid',
        resilient: this.mode === 'autonomous' || this.mode === 'hybrid',
        validated: this.mode === 'hybrid'
      }
    };
  }
  
  /**
   * Cleanup
   */
  async stop() {
    if (this.autonomousCollector) {
      await this.autonomousCollector.stop();
    }
    this.removeAllListeners();
  }
}