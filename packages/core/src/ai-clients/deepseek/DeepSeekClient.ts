/**
 * Main DeepSeek client - orchestrates all components
 * Clean, modular architecture for maintainability
 */

import type { Config } from '../../config/config.js';
import { DeepSeekPrompts } from './DeepSeekPrompts.js';
import { DeepSeekMessageParser } from './DeepSeekMessageParser.js';
import { DeepSeekToolExecutor } from './DeepSeekToolExecutor.js';
import { ToolDisplayFormatter } from '../shared/formatters/ToolDisplayFormatter.js';
import { ResultFormatter } from '../shared/formatters/ResultFormatter.js';
import { ColorThemes } from '../shared/formatters/AnsiColors.js';
import { DebugLogger } from '../shared/utils/DebugLogger.js';

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekResponse {
  choices: Array<{
    message: {
      content?: string;
    };
  }>;
}

export class DeepSeekClient {
  private endpoint: string;
  private apiKey: string;
  private model: string;
  private apiVersion: string;
  
  private conversation: DeepSeekMessage[] = [];
  private parser = new DeepSeekMessageParser();
  private executor: DeepSeekToolExecutor;
  private toolDisplayFormatter = new ToolDisplayFormatter();
  private resultFormatter = new ResultFormatter();
  private config: Config;
  private progressCallback?: (message: string) => void;
  private debugLogger = new DebugLogger('🔧 DeepSeek');

  constructor(config: Config) {
    this.config = config;
    // Load configuration from environment - check both patterns
    this.apiKey = process.env['API_KEY'] || process.env['AZURE_API_KEY'] || '';
    this.endpoint = process.env['ENDPOINT'] || process.env['AZURE_ENDPOINT_URL'] || '';
    this.model = process.env['MODEL'] || process.env['AZURE_MODEL'] || 'DeepSeek-R1';
    this.apiVersion = process.env['API_VERSION'] || process.env['AZURE_OPENAI_API_VERSION'] || '2024-05-01-preview';
    
    if (!this.apiKey || !this.endpoint) {
      throw new Error('DeepSeek configuration missing: API_KEY and ENDPOINT are required');
    }
    
    this.executor = new DeepSeekToolExecutor(config);
  }

  /**
   * Set confirmation callback for approval prompts
   */
  setConfirmationCallback(callback: (details: any) => Promise<boolean>) {
    this.executor.setConfirmationCallback(callback);
  }

  /**
   * Set progress callback for real-time updates
   */
  setProgressCallback(callback: (message: string) => void) {
    this.progressCallback = callback;
  }

  /**
   * Main entry point - send message and stream response
   */
  async *sendMessageStream(message: string): AsyncGenerator<string> {
    try {
      // Check if task is complex and needs chunking
      const isComplex = await this.analyzeTaskComplexity(message);
      if (isComplex) {
        yield '📋 Breaking down complex task into steps...\n';
        const chunks = await this.chunkTask(message);
        yield* this.executeChunkedTask(chunks);
        return;
      }
      
      // Use internal handler for non-complex tasks
      yield* this.sendMessageStreamInternal(message);
    } catch (error) {
      yield ColorThemes.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  /**
   * Execute tool calls and stream progress
   */
  private async *executeTools(toolCalls: any[]): AsyncGenerator<string> {
    const results: string[] = [];
    
    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i];
      
      // Display tool execution
      const displayName = this.toolDisplayFormatter.formatToolCall(toolCall.name, toolCall.arguments);
      yield `\n${displayName}\n`;
      
      // Send progress update if callback is set
      if (this.progressCallback) {
        this.progressCallback(`⏺ Executing ${toolCall.name} (${i + 1}/${toolCalls.length})`);
      }
      
      // Debug log tool execution
      const execStartTime = Date.now();
      this.debugLogger.logToolExecution(toolCall.name, toolCall.arguments);
      
      // Execute the tool
      const executionResult = await this.executor.execute(toolCall);
      
      if (executionResult.success) {
        // Log successful execution
        this.debugLogger.logPerformance(`Tool ${toolCall.name}`, execStartTime);
        this.debugLogger.logToolExecution(toolCall.name, toolCall.arguments, executionResult.result);
        
        // Format and display result
        const formattedResult = this.resultFormatter.formatResult(
          toolCall.name,
          toolCall.arguments,
          executionResult.result
        );
        
        // Stream formatted result lines
        const resultLines = this.toolDisplayFormatter.formatToolResult(formattedResult);
        for (const line of resultLines) {
          yield line + '\n';
        }
        
        results.push(`${toolCall.name}: ${executionResult.result}`);
      } else {
        // Display error
        yield this.toolDisplayFormatter.formatToolError(executionResult.error || 'Unknown error') + '\n';
        results.push(`${toolCall.name}: Error - ${executionResult.error}`);
      }
    }
    
    // Add tool results to conversation
    if (results.length > 0) {
      this.conversation.push({
        role: 'user',
        content: `Tool results:\n${results.join('\n')}`
      });
    }
  }

  /**
   * Call DeepSeek API with retry logic and timeout
   */
  private async callDeepSeek(): Promise<DeepSeekResponse | null> {
    const url = `${this.endpoint}/chat/completions?api-version=${this.apiVersion}`;
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 120000; // 2 minutes
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          this.debugLogger.debug('Request timeout after 2 minutes');
        }, TIMEOUT_MS);
        
        const startTime = Date.now();
        this.debugLogger.logRequest(url, 'POST', {
          messages: this.conversation.length,
          model: this.model,
          temperature: 0.7,
          // No token limits
        });
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            messages: this.conversation,
            model: this.model,
            temperature: 0.7,
            // NO TOKEN LIMITS - let the model use what it needs
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        this.debugLogger.logPerformance('API call', startTime);
        this.debugLogger.logResponse(response.status, response.statusText);
        
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
          console.log(`⏳ Rate limited. Waiting ${waitTime/1000}s before retry ${attempt + 1}/${MAX_RETRIES}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        if (!response.ok) {
          // Provide better error messages
          let errorDetail = `${response.status} ${response.statusText}`;
          try {
            const errorBody = await response.text();
            if (errorBody) {
              const parsed = JSON.parse(errorBody);
              errorDetail = parsed.error?.message || errorDetail;
            }
          } catch {}
          
          throw new Error(`API error: ${errorDetail}`);
        }
        
        return await response.json();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        // Check if it's a timeout or network error
        if (errorMsg.includes('abort') || errorMsg.includes('timeout')) {
          console.error(`⏰ Request timeout on attempt ${attempt + 1}/${MAX_RETRIES}`);
        } else if (errorMsg.includes('fetch')) {
          console.error(`🌐 Network error on attempt ${attempt + 1}/${MAX_RETRIES}: ${errorMsg}`);
        } else {
          console.error(`⚠️ DeepSeek API error on attempt ${attempt + 1}/${MAX_RETRIES}: ${errorMsg}`);
        }
        
        // Retry for retriable errors
        if (attempt < MAX_RETRIES - 1) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`↻ Retrying in ${waitTime/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // Final attempt failed
        console.error('❌ All retry attempts exhausted');
        return null;
      }
    }
    
    return null;
  }

  /**
   * Get tool descriptions dynamically from registry
   */
  private getToolDescriptions(): string {
    const toolRegistry = this.config.getToolRegistry();
    const allTools = toolRegistry.getAllTools();
    
    if (allTools.length === 0) {
      throw new Error('No tools available in registry! Tool registry not initialized properly.');
    }
    
    // FULLY DYNAMIC - no hardcoded tools!
    const tools = allTools.map(tool => ({
      name: this.mapToolName(tool.name),
      description: tool.schema?.description || tool.description || tool.name,
      parameters: this.extractToolParameters(tool)
    }));
    
    this.debugLogger.debug(`Dynamically loaded ${tools.length} tools from registry: ${tools.map(t => t.name).join(', ')}`);
    return DeepSeekPrompts.formatToolDescriptions(tools);
  }

  /**
   * Extract parameters from tool schema
   */
  private extractToolParameters(tool: any): string[] {
    if (!tool.schema?.parametersJsonSchema) return [];
    
    const schema = tool.schema.parametersJsonSchema as any;
    const required = Array.isArray(schema.required) ? schema.required : [];
    const properties = schema.properties || {};
    
    return Object.keys(properties).map(key => {
      const isRequired = required.includes(key);
      return `${key}${isRequired ? '' : '?'}`;
    });
  }

  // TODO: Add getAvailableFunctions and convertToolToFunction when implementing function calling API

  /**
   * Map tool names from registry to DeepSeek format
   */
  private mapToolName(toolName: string): string {
    // If already snake_case, return as-is
    if (toolName.includes('_') && !toolName.includes('-')) {
      return toolName;
    }
    
    // Convert kebab-case to snake_case
    if (toolName.includes('-')) {
      return toolName.replace(/-/g, '_');
    }
    
    // Handle CamelCase tool names
    if (toolName.endsWith('Tool')) {
      const baseName = toolName.slice(0, -4);
      return baseName
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
    }
    
    // Handle other CamelCase
    if (/[A-Z]/.test(toolName)) {
      return toolName
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .toLowerCase();
    }
    
    return toolName;
  }

  /**
   * Get the model name
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Analyze if a task is complex and needs chunking
   */
  private async analyzeTaskComplexity(task: string): Promise<boolean> {
    // DISABLED - This was breaking simple tasks
    // Only enable for truly complex multi-step operations
    return false;
    
    /* Original overly aggressive detection:
    const indicators = [
      /multiple|several|various|different/i,
      /step.?by.?step/i,
      /first.*then.*finally/i,
      /\d+\..*\d+\./s, // Numbered lists
      /and also|as well as|in addition/i
    ];
    
    const operations = task.match(/create|update|delete|modify|add|remove|search|find|analyze/gi);
    if (operations && operations.length > 3) {
      return true;
    }
    
    return indicators.some(pattern => pattern.test(task));
    */
  }

  /**
   * Break complex task into chunks
   */
  private async chunkTask(task: string): Promise<string[]> {
    // Try to split by numbered items
    const numberedMatch = task.match(/\d+[\.)\s]+[^\n]+/g);
    if (numberedMatch && numberedMatch.length > 1) {
      return numberedMatch.map(chunk => chunk.replace(/^\d+[\.)\s]+/, ''));
    }
    
    // Try to split by conjunctions
    const parts = task.split(/(?:,\s+and\s+|;\s+|\bthen\b|\bafter that\b|\bnext\b)/i);
    if (parts.length > 1) {
      return parts.map(p => p.trim()).filter(p => p.length > 0);
    }
    
    // Default: treat as single chunk
    return [task];
  }

  /**
   * Execute a chunked task
   */
  private async *executeChunkedTask(chunks: string[]): AsyncGenerator<string> {
    for (let i = 0; i < chunks.length; i++) {
      yield `\n📍 Step ${i + 1}/${chunks.length}: ${chunks[i].substring(0, 50)}...\n`;
      
      // Execute each chunk as a separate task
      yield* this.sendMessageStreamInternal(chunks[i]);
      
      // Small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    yield '\n✅ All steps completed!\n';
  }

  /**
   * Internal message stream handler
   */
  private async *sendMessageStreamInternal(message: string): AsyncGenerator<string> {
    const MAX_ITERATIONS = 5;
    let iterations = 0;
    let currentMessage = message;
    
    // Initialize conversation with system prompt if needed
    if (this.conversation.length === 0) {
      const toolDescriptions = this.getToolDescriptions();
      const systemPrompt = DeepSeekPrompts.getSystemPrompt(toolDescriptions);
      this.conversation.push({ role: 'system', content: systemPrompt });
    }
    
    // Main execution loop
    while (iterations < MAX_ITERATIONS) {
      iterations++;
      
      // Show continuation message for rounds 2+
      if (iterations > 1) {
        yield `\n↻ Continuing (${iterations}/${MAX_ITERATIONS})...\n`;
      }
      
      // Add user message on first iteration
      if (iterations === 1) {
        this.conversation.push({ role: 'user', content: currentMessage });
      }
      
      // Call DeepSeek API
      const response = await this.callDeepSeek();
      
      if (!response || !response.choices?.[0]?.message?.content) {
        yield ColorThemes.warning('⚠️ Empty response from DeepSeek\n');
        break;
      }
      
      const responseContent = response.choices[0].message.content;
      
      // Debug output
      this.debugLogger.debug(`Response length: ${responseContent.length}`);
      if (this.debugLogger.isVerbose()) {
        this.debugLogger.debug(`Response content preview`, responseContent.substring(0, 500));
      }
      
      // Parse for tool calls
      const toolCalls = this.parser.parseToolCalls(responseContent);
      
      if (toolCalls.length > 0) {
        // Execute tools and stream progress
        yield* this.executeTools(toolCalls);
        
        // Add assistant's message that contained the tool calls
        this.conversation.push({
          role: 'assistant',
          content: responseContent
        });
        
        // After executing tools, we need to get a final response from the AI
        // that incorporates the tool results
        if (iterations < MAX_ITERATIONS) {
          // Continue to get the AI's final response with tool results
          continue;
        }
        
        break;
      } else {
        // No tools, just display the message
        const cleanMessage = this.parser.extractMessage(responseContent);
        if (cleanMessage) {
          yield cleanMessage + '\n';
        }
        break;
      }
    }
    
    if (iterations >= MAX_ITERATIONS) {
      yield ColorThemes.warning('\n⚠️ Reached maximum iterations limit\n');
    }
  }

  /**
   * Reset conversation
   */
  reset(): void {
    this.conversation = [];
  }
}