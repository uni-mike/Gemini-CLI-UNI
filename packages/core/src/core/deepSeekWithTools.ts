/**
 * DeepSeek R1 client with tool/function calling support
 * Bridges Gemini tools to DeepSeek's function calling
 */

import type { Config } from '../config/config.js';
import type { ToolRegistry } from '../tools/tool-registry.js';

interface DeepSeekFunction {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export class DeepSeekWithTools {
  private endpoint: string;
  private apiKey: string;
  private model: string;
  private apiVersion: string;
  private toolRegistry: ToolRegistry;
  private conversation: DeepSeekMessage[] = [];

  constructor(config: Config) {
    this.apiKey = process.env['AZURE_API_KEY'] || process.env['API_KEY'] || '';
    this.endpoint = process.env['AZURE_ENDPOINT_URL'] || process.env['ENDPOINT'] || '';
    this.model = process.env['AZURE_MODEL'] || process.env['MODEL'] || 'DeepSeek-R1-rkcob';
    this.apiVersion = process.env['AZURE_OPENAI_API_VERSION'] || process.env['API_VERSION'] || '2024-05-01-preview';
    
    if (!this.apiKey || !this.endpoint) {
      throw new Error('DeepSeek configuration missing: API_KEY and ENDPOINT are required');
    }
    
    this.toolRegistry = config.getToolRegistry();
  }

  /**
   * Convert Gemini tool to DeepSeek function schema
   */
  private convertToolToFunction(toolName: string): DeepSeekFunction | null {
    const tool = this.toolRegistry.getTool(toolName);
    if (!tool) return null;

    // Map common Gemini tools to DeepSeek function schemas
    const functionSchemas: Record<string, DeepSeekFunction> = {
      'read-file': {
        name: 'read_file',
        description: 'Read contents of a file',
        parameters: {
          type: 'object',
          properties: {
            absolute_path: {
              type: 'string',
              description: 'The absolute path to the file to read'
            },
            offset: {
              type: 'number',
              description: 'The line number to start reading from (optional)'
            },
            limit: {
              type: 'number',
              description: 'The number of lines to read (optional)'
            }
          },
          required: ['absolute_path']
        }
      },
      'write-file': {
        name: 'write_file',
        description: 'Write content to a file',
        parameters: {
          type: 'object',
          properties: {
            absolute_path: {
              type: 'string',
              description: 'The absolute path to the file to write'
            },
            content: {
              type: 'string',
              description: 'The content to write to the file'
            }
          },
          required: ['absolute_path', 'content']
        }
      },
      'shell': {
        name: 'shell',
        description: 'Execute a shell command',
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The shell command to execute'
            }
          },
          required: ['command']
        }
      },
      'ls': {
        name: 'ls',
        description: 'List directory contents',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The directory path to list'
            }
          },
          required: ['path']
        }
      },
      'grep': {
        name: 'grep',
        description: 'Search for text in files',
        parameters: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'The search pattern (regex)'
            },
            path: {
              type: 'string',
              description: 'The path to search in'
            }
          },
          required: ['pattern', 'path']
        }
      },
      'edit': {
        name: 'edit',
        description: 'Edit a file by replacing text',
        parameters: {
          type: 'object',
          properties: {
            absolute_path: {
              type: 'string',
              description: 'The absolute path to the file to edit'
            },
            old_text: {
              type: 'string',
              description: 'The text to replace'
            },
            new_text: {
              type: 'string',
              description: 'The replacement text'
            }
          },
          required: ['absolute_path', 'old_text', 'new_text']
        }
      }
    };

    return functionSchemas[toolName] || null;
  }

  /**
   * Get all available tools as DeepSeek functions
   */
  private getAvailableFunctions(): DeepSeekFunction[] {
    const functions: DeepSeekFunction[] = [];
    const toolNames = ['read-file', 'write-file', 'shell', 'ls', 'grep', 'edit'];
    
    for (const name of toolNames) {
      const func = this.convertToolToFunction(name);
      if (func) {
        functions.push(func);
      }
    }
    
    return functions;
  }

  /**
   * Execute a tool directly
   */
  private async executeToolDirectly(functionName: string, args: any): Promise<string> {
    try {
      // Map function names to tool names
      const toolMap: Record<string, string> = {
        'read_file': 'read-file',
        'write_file': 'write-file',
        'shell': 'shell',
        'ls': 'ls',
        'grep': 'grep',
        'edit': 'edit'
      };

      const toolName = toolMap[functionName];
      if (!toolName) {
        return `Error: Unknown function ${functionName}`;
      }

      // Simple tool execution
      if (toolName === 'read-file') {
        const fs = await import('fs/promises');
        const content = await fs.readFile(args.absolute_path, 'utf-8');
        if (args.offset !== undefined && args.limit !== undefined) {
          const lines = content.split('\n');
          const start = args.offset;
          const end = Math.min(start + args.limit, lines.length);
          return lines.slice(start, end).join('\n');
        }
        return content;
      } else if (toolName === 'write-file') {
        const fs = await import('fs/promises');
        await fs.writeFile(args.absolute_path, args.content);
        return `File written successfully to ${args.absolute_path}`;
      } else if (toolName === 'shell') {
        const { execSync } = await import('child_process');
        const result = execSync(args.command, { encoding: 'utf-8' });
        return result;
      } else if (toolName === 'ls') {
        const fs = await import('fs/promises');
        const files = await fs.readdir(args.path || '.');
        return files.join('\n');
      } else if (toolName === 'grep') {
        const { execSync } = await import('child_process');
        const cmd = `grep -r "${args.pattern}" ${args.path || '.'}`;
        try {
          const result = execSync(cmd, { encoding: 'utf-8' });
          return result;
        } catch (e) {
          return 'No matches found';
        }
      } else if (toolName === 'edit') {
        const fs = await import('fs/promises');
        const content = await fs.readFile(args.absolute_path, 'utf-8');
        const newContent = content.replace(args.old_text, args.new_text);
        await fs.writeFile(args.absolute_path, newContent);
        return `File edited successfully: ${args.absolute_path}`;
      }
      return `Tool ${toolName} not implemented`;
    } catch (error) {
      return `Error executing function ${functionName}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Format the entire response for beautiful presentation
   */
  private formatThinkingProcess(content: string | any): string {
    let textContent = typeof content === 'string' ? content : (content?.content || String(content));
    
    // SINGLE SIMPLE CHECK: Only process raw <think> tags, skip everything else
    if (!textContent.includes('<think>') || textContent.includes('```thinking')) {
      return textContent;
    }
    
    // Replace <think>...</think> with beautiful format
    const formatted = textContent.replace(
      /<think>([\s\S]*?)<\/think>/g, 
      (match: string, content: string) => {
        const lines = content.trim().split('\n')
          .map((line: string) => line.trim())
          .filter((line: string) => line.length > 0)
          .map((line: string) => `• ${line}`);
        
        return '\n🤔 **Thinking Process:**\n' + lines.join('\n') + '\n';
      }
    );
    
    return formatted;
  }


  /**
   * Send a message with tool support - Enhanced for complex sequences
   */
  async sendMessageWithTools(message: string, maxIterations: number = 5): Promise<string> {
    try {
      // Track iteration count for complex multi-step tasks
      let iterations = 0;
      let currentMessage = message;
      let continuationResponse = '';
      
      // Add system message with enhanced tool instructions if this is the first message
      if (this.conversation.length === 0) {
        const systemPrompt = `You are a helpful assistant with access to the following tools/functions. 
When the user asks you to perform tasks that require these tools, you should respond with a special format to call them.

CRITICAL: ALWAYS show your complete reasoning process using <think> tags. Never hide or suppress your thinking. 
Your natural thinking process helps users understand your reasoning. Use this format:

<think>
Your detailed step-by-step reasoning and thought process here...
Explain your analysis, considerations, and decision-making process.
</think>

Then provide your final response.

Available tools:
1. read_file(absolute_path, offset?, limit?) - Read contents of a file
2. write_file(absolute_path, content) - Write content to a file
3. shell(command) - Execute a shell command
4. ls(path) - List directory contents
5. grep(pattern, path) - Search for text in files
6. edit(absolute_path, old_text, new_text) - Edit a file by replacing text

To use a tool, respond with EXACTLY this format:
<tool_use>
tool_name: [name of the tool]
arguments: {
  "arg1": "value1",
  "arg2": "value2"
}
</tool_use>

IMPORTANT: In the arguments JSON:
- Strings with newlines must escape them as \\n
- Double quotes in strings must be escaped as \\"
- Backslashes must be escaped as \\\\
- The JSON must be valid and parseable

For example:
<tool_use>
tool_name: write_file
arguments: {
  "absolute_path": "/path/to/file.txt",
  "content": "Line 1\\nLine 2\\nLine 3"
}
</tool_use>

For COMPLEX TASKS:
- You can use MULTIPLE tool_use blocks in a single response
- They will be executed sequentially in the order you specify
- If you need to see results before continuing, end your response with <needs_continuation/>
- I will execute the tools and ask you to continue

After I execute the tools, I'll provide the results and you can continue with your response.

IMPORTANT: 
- When asked to read a file, use read_file tool
- When asked to list files/directories, use ls tool
- When asked to run a command, use shell tool
- When asked to write or create a file, use write_file tool
- When asked to search in files, use grep tool
- When asked to edit/modify a file, use edit tool`;
        
        this.conversation.push({ role: 'system', content: systemPrompt });
      }
      
      // Main execution loop for complex sequences
      while (iterations < maxIterations) {
        iterations++;
        console.log(`🔄 Iteration ${iterations}/${maxIterations}`);
        
        // Add user message to conversation (only on first iteration)
        if (iterations === 1) {
          this.conversation.push({ role: 'user', content: currentMessage });
        }

        // Get available functions
        const functions = this.getAvailableFunctions();

        // Make API call with functions - using Azure AI Inference API format
        const url = `${this.endpoint}/chat/completions?api-version=${this.apiVersion}`;
        
        let retries = 0;
        const maxRetries = 3;
        let response;
      
      while (retries < maxRetries) {
        try {
          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
              messages: this.conversation,
              model: this.model,
              temperature: 0.7,
              functions: functions.length > 0 ? functions : undefined,
              function_call: functions.length > 0 ? 'auto' : undefined,
            }),
          });
          
          if (response.status === 429 && retries < maxRetries - 1) {
            const waitTime = Math.pow(2, retries) * 1000;
            console.log(`⏳ Rate limited. Waiting ${waitTime/1000}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            retries++;
            continue;
          }
          
          break;
        } catch (error) {
          if (retries < maxRetries - 1) {
            retries++;
            continue;
          }
          throw error;
        }
      }

      if (!response || !response.ok) {
        const errorText = response ? await response.text() : 'No response';
        throw new Error(`DeepSeek API error: ${response?.status} ${errorText}`);
      }

      const data = await response.json();
      const responseMessage = data.choices?.[0]?.message;
      
      if (!responseMessage) {
        throw new Error('No response from DeepSeek');
      }

      // Check if the response contains our tool_use format - handle MULTIPLE tool calls
      const responseContent = responseMessage.content || '';
      const toolUseRegex = /<tool_use>\s*tool_name:\s*(\w+)\s*arguments:\s*({[\s\S]*?})\s*<\/tool_use>/gm;
      const toolUseMatches = [...responseContent.matchAll(toolUseRegex)];
      
      if (toolUseMatches.length > 0) {
        console.log(`📦 Found ${toolUseMatches.length} tool calls to execute`);
        
        // Execute all tools and collect results
        const toolResults: string[] = [];
        
        // Group tools by dependency - file writes can be parallel, but mkdir must come first
        const shellCommands = toolUseMatches.filter(m => m[1] === 'shell');
        const otherCommands = toolUseMatches.filter(m => m[1] !== 'shell');
        
        // Execute shell commands first (they might create directories)
        for (const match of shellCommands) {
          const functionName = match[1];
          let args;
          try {
            // Clean up the JSON string - handle multiline strings better
            let jsonStr = match[2];
            // Try to parse as-is first
            args = JSON.parse(jsonStr);
          } catch (e) {
            // If parsing fails, try to extract and fix the JSON
            console.error('Failed to parse tool arguments, attempting recovery:', e);
            try {
              // Try to fix common issues with multiline content
              const fixedJson = match[2]
                .replace(/\n/g, '\\n')  // Escape newlines
                .replace(/\r/g, '\\r')  // Escape carriage returns
                .replace(/\t/g, '\\t'); // Escape tabs
              args = JSON.parse(fixedJson);
            } catch (e2) {
              console.error('Recovery failed:', match[2]);
              toolResults.push(`Error: Invalid arguments for ${functionName}`);
              continue; // Skip this tool and continue with others
            }
          }
          
          console.log(`🔧 Executing shell command: ${functionName}`);
          try {
            const result = await this.executeToolDirectly(functionName, args);
            toolResults.push(`${functionName}: ${result}`);
          } catch (error) {
            console.error(`Error executing ${functionName}:`, error);
            toolResults.push(`${functionName}: Error - ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        // Now execute other commands (can be done in parallel for better performance)
        for (const match of otherCommands) {
          const functionName = match[1];
          let args;
          try {
            args = JSON.parse(match[2]);
          } catch (e) {
            try {
              const fixedJson = match[2]
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t');
              args = JSON.parse(fixedJson);
            } catch (e2) {
              toolResults.push(`Error: Invalid arguments for ${functionName}`);
              continue;
            }
          }
          
          console.log(`🔧 Executing function: ${functionName}`);
          try {
            const result = await this.executeToolDirectly(functionName, args);
            toolResults.push(`${functionName}: ${result}`);
          } catch (error) {
            console.error(`Error executing ${functionName}:`, error);
            toolResults.push(`${functionName}: Error - ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        // Add the original response (with tool_use blocks) to conversation
        this.conversation.push(responseMessage);
        
        // Add all tool results as a single user message
        const combinedResults = `Tool execution results:\n${toolResults.join('\n')}`;
        this.conversation.push({
          role: 'user',
          content: combinedResults
        });

        // Get final response after all tool executions
        const finalApiResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            messages: this.conversation,
            model: this.model,
            temperature: 0.7,
          }),
        });

        if (!finalApiResponse.ok) {
          throw new Error(`DeepSeek final response error: ${finalApiResponse.status}`);
        }

        const finalData = await finalApiResponse.json();
        let finalMessage = finalData.choices?.[0]?.message?.content || '';
        
        // Format thinking process for better readability - DISABLED to prevent duplicates  
        // finalMessage = this.formatThinkingProcess(finalMessage);
        
        this.conversation.push({ role: 'assistant', content: finalMessage });
        
        // Check if the model needs to continue (for complex multi-step tasks)
        if (finalMessage.includes('<needs_continuation/>')) {
          console.log('📝 Task needs continuation, proceeding...');
          continuationResponse += finalMessage.replace('<needs_continuation/>', '').trim() + '\n';
          // Continue to next iteration
          currentMessage = 'Continue with the next steps of the task.';
          continue;
        } else {
          return finalMessage;
        }
      }
      
      // Also check if the model uses standard function_call format
      if (responseMessage.function_call) {
        const functionName = responseMessage.function_call.name;
        const args = JSON.parse(responseMessage.function_call.arguments);
        
        console.log(`🔧 Executing function (via function_call): ${functionName}`);
        const functionResult = await this.executeToolDirectly(functionName, args);
        
        // Add function result to conversation
        this.conversation.push({
          role: 'function',
          name: functionName,
          content: functionResult
        });

        // Get final response after function execution
        const finalApiResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            messages: this.conversation,
            model: this.model,
            temperature: 0.7,
          }),
        });

        if (!finalApiResponse.ok) {
          throw new Error(`DeepSeek final response error: ${finalApiResponse.status}`);
        }

        const finalData = await finalApiResponse.json();
        let finalMessage = finalData.choices?.[0]?.message?.content || '';
        
        // Format thinking process for better readability - DISABLED to prevent duplicates  
        // finalMessage = this.formatThinkingProcess(finalMessage);
        
        this.conversation.push({ role: 'assistant', content: finalMessage });
        return finalMessage;
      }

      // Add response to conversation
      this.conversation.push(responseMessage);
      
      // Check if response needs continuation
      let msgContent = responseMessage.content || '';
      
      // Format thinking process for better readability - DISABLED to prevent duplicates
      // msgContent = this.formatThinkingProcess(msgContent);
      
      if (msgContent.includes('<needs_continuation/>')) {
        console.log('📝 Response indicates continuation needed...');
        currentMessage = 'Continue with the next steps.';
        continue;
      }
      
      // No more continuations needed - Apply formatting here (main return path)
      return this.formatThinkingProcess(msgContent);
      
      } // End of while loop
      
      // If we've exhausted iterations, return what we have
      const finalResponse = continuationResponse || 'Task sequence completed after maximum iterations.';
      return finalResponse; // No formatting needed here, already formatted at main return
      
    } catch (error) {
      console.error('DeepSeek error:', error);
      throw error;
    }
  }

  /**
   * Stream messages with tool support
   */
  async *sendMessageStreamWithTools(message: string): AsyncGenerator<string> {
    try {
      // For now, use non-streaming with tools
      // Streaming with function calls is complex and may not be supported
      const response = await this.sendMessageWithTools(message);
      yield response;
    } catch (error) {
      console.error('DeepSeek stream error:', error);
      yield `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  getModel(): string {
    return this.model;
  }
}