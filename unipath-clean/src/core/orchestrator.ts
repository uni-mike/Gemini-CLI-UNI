/**
 * Main Orchestrator
 * Connects LLM with tools and manages execution flow
 */

import { EventEmitter } from 'events';
import { DeepSeekClient } from '../llm/deepseek-client.js';
import { MockLLMClient } from '../llm/mock-client.js';
import { globalRegistry } from '../tools/registry.js';
import { Config } from '../config/Config.js';
import { Message } from '../llm/provider.js';
import { Planner } from './planner.js';
import { Executor, ExecutionContext } from './executor.js';

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
  private client: DeepSeekClient | MockLLMClient;
  private config: Config;
  private conversation: Message[] = [];
  private toolsUsed: string[] = [];
  private processedTools = new Set<string>();
  private planner: Planner;
  private executor: Executor;
  private executionContext: ExecutionContext;
  private trioMessages: TrioMessage[] = [];
  
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
    
    // Use real client if API key is available
    if (process.env.API_KEY) {
      this.client = new DeepSeekClient();
    } else {
      console.warn('⚠️  No API_KEY found, using mock client');
      this.client = new MockLLMClient();
    }
    
    // Forward events from trio components
    this.setupTrioEvents();
    
    // Forward LLM events
    this.client.on('start', (data) => this.emit('llm-start', data));
    this.client.on('complete', (data) => this.emit('llm-complete', data));
    this.client.on('error', (error) => this.emit('llm-error', error));
    this.client.on('tool-calls', (calls) => this.handleToolCalls(calls));
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
      
      if (process.env.DEBUG === 'true') {
        console.log(`📋 Plan created: ${plan.tasks.length} tasks, complexity: ${plan.complexity}`);
      }
      
      // Step 2: Check if this is a simple question that needs LLM response
      if (plan.complexity === 'simple' && plan.tasks.length === 1 && 
          (!plan.tasks[0].tools || plan.tasks[0].tools.length === 0)) {
        // Simple question - use LLM for response
        this.conversation.push({ role: 'user', content: prompt });
        const response = await this.client.chat(this.conversation, []);
        this.conversation.push({ role: 'assistant', content: response });
        
        this.emit('orchestration-complete', { response });
        return {
          success: true,
          response,
          toolsUsed: []
        };
      }
      
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
    // If all results have output, compile them
    const outputs = results.filter(r => r.output).map(r => r.output);
    
    // For queries that need summarization (like prices, times, etc), use LLM
    if (prompt.toLowerCase().includes('price') || 
        prompt.toLowerCase().includes('time') ||
        prompt.toLowerCase().includes('what is') ||
        prompt.toLowerCase().includes('how much')) {
      
      // Build context from results
      const context = outputs.join('\n');
      this.conversation.push({ 
        role: 'user', 
        content: `Based on the following information, answer this question: ${prompt}\n\nInformation:\n${context}` 
      });
      
      const response = await this.client.chat(this.conversation, []);
      this.conversation.push({ role: 'assistant', content: response });
      return response;
    }
    
    // For file operations, return confirmation
    if (plan.tasks.some((t: any) => t.tools?.includes('file'))) {
      const fileOps = results.filter(r => r.success && r.toolsUsed?.includes('file'));
      if (fileOps.length > 0) {
        return outputs.join('\n');
      }
    }
    
    // Default: return all outputs
    if (outputs.length > 0) {
      return outputs.join('\n');
    }
    
    return `Completed ${results.length} task${results.length !== 1 ? 's' : ''}`;
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
      const recovery = await this.client.chat(
        [{ role: 'user', content: recoveryPrompt }],
        []
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
  
  private async handleToolCalls(toolCalls: any[]) {
    this.emit('tools-start', toolCalls);
    
    if (process.env.DEBUG === 'true') {
      console.log(`🔍 Handling ${toolCalls.length} tool calls from DeepSeek`);
    }
    
    const toolResults: any[] = [];
    
    for (const call of toolCalls) {
      const toolName = call.function?.name || call.name;
      const argsString = call.function?.arguments || call.arguments;
      const args = typeof argsString === 'string' ? JSON.parse(argsString) : argsString;
      const callId = call.id || `call_${Date.now()}`;
      
      // Create unique key to prevent duplicate tool execution
      const toolKey = `${toolName}-${JSON.stringify(args)}`;
      if (this.processedTools.has(toolKey)) {
        if (process.env.DEBUG === 'true') {
          console.log(`🔍 Skipping duplicate tool call: ${toolName}`);
        }
        continue; // Skip duplicate tool call
      }
      this.processedTools.add(toolKey);
      
      this.emit('tool-execute', { name: toolName, args });
      
      // Check approval if needed
      if (this.config.getApprovalMode() !== 'yolo' && this.needsApproval(toolName)) {
        const approved = await this.requestApproval(toolName, args);
        if (!approved) {
          this.emit('tool-rejected', { name: toolName });
          toolResults.push({
            tool_call_id: callId,
            role: 'tool',
            name: toolName,
            content: 'Tool execution rejected by user'
          });
          continue;
        }
      }
      
      // Execute tool
      const result = await globalRegistry.execute(toolName, args);
      this.toolsUsed.push(toolName);
      
      this.emit('tool-result', { name: toolName, result });
      
      // Format tool result for API
      toolResults.push({
        tool_call_id: callId,
        role: 'tool',
        name: toolName,
        content: result.success ? (result.output || 'Success') : (result.error || 'Failed')
      });
    }
    
    // Add tool call message to conversation
    this.conversation.push({
      role: 'assistant',
      content: null,
      tool_calls: toolCalls
    } as any);
    
    // Add tool results to conversation
    for (const toolResult of toolResults) {
      this.conversation.push(toolResult as any);
    }
    
    this.emit('tools-complete', this.toolsUsed);
  }
  
  private getToolDefinitions(): any[] {
    const tools = globalRegistry.list();
    return tools.map(name => {
      const tool = globalRegistry.get(name)!;
      return {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: this.getToolProperties(tool.name),
          required: this.getRequiredParams(tool.name)
        }
      };
    });
  }
  
  private getToolProperties(toolName: string): any {
    // Define properties for each tool
    switch (toolName) {
      case 'bash':
        return {
          command: { type: 'string', description: 'Command to execute' }
        };
      case 'file':
        return {
          action: { type: 'string', enum: ['read', 'write'], description: 'Action to perform' },
          path: { type: 'string', description: 'File path' },
          content: { type: 'string', description: 'Content to write (for write action)' }
        };
      case 'web':
        return {
          action: { type: 'string', enum: ['search', 'fetch'], description: 'Action to perform' },
          query: { type: 'string', description: 'Search query (for search action)' },
          url: { type: 'string', description: 'URL to fetch (for fetch action)' }
        };
      case 'edit':
        return {
          path: { type: 'string', description: 'File path to edit' },
          oldText: { type: 'string', description: 'Text to find and replace' },
          newText: { type: 'string', description: 'Replacement text' }
        };
      case 'grep':
        return {
          pattern: { type: 'string', description: 'Pattern to search for' },
          path: { type: 'string', description: 'Path to search in (optional, defaults to current directory)' },
          flags: { type: 'string', description: 'Grep flags (optional)' }
        };
      case 'git':
        return {
          action: { type: 'string', description: 'Git action (status, add, commit, push, pull, branch, log, diff)' },
          message: { type: 'string', description: 'Commit message (for commit action)' },
          files: { type: 'array', description: 'Files to add (for add action)' },
          branch: { type: 'string', description: 'Branch name (optional)' }
        };
      default:
        return {};
    }
  }
  
  private getRequiredParams(toolName: string): string[] {
    switch (toolName) {
      case 'bash':
        return ['command'];
      case 'file':
        return ['action', 'path'];
      case 'web':
        return ['action'];
      case 'edit':
        return ['path', 'oldText', 'newText'];
      case 'grep':
        return ['pattern'];
      case 'git':
        return ['action'];
      default:
        return [];
    }
  }
  
  private needsApproval(toolName: string): boolean {
    // Define which tools need approval
    return ['bash', 'file'].includes(toolName);
  }
  
  private async requestApproval(toolName: string, args: any): Promise<boolean> {
    // For now, auto-approve in autoEdit mode
    return this.config.getApprovalMode() === 'autoEdit';
  }
  
  private handleSlashCommand(command: string): ExecutionResult {
    const tools = globalRegistry.list();
    
    if (command === '/help' || command === '/?') {
      const helpText = `🎭 Flexi-CLI - Help

Available Commands:
  /help, /?           - Show this help message
  /quit, /exit        - Exit the CLI
  /clear              - Clear the screen and history
  /status             - Show system status
  /tools              - List available tools

Available Tools:
${tools.map(name => `  ${name} - ${globalRegistry.get(name)?.description || 'No description'}`).join('\n')}

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

${tools.map(name => {
  const tool = globalRegistry.get(name)!;
  return `${name}:
  Description: ${tool.description}
  Parameters: ${JSON.stringify(this.getToolProperties(name), null, 2)}`;
}).join('\n\n')}`;
      
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
}