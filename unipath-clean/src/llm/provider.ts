/**
 * LLM Provider Interface
 * Simple abstraction for different LLM providers
 */

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMProvider {
  name: string;
  generateResponse(messages: Message[]): Promise<string>;
}

export class DeepSeekProvider implements LLMProvider {
  name = 'deepseek';
  
  async generateResponse(messages: Message[]): Promise<string> {
    // Simplified - would connect to actual DeepSeek API
    const lastMessage = messages[messages.length - 1];
    return `DeepSeek processing: ${lastMessage.content}`;
  }
}