/**
 * DeepSeek API Client with proper timeout and error handling
 * Fixed version that prevents hanging and provides user feedback
 */

import { Message } from './provider.js';
import { EventEmitter } from 'events';
import { StreamProcessor } from './streaming.js';

interface DeepSeekConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeout?: number; // Configurable timeout in ms
}

interface ToolCall {
  name: string;
  arguments: any;
}

export class DeepSeekClient extends EventEmitter {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private apiVersion: string;
  private timeout: number;

  constructor(config: DeepSeekConfig = {}) {
    super();
    this.apiKey = config.apiKey || process.env.API_KEY || '';
    this.baseUrl = config.baseUrl || process.env.ENDPOINT || '';
    this.model = config.model || process.env.MODEL || 'DeepSeek-V3.1';
    this.apiVersion = process.env.API_VERSION || '2024-05-01-preview';
    this.timeout = config.timeout || 120000; // Default 120 seconds for complex prompts
  }

  async chat(messages: Message[], tools?: any[], forceJson?: boolean): Promise<string> {
    this.emit('start', { messages, tools });

    // Clone messages to avoid modifying original
    const processedMessages = [...messages];

    // Dynamic token allocation based on prompt complexity
    // DeepSeek-V3.1 supports up to 32K output tokens (verified on Azure)
    const promptLength = processedMessages.reduce((acc, msg) => acc + msg.content.length, 0);
    const estimatedTokens = Math.ceil(promptLength / 4); // Rough estimate: 4 chars per token

    // Economic allocation: use what's needed, not max
    // Simple prompts: 2K, Medium: 8K, Complex: 16K, Very Complex: 32K
    let maxTokens: number;
    if (estimatedTokens < 500) {
      maxTokens = 2000;  // Simple prompts
    } else if (estimatedTokens < 2000) {
      maxTokens = 8000;  // Medium complexity
    } else if (estimatedTokens < 5000) {
      maxTokens = 16000; // Complex prompts
    } else {
      maxTokens = 32000; // Very complex prompts (max supported)
    }

    const requestBody: any = {
      model: this.model,
      messages: processedMessages,
      temperature: 0, // Use temperature 0 for consistency
      stream: false,
      max_tokens: maxTokens // Dynamic based on prompt complexity
    };

    if (forceJson) {
      requestBody.response_format = { type: "json_object" };
      // Enhance the last message to explicitly request clean JSON
      const lastMessage = processedMessages[processedMessages.length - 1];
      lastMessage.content += `\n\nIMP: give the output in a valid JSON string (it should be not be wrapped in markdown, just plain json object)`;
    }

    if (tools && tools.length > 0) {
      requestBody.tools = this.formatToolsForAPI(tools);
      requestBody.tool_choice = 'auto';
    }

    // Retry logic with exponential backoff
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Show retry status to user
        if (attempt > 0) {
          this.emit('retry', {
            attempt: attempt + 1,
            maxRetries,
            message: `Retrying API call (attempt ${attempt + 1}/${maxRetries})...`
          });
          console.log(`🔄 Retrying DeepSeek API (attempt ${attempt + 1}/${maxRetries})...`);
        }

        // Azure OpenAI endpoint format
        // If baseUrl doesn't end with /openai/v1, add it
        const baseUrlWithPath = this.baseUrl.endsWith('/openai/v1')
          ? this.baseUrl
          : `${this.baseUrl}/openai/v1`;
        const url = `${baseUrlWithPath}/chat/completions`;

        if (process.env.DEBUG === 'true') {
          console.log('DeepSeek API Request:', {
            url,
            model: this.model,
            messagesCount: messages.length,
            hasTools: !!tools,
            attempt: attempt + 1,
            maxTokens,
            timeout: this.timeout
          });
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          this.emit('timeout', {
            timeout: this.timeout,
            message: `Request timed out after ${this.timeout/1000} seconds`
          });
          console.error(`⏱️ DeepSeek API timeout after ${this.timeout/1000} seconds (increase timeout if needed)`);
        }, this.timeout);

        // Make the API call with timeout
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': this.apiKey
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));

        if (!response.ok) {
          const errorText = await response.text();
          const errorMsg = `API error: ${response.status} - ${errorText.substring(0, 200)}`;
          console.error('DeepSeek API Error:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          });
          throw new Error(errorMsg);
        }

        const data: any = await response.json();
        const choice = data.choices[0];

        // Emit token usage if available
        if (data.usage) {
          this.emit('token-usage', {
            prompt_tokens: data.usage.prompt_tokens || 0,
            completion_tokens: data.usage.completion_tokens || 0,
            total_tokens: data.usage.total_tokens || 0
          });
        }

        // Check for tool calls
        if (choice.message.tool_calls) {
          this.emit('tool-calls', choice.message.tool_calls);
          return JSON.stringify(choice.message.tool_calls);
        }

        // DeepSeek R1 returns reasoning in reasoning_content and final answer in content
        // Sometimes content is null and only reasoning_content is provided
        let content = choice.message.content || choice.message.reasoning_content || '';

        // Check if response was truncated (finish_reason will be 'length' instead of 'stop')
        const wasTruncated = choice.finish_reason === 'length';
        if (wasTruncated) {
          console.warn(`⚠️ Response was truncated at ${maxTokens} tokens. Consider increasing max_tokens.`);
          this.emit('warning', {
            type: 'truncated_response',
            message: `Response truncated at ${maxTokens} tokens`,
            maxTokens
          });
        }

        if (forceJson) {
          // JSON-specific cleaning
          content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

          // Remove markdown code blocks if present
          if (content.includes('```json') || content.includes('```')) {
            const pattern = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;
            const match = content.match(pattern);
            if (match) {
              content = match[1];
            }
          }

          content = content.trim();

          // If JSON was truncated, try to fix it
          if (wasTruncated && forceJson) {
            console.warn('⚠️ Attempting to repair truncated JSON...');
            content = this.attemptJsonRepair(content);
          }
        } else {
          // Standard cleaning for non-JSON responses
          content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
          content = content.replace(/<\/think>/g, '').trim();
        }

        // Debug logging when in debug mode
        if (process.env.DEBUG === 'true' && content !== choice.message.content) {
          console.log('DeepSeek Response Cleaning:', {
            original: choice.message.content.substring(0, 200),
            cleaned: content.substring(0, 200)
          });
        }

        this.emit('finish', content);
        return content;

      } catch (error: any) {
        lastError = error;

        // Check if it's an abort error (timeout)
        const isTimeout = error.name === 'AbortError';
        const errorMessage = isTimeout
          ? `Request timeout after ${this.timeout/1000} seconds`
          : error.message;

        console.error(`❌ DeepSeek API attempt ${attempt + 1} failed:`, errorMessage);

        // Emit error event for UI feedback
        this.emit('error', {
          attempt: attempt + 1,
          maxRetries,
          message: errorMessage,
          isTimeout,
          willRetry: attempt < maxRetries - 1
        });

        // Don't retry on certain errors
        if (error.message?.includes('401') || error.message?.includes('403')) {
          console.error('🔐 Authentication error - check your API key');
          break; // Don't retry auth errors
        }

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.log(`⏳ Waiting ${delay/1000} seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    const finalError = lastError || new Error('Unknown error in DeepSeek API');
    this.emit('error', {
      final: true,
      message: `Failed after ${maxRetries} attempts: ${finalError.message}`
    });
    throw finalError;
  }

  async *streamChat(messages: Message[], tools?: any[]): AsyncGenerator<string> {
    this.emit('start', { messages, tools, streaming: true });

    const requestBody: any = {
      model: this.model,
      messages,
      temperature: 0,
      stream: true
    };

    if (tools && tools.length > 0) {
      requestBody.tools = this.formatToolsForAPI(tools);
      requestBody.tool_choice = 'auto';
    }

    try {
      const baseUrlWithPath = this.baseUrl.endsWith('/openai/v1')
        ? this.baseUrl
        : `${this.baseUrl}/openai/v1`;
      const url = `${baseUrlWithPath}/chat/completions`;

      // Add timeout for streaming
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        this.emit('timeout', {
          timeout: this.timeout * 2, // Longer timeout for streaming
          message: `Stream timeout after ${this.timeout * 2 / 1000} seconds`
        });
      }, this.timeout * 2); // Double timeout for streaming

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText.substring(0, 200)}`);
      }

      const processor = new StreamProcessor();
      const stream = processor.processStream(response);

      for await (const chunk of stream) {
        // Clean thinking tokens from streaming response
        const cleanedChunk = chunk
          .replace(/<think>[\s\S]*?<\/think>/g, '')
          .replace(/<\/think>/g, '');

        if (cleanedChunk) {
          yield cleanedChunk;
        }
      }

      this.emit('finish');
    } catch (error: any) {
      const errorMessage = error.name === 'AbortError'
        ? `Stream timeout after ${this.timeout * 2 / 1000} seconds`
        : error.message;

      console.error('❌ DeepSeek streaming error:', errorMessage);
      this.emit('error', { message: errorMessage, streaming: true });
      throw error;
    }
  }

  private attemptJsonRepair(json: string): string {
    try {
      // Try to parse as-is first
      JSON.parse(json);
      return json; // It's already valid
    } catch {
      // Common truncation patterns and fixes
      let repaired = json;

      // Count open/close braces and brackets
      const openBraces = (repaired.match(/{/g) || []).length;
      const closeBraces = (repaired.match(/}/g) || []).length;
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/]/g) || []).length;

      // Remove incomplete last item if there's a trailing comma
      if (repaired.match(/,\s*$/)) {
        repaired = repaired.replace(/,\s*$/, '');
      }

      // Add missing close brackets
      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        repaired += ']';
      }

      // Add missing close braces
      for (let i = 0; i < openBraces - closeBraces; i++) {
        repaired += '}';
      }

      // Try to parse the repaired JSON
      try {
        JSON.parse(repaired);
        console.log('✅ Successfully repaired truncated JSON');
        return repaired;
      } catch {
        console.error('❌ Could not repair truncated JSON');
        // Return original with warning comment
        return json + '\n/* WARNING: Response was truncated and could not be repaired */';
      }
    }
  }

  private formatToolsForAPI(tools: any[]): any[] {
    return tools.map(tool => {
      // Handle tools from the registry (Tool class instances)
      if (tool.name && tool.description && !tool.type) {
        // Convert Tool instance to OpenAI function format
        const parameters: any = {
          type: 'object',
          properties: {},
          required: []
        };

        // Build parameters from parameterSchema if available
        if (tool.parameterSchema && Array.isArray(tool.parameterSchema)) {
          tool.parameterSchema.forEach((param: any) => {
            parameters.properties[param.name] = {
              type: param.type,
              description: param.description || `The ${param.name} parameter`
            };
            if (param.enum) {
              parameters.properties[param.name].enum = param.enum;
            }
            if (param.required) {
              parameters.required.push(param.name);
            }
          });
        }

        return {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: parameters
          }
        };
      }

      // Handle already formatted tools (for backwards compatibility)
      if (tool.type === 'function' && tool.function) {
        return {
          type: 'function',
          function: {
            name: tool.function.name,
            description: tool.function.description,
            parameters: tool.function.parameters || {}
          }
        };
      }

      // Fallback for any other format
      return {
        type: 'function',
        function: {
          name: tool.name || 'unknown',
          description: tool.description || 'No description',
          parameters: { type: 'object', properties: {}, required: [] }
        }
      };
    });
  }
}