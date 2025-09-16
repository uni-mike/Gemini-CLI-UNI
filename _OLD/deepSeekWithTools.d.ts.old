/**
 * DeepSeek R1 client with tool/function calling support
 * Bridges Gemini tools to DeepSeek's function calling
 */
import type { Config } from '../config/config.js';
export declare class DeepSeekWithTools {
    private endpoint;
    private apiKey;
    private model;
    private apiVersion;
    private toolRegistry;
    private conversation;
    constructor(config: Config);
    /**
     * Convert Gemini tool to DeepSeek function schema
     */
    private convertToolToFunction;
    /**
     * Get all available tools as DeepSeek functions
     */
    private getAvailableFunctions;
    /**
     * Execute a tool directly
     */
    private executeToolDirectly;
    /**
     * Send a message with tool support - Enhanced for complex sequences
     */
    sendMessageWithTools(message: string, maxIterations?: number): Promise<string>;
    /**
     * Stream messages with tool support
     */
    sendMessageStreamWithTools(message: string): AsyncGenerator<string>;
    getModel(): string;
}
