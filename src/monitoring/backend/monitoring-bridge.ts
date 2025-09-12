/**
 * Monitoring Bridge
 * Subscribes to existing agent events and forwards to monitoring system
 * Can attach/detach without affecting agent operation
 */

import { EventEmitter } from 'events';
import { Orchestrator } from '../../core/orchestrator.js';
import { MemoryManager } from '../../memory/memory-manager.js';
import { MetricsCollector } from './MetricsCollector.js';
import { AutonomousCollector } from './autonomous-collector.js';
import { PrismaClient } from '@prisma/client';

export class MonitoringBridge {
  private collector: MetricsCollector;
  private autonomousCollector: AutonomousCollector;
  private attachedModules: Map<string, EventEmitter> = new Map();
  private listeners: Map<string, Function[]> = new Map();
  
  constructor(prisma: PrismaClient, projectRoot: string) {
    // Integrated collector for real-time events
    this.collector = new MetricsCollector(prisma);
    
    // Autonomous collector continues working even if agent dies
    this.autonomousCollector = new AutonomousCollector({
      projectRoot,
      pollInterval: 2000
    });
  }
  
  /**
   * Start monitoring (works with or without agent)
   */
  async start() {
    // Always start autonomous monitoring (reads DB, logs, files)
    await this.autonomousCollector.start();
    console.log('📊 Autonomous monitoring started (will survive agent crashes)');
  }
  
  /**
   * Attach to a running orchestrator (optional - for real-time data)
   */
  attachToOrchestrator(orchestrator: Orchestrator) {
    if (this.attachedModules.has('orchestrator')) {
      console.log('Already attached to orchestrator');
      return;
    }
    
    const listeners: Function[] = [];
    
    // Subscribe to existing orchestrator events
    const onPlanningStart = (data: any) => {
      this.collector.startPipelineStage({
        id: `plan-${Date.now()}`,
        name: 'Planning',
        type: 'planner',
        input: data
      });
    };
    orchestrator.on('planning-start', onPlanningStart);
    listeners.push(() => orchestrator.off('planning-start', onPlanningStart));
    
    const onPlanningComplete = (plan: any) => {
      this.collector.completePipelineStage(`plan-${Date.now()}`, plan);
    };
    orchestrator.on('planning-complete', onPlanningComplete);
    listeners.push(() => orchestrator.off('planning-complete', onPlanningComplete));
    
    // Track tool executions with proper IDs
    const toolExecutions = new Map<string, any>();
    
    const onToolExecute = (data: any) => {
      console.log('🔧 [MONITORING] Tool execute event received:', data.name || 'unknown');
      const toolId = `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const execution = {
        id: toolId,
        toolName: data.name || 'unknown',
        success: false,
        input: data.args,
        startTime: Date.now()
      };
      toolExecutions.set(data.name || toolId, execution);
      this.collector.startToolExecution(execution);
    };
    orchestrator.on('tool-execute', onToolExecute);
    listeners.push(() => orchestrator.off('tool-execute', onToolExecute));
    
    const onToolResult = async (result: any) => {
      console.log('✅ [MONITORING] Tool result event received:', result.name || 'unknown', 'success:', result.success !== false);
      const execution = toolExecutions.get(result.name) || {
        id: `tool-${Date.now()}`,
        toolName: result.name || 'unknown',
        startTime: Date.now()
      };
      
      execution.success = result.success !== false;
      execution.output = result.result;
      execution.duration = Date.now() - execution.startTime;
      execution.error = result.error;
      
      // Complete and persist to database
      this.collector.completeToolExecution(execution.id, result.result, result.error);
      
      try {
        await this.collector.writeExecutionLogToDB(execution);
        console.log('💾 [MONITORING] Execution log written to DB for:', execution.toolName);
      } catch (error) {
        console.error('❌ [MONITORING] Failed to write execution log:', error);
      }
      
      toolExecutions.delete(result.name);
    };
    orchestrator.on('tool-result', onToolResult);
    listeners.push(() => orchestrator.off('tool-result', onToolResult));
    
    const onOrchestrationError = (error: any) => {
      this.collector.recordEvent('error', 'orchestration_error', error);
    };
    orchestrator.on('orchestration-error', onOrchestrationError);
    listeners.push(() => orchestrator.off('orchestration-error', onOrchestrationError));
    
    // Track token usage from DeepSeek API
    const onTokenUsage = async (usage: any) => {
      console.log('💰 [MONITORING] Token usage event received:', usage);
      
      // Update session with actual token counts
      try {
        const totalTokens = (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
        await this.collector.updateSessionTokens(totalTokens);
        console.log('💾 [MONITORING] Session tokens updated:', totalTokens);
        
        // Also record detailed token metrics
        this.collector.recordTokenUsage({
          input: {
            ephemeral: 0,
            retrieved: 0,
            knowledge: 0,
            query: usage.prompt_tokens || 0,
            buffer: 0,
            total: usage.prompt_tokens || 0,
            limit: 128000
          },
          output: {
            reasoning: 0,
            code: 0,
            explanation: usage.completion_tokens || 0,
            buffer: 0,
            total: usage.completion_tokens || 0,
            limit: 32000
          },
          mode: 'concise' as const
        });
      } catch (error) {
        console.error('❌ [MONITORING] Failed to update session tokens:', error);
      }
    };
    orchestrator.on('token-usage', onTokenUsage);
    listeners.push(() => orchestrator.off('token-usage', onTokenUsage));
    
    this.attachedModules.set('orchestrator', orchestrator);
    this.listeners.set('orchestrator', listeners);
    
    console.log('✅ Monitoring attached to orchestrator (real-time events enabled)');
  }
  
  /**
   * Attach to memory manager (optional - for token tracking)
   */
  attachToMemoryManager(memoryManager: MemoryManager) {
    if (this.attachedModules.has('memory')) {
      console.log('Already attached to memory manager');
      return;
    }
    
    const listeners: Function[] = [];
    
    // Intercept buildPrompt to track token usage
    const originalBuildPrompt = memoryManager.buildPrompt.bind(memoryManager);
    (memoryManager as any).buildPrompt = async (query: string, options?: any) => {
      const result = await originalBuildPrompt(query, options);
      
      // Extract token metrics from the result and update session
      const tokenMetrics = {
        input: {
          ephemeral: this.estimateTokens(result.ephemeral),
          retrieved: this.estimateTokens(result.retrieved),
          knowledge: this.estimateTokens(result.knowledge),
          query: this.estimateTokens(query),
          buffer: 0,
          total: 0,
          limit: 128000
        },
        output: {
          reasoning: 0,
          code: 0,
          explanation: 0,
          buffer: 0,
          total: 0,
          limit: 6000
        },
        mode: 'concise' as const
      };
      
      tokenMetrics.input.total = Object.values(tokenMetrics.input)
        .filter(v => typeof v === 'number')
        .reduce((a, b) => a + b, 0);
      
      this.collector.recordTokenUsage(tokenMetrics);
      
      return result;
    };
    
    listeners.push(() => {
      (memoryManager as any).buildPrompt = originalBuildPrompt;
    });
    
    this.attachedModules.set('memory', memoryManager);
    this.listeners.set('memory', listeners);
    
    console.log('✅ Monitoring attached to memory manager (token tracking enabled)');
  }
  
  /**
   * Detach from all modules (monitoring continues autonomously)
   */
  detach() {
    for (const [module, listeners] of this.listeners.entries()) {
      for (const cleanup of listeners) {
        cleanup();
      }
    }
    
    this.attachedModules.clear();
    this.listeners.clear();
    
    console.log('📊 Detached from agent (autonomous monitoring continues)');
  }
  
  /**
   * Get all metrics (combines real-time and autonomous)
   */
  getAllMetrics() {
    const realtime = this.collector.getAllMetrics();
    const autonomous = this.autonomousCollector.getAllMetrics();
    
    return {
      realtime,
      autonomous,
      combined: this.mergeMetrics(realtime, autonomous)
    };
  }
  
  /**
   * Check monitoring health
   */
  getHealth() {
    return {
      autonomousRunning: true, // Always true if started
      realtimeAttached: this.attachedModules.size > 0,
      attachedModules: Array.from(this.attachedModules.keys()),
      dataAvailable: {
        database: true, // Always accessible
        logs: true,     // Always accessible
        realtime: this.attachedModules.size > 0
      }
    };
  }
  
  /**
   * Stop monitoring
   */
  async stop() {
    this.detach();
    await this.autonomousCollector.stop();
    console.log('🛑 Monitoring stopped');
  }
  
  private estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }
  
  private mergeMetrics(realtime: any, autonomous: any): any {
    // Prefer real-time data when available, fill gaps with autonomous
    return {
      ...autonomous,
      ...realtime,
      source: {
        realtime: Object.keys(realtime),
        autonomous: Object.keys(autonomous)
      }
    };
  }
}