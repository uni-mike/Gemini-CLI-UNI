/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Config } from '../config/config.js';
/**
 * Azure OpenAI client with full tool/function calling support
 * This bridges Gemini tools to OpenAI function calling
 */
export declare class AzureOpenAIWithTools {
    private client;
    private deploymentName;
    private model;
    private toolRegistry;
    private conversation;
    constructor(config: Config);
    /**
     * Convert Gemini tool to OpenAI function schema
     */
    private convertToolToFunction;
    /**
     * Get all available tools as OpenAI functions
     */
    private getAvailableTools;
    /**
     * Execute a tool call and return the result
     */
    private executeToolCall;
    /**
     * Execute a tool directly without creating an invocation
     */
    private executeToolDirectly;
    /**
     * Convert OpenAI function arguments to Gemini tool parameters
     */
    private convertFunctionArgsToToolParams;
    /**
     * Send a message with tool support
     */
    sendMessageWithTools(message: string): Promise<string>;
    /**
     * Stream messages with tool support
     */
    sendMessageStreamWithTools(message: string): AsyncGenerator<string>;
    getModel(): string;
}
