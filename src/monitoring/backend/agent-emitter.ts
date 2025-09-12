/**
 * Minimal Agent Event Emitter
 * Single integration point for all agent modules to emit monitoring events
 * Completely decoupled - monitoring server can listen or not
 */

import { EventEmitter } from 'events';

class AgentEmitter extends EventEmitter {
  private enabled: boolean = true;
  private eventQueue: any[] = [];
  private maxQueueSize: number = 1000;
  
  /**
   * Emit a monitoring event (fire and forget)
   * Agent modules don't need to know if anyone is listening
   */
  emit(event: string, data?: any): boolean {
    if (!this.enabled) return false;
    
    // Add timestamp if not present
    const eventData = {
      ...data,
      timestamp: data?.timestamp || new Date(),
      event
    };
    
    // Queue events in case no listener yet
    this.eventQueue.push(eventData);
    if (this.eventQueue.length > this.maxQueueSize) {
      this.eventQueue.shift();
    }
    
    // Emit to any listeners (monitoring system or not)
    return super.emit(event, eventData);
  }
  
  /**
   * Get queued events (for late subscribers)
   */
  getQueuedEvents(): any[] {
    return [...this.eventQueue];
  }
  
  /**
   * Clear event queue
   */
  clearQueue(): void {
    this.eventQueue = [];
  }
  
  /**
   * Enable/disable emissions
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

// Global singleton instance
export const agentEmitter = new AgentEmitter();

/**
 * Convenience methods for common emissions
 */
export const AgentEvents = {
  // Token events
  tokenUsage: (data: any) => agentEmitter.emit('token:usage', data),
  tokenOverflow: (data: any) => agentEmitter.emit('token:overflow', data),
  
  // Pipeline events  
  pipelineStart: (stage: string, data?: any) => agentEmitter.emit('pipeline:start', { stage, ...data }),
  pipelineComplete: (stage: string, data?: any) => agentEmitter.emit('pipeline:complete', { stage, ...data }),
  pipelineError: (stage: string, error: any) => agentEmitter.emit('pipeline:error', { stage, error }),
  
  // Tool events
  toolStart: (tool: string, input?: any) => agentEmitter.emit('tool:start', { tool, input }),
  toolComplete: (tool: string, output?: any) => agentEmitter.emit('tool:complete', { tool, output }),
  toolError: (tool: string, error: any) => agentEmitter.emit('tool:error', { tool, error }),
  
  // Memory events
  memoryUpdate: (layer: string, data: any) => agentEmitter.emit('memory:update', { layer, ...data }),
  memoryRetrieval: (data: any) => agentEmitter.emit('memory:retrieval', data),
  
  // Session events
  sessionStart: (id: string, mode: string) => agentEmitter.emit('session:start', { id, mode }),
  sessionSnapshot: (id: string) => agentEmitter.emit('session:snapshot', { id }),
  sessionEnd: (id: string) => agentEmitter.emit('session:end', { id }),
  
  // LLM events
  llmRequest: (model: string, tokens: number) => agentEmitter.emit('llm:request', { model, tokens }),
  llmResponse: (model: string, tokens: number) => agentEmitter.emit('llm:response', { model, tokens }),
  
  // Generic event
  custom: (name: string, data: any) => agentEmitter.emit(`custom:${name}`, data)
};