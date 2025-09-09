/**
 * Tool Manager - Centralized tool management for the Trio
 * Integrates advanced registry with dynamic discovery and AI-powered selection
 */

import { AdvancedToolRegistry } from './advanced-registry';
import { EventEmitter } from 'events';

export class ToolManager extends EventEmitter {
  private registry: AdvancedToolRegistry;
  private isInitialized = false;
  
  constructor() {
    super();
    this.registry = new AdvancedToolRegistry();
    
    // Forward registry events
    this.registry.on('tool-registered', (data) => this.emit('tool-registered', data));
    this.registry.on('tool-start', (data) => this.emit('tool-start', data));
    this.registry.on('tool-complete', (data) => this.emit('tool-complete', data));
    this.registry.on('tool-error', (data) => this.emit('tool-error', data));
  }
  
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('🚀 Initializing Tool Manager...');
    await this.registry.initialize();
    this.isInitialized = true;
    
    this.emit('manager-ready', this.getStats());
  }
  
  // Planner Integration - Get tools for a task
  getToolsForTask(description: string, maxTools = 5): Array<{tool: string, score: number, reason: string}> {
    this.ensureInitialized();
    return this.registry.getRelevantTools(description, maxTools);
  }
  
  // Executor Integration - Execute tools
  async executeTool(name: string, args: any): Promise<any> {
    this.ensureInitialized();
    return await this.registry.execute(name, args);
  }
  
  // Get tool by name or alias
  getTool(name: string): any {
    this.ensureInitialized();
    return this.registry.get(name);
  }
  
  // Get all available tools
  listTools(): string[] {
    this.ensureInitialized();
    return this.registry.list();
  }
  
  // Get tools by category
  getToolsByCategory(category: string): string[] {
    this.ensureInitialized();
    return this.registry.getByCategory(category);
  }
  
  // Get tool metadata
  getToolInfo(name: string): any {
    this.ensureInitialized();
    return this.registry.getMetadata(name);
  }
  
  // Generate LLM schemas
  generateToolSchemas(): any[] {
    this.ensureInitialized();
    return this.registry.generateToolSchemas();
  }
  
  // Get comprehensive stats
  getStats(): any {
    if (!this.isInitialized) {
      return { status: 'not_initialized' };
    }
    
    return {
      status: 'ready',
      ...this.registry.getStats(),
      capabilities: {
        dynamicDiscovery: true,
        aiPoweredSelection: true,
        aliasSupport: true,
        categoryOrganization: true
      }
    };
  }
  
  // Search tools
  searchTools(query: string): any[] {
    this.ensureInitialized();
    const relevant = this.registry.getRelevantTools(query, 10);
    return relevant.map(r => ({
      name: r.tool,
      relevance: r.score,
      reason: r.reason,
      metadata: this.registry.getMetadata(r.tool)
    }));
  }
  
  // Tool recommendation for Planner
  recommendTools(taskType: string, context?: any): string[] {
    this.ensureInitialized();
    
    const recommendations = this.registry.getRelevantTools(taskType, 5);
    
    // Context-aware filtering
    if (context?.previousTools) {
      // Prefer different tools if we just used some
      const recentTools = new Set(context.previousTools);
      const filtered = recommendations.filter(r => !recentTools.has(r.tool));
      if (filtered.length > 0) {
        return filtered.map(r => r.tool);
      }
    }
    
    return recommendations.map(r => r.tool);
  }
  
  // Validate tool parameters
  validateParameters(toolName: string, params: any): { valid: boolean; errors?: string[] } {
    this.ensureInitialized();
    
    const tool = this.registry.get(toolName);
    if (!tool) {
      return { valid: false, errors: [`Tool ${toolName} not found`] };
    }
    
    // Basic validation - could be enhanced
    return { valid: true };
  }
  
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('ToolManager not initialized. Call initialize() first.');
    }
  }
}

// Global instance
export const toolManager = new ToolManager();

// Legacy compatibility
export const advancedRegistry = new AdvancedToolRegistry();