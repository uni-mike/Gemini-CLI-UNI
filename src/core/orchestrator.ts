/**
 * Main Orchestrator
 * Connects LLM with tools and manages execution flow
 */

import { EventEmitter } from 'events';
import { DeepSeekClient } from '../llm/deepseek-client.js';
import { Config } from '../config/Config.js';
import { Message } from '../llm/provider.js';
import { Planner } from './planner.js';
import { Executor, ExecutionContext } from './executor.js';
import { globalRegistry } from '../tools/registry.js'; // Only for slash commands
import { MonitoringSystem } from '../monitoring/backend/index.js';

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
  private memoryManager: any = null;
  
  constructor(config: Config) {
    super();
    this.config = config;
    
    // Initialize the trio components
    this.planner = new Planner();
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
    
    // Use real client (API key required)
    this.client = new DeepSeekClient();
    
    // Forward events from trio components
    this.setupTrioEvents();
    
    // Forward LLM events (only used for final response generation)
    this.client.on('start', (data: any) => this.emit('llm-start', data));
    this.client.on('complete', (data: any) => this.emit('llm-complete', data));
    this.client.on('error', (error: any) => this.emit('llm-error', error));
    
    // Forward token usage events from DeepSeek client to monitoring
    this.client.on('token-usage', (usage: any) => {
      console.log('📊 [ORCHESTRATOR] Token usage from DeepSeek:', usage);
      this.emit('token-usage', usage);
    });
    
    // Initialize monitoring by default (unless disabled)
    if (process.env.DISABLE_MONITORING !== 'true') {
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
          this.monitoring?.attachToAgent(this, this.memoryManager);
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
      // Ask planner for help when task fails
      this.sendTrioMessage({
        from: 'executor',
        to: 'planner',
        type: 'question',
        content: `❌ Task failed: ${result.error}. Need recovery strategy.`,
        data: result
      });
      this.handleFailureRecovery(result);
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
    this.planner.on('token-usage', (usage) => {
      console.log('📊 [ORCHESTRATOR] Forwarding token usage from Planner');
      this.emit('token-usage', usage);
    });
    
    this.executor.on('token-usage', (usage) => {
      console.log('📊 [ORCHESTRATOR] Forwarding token usage from Executor');
      this.emit('token-usage', usage);
    });
  }
  
  async execute(prompt: string): Promise<ExecutionResult> {
    this.emit('orchestration-start', { prompt });
    this.emit('status', '🎯 Orchestrator starting...');
    this.toolsUsed = [];
    this.processedTools.clear();
    this.trioMessages = []; // Clear trio conversation
    
    // Handle slash commands
    if (prompt.startsWith('/')) {
      return this.handleSlashCommand(prompt.toLowerCase());
    }
    
    try {
      
      // Step 1: Orchestrator asks Planner to create plan
      this.sendTrioMessage({
        from: 'orchestrator',
        to: 'planner',
        type: 'question',
        content: `📝 Please create a plan for: ${prompt}`
      });
      
      const plan = await this.planner.createPlan(prompt);
      
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
      this.emit('orchestration-error', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  private async generateFinalResponse(prompt: string, plan: any, results: any[]): Promise<string> {
    // Get any outputs from executed tools
    const outputs = results.filter(r => r.output).map(r => r.output);
    
    // Check if we created/modified files - if so, just return success message
    const fileCreated = outputs.some(o => 
      typeof o === 'string' && (o.includes('Created ') || o.includes('Updated '))
    );
    
    if (fileCreated) {
      // File was created/updated - no need for explanation, the diff output says it all
      return 'Done.';
    }
    
    // For other operations, let DeepSeek provide appropriate response
    if (outputs.length > 0) {
      const context = outputs.join('\n');
      this.conversation.push({ 
        role: 'user', 
        content: `${prompt}\n\n[Tool outputs]:\n${context}` 
      });
    } else {
      this.conversation.push({ role: 'user', content: prompt });
    }
    
    // For final response generation, don't pass tools since we already have results
    // The tool outputs are already in the conversation context
    const response = await this.client.chat(this.conversation, []);
    this.conversation.push({ role: 'assistant', content: response });
    return response;
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
    // Smart recovery: ask LLM for alternative approach
    const recoveryPrompt = `A task failed with error: ${failedResult.error}

Suggest an alternative approach using available tools.`;
    
    try {
      const availableTools = globalRegistry.getTools();
      const recovery = await this.client.chat(
        [{ role: 'user', content: recoveryPrompt }],
        availableTools
      );
      
      this.sendTrioMessage({
        from: 'orchestrator',
        to: 'executor',
        type: 'adjustment',
        content: `💡 Recovery strategy: ${recovery.substring(0, 100)}...`,
        data: { strategy: recovery }
      });
      
      this.emit('status', `🔄 Applying recovery strategy...`);
    } catch (e) {
      console.warn('Recovery failed:', e);
    }
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

}