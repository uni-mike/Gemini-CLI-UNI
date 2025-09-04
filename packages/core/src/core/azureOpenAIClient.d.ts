/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Config } from '../config/config.js';
export interface OpenAIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
export interface OpenAIChatResponse {
    message: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    model: string;
}
export declare class AzureOpenAIClient {
    private client;
    private deploymentName;
    private model;
    constructor(config: Config);
    sendMessage(messages: OpenAIMessage[]): Promise<OpenAIChatResponse>;
    sendMessageStream(messages: OpenAIMessage[]): AsyncGenerator<string>;
    getModel(): string;
}
