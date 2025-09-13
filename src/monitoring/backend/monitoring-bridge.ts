/**
 * Monitoring Bridge
 * Subscribes to existing agent events and forwards to monitoring system
 * Can attach/detach without affecting agent operation
 */

import { EventEmitter } from 'events';
import { Orchestrator } from '../../core/orchestrator.js';
import { MemoryManager } from '../../memory/memory-manager.js';
import { HybridCollector } from './hybrid-collector.js';
import { AutonomousCollector } from './autonomous-collector.js';
import { FilePersistenceManager, SessionState, Checkpoint } from '../../persistence/FilePersistenceManager.js';
import { PrismaClient } from '@prisma/client';

export class MonitoringBridge {
  private collector: HybridCollector;
  private autonomousCollector: AutonomousCollector;
  private attachedModules: Map<string, EventEmitter> = new Map();
  private listeners: Map<string, Function[]> = new Map();
  private filePersistence: FilePersistenceManager;
  private currentSessionId: string | null = null;
  
  constructor(prisma: PrismaClient, projectRoot: string) {
    // Use HybridCollector which has all the required methods
    this.collector = new HybridCollector(prisma, projectRoot, 'integrated');
    
    // Autonomous collector continues working even if agent dies
    this.autonomousCollector = new AutonomousCollector({
      projectRoot,
      pollInterval: 2000
    });
    
    // Initialize file persistence manager
    this.filePersistence = FilePersistenceManager.getInstance();
  }
  
  /**
   * Start monitoring (works with or without agent)
   */
  async start() {
    // Initialize file persistence
    await this.filePersistence.initialize();
    
    // Always start autonomous monitoring (reads DB, logs, files)
    await this.autonomousCollector.start();
    console.log('📊 Autonomous monitoring started (will survive agent crashes)');
    
    // Log monitoring start
    await this.filePersistence.logInfo('MonitoringBridge', 'Monitoring system started');
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
    const onPlanningStart = async (data: any) => {
      const stageId = `plan-${Date.now()}`;
      this.collector.startPipelineStage({
        id: stageId,
        name: 'Planning',
        type: 'planner',
        input: data
      });
      
      // Save checkpoint for planning start
      if (this.currentSessionId) {
        await this.filePersistence.saveCheckpoint({
          id: `checkpoint-${stageId}`,
          sessionId: this.currentSessionId,
          timestamp: new Date().toISOString(),
          stage: 'planning-start',
          state: { input: data }
        });
      }
      
      // Log to file
      await this.filePersistence.logInfo('Pipeline', 'Planning stage started', { stageId, input: data });
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
    
    const onToolExecute = async (data: any) => {
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
      
      // Log tool execution to file
      await this.filePersistence.logInfo('ToolExecution', `Starting tool: ${execution.toolName}`, {
        toolId: execution.id,
        input: execution.input
      });
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
        
        // Also log to file
        await this.filePersistence.logInfo('ToolExecution', `Completed tool: ${execution.toolName}`, {
          toolId: execution.id,
          success: execution.success,
          duration: execution.duration,
          error: execution.error
        });
      } catch (error) {
        console.error('❌ [MONITORING] Failed to write execution log:', error);
        await this.filePersistence.logError('ToolExecution', 'Failed to persist tool execution', error);
      }
      
      toolExecutions.delete(result.name);
    };
    orchestrator.on('tool-result', onToolResult);
    listeners.push(() => orchestrator.off('tool-result', onToolResult));
    
    const onOrchestrationError = (error: any) => {
      // Log error but don't call non-existent recordEvent method
      console.error('❌ [MONITORING] Orchestration error:', error);
    };
    orchestrator.on('orchestration-error', onOrchestrationError);
    listeners.push(() => orchestrator.off('orchestration-error', onOrchestrationError));
    
    // Track tool-execution events (for tests and custom tool events)
    const onToolExecution = (data: any) => {
      console.log('🔧 [MONITORING] Tool execution event received:', data);
      
      // Record the tool execution
      if (this.collector && this.collector.recordToolExecution) {
        this.collector.recordToolExecution(
          data.tool || 'unknown',
          data.success || false,
          data.duration || 0
        );
      }
    };
    orchestrator.on('tool-execution', onToolExecution);
    listeners.push(() => orchestrator.off('tool-execution', onToolExecution));
    
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
   * Attach to memory manager (optional - for memory layer and token tracking)
   */
  attachToMemoryManager(memoryManager: MemoryManager) {
    if (this.attachedModules.has('memory')) {
      console.log('Already attached to memory manager');
      return;
    }
    
    const listeners: Function[] = [];
    
    // Listen for memory layer updates
    const onMemoryLayerUpdate = (data: any) => {
      console.log('🧠 [MONITORING] Memory layer update:', data.layer, 'tokens:', data.tokens);
      
      // Track memory layer metrics
      this.collector.recordMemoryMetrics({
        layer: data.layer,
        tokens: data.tokens,
        size: data.size,
        chunks: data.chunks || 0
      });
    };
    memoryManager.on('memory-layer-update', onMemoryLayerUpdate);
    listeners.push(() => memoryManager.off('memory-layer-update', onMemoryLayerUpdate));
    
    // Listen for overall memory updates
    const onMemoryUpdate = (data: any) => {
      console.log('💭 [MONITORING] Memory update, total tokens:', data.totalTokens);
      
      // Update overall memory metrics
      this.collector.recordMemoryUpdate({
        totalTokens: data.totalTokens,
        layers: data.layers
      });
    };
    memoryManager.on('memory-update', onMemoryUpdate);
    listeners.push(() => memoryManager.off('memory-update', onMemoryUpdate));
    
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
    
    console.log('✅ Monitoring attached to memory manager (memory layer & token tracking enabled)');
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
   * Start a new session
   */
  async startSession(prompt: string, mode: string = 'interactive'): Promise<string> {
    this.currentSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const sessionState: SessionState = {
      id: this.currentSessionId,
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      prompt,
      mode,
      tokens: { input: 0, output: 0, total: 0 },
      tools: [],
      memory: { ephemeral: 0, knowledge: 0, retrieval: 0 },
      pipeline: {}
    };
    
    // Save session state to file
    await this.filePersistence.saveSessionState(sessionState);
    
    // Log session start
    await this.filePersistence.logInfo('Session', `Started new session: ${this.currentSessionId}`, {
      prompt,
      mode
    });
    
    return this.currentSessionId;
  }
  
  /**
   * Update current session with metrics
   */
  async updateSession(updates: Partial<SessionState>): Promise<void> {
    if (!this.currentSessionId) return;
    
    await this.filePersistence.updateSessionState(this.currentSessionId, updates);
  }
  
  /**
   * Stop monitoring
   */
  async stop() {
    // Save final session state if exists
    if (this.currentSessionId) {
      await this.updateSession({
        pipeline: {
          ...((await this.filePersistence.loadSessionState(this.currentSessionId))?.pipeline || {}),
          execution: { duration: Date.now(), completed: true }
        }
      });
    }
    
    // Close file persistence
    await this.filePersistence.close();
    
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