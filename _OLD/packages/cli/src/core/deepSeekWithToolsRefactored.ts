/**
 * Bridge between old system and new refactored DeepSeek client
 * This replaces the monolithic deepSeekWithTools.ts
 */

import type { Config } from '../config/core-config.js';
import { DeepSeekClient } from '../ai-clients/deepseek/index.js';

/**
 * DeepSeekWithTools - now using the refactored modular architecture
 * This maintains API compatibility while using the new clean modules
 */
export class DeepSeekWithTools {
  private client: DeepSeekClient;

  constructor(config: Config) {
    this.client = new DeepSeekClient(config);
  }

  /**
   * Set confirmation callback for approval prompts
   */
  setConfirmationCallback(callback: (details: any) => Promise<boolean>) {
    this.client.setConfirmationCallback(callback);
  }

  /**
   * Set progress callback for real-time updates
   */
  setProgressCallback(callback: (message: string) => void) {
    this.client.setProgressCallback(callback);
  }

  /**
   * Send message and stream response
   * Compatible with the old API but using new architecture
   */
  async *sendMessageStreamWithTools(message: string): AsyncGenerator<string> {
    // Simply delegate to the new client
    yield* this.client.sendMessageStream(message);
  }

  /**
   * Send message and get full response (non-streaming)
   * For backward compatibility
   */
  async sendMessageWithTools(message: string): Promise<string> {
    const chunks: string[] = [];
    for await (const chunk of this.sendMessageStreamWithTools(message)) {
      chunks.push(chunk);
    }
    return chunks.join('');
  }

  /**
   * Execute a tool directly (for orchestration)
   */
  async executeToolDirectly(toolName: string, args: any): Promise<any> {
    // Get the tool executor from the client
    const executor = (this.client as any).executor;
    if (!executor) {
      throw new Error('Tool executor not available');
    }
    
    // Execute the tool
    const result = await executor.execute({
      name: toolName,
      arguments: args
    });
    
    return result;
  }

  /**
   * Get the tool executor (for orchestration integration)
   */
  getToolExecutor(): any {
    return (this.client as any).executor;
  }

  /**
   * Get the DeepSeek client (for AI model access)
   */
  getClient(): any {
    return this.client;
  }

  /**
   * Get model name
   */
  getModel(): string {
    return this.client.getModel();
  }
}

/**
 * Export for backward compatibility
 */
export default DeepSeekWithTools;