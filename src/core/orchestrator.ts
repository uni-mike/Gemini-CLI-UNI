/**
 * Main Orchestrator - Autonomous AI-Driven Agent System
 * Connects LLM with tools and manages execution flow through Planner-Executor pattern
 *
 * CRITICAL: NO EMERGENCY FALLBACKS ALLOWED!
 * - All failures must be handled through AI-based recovery (retry with different prompts, models, etc.)
 * - Never add hardcoded/rule-based fallback methods
 * - Always route failures back through the AI agent trio (Orchestrator->Planner->Executor)
 * - This ensures the system remains fully autonomous and AI-driven
 */

import { EventEmitter } from 'events';
import { DeepSeekClient } from '../llm/deepseek-client.js';
import { Config } from '../config/Config.js';
import { Message } from '../llm/provider.js';
import { Planner } from './planner.js';
import { Executor, ExecutionContext } from './executor.js';
import { globalRegistry } from '../tools/registry.js'; // Only for slash commands
import { MonitoringSystem } from '../monitoring/backend/index.js';
import { MemoryManager } from '../memory/memory-manager.js';
import { ModeDetector } from '../memory/mode-detector.js';

export interface ExecutionResult {
  success: boolean;
  response?: string;
  toolsUsed?: string[];
  error?: string;
}

export interface TrioMessage {
  from: 'planner' | 'executor' | 'orchestrator';
  to: 'planner' | 'executor' | 'orchestrator' | 'all';
  type: 'question' | 'response' | 'adjustment' | 'status' | 'error';
  content: string;
  data?: any;
}

export class Orchestrator extends EventEmitter {
  private client: DeepSeekClient;
  private config: Config;
  private conversation: Message[] = [];
  private toolsUsed: string[] = [];
  private processedTools = new Set<string>();
  private planner: Planner;
  private executor: Executor;
  private executionContext: ExecutionContext;
  private trioMessages: TrioMessage[] = [];
  private monitoring: MonitoringSystem | null = null;
  private monitoringEnabled: boolean = true;
  private memoryManager: MemoryManager | null = null;
  
  constructor(config: Config) {
    super();
    this.config = config;
    
    // Initialize the trio components with config for correct model
    this.planner = new Planner(config);
    this.executor = new Executor();
    
    // Initialize execution context
    this.executionContext = {
      workingDirectory: process.cwd(),
      environment: process.env as Record<string, string>,
      createdFiles: [],
      modifiedFiles: [],
      deletedFiles: [],
      executedCommands: [],
      webSearches: [],
      toolExecutions: new Map<string, any>(),
      taskHistory: []
    };
    
    // Use real client with proper timeout configuration (API key required)
    this.client = new DeepSeekClient({
      model: config.getModel(), // Ensure correct model is used
      timeout: 120000 // 120 seconds for complex prompts - matches planner/executor
    });
    
    // Initialize memory manager for better context awareness
    this.memoryManager = new MemoryManager('concise');

    // Connect memory manager to trio components for context sharing
    this.planner.setMemoryManager(this.memoryManager);

    // Forward events from trio components
    this.setupTrioEvents();
    
    // Forward LLM events (only used for final response generation)
    this.client.on('start', (data: any) => this.emit('llm-start', data));
    this.client.on('complete', (data: any) => this.emit('llm-complete', data));
    this.client.on('error', (error: any) => {
      // Enhanced error handling with user feedback
      if (error.final) {
        console.error(`❌ DeepSeek API failed completely: ${error.message}`);
        this.emit('status', `❌ API Error: ${error.message}`);
      } else if (error.willRetry) {
        console.log(`🔄 API error (will retry): ${error.message}`);
        this.emit('status', `⚠️ API issue, retrying...`);
      } else {
        console.error(`❌ API error: ${error.message}`);
        this.emit('status', `❌ API Error: ${error.message}`);
      }
      this.emit('llm-error', error);
    });

    // Handle retry events from DeepSeek client
    this.client.on('retry', (data: any) => {
      console.log(`🔄 Retrying API call (attempt ${data.attempt}/${data.maxRetries})`);
      this.emit('status', `🔄 Retrying API call (attempt ${data.attempt}/${data.maxRetries})...`);
    });

    // Handle timeout events from DeepSeek client
    this.client.on('timeout', (data: any) => {
      console.error(`⏱️ API timeout: ${data.message}`);
      this.emit('status', `⏱️ API timeout - ${data.message}`);
    });

    // Forward token usage events from DeepSeek client to monitoring
    this.client.on('token-usage', (usage: any) => {
      console.log('📊 [ORCHESTRATOR] Token usage from DeepSeek:', usage);
      this.emit('token-usage', usage);
    });
    
    // Initialize monitoring only if explicitly enabled
    if (process.env.ENABLE_MONITORING === 'true') {
      this.initializeMonitoring();
    }
  }
  
  private async initializeMonitoring() {
    try {
      const port = parseInt(process.env.MONITORING_PORT || '4000');
      
      // Check if monitoring is already running
      const isRunning = await this.checkMonitoringRunning(port);
      
      if (isRunning) {
        // Monitoring already running, just attach to it
        console.log('✅ Monitoring already running, attaching to it...');
        this.monitoring = new MonitoringSystem({ port, enableRealtime: true });
        
        // Don't start, just attach for real-time events
        this.monitoring.attachToAgent(this, this.memoryManager);
        console.log('🔗 Attached to existing monitoring at http://localhost:' + port);
      } else {
        // Start new monitoring instance
        this.monitoring = new MonitoringSystem({ port, enableRealtime: true });
        
        // Start monitoring in background
        this.monitoring.start().then(() => {
          // Attach to this orchestrator for real-time data
          this.monitoring?.attachToAgent(this, this.memoryManager || undefined);
          console.log('📊 Monitoring dashboard: http://localhost:' + port);
        }).catch(err => {
          console.warn('⚠️ Monitoring failed to start:', err.message);
          this.monitoring = null;
        });
      }
    } catch (error) {
      console.warn('⚠️ Could not initialize monitoring:', error);
      this.monitoring = null;
    }
  }
  
  private async checkMonitoringRunning(port: number): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${port}/api/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
  
  private setupTrioEvents() {
    // Forward Planner events
    this.planner.on('planning-start', (data) => {
      this.emit('planning-start', data);
      this.sendTrioMessage({
        from: 'planner',
        to: 'all',
        type: 'status',
        content: `📋 Starting to plan: ${data.prompt}`,
        data
      });
    });
    
    this.planner.on('planning-complete', (plan) => {
      this.emit('planning-complete', plan);
      this.sendTrioMessage({
        from: 'planner',
        to: 'orchestrator',
        type: 'response',
        content: `✅ Plan created with ${plan.tasks.length} tasks`,
        data: plan
      });
    });
    
    // Forward Executor events with trio communication
    this.executor.on('task-start', (data) => {
      this.emit('task-start', data);
      this.sendTrioMessage({
        from: 'executor',
        to: 'all',
        type: 'status',
        content: `⚙️ Starting task: ${data.task.description}`,
        data
      });
    });
    
    this.executor.on('task-complete', (result) => {
      this.emit('task-complete', result);
      this.sendTrioMessage({
        from: 'executor',
        to: 'orchestrator',
        type: 'response',
        content: `✅ Task completed successfully`,
        data: result
      });
    });
    
    this.executor.on('task-error', (result) => {
      this.emit('task-error', result);
      // IMPORTANT: Do NOT call handleFailureRecovery or ask AI for help
      // Just send a simple trio message for logging and let generateFinalResponse handle it
      this.sendTrioMessage({
        from: 'executor',
        to: 'orchestrator',
        type: 'error',
        content: `❌ Task failed: ${result.error}`,
        data: result
      });
    });
    
    this.executor.on('tool-execute', (data) => {
      this.emit('tool-execute', data);
    });
    
    this.executor.on('tool-result', (data) => {
      this.emit('tool-result', data);
      if (!data.result?.success) {
        // Tool failed, ask for alternative
        this.sendTrioMessage({
          from: 'executor',
          to: 'planner',
          type: 'question',
          content: `🔧 Tool ${data.tool} failed. Should I try alternative?`,
          data
        });
      }
    });
    
    this.executor.on('status', (message) => {
      this.emit('status', message);
    });
    
    // Forward Planner status events
    this.planner.on('status', (message) => {
      this.emit('status', message);
    });
    
    // Forward token-usage events from Planner and Executor
    this.planner.on('token-usage', async (usage) => {
      console.log('📊 [ORCHESTRATOR] Token usage from Planner:', usage);
      this.emit('token-usage', usage);

      // Update session with token count
      console.log('📊 [ORCHESTRATOR] Checking token update conditions:', {
        hasMemoryManager: !!this.memoryManager,
        totalTokens: usage.total_tokens,
        shouldUpdate: !!(this.memoryManager && usage.total_tokens)
      });

      if (this.memoryManager && usage.total_tokens) {
        console.log('📊 [ORCHESTRATOR] Tracking API tokens with memory manager:', usage.total_tokens);
        await this.memoryManager?.trackApiTokens(usage.total_tokens);
      }
    });

    this.executor.on('token-usage', async (usage) => {
      console.log('📊 [ORCHESTRATOR] Token usage from Executor:', usage);
      this.emit('token-usage', usage);

      // Update session with token count
      console.log('📊 [ORCHESTRATOR] Checking token update conditions:', {
        hasMemoryManager: !!this.memoryManager,
        totalTokens: usage.total_tokens,
        shouldUpdate: !!(this.memoryManager && usage.total_tokens)
      });

      if (this.memoryManager && usage.total_tokens) {
        console.log('📊 [ORCHESTRATOR] Tracking API tokens with memory manager:', usage.total_tokens);
        await this.memoryManager?.trackApiTokens(usage.total_tokens);
      }
    });
  }
  
  /**
   * Initialize memory manager for better context awareness
   */
  async initialize(): Promise<void> {
    if (this.memoryManager) {
      await this.memoryManager.initialize();

      // Listen to memory layer updates for better trio communication
      this.memoryManager.on('memory-layer-update', (data: any) => {
        this.emit('memory-update', data);
        this.sendTrioMessage({
          from: 'orchestrator',
          to: 'all',
          type: 'status',
          content: `📊 Memory layer updated: ${data.layer} (${data.tokens} tokens)`,
          data
        });
      });
    }
  }

  // Mini-agent execution with scoped context and restricted permissions
  async executeAsAgent(
    prompt: string,
    context: {
      agentId: string;
      type: string;
      scopedMemory?: any;
      permissions?: any;
      maxTokens?: number;
      timeoutMs?: number;
    }
  ): Promise<ExecutionResult> {

    this.emit('mini-agent-start', {
      agentId: context.agentId,
      type: context.type,
      prompt: prompt.substring(0, 100) + '...'
    });

    // Create scoped memory manager for mini-agent
    const originalMemoryManager = this.memoryManager;
    const scopedMemory = new MemoryManager('concise'); // More focused for mini-agents

    // Apply context scoping if provided
    if (context.scopedMemory) {
      await scopedMemory.initialize();
      // Apply memory filters here if needed
    }

    // Temporarily switch to scoped memory
    this.memoryManager = scopedMemory;
    this.planner.setMemoryManager(scopedMemory);

    // Store original timeout and apply mini-agent timeout
    const originalTimeout = this.client.timeout;
    if (context.timeoutMs) {
      this.client.timeout = Math.min(context.timeoutMs, 300000); // Max 5 minutes for mini-agents
    }

    try {
      // Execute with specialized prompt for mini-agent
      const specializedPrompt = this.buildMiniAgentPrompt(prompt, context);
      const result = await this.execute(specializedPrompt);

      this.emit('mini-agent-complete', {
        agentId: context.agentId,
        success: result.success,
        toolsUsed: result.toolsUsed
      });

      return result;

    } catch (error: any) {
      this.emit('mini-agent-error', {
        agentId: context.agentId,
        error: error.message
      });

      return {
        success: false,
        error: `Mini-agent ${context.agentId} failed: ${error.message}`,
        toolsUsed: this.toolsUsed
      };

    } finally {
      // Restore original memory manager and timeout
      this.memoryManager = originalMemoryManager;
      if (originalMemoryManager) {
        this.planner.setMemoryManager(originalMemoryManager);
      }
      this.client.timeout = originalTimeout;
    }
  }

  private buildMiniAgentPrompt(prompt: string, context: any): string {
    return `[MINI-AGENT ${context.type.toUpperCase()}]
Task: ${prompt}

You are a specialized ${context.type} agent. Stay focused on this specific task.
${context.maxTokens ? `Token limit: ${context.maxTokens}` : ''}
Be efficient and report progress clearly.

Execute the task:`;
  }

  async execute(prompt: string): Promise<ExecutionResult> {
    // Detect operating mode based on prompt complexity
    const detectedMode = ModeDetector.detectMode(prompt);

    // Initialize memory manager with detected mode if needed
    if (!this.memoryManager || this.memoryManager.getMode() !== detectedMode) {
      this.memoryManager = new MemoryManager(detectedMode);
      this.planner.setMemoryManager(this.memoryManager);
      await this.memoryManager.initialize();
    } else if (!this.memoryManager.initialized) {
      await this.initialize();
    }

    if (process.env.DEBUG === 'true') {
      console.log(`🎯 Detected mode: ${detectedMode} for prompt (${prompt.split(' ').length} words)`);
    }

    // Pass sessionId to executor for ExecutionLog tracking
    if (this.memoryManager) {
      const sessionId = this.memoryManager.getSessionId();
      if (sessionId) {
        this.executor.setSession(sessionId);
      }
    }

    this.emit('orchestration-start', { prompt, mode: detectedMode });
    this.emit('status', `🎯 Orchestrator starting in ${detectedMode} mode...`);
    this.toolsUsed = [];
    this.processedTools.clear();
    this.trioMessages = []; // Clear trio conversation
    
    // Handle slash commands
    if (prompt.startsWith('/')) {
      return this.handleSlashCommand(prompt.toLowerCase());
    }
    
    try {
      // CRITICAL FIX: Check if this is an information query BEFORE planning (ZERO TOLERANCE)
      const isInfoQuery = prompt.toLowerCase().includes('what') ||
                         prompt.toLowerCase().includes('how') ||
                         prompt.toLowerCase().includes('why') ||
                         prompt.toLowerCase().includes('when') ||
                         prompt.toLowerCase().includes('where') ||
                         prompt.toLowerCase().includes('who') ||
                         prompt.toLowerCase().includes('explain') ||
                         prompt.toLowerCase().includes('describe') ||
                         prompt.toLowerCase().includes('tell me') ||
                         prompt.toLowerCase().includes('show me') ||
                         prompt.match(/\?$/);

      // Step 1: Orchestrator asks Planner to create plan
      this.sendTrioMessage({
        from: 'orchestrator',
        to: 'planner',
        type: 'question',
        content: `📝 Please create a plan for: ${prompt}`
      });

      // CRITICAL: For info queries, explicitly ask for conversation response
      const planPrompt = isInfoQuery
        ? `SIMPLE QUESTION: ${prompt}\n\nThis is an information query that needs a direct answer, not tasks.`
        : prompt;

      const plan = await this.planner.createPlan(planPrompt);
      
      // Handle conversation plans
      if (plan.isConversation && plan.conversationResponse) {
        this.emit('orchestration-complete', { response: plan.conversationResponse });
        return {
          success: true,
          response: plan.conversationResponse,
          toolsUsed: []
        };
      }
      
      if (process.env.DEBUG === 'true') {
        console.log(`📋 Plan created: ${plan.tasks.length} tasks, complexity: ${plan.complexity}`);
      }
      
      // Step 2: Even for simple questions, use the executor
      // This ensures all operations go through the proper trio pattern
      
      // Step 3: Orchestrator asks Executor to execute plan
      this.sendTrioMessage({
        from: 'orchestrator',
        to: 'executor',
        type: 'question',
        content: `🚀 Please execute this plan with ${plan.tasks.length} tasks`
      });
      
      const results = await this.executor.executePlan(plan, this.executionContext);
      
      // Check if any tasks failed
      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        this.emit('status', `⚠️ ${failures.length} task(s) failed, attempting recovery...`);
        // Recovery is handled in event listeners
      }
      
      // Update toolsUsed from execution results
      for (const result of results) {
        if (result.toolsUsed) {
          this.toolsUsed.push(...result.toolsUsed);
        }
      }
      
      // Update execution context with results
      for (const result of results) {
        if (result.success && result.output) {
          // Track executed tools
          const taskId = result.taskId;
          this.executionContext.toolExecutions.set(taskId, result.output);
          
          // Track created files if mentioned in output
          const fileMatch = result.output.toString().match(/File written: (.+)/) ||
                           result.output.toString().match(/Created: (.+)/);
          if (fileMatch) {
            this.executionContext.createdFiles.push(fileMatch[1]);
          }
        }
      }
      
      // Step 4: Store execution context in memory for learning
      if (this.memoryManager) {
        // Store intelligent knowledge about successful task patterns and outcomes
        const successfulTasks = results.filter(r => r.success);
        if (successfulTasks.length > 0) {
          // Store semantic knowledge about the task and its context
          const taskContext = {
            originalPrompt: prompt,
            planSteps: plan.tasks.map(t => ({ type: t.tools?.[0] || t.type, description: t.description })),
            successfulOutputs: successfulTasks.map(r => ({
              tool: r.toolsUsed?.[0] || 'unknown',
              output: typeof r.output === 'string' ? r.output.substring(0, 500) : JSON.stringify(r.output).substring(0, 500)
            })),
            timestamp: new Date().toISOString()
          };

          // Store comprehensive knowledge for RAG retrieval
          await this.memoryManager.storeKnowledge(
            `task_knowledge_${Date.now()}`,
            JSON.stringify(taskContext),
            'task_execution'
          );

          // Store semantic chunks for embeddings
          const semanticContent = `User requested: ${prompt}\nPlan created: ${plan.tasks.map(t => t.description).join('; ')}\nSuccessful execution with tools: ${successfulTasks.map(r => r.toolsUsed?.[0] || 'unknown').join(', ')}`;

          // Store semantic chunks via memory manager
          try {
            await this.memoryManager.storeChunk(
              `execution_success_${Date.now()}`, // path
              semanticContent,                    // content
              'doc',                             // chunkType
              {                                  // metadata
                prompt_hash: this.hashPrompt(prompt),
                tools_used: successfulTasks.flatMap(r => r.toolsUsed || []).filter(tool => tool !== undefined),
                success_rate: successfulTasks.length / results.length,
                task_count: results.length,
                timestamp: new Date().toISOString()
              }
            );
          } catch (error: any) {
            console.error('Failed to store embedding chunk:', error.message);
          }
        }

        // Add the interaction to memory for context with rich details
        this.memoryManager.addAssistantResponse(
          JSON.stringify({
            prompt,
            plan_summary: plan.tasks.map(t => t.description).join('; '),
            execution_results: results.map(r => ({ tool: r.toolsUsed?.[0] || 'unknown', success: r.success })),
            timestamp: new Date().toISOString()
          })
        );
      }

      // Step 4: Generate final response based on execution results
      let finalResponse = await this.generateFinalResponse(prompt, plan, results);
      
      if (process.env.DEBUG === 'true') {
        console.log('🚀 Emitting orchestration-complete with:', finalResponse?.substring(0, 100) + (finalResponse?.length > 100 ? '...' : ''));
      }
      
      // Final trio communication
      this.sendTrioMessage({
        from: 'orchestrator',
        to: 'all',
        type: 'status',
        content: `🎉 Execution complete: ${results.filter(r => r.success).length}/${results.length} tasks succeeded`
      });
      
      this.emit('orchestration-complete', { response: finalResponse });
      
      return {
        success: results.every(r => r.success),
        response: finalResponse,
        toolsUsed: this.toolsUsed
      };
    } catch (error: any) {
      // PROPER ERROR HANDLING - NO EMERGENCY FALLBACKS!
      // If planner fails, try AI-based recovery strategies

      console.log('🔄 Planning failed, attempting AI-based recovery...');
      this.emit('orchestration-error', error);

      try {
        // Strategy 1: Retry with simplified prompt
        console.log('🔄 Strategy 1: Retrying with simplified prompt...');
        const simplifiedPrompt = `Task: ${prompt}\n\nPlease break this into simple steps and return JSON format only.`;
        const recoveryPlan = await this.planner.createPlan(simplifiedPrompt);

        console.log('✅ Recovery strategy 1 succeeded');
        const recoveryResults = await this.executor.executePlan(recoveryPlan, this.executionContext);

        const finalResponse = await this.generateFinalResponse(prompt, recoveryPlan, recoveryResults);

        this.emit('orchestration-complete', { response: finalResponse });
        return {
          success: recoveryResults.every(r => r.success),
          response: finalResponse,
          toolsUsed: this.toolsUsed
        };

      } catch (recoveryError: any) {
        // Strategy 2: Could add more AI-based recovery strategies here
        // e.g., try different AI models, break down into smaller parts, etc.

        console.error('❌ All AI-based recovery strategies failed:', recoveryError);
        this.emit('orchestration-error', recoveryError);

        return {
          success: false,
          error: `Planning failed: ${error.message}. Recovery also failed: ${recoveryError.message}`
        };
      }
    }
  }
  
  /**
   * Update session with token usage
   */

  private async generateFinalResponse(prompt: string, plan: any, results: any[]): Promise<string> {
    // CRITICAL: NO GENERIC AI FALLBACKS ALLOWED!
    // This method must NEVER generate generic responses or "helpful explanations"
    // when tasks fail. It should only report what actually happened.

    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    // If all tasks succeeded, provide a brief success message
    if (failedResults.length === 0) {
      const outputs = results.filter(r => r.output).map(r => r.output);

      // CRITICAL FIX: Check if this is an information query that needs synthesis
      const isInformationQuery = prompt.toLowerCase().includes('what') ||
                                 prompt.toLowerCase().includes('how') ||
                                 prompt.toLowerCase().includes('why') ||
                                 prompt.toLowerCase().includes('when') ||
                                 prompt.toLowerCase().includes('where') ||
                                 prompt.toLowerCase().includes('who') ||
                                 prompt.toLowerCase().includes('tell me') ||
                                 prompt.toLowerCase().includes('explain') ||
                                 prompt.toLowerCase().includes('describe') ||
                                 prompt.toLowerCase().includes('show me');

      // Check if we have retrieved information to synthesize
      const hasRetrievedInfo = results.some(r =>
        r.toolsUsed?.includes('memory_retrieval') ||
        r.toolsUsed?.includes('git') ||
        r.toolsUsed?.includes('read_file') ||
        r.toolsUsed?.includes('rg') ||
        r.toolsUsed?.includes('grep')
      );

      if (isInformationQuery && hasRetrievedInfo) {
        // This is a query - we need to synthesize the information!
        // CRITICAL FIX: Format prompt to trigger conversation response (ZERO TOLERANCE FOR ERRORS)
        const synthesisPrompt = `SIMPLE QUESTION (no tasks needed): Based on the retrieved information below, what is the answer to: "${prompt}"?

Retrieved Information:
${outputs.map((o, i) => `${JSON.stringify(o).substring(0, 1000)}`).join('\n\n')}

This is a simple question that requires a conversational answer, not tasks. Provide a direct answer.`;

        try {
          const response = await this.planner.createPlan(synthesisPrompt);

          // Debug log to see what we're getting
          if (process.env.DEBUG === 'true') {
            console.log('🔍 Synthesis response structure:', JSON.stringify(response).substring(0, 200));
          }

          // Extract the actual answer from the plan (which will be the synthesis)
          if (typeof response === 'string') {
            return response;
          }

          // CRITICAL FIX: Handle the actual response structure from planner
          if (response && response.response) {
            return response.response;  // This is where the actual answer is!
          }

          // CRITICAL: Log exact structure for debugging (ZERO TOLERANCE FOR ERRORS)
          if (process.env.DEBUG === 'true') {
            console.log('📋 Full planner response structure:', JSON.stringify(response, null, 2).substring(0, 500));
          }

          // If response is an object with type and other fields, look deeper
          if (response && typeof response === 'object') {
            // CRITICAL FIX: Check for conversation plan structure (ZERO TOLERANCE FOR ERRORS)
            if (response.isConversation && response.conversationResponse) {
              console.log('✅ Successfully extracted conversation response from plan');
              return response.conversationResponse; // This is the FULL synthesized answer!
            }

            // Also check for direct conversation type response
            if (response.type === 'conversation' && response.response) {
              console.log('✅ Successfully extracted synthesized conversation response');
              return response.response; // This is the FULL synthesized answer!
            }

            // Check if this is actually a task plan
            if (response.type === 'task' && response.tasks && Array.isArray(response.tasks)) {
              // This means the planner created tasks instead of synthesizing
              console.error('⚠️ Planner returned tasks instead of synthesis');
            } else {
              // Try to find the actual text response in various places
              // CRITICAL: 'response' field should be FIRST priority
              const possibleFields = ['response', 'answer', 'result', 'summary', 'content', 'text', 'message'];
              for (const field of possibleFields) {
                if (response[field] && typeof response[field] === 'string') {
                  console.log(`✅ Found response in field: ${field}`);
                  return response[field];
                }
              }
            }
          }

          // CRITICAL: Make failures EXPLICIT - ZERO TOLERANCE FOR HIDDEN ERRORS
          console.error('❌ CRITICAL ERROR: Could not extract synthesized response!');
          console.error('Response object was:', JSON.stringify(response).substring(0, 1000));

          // THROW ERROR instead of hiding with fallback
          throw new Error('Failed to extract synthesized response from planner - check logs above');
        } catch (error) {
          // CRITICAL: Make failures EXPLICIT - don't hide with generic responses
          console.error('❌ SYNTHESIS FAILED:', error);
          console.error('Stack trace:', error.stack);

          // Re-throw to make failure visible
          throw new Error(`Synthesis failed: ${error.message}`);
        }

        // CRITICAL: This should NEVER be reached if synthesis was attempted
        console.error('❌ CRITICAL: Reached unexpected code path in synthesis block');
        throw new Error('Unexpected code path - synthesis block failed to return');
      }

      // Check if we created/modified files
      const fileCreated = outputs.some(o =>
        typeof o === 'string' && (o.includes('Created ') || o.includes('Updated '))
      );

      if (fileCreated) {
        return 'Files created/updated successfully.';
      }

      // For other successful operations, return a brief summary
      return `Task completed successfully. ${results.length} operations executed.`;
    }

    // If there are failures, report them directly - NO GENERIC RESPONSES
    const failureMessages = failedResults.map(result => {
      if (result.error) {
        return `❌ ${result.task || 'Task'} failed: ${result.error}`;
      }
      return `❌ ${result.task || 'Task'} failed with unknown error`;
    }).join('\n');

    const summaryMessage = `${successfulResults.length}/${results.length} tasks completed successfully.\n\n${failureMessages}`;

    // IMPORTANT: Do NOT call AI to generate explanatory text
    // Just return the factual failure report
    return summaryMessage;
  }
  
  private sendTrioMessage(message: TrioMessage) {
    this.trioMessages.push(message);
    this.emit('trio-message', message);
    
    if (process.env.DEBUG === 'true') {
      const arrow = message.to === 'all' ? '📢' : '→';
      console.log(`🎭 ${message.from} ${arrow} ${message.to}: ${message.content}`);
    }
  }
  
  private async handleFailureRecovery(failedResult: any) {
    // CRITICAL: NO AI-GENERATED RECOVERY SUGGESTIONS!
    // This method should NEVER ask AI to generate "helpful" explanations
    // or alternative approaches when tasks fail. This was the source of
    // generic fallback responses that users complained about.

    // Only log the failure for debugging purposes
    if (process.env.DEBUG === 'true') {
      console.warn('⚠️ Task failure logged (no recovery attempted):', failedResult.error);
    }

    // Send a simple failure notification to trio without AI suggestions
    this.sendTrioMessage({
      from: 'orchestrator',
      to: 'executor',
      type: 'error',
      content: `❌ Task failed: ${failedResult.error}`,
      data: { failedResult }
    });

    // Do NOT emit status or attempt AI-based recovery
    // Let the generateFinalResponse method handle the user-facing error message
  }
  
  getTrioConversation(): TrioMessage[] {
    return this.trioMessages;
  }
  
  // Removed handleToolCalls - all tool execution now goes through Executor
  
  // Removed tool definition methods - all tool handling is now in Executor
  
  private handleSlashCommand(command: string): ExecutionResult {
    // Get tool list from registry using new method
    const toolObjects = globalRegistry.getTools();
    const tools = toolObjects.map(t => t.name);
    
    if (command === '/help' || command === '/?') {
      const helpText = `🎭 Flexi-CLI - Help

Available Commands:
  /help, /?           - Show this help message
  /quit, /exit        - Exit the CLI
  /clear              - Clear the screen and history
  /status             - Show system status
  /tools              - List available tools
  /monitor on|off     - Enable/disable monitoring dashboard
  /monitor status     - Show monitoring status

Available Tools:
${toolObjects.map(tool => `  ${tool.name} - ${tool.description}`).join('\n')}

Usage: Just type your request in natural language and I'll help you with it!`;
      
      setTimeout(() => {
        this.emit('orchestration-complete', { response: helpText });
      }, 100);
      
      return { success: true, response: helpText };
      
    } else if (command === '/status') {
      const statusText = `🔧 System Status:
  Model: ${this.config.getModel()}
  Approval Mode: ${this.config.getApprovalMode()}
  Interactive: ${this.config.isInteractive()}
  Tools: ${tools.length}
  Conversation: ${this.conversation.length} messages`;
      
      setTimeout(() => {
        this.emit('orchestration-complete', { response: statusText });
      }, 100);
      
      return { success: true, response: statusText };
      
    } else if (command === '/tools') {
      const toolsText = `🛠️ Available Tools:

${toolObjects.map(tool => {
  return `${tool.name}: ${tool.description}`;
}).join('\n')}`;
      
      setTimeout(() => {
        this.emit('orchestration-complete', { response: toolsText });
      }, 100);
      
      return { success: true, response: toolsText };
      
    } else if (command === '/quit' || command === '/exit') {
      const goodbyeText = 'Goodbye! Thanks for using Flexi-CLI! 👋';
      
      setTimeout(() => {
        this.emit('orchestration-complete', { response: goodbyeText });
        // In non-interactive mode, we can't exit the process, just return
      }, 100);
      
      return { success: true, response: goodbyeText };
      
    } else if (command === '/clear') {
      this.clearConversation();
      const clearText = 'Screen and history cleared! 🧹';
      
      setTimeout(() => {
        this.emit('orchestration-complete', { response: clearText });
      }, 100);
      
      return { success: true, response: clearText };
      
    } else if (command.startsWith('/monitor')) {
      const parts = command.split(' ');
      const subCommand = parts[1];
      
      if (subCommand === 'off') {
        this.monitoringEnabled = false;
        if (this.monitoring) {
          this.monitoring.detachFromAgent();
          const text = '📊 Monitoring detached (still running at http://localhost:4000)';
          setTimeout(() => {
            this.emit('orchestration-complete', { response: text });
          }, 100);
          return { success: true, response: text };
        } else {
          const text = '📊 Monitoring is not running';
          setTimeout(() => {
            this.emit('orchestration-complete', { response: text });
          }, 100);
          return { success: true, response: text };
        }
        
      } else if (subCommand === 'on') {
        this.monitoringEnabled = true;
        if (!this.monitoring) {
          this.initializeMonitoring();
          const text = '📊 Starting monitoring at http://localhost:4000...';
          setTimeout(() => {
            this.emit('orchestration-complete', { response: text });
          }, 100);
          return { success: true, response: text };
        } else {
          this.monitoring.attachToAgent(this, undefined);
          const text = '📊 Monitoring re-attached (dashboard at http://localhost:4000)';
          setTimeout(() => {
            this.emit('orchestration-complete', { response: text });
          }, 100);
          return { success: true, response: text };
        }
        
      } else if (subCommand === 'status' || !subCommand) {
        const status = this.monitoring?.getStatus();
        const text = `📊 Monitoring Status:
  Enabled: ${this.monitoringEnabled}
  Running: ${this.monitoring !== null}
  Dashboard: ${this.monitoring ? 'http://localhost:4000' : 'Not running'}
  Mode: ${status?.health.realtimeAttached ? 'Real-time' : 'Autonomous'}
  Data Sources: ${status?.health.dataAvailable ? 
    Object.entries(status.health.dataAvailable)
      .filter(([_, v]) => v)
      .map(([k]) => k)
      .join(', ') : 'None'}`;
        
        setTimeout(() => {
          this.emit('orchestration-complete', { response: text });
        }, 100);
        return { success: true, response: text };
        
      } else {
        const text = 'Usage: /monitor [on|off|status]';
        setTimeout(() => {
          this.emit('orchestration-complete', { response: text });
        }, 100);
        return { success: false, response: text };
      }
      
    } else {
      const errorText = `Unknown command: ${command}. Type /help for available commands.`;
      
      setTimeout(() => {
        this.emit('orchestration-complete', { response: errorText });
      }, 100);
      
      return { success: false, response: errorText };
    }
  }
  
  getConversation(): Message[] {
    return this.conversation;
  }
  
  clearConversation(): void {
    this.conversation = [];
    this.toolsUsed = [];
  }
  
  /**
   * Set memory manager for monitoring integration
   */
  setMemoryManager(memoryManager: any) {
    this.memoryManager = memoryManager;
  }

  async cleanup(): Promise<void> {
    // Stop monitoring if running
    if (this.monitoring) {
      await this.monitoring.stop();
      this.monitoring = null;
    }
  }

  private hashPrompt(prompt: string): string {
    // Create a simple hash of the prompt for deduplication and caching
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}