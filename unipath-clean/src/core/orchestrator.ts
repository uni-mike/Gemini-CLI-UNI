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

export interface ExecutionResult {
  success: boolean;
  response?: string;
  toolsUsed?: string[];
  error?: string;
}

export class Orchestrator extends EventEmitter {
  private client: DeepSeekClient | MockLLMClient;
  private config: Config;
  private conversation: Message[] = [];
  private toolsUsed: string[] = [];
  
  constructor(config: Config) {
    super();
    this.config = config;
    
    // Use real client if API key is available
    if (process.env.API_KEY) {
      this.client = new DeepSeekClient();
    } else {
      console.warn('⚠️  No API_KEY found, using mock client');
      this.client = new MockLLMClient();
    }
    
    // Forward events
    this.client.on('start', (data) => this.emit('llm-start', data));
    this.client.on('complete', (data) => this.emit('llm-complete', data));
    this.client.on('error', (error) => this.emit('llm-error', error));
    this.client.on('tool-calls', (calls) => this.handleToolCalls(calls));
  }
  
  async execute(prompt: string): Promise<ExecutionResult> {
    this.emit('orchestration-start', { prompt });
    this.toolsUsed = [];
    
    // Add user message
    this.conversation.push({ role: 'user', content: prompt });
    
    try {
      // Get available tools
      const tools = this.getToolDefinitions();
      
      // Get LLM response
      let response = await this.client.chat(this.conversation, tools);
      
      // Check if response contains tool calls (it's a JSON string)
      let iterations = 0;
      const maxIterations = 10; // Prevent infinite loops
      
      while (response.startsWith('[') && response.includes('function') && iterations < maxIterations) {
        iterations++;
        
        // Parse and handle tool calls
        const toolCalls = JSON.parse(response);
        await this.handleToolCalls(toolCalls);
        
        // Get follow-up response after tool execution
        response = await this.client.chat(this.conversation, []);
        
        // If we get a clean response, break
        if (!response.startsWith('[')) {
          break;
        }
      }
      
      // Add assistant response
      this.conversation.push({ role: 'assistant', content: response });
      
      this.emit('orchestration-complete', { response });
      
      return {
        success: true,
        response,
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
  
  private async handleToolCalls(toolCalls: any[]) {
    this.emit('tools-start', toolCalls);
    
    const toolResults: any[] = [];
    
    for (const call of toolCalls) {
      const toolName = call.function?.name || call.name;
      const argsString = call.function?.arguments || call.arguments;
      const args = typeof argsString === 'string' ? JSON.parse(argsString) : argsString;
      const callId = call.id || `call_${Date.now()}`;
      
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
  
  getConversation(): Message[] {
    return this.conversation;
  }
  
  clearConversation(): void {
    this.conversation = [];
    this.toolsUsed = [];
  }
}