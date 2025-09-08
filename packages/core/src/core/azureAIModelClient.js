/**
 * Azure AI Model Client for DeepSeek and other Azure AI models
 * Uses Azure AI Inference API format
 */
export class AzureAIModelClient {
    endpoint;
    apiKey;
    model;
    apiVersion;
    constructor() {
        this.apiKey = process.env['AZURE_API_KEY'] || process.env['API_KEY'] || '';
        this.endpoint = process.env['AZURE_ENDPOINT_URL'] || process.env['ENDPOINT'] || '';
        this.model = process.env['AZURE_MODEL'] || process.env['MODEL'] || 'DeepSeek-R1-rkcob';
        this.apiVersion = process.env['AZURE_OPENAI_API_VERSION'] || process.env['API_VERSION'] || '2025-05-01-preview';
        if (!this.apiKey || !this.endpoint) {
            throw new Error('Azure AI Model configuration missing: API_KEY and ENDPOINT are required');
        }
    }
    async sendMessage(message) {
        try {
            // Azure AI Inference API endpoint format
            const url = `${this.endpoint}/chat/completions?api-version=${this.apiVersion}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: 'You are a helpful assistant.' },
                        { role: 'user', content: message }
                    ],
                    model: this.model,
                    temperature: 0.7,
                    // No token limit - let the model use its full context
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Azure AI Model error: ${response.status} ${response.statusText}`, errorText);
                throw new Error(`Azure AI Model error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            return data.choices?.[0]?.message?.content || 'No response from model';
        }
        catch (error) {
            console.error('Azure AI Model request failed:', error);
            throw error;
        }
    }
    async *sendMessageStream(message) {
        try {
            const url = `${this.endpoint}/chat/completions?api-version=${this.apiVersion}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: 'You are a helpful assistant.' },
                        { role: 'user', content: message }
                    ],
                    max_tokens: 2048,
                    model: this.model,
                    temperature: 0.7,
                    stream: true,
                }),
            });
            if (!response.ok) {
                throw new Error(`Azure AI Model stream error: ${response.status}`);
            }
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]')
                            continue;
                        try {
                            const json = JSON.parse(data);
                            const content = json.choices?.[0]?.delta?.content;
                            if (content) {
                                yield content;
                            }
                        }
                        catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error('Stream failed, falling back to regular message:', error);
            // Fallback to non-streaming if streaming fails
            const response = await this.sendMessage(message);
            yield response;
        }
    }
    getModel() {
        return this.model;
    }
}
//# sourceMappingURL=azureAIModelClient.js.map