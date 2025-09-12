/**
 * Streaming Support for LLM Responses
 */

import { EventEmitter } from 'events';

export interface StreamChunk {
  content?: string;
  tool_calls?: any[];
  finish_reason?: string;
}

export class StreamProcessor extends EventEmitter {
  private buffer: string = '';
  
  processChunk(chunk: string): void {
    this.buffer += chunk;
    
    // Process complete lines
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim().startsWith('data: ')) {
        const data = line.substring(6).trim();
        
        if (data === '[DONE]') {
          this.emit('done');
          continue;
        }
        
        try {
          const parsed = JSON.parse(data);
          this.processStreamData(parsed);
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }
  
  private processStreamData(data: any): void {
    const choices = data.choices || [];
    
    for (const choice of choices) {
      const delta = choice.delta || {};
      
      if (delta.content) {
        this.emit('content', delta.content);
      }
      
      if (delta.tool_calls) {
        this.emit('tool_calls', delta.tool_calls);
      }
      
      if (choice.finish_reason) {
        this.emit('finish', choice.finish_reason);
      }
    }
  }
  
  reset(): void {
    this.buffer = '';
  }
}