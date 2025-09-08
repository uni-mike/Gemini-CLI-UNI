/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import OpenAI from 'openai';
export class AzureOpenAIClient {
    client;
    deploymentName;
    model;
    constructor(config) {
        const apiKey = process.env['AZURE_API_KEY'];
        const endpoint = process.env['AZURE_ENDPOINT_URL'];
        const apiVersion = process.env['AZURE_OPENAI_API_VERSION'] || '2025-12-01-preview';
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
        this.model = process.env['AZURE_MODEL'] || 'gpt-5';
    }
    async sendMessage(messages) {
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
        }
        catch (error) {
            console.error('Azure OpenAI API error:', error);
            throw error;
        }
    }
    async *sendMessageStream(messages) {
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
        }
        catch (error) {
            console.error('Azure OpenAI streaming error:', error);
            throw error;
        }
    }
    getModel() {
        return this.model;
    }
}
//# sourceMappingURL=azureOpenAIClient.js.map