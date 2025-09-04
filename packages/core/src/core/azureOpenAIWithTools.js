/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import OpenAI from 'openai';
/**
 * Azure OpenAI client with full tool/function calling support
 * This bridges Gemini tools to OpenAI function calling
 */
export class AzureOpenAIWithTools {
    client;
    deploymentName;
    model;
    toolRegistry;
    conversation = [];
    constructor(config) {
        const apiKey = process.env['AZURE_API_KEY'];
        const endpoint = process.env['AZURE_ENDPOINT_URL'];
        const apiVersion = process.env['AZURE_OPENAI_API_VERSION'] || '2024-12-01-preview';
        const deployment = process.env['AZURE_DEPLOYMENT'];
        if (!apiKey || !endpoint || !deployment) {
            throw new Error('Azure OpenAI configuration missing: AZURE_API_KEY, AZURE_ENDPOINT_URL, and AZURE_DEPLOYMENT are required');
        }
        this.client = new OpenAI({
            apiKey,
            baseURL: `${endpoint}/openai/deployments/${deployment}`,
            defaultQuery: { 'api-version': apiVersion },
        });
        this.deploymentName = deployment;
        this.model = process.env['AZURE_MODEL'] || 'gpt-4';
        this.toolRegistry = config.getToolRegistry();
    }
    /**
     * Convert Gemini tool to OpenAI function schema
     */
    convertToolToFunction(toolName) {
        const tool = this.toolRegistry.getTool(toolName);
        if (!tool)
            return null;
        // Map common Gemini tools to OpenAI function schemas
        const functionSchemas = {
            'read-file': {
                type: 'function',
                function: {
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
                }
            },
            'write-file': {
                type: 'function',
                function: {
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
                }
            },
            'shell': {
                type: 'function',
                function: {
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
                }
            },
            'ls': {
                type: 'function',
                function: {
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
                }
            },
            'grep': {
                type: 'function',
                function: {
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
                }
            },
            'edit': {
                type: 'function',
                function: {
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
            }
        };
        return functionSchemas[toolName] || null;
    }
    /**
     * Get all available tools as OpenAI functions
     */
    getAvailableTools() {
        const tools = [];
        const toolNames = ['read-file', 'write-file', 'shell', 'ls', 'grep', 'edit'];
        for (const name of toolNames) {
            const tool = this.convertToolToFunction(name);
            if (tool) {
                tools.push(tool);
            }
        }
        return tools;
    }
    /**
     * Execute a tool call and return the result
     */
    async executeToolCall(functionName, args) {
        try {
            // Map OpenAI function names back to Gemini tool names
            const toolMap = {
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
            const tool = this.toolRegistry.getTool(toolName);
            if (!tool) {
                return `Error: Tool ${toolName} not found`;
            }
            // Convert function arguments to tool parameters
            const params = this.convertFunctionArgsToToolParams(functionName, args);
            // Create and execute tool invocation
            // We need to call the tool directly with its execute method
            // Since tools are dynamically created, we'll use a simple approach
            const toolResult = await this.executeToolDirectly(toolName, params);
            return toolResult;
        }
        catch (error) {
            console.error(`Tool execution error: ${error}`);
            return `Error executing tool: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
    /**
     * Execute a tool directly without creating an invocation
     */
    async executeToolDirectly(toolName, params) {
        try {
            // For now, we'll use a simple approach to execute tools
            // This can be enhanced to use the actual tool execution logic
            if (toolName === 'read-file') {
                const fs = await import('fs/promises');
                const content = await fs.readFile(params.absolute_path, 'utf-8');
                if (params.offset !== undefined && params.limit !== undefined) {
                    const lines = content.split('\n');
                    const start = params.offset;
                    const end = Math.min(start + params.limit, lines.length);
                    return lines.slice(start, end).join('\n');
                }
                return content;
            }
            else if (toolName === 'write-file') {
                const fs = await import('fs/promises');
                await fs.writeFile(params.absolute_path, params.content);
                return `File written successfully to ${params.absolute_path}`;
            }
            else if (toolName === 'shell') {
                const { execSync } = await import('child_process');
                const result = execSync(params.command, { encoding: 'utf-8' });
                return result;
            }
            else if (toolName === 'ls') {
                const fs = await import('fs/promises');
                const files = await fs.readdir(params.path || '.');
                return files.join('\n');
            }
            else if (toolName === 'grep') {
                const { execSync } = await import('child_process');
                const cmd = `grep -r "${params.pattern}" ${params.path || '.'}`;
                try {
                    const result = execSync(cmd, { encoding: 'utf-8' });
                    return result;
                }
                catch (e) {
                    return 'No matches found';
                }
            }
            else if (toolName === 'edit') {
                const fs = await import('fs/promises');
                const content = await fs.readFile(params.absolute_path, 'utf-8');
                const newContent = content.replace(params.old_text, params.new_text);
                await fs.writeFile(params.absolute_path, newContent);
                return `File edited successfully: ${params.absolute_path}`;
            }
            return `Tool ${toolName} not implemented`;
        }
        catch (error) {
            return `Error executing tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
    /**
     * Convert OpenAI function arguments to Gemini tool parameters
     */
    convertFunctionArgsToToolParams(functionName, args) {
        // Map function arguments to tool parameters
        const paramMap = {
            'read_file': (args) => ({
                absolute_path: args.absolute_path,
                offset: args.offset,
                limit: args.limit
            }),
            'write_file': (args) => ({
                absolute_path: args.absolute_path,
                content: args.content
            }),
            'shell': (args) => ({
                command: args.command
            }),
            'ls': (args) => ({
                path: args.path || '.'
            }),
            'grep': (args) => ({
                pattern: args.pattern,
                path: args.path || '.'
            }),
            'edit': (args) => ({
                absolute_path: args.absolute_path,
                old_text: args.old_text,
                new_text: args.new_text
            })
        };
        const converter = paramMap[functionName];
        return converter ? converter(args) : args;
    }
    /**
     * Send a message with tool support
     */
    async sendMessageWithTools(message) {
        try {
            // Add user message to conversation
            this.conversation.push({ role: 'user', content: message });
            // Get available tools
            const tools = this.getAvailableTools();
            // Make API call with tools - with retry logic for rate limits
            let response;
            let retries = 0;
            const maxRetries = 3;
            while (retries < maxRetries) {
                try {
                    response = await this.client.chat.completions.create({
                        model: this.deploymentName,
                        messages: this.conversation,
                        tools: tools.length > 0 ? tools : undefined,
                        tool_choice: tools.length > 0 ? 'auto' : undefined,
                    });
                    break; // Success, exit retry loop
                }
                catch (error) {
                    if (error?.status === 429 && retries < maxRetries - 1) {
                        const waitTime = Math.pow(2, retries) * 1000; // Exponential backoff: 1s, 2s, 4s
                        console.log(`⏳ Rate limited. Waiting ${waitTime / 1000}s before retry...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        retries++;
                    }
                    else {
                        throw error; // Re-throw if not rate limit or max retries reached
                    }
                }
            }
            if (!response) {
                throw new Error('Failed to get response after retries');
            }
            const responseMessage = response.choices[0]?.message;
            if (!responseMessage) {
                throw new Error('No response from Azure OpenAI');
            }
            // Add assistant response to conversation
            this.conversation.push(responseMessage);
            // Check if the model wants to use tools
            if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                // Execute tool calls
                for (const toolCall of responseMessage.tool_calls) {
                    const functionCall = toolCall.function;
                    if (!functionCall)
                        continue;
                    const functionName = functionCall.name;
                    const args = JSON.parse(functionCall.arguments);
                    console.log(`🔧 Executing tool: ${functionName}`);
                    const toolResult = await this.executeToolCall(functionName, args);
                    // Add tool result to conversation
                    this.conversation.push({
                        role: 'tool',
                        content: toolResult,
                        tool_call_id: toolCall.id
                    });
                }
                // Get final response after tool execution
                const finalResponse = await this.client.chat.completions.create({
                    model: this.deploymentName,
                    messages: this.conversation,
                });
                const finalMessage = finalResponse.choices[0]?.message?.content || '';
                this.conversation.push({ role: 'assistant', content: finalMessage });
                return finalMessage;
            }
            // Return direct response if no tools were called
            return responseMessage.content || '';
        }
        catch (error) {
            console.error('Azure OpenAI error:', error);
            throw error;
        }
    }
    /**
     * Stream messages with tool support
     */
    async *sendMessageStreamWithTools(message) {
        try {
            // Add user message
            this.conversation.push({ role: 'user', content: message });
            // Get available tools
            const tools = this.getAvailableTools();
            // Stream the response - with retry logic for rate limits
            let stream;
            let retries = 0;
            const maxRetries = 3;
            while (retries < maxRetries) {
                try {
                    stream = await this.client.chat.completions.create({
                        model: this.deploymentName,
                        messages: this.conversation,
                        tools: tools.length > 0 ? tools : undefined,
                        tool_choice: tools.length > 0 ? 'auto' : undefined,
                        stream: true,
                    });
                    break; // Success, exit retry loop
                }
                catch (error) {
                    if (error?.status === 429 && retries < maxRetries - 1) {
                        const waitTime = Math.pow(2, retries) * 1000; // Exponential backoff: 1s, 2s, 4s
                        console.log(`⏳ Rate limited. Waiting ${waitTime / 1000}s before retry...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        retries++;
                    }
                    else {
                        throw error; // Re-throw if not rate limit or max retries reached
                    }
                }
            }
            if (!stream) {
                throw new Error('Failed to get stream after retries');
            }
            let fullResponse = '';
            let toolCalls = [];
            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta;
                // Handle content
                if (delta?.content) {
                    fullResponse += delta.content;
                    yield delta.content;
                }
                // Collect tool calls
                if (delta?.tool_calls) {
                    for (const toolCall of delta.tool_calls) {
                        if (!toolCalls[toolCall.index]) {
                            toolCalls[toolCall.index] = {
                                id: toolCall.id || '',
                                function: {
                                    name: toolCall.function?.name || '',
                                    arguments: ''
                                }
                            };
                        }
                        if (toolCall.function?.arguments) {
                            toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
                        }
                    }
                }
            }
            // Execute any tool calls
            if (toolCalls.length > 0) {
                yield '\n\n🔧 Executing tools...\n';
                for (const toolCall of toolCalls) {
                    if (toolCall && toolCall.function.name) {
                        const args = JSON.parse(toolCall.function.arguments);
                        const result = await this.executeToolCall(toolCall.function.name, args);
                        yield `\n✅ ${toolCall.function.name}: ${result.substring(0, 100)}...\n`;
                    }
                }
            }
            // Add to conversation history
            if (fullResponse) {
                this.conversation.push({ role: 'assistant', content: fullResponse });
            }
        }
        catch (error) {
            console.error('Stream error:', error);
            yield `\n❌ Error: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
    getModel() {
        return this.model;
    }
}
//# sourceMappingURL=azureOpenAIWithTools.js.map