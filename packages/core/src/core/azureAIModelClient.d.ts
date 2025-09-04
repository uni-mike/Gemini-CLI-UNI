/**
 * Azure AI Model Client for DeepSeek and other Azure AI models
 * Uses Azure AI Inference API format
 */
export declare class AzureAIModelClient {
    private endpoint;
    private apiKey;
    private model;
    private apiVersion;
    constructor();
    sendMessage(message: string): Promise<string>;
    sendMessageStream(message: string): AsyncGenerator<string>;
    getModel(): string;
}
