/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import OpenAI from 'openai';
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

export class AzureOpenAIClient {
  private client: OpenAI;
  private deploymentName: string;
  private model: string;

  constructor(config: Config) {
    const apiKey = process.env['AZURE_API_KEY'];
    const endpoint = process.env['AZURE_ENDPOINT_URL'];
    const apiVersion = process.env['AZURE_OPENAI_API_VERSION'] || '2024-12-01-preview';
    const deployment = process.env['AZURE_DEPLOYMENT'];
    
    if (!apiKey || !endpoint || !deployment) {
      throw new Error('Azure OpenAI configuration missing: AZURE_API_KEY, AZURE_ENDPOINT_URL, and AZURE_DEPLOYMENT are required');
    }

    // Check if this is an Azure AI Models endpoint (models.ai.azure.com or services.ai.azure.com)
    const isAzureAIModels = endpoint.includes('models.ai.azure.com') || endpoint.includes('services.ai.azure.com');
    
    // Different URL format for Azure AI Models vs Azure OpenAI
    const baseURL = isAzureAIModels 
      ? endpoint.endsWith('/models') ? endpoint : `${endpoint}/models`  // Azure AI services uses /models path
      : `${endpoint}/openai/deployments/${deployment}`;  // Azure OpenAI format
    
    this.client = new OpenAI({
      apiKey,
      baseURL,
      defaultQuery: isAzureAIModels ? {} : { 'api-version': apiVersion },
      defaultHeaders: isAzureAIModels ? {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      } : {},
    });
    
    this.deploymentName = deployment;
    this.model = process.env['AZURE_MODEL'] || 'gpt-5';
  }

  async sendMessage(messages: OpenAIMessage[]): Promise<OpenAIChatResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.deploymentName,
        messages,
        stream: false,
      });

      const message = response.choices[0]?.message?.content || '';
      
      return {
        message,
        usage: response.usage ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens,
        } : undefined,
        model: this.model,
      };
    } catch (error) {
      console.error('Azure OpenAI API error:', error);
      throw error;
    }
  }

  async *sendMessageStream(messages: OpenAIMessage[]): AsyncGenerator<string> {
    try {
      const stream = await this.client.chat.completions.create({
        model: this.deploymentName,
        messages,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      console.error('Azure OpenAI streaming error:', error);
      throw error;
    }
  }

  getModel(): string {
    return this.model;
  }
}