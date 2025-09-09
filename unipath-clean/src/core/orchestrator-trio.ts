/**
 * Orchestrator with Trio Pattern
 * Coordinates between Planner, Executor, and itself with bidirectional communication
 * The Trio can ask questions, respond to each other, and adjust tasks dynamically
 */

import { EventEmitter } from 'events';
import { Planner, Task, TaskPlan } from './planner';
import { Executor, ExecutionContext, ExecutionResult } from './executor';
import { Config } from '../config/Config';
import { DeepSeekClient } from '../llm/deepseek-client';
import { Message } from '../llm/provider';
import { RecoveryManager } from './recovery-strategies';
import { toolManager } from '../tools/tool-manager';

export interface TrioMessage {
  from: 'planner' | 'executor' | 'orchestrator';
  to: 'planner' | 'executor' | 'orchestrator' | 'all';
  type: 'question' | 'response' | 'adjustment' | 'status' | 'error';
  content: string;
  data?: any;
  requiresResponse?: boolean;
}

export interface TrioConversation {
  id: string;
  messages: TrioMessage[];
  context: any;
}

export class OrchestratorTrio extends EventEmitter {
  private planner: Planner;
  private executor: Executor;
  private client: DeepSeekClient;
  private config: Config;
  private conversation: Message[] = [];
  private trioConversation: TrioConversation;
  private isProcessing: boolean = false;
  private recoveryManager: RecoveryManager;

  constructor(config: Config) {
    super();
    this.config = config;
    this.planner = new Planner();
    this.executor = new Executor();
    this.client = new DeepSeekClient({
      apiKey: process.env.API_KEY,
      baseUrl: process.env.ENDPOINT,
      model: process.env.MODEL || 'DeepSeek-R1-0528'
    });
    this.recoveryManager = new RecoveryManager();
    
    this.trioConversation = {
      id: `trio_${Date.now()}`,
      messages: [],
      context: {}
    };
    
    this.setupTrioCommunication();
  }

  private setupTrioCommunication() {
    // Planner events and communication
    this.planner.on('planning-start', (data) => {
      this.sendTrioMessage({
        from: 'planner',
        to: 'all',
        type: 'status',
        content: `Starting to plan: ${data.prompt}`,
        data
      });
    });

    this.planner.on('planning-complete', (plan) => {
      this.sendTrioMessage({
        from: 'planner',
        to: 'orchestrator',
        type: 'response',
        content: `Plan created with ${plan.tasks.length} tasks`,
        data: plan
      });
    });

    // Executor events and communication
    this.executor.on('task-start', ({ task, context }) => {
      this.sendTrioMessage({
        from: 'executor',
        to: 'all',
        type: 'status',
        content: `Starting task: ${task.description}`,
        data: { task, context }
      });
    });

    this.executor.on('task-complete', (result) => {
      this.sendTrioMessage({
        from: 'executor',
        to: 'orchestrator',
        type: 'response',
        content: `Task completed: ${result.taskId}`,
        data: result
      });
    });

    this.executor.on('task-error', (result) => {
      // Executor asks Planner for help when task fails
      this.sendTrioMessage({
        from: 'executor',
        to: 'planner',
        type: 'question',
        content: `Task failed: ${result.error}. How should I adjust?`,
        data: result,
        requiresResponse: true
      });
    });

    this.executor.on('tool-result', ({ taskId, tool, result }) => {
      // Executor informs about tool results for potential adjustments
      if (!result.success) {
        this.sendTrioMessage({
          from: 'executor',
          to: 'planner',
          type: 'question',
          content: `Tool ${tool} failed. Should I try alternative approach?`,
          data: { taskId, tool, result },
          requiresResponse: true
        });
      }
    });

    // Handle multi-step coordination
    this.executor.on('multi-step', ({ task }) => {
      this.sendTrioMessage({
        from: 'executor',
        to: 'planner',
        type: 'question',
        content: `Found multi-step task. Please help decompose: ${task.description}`,
        data: task,
        requiresResponse: true
      });
    });
  }

  private sendTrioMessage(message: TrioMessage) {
    this.trioConversation.messages.push(message);
    this.emit('trio-message', message);
    
    // Handle messages that require responses
    if (message.requiresResponse) {
      this.handleTrioQuestion(message);
    }
  }

  private async handleTrioQuestion(message: TrioMessage) {
    // Orchestrator mediates questions between components
    console.log(`🎭 Trio Communication: ${message.from} asks ${message.to}: ${message.content}`);
    
    switch (message.to) {
      case 'planner':
        await this.handleQuestionToPlanner(message);
        break;
      case 'executor':
        await this.handleQuestionToExecutor(message);
        break;
      case 'orchestrator':
        await this.handleQuestionToOrchestrator(message);
        break;
      case 'all':
        // Broadcast to all components
        await this.handleBroadcastQuestion(message);
        break;
    }
  }

  private async handleQuestionToPlanner(message: TrioMessage) {
    // Planner responds to questions about task adjustments
    if (message.type === 'question' && message.from === 'executor') {
      if (message.content.includes('failed')) {
        // Task failed, create recovery plan
        const failedTask = message.data;
        const recoveryPlan = await this.createRecoveryPlan(failedTask);
        
        // Suggest alternative tools for recovery
        const alternativeTools = toolManager.getToolsForTask(failedTask.description || '', 3);
        
        this.sendTrioMessage({
          from: 'planner',
          to: 'executor',
          type: 'adjustment',
          content: `Recovery plan: ${recoveryPlan.description}. Consider tools: ${alternativeTools.map(t => t.tool).join(', ')}`,
          data: { ...recoveryPlan, alternativeTools }
        });
      } else if (message.content.includes('decompose')) {
        // Help decompose complex task
        const task = message.data;
        const subPlan = await this.planner.createPlan(task.description);
        
        this.sendTrioMessage({
          from: 'planner',
          to: 'executor',
          type: 'response',
          content: `Decomposed into ${subPlan.tasks.length} subtasks`,
          data: subPlan
        });
      }
    }
  }

  private async handleQuestionToExecutor(message: TrioMessage) {
    // Executor responds to questions about execution status
    if (message.type === 'question' && message.from === 'orchestrator') {
      this.sendTrioMessage({
        from: 'executor',
        to: 'orchestrator',
        type: 'response',
        content: `Current execution status: ${this.isProcessing ? 'busy' : 'ready'}`,
        data: { isProcessing: this.isProcessing }
      });
    }
  }

  private async handleQuestionToOrchestrator(message: TrioMessage) {
    // Orchestrator uses AI to provide intelligent responses
    const response = await this.askAI(message.content, message.data);
    
    this.sendTrioMessage({
      from: 'orchestrator',
      to: message.from,
      type: 'response',
      content: response,
      data: null
    });
  }

  private async handleBroadcastQuestion(message: TrioMessage) {
    // All components can respond to broadcast questions
    console.log(`📢 Broadcast: ${message.content}`);
    
    // Each component evaluates if they can help
    if (message.content.includes('plan') || message.content.includes('task')) {
      await this.handleQuestionToPlanner(message);
    }
    if (message.content.includes('execute') || message.content.includes('tool')) {
      await this.handleQuestionToExecutor(message);
    }
  }

  private async createRecoveryPlan(failedResult: ExecutionResult): Promise<any> {
    // Use RecoveryManager for intelligent recovery
    const recovery = await this.recoveryManager.applyRecovery(
      failedResult.error || '',
      failedResult,
      this.trioConversation.context
    );
    
    // Log recovery strategy to Trio conversation
    this.sendTrioMessage({
      from: 'orchestrator',
      to: 'all',
      type: 'adjustment',
      content: `Applying recovery: ${recovery.strategyUsed || 'default'}`,
      data: recovery
    });
    
    return recovery;
  }

  private async askAI(question: string, context: any): Promise<string> {
    // Use AI to answer complex questions with full tool awareness
    const availableTools = toolManager.generateToolSchemas();
    const toolNames = toolManager.listTools();
    
    const prompt = `
      As an orchestrator coordinating between Planner and Executor components:
      Question: ${question}
      Context: ${JSON.stringify(context, null, 2)}
      
      Available tools: ${toolNames.join(', ')}
      
      Provide a helpful response to guide the component. Consider which tools might be most relevant.
    `;
    
    this.conversation.push({ role: 'user', content: prompt });
    const response = await this.client.chat(this.conversation, availableTools);
    this.conversation.push({ role: 'assistant', content: response });
    
    return response;
  }

  async execute(prompt: string): Promise<any> {
    this.emit('orchestration-start', { prompt });
    this.isProcessing = true;
    
    try {
      // Step 1: Orchestrator asks Planner to create plan
      this.sendTrioMessage({
        from: 'orchestrator',
        to: 'planner',
        type: 'question',
        content: `Please create a plan for: ${prompt}`,
        requiresResponse: true
      });
      
      // Planner creates plan
      const plan = await this.planner.createPlan(prompt);
      
      // Step 2: Orchestrator reviews plan and may ask for adjustments
      if (plan.complexity === 'complex' && plan.tasks.length > 5) {
        this.sendTrioMessage({
          from: 'orchestrator',
          to: 'planner',
          type: 'question',
          content: `Plan seems complex with ${plan.tasks.length} tasks. Can we optimize?`,
          data: plan,
          requiresResponse: true
        });
      }
      
      // Step 3: Orchestrator asks Executor to execute plan
      this.sendTrioMessage({
        from: 'orchestrator',
        to: 'executor',
        type: 'question',
        content: `Please execute this plan`,
        data: plan
      });
      
      const context: ExecutionContext = {
        workingDirectory: process.cwd(),
        environment: process.env as Record<string, string>
      };
      
      const results = await this.executor.executePlan(plan, context);
      
      // Step 4: Orchestrator evaluates results
      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        // Ask Planner for recovery strategy
        this.sendTrioMessage({
          from: 'orchestrator',
          to: 'planner',
          type: 'question',
          content: `${failures.length} tasks failed. Need recovery strategy.`,
          data: failures,
          requiresResponse: true
        });
        
        // Wait for recovery plan and re-execute if needed
        const recoveryPlan = await this.createRecoveryPlan(failures[0]);
        if (recoveryPlan.strategies.length > 0) {
          console.log(`🔄 Attempting recovery: ${recoveryPlan.description}`);
          // Re-execute with adjustments
        }
      }
      
      // Step 5: Prepare final response
      const successfulResults = results.filter(r => r.success);
      const response = this.formatResults(successfulResults, plan);
      
      this.sendTrioMessage({
        from: 'orchestrator',
        to: 'all',
        type: 'status',
        content: `Completed execution: ${successfulResults.length}/${results.length} tasks successful`,
        data: { results, response }
      });
      
      this.emit('orchestration-complete', { response, results });
      
      return {
        success: failures.length === 0,
        response,
        results,
        trioConversation: this.trioConversation.messages
      };
      
    } catch (error: any) {
      this.sendTrioMessage({
        from: 'orchestrator',
        to: 'all',
        type: 'error',
        content: `Orchestration failed: ${error.message}`,
        data: error
      });
      
      this.emit('orchestration-error', error);
      throw error;
      
    } finally {
      this.isProcessing = false;
    }
  }

  private formatResults(results: ExecutionResult[], plan: TaskPlan): string {
    if (results.length === 0) {
      return 'No tasks were executed successfully.';
    }
    
    const outputs = results.map(r => r.output).filter(Boolean);
    const toolsUsed = [...new Set(results.flatMap(r => r.toolsUsed))];
    
    let response = `Completed ${results.length} task${results.length !== 1 ? 's' : ''}`;
    
    if (toolsUsed.length > 0) {
      response += ` using ${toolsUsed.join(', ')}`;
    }
    
    if (outputs.length > 0 && outputs[0]) {
      response += `\n\nResults:\n${outputs.join('\n')}`;
    }
    
    return response;
  }

  getTrioConversation(): TrioMessage[] {
    return this.trioConversation.messages;
  }

  visualizeTrioCommunication(): string {
    const messages = this.trioConversation.messages.slice(-10); // Last 10 messages
    let visualization = '\n🎭 Trio Communication Flow:\n';
    visualization += '─'.repeat(50) + '\n';
    
    for (const msg of messages) {
      const arrow = msg.to === 'all' ? '📢' : '→';
      const icon = msg.type === 'question' ? '❓' : 
                   msg.type === 'response' ? '✅' :
                   msg.type === 'adjustment' ? '🔧' :
                   msg.type === 'error' ? '❌' : '📋';
      
      visualization += `${icon} ${msg.from} ${arrow} ${msg.to}: ${msg.content.substring(0, 50)}...\n`;
    }
    
    visualization += '─'.repeat(50) + '\n';
    return visualization;
  }
}