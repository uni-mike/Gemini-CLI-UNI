/**
 * Advanced Tool Registry with Dynamic Discovery
 * Like the OLD registry but cleaner and more intelligent
 */

import { Tool, ToolResult } from './base';
import { EventEmitter } from 'events';
import { readdir } from 'fs/promises';
import { join } from 'path';

export interface ToolMetadata {
  name: string;
  description: string;
  category: string;
  parameters: Record<string, any>;
  examples: string[];
  capabilities: string[];
  aliases: string[];
}

export class AdvancedToolRegistry extends EventEmitter {
  private tools: Map<string, Tool> = new Map();
  private metadata: Map<string, ToolMetadata> = new Map();
  private categories: Map<string, Set<string>> = new Map();
  private aliases: Map<string, string> = new Map(); // alias -> tool name
  
  async initialize(): Promise<void> {
    console.log('🔧 Initializing Advanced Tool Registry...');
    
    // Register built-in tools first
    await this.registerBuiltInTools();
    
    // Auto-discover tools
    const discovered = await this.autoDiscover();
    
    console.log(`📊 Tool Registry Stats:`);
    console.log(`  • Total tools: ${this.tools.size}`);
    console.log(`  • Categories: ${this.getCategories().length}`);
    console.log(`  • Auto-discovered: ${discovered}`);
    
    this.emit('registry-initialized', this.getStats());
  }
  
  private async registerBuiltInTools(): Promise<void> {
    // Import and register all our tools
    try {
      const { BashTool } = await import('./bash');
      const { FileTool } = await import('./file');
      const { EditTool } = await import('./edit');
      const { GrepTool } = await import('./grep');
      const { WebTool } = await import('./web');
      const { GitTool } = await import('./git');
      
      this.registerTool(new BashTool(), {
        category: 'system',
        capabilities: ['execute', 'command', 'shell', 'run'],
        aliases: ['sh', 'cmd', 'exec']
      });
      
      this.registerTool(new FileTool(), {
        category: 'file_system',
        capabilities: ['read', 'write', 'file', 'content'],
        aliases: ['f', 'file_ops']
      });
      
      this.registerTool(new EditTool(), {
        category: 'editing',
        capabilities: ['modify', 'change', 'replace', 'edit'],
        aliases: ['modify', 'change']
      });
      
      this.registerTool(new GrepTool(), {
        category: 'search',
        capabilities: ['search', 'pattern', 'text', 'find'],
        aliases: ['search', 'find']
      });
      
      this.registerTool(new WebTool(), {
        category: 'network',
        capabilities: ['http', 'fetch', 'web', 'search', 'download'],
        aliases: ['fetch', 'curl', 'wget']
      });
      
      this.registerTool(new GitTool(), {
        category: 'version_control',
        capabilities: ['git', 'version', 'commit', 'branch', 'repository'],
        aliases: ['version_control', 'vcs']
      });
      
    } catch (error) {
      console.warn('Failed to load some built-in tools:', error);
    }
  }
  
  private async autoDiscover(): Promise<number> {
    try {
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      
      // Get current directory in ESM compatible way
      const currentFile = fileURLToPath(import.meta.url);
      const toolsDir = path.dirname(currentFile);
      
      const files = await readdir(toolsDir);
      const toolFiles = files.filter(f => 
        f.endsWith('.ts') && 
        !['base.ts', 'registry.ts', 'advanced-registry.ts'].includes(f)
      );
      
      let discovered = 0;
      
      for (const file of toolFiles) {
        try {
          const moduleName = file.replace('.ts', '');
          const module = await import(`./${moduleName}`);
          
          // Look for Tool classes (should end with 'Tool')
          for (const exportName of Object.keys(module)) {
            if (exportName.endsWith('Tool') && typeof module[exportName] === 'function') {
              try {
                const toolInstance = new module[exportName]();
                if (toolInstance instanceof Tool && !this.tools.has(toolInstance.name)) {
                  this.registerTool(toolInstance, {
                    category: this.inferCategory(toolInstance.name),
                    capabilities: this.inferCapabilities(toolInstance.name)
                  });
                  discovered++;
                  console.log(`  🔍 Auto-discovered: ${toolInstance.name}`);
                }
              } catch (error) {
                console.warn(`Failed to instantiate ${exportName}:`, error);
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to load ${file}:`, error);
        }
      }
      
      return discovered;
    } catch (error) {
      console.warn('Auto-discovery failed:', error);
      return 0;
    }
  }
  
  registerTool(tool: Tool, metadata?: Partial<ToolMetadata>): void {
    this.tools.set(tool.name, tool);
    
    // Create complete metadata
    const toolMeta: ToolMetadata = {
      name: tool.name,
      description: tool.description,
      category: metadata?.category || this.inferCategory(tool.name),
      parameters: metadata?.parameters || this.inferParameters(tool),
      examples: metadata?.examples || [],
      capabilities: metadata?.capabilities || this.inferCapabilities(tool.name),
      aliases: metadata?.aliases || []
    };
    
    this.metadata.set(tool.name, toolMeta);
    
    // Update categories
    const category = toolMeta.category;
    if (!this.categories.has(category)) {
      this.categories.set(category, new Set());
    }
    this.categories.get(category)!.add(tool.name);
    
    // Register aliases
    for (const alias of toolMeta.aliases) {
      this.aliases.set(alias, tool.name);
    }
    
    this.emit('tool-registered', { tool: tool.name, category, aliases: toolMeta.aliases });
  }
  
  get(name: string): Tool | undefined {
    // Check direct name first
    if (this.tools.has(name)) {
      return this.tools.get(name);
    }
    
    // Check aliases
    const actualName = this.aliases.get(name);
    if (actualName) {
      return this.tools.get(actualName);
    }
    
    return undefined;
  }
  
  list(): string[] {
    return Array.from(this.tools.keys());
  }
  
  getByCategory(category: string): string[] {
    return Array.from(this.categories.get(category) || []);
  }
  
  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }
  
  getMetadata(name: string): ToolMetadata | undefined {
    // Resolve alias if needed
    const actualName = this.aliases.get(name) || name;
    return this.metadata.get(actualName);
  }
  
  getAllMetadata(): ToolMetadata[] {
    return Array.from(this.metadata.values());
  }
  
  // AI-powered tool selection based on task description
  getRelevantTools(taskDescription: string, maxResults = 5): Array<{tool: string, score: number, reason: string}> {
    const task = taskDescription.toLowerCase();
    const scored: Array<{tool: string, score: number, reason: string}> = [];
    
    for (const [toolName, metadata] of this.metadata) {
      let score = 0;
      const reasons: string[] = [];
      
      // Exact tool name match (highest priority)
      if (task.includes(toolName)) {
        score += 20;
        reasons.push('tool name mentioned');
      }
      
      // Check aliases
      for (const alias of metadata.aliases) {
        if (task.includes(alias)) {
          score += 15;
          reasons.push(`alias "${alias}" mentioned`);
        }
      }
      
      // Check capabilities
      for (const capability of metadata.capabilities) {
        if (task.includes(capability)) {
          score += 10;
          reasons.push(`capability "${capability}"`);
        }
      }
      
      // Check description keywords
      const descWords = metadata.description.toLowerCase().split(/\s+/);
      for (const word of descWords) {
        if (word.length > 3 && task.includes(word)) {
          score += 5;
          reasons.push(`description keyword "${word}"`);
        }
      }
      
      // Category relevance
      if (task.includes(metadata.category.replace('_', ' '))) {
        score += 8;
        reasons.push(`category match`);
      }
      
      // Context-based scoring
      if (task.includes('create') || task.includes('write')) {
        if (metadata.capabilities.includes('write') || metadata.capabilities.includes('create')) {
          score += 12;
          reasons.push('creation task');
        }
      }
      
      if (task.includes('read') || task.includes('show') || task.includes('display')) {
        if (metadata.capabilities.includes('read') || metadata.capabilities.includes('list')) {
          score += 12;
          reasons.push('reading task');
        }
      }
      
      if (task.includes('search') || task.includes('find')) {
        if (metadata.capabilities.includes('search') || metadata.capabilities.includes('find')) {
          score += 15;
          reasons.push('search task');
        }
      }
      
      if (score > 0) {
        scored.push({
          tool: toolName,
          score,
          reason: reasons.join(', ')
        });
      }
    }
    
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }
  
  async execute(name: string, args: any): Promise<ToolResult> {
    const tool = this.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool '${name}' not found. Available: ${this.list().join(', ')}`
      };
    }
    
    this.emit('tool-start', { name: tool.name, args });
    
    try {
      const result = await tool.execute(args);
      this.emit('tool-complete', { name: tool.name, result });
      return result;
    } catch (error: any) {
      const errorResult = {
        success: false,
        error: `Tool execution failed: ${error.message}`
      };
      this.emit('tool-error', { name: tool.name, error: errorResult.error });
      return errorResult;
    }
  }
  
  private inferCategory(toolName: string): string {
    const categories: Record<string, string> = {
      'ls': 'file_system',
      'read_file': 'file_system', 
      'write_file': 'file_system',
      'glob': 'file_system',
      'file': 'file_system',
      'git': 'version_control',
      'bash': 'system',
      'shell': 'system',
      'web': 'network',
      'fetch': 'network',
      'grep': 'search',
      'rg': 'search',
      'edit': 'editing',
      'smart_edit': 'editing',
      'memory': 'data'
    };
    
    return categories[toolName] || 'general';
  }
  
  private inferParameters(tool: Tool): Record<string, any> {
    // Basic parameter inference - could be enhanced
    return {
      type: 'object',
      properties: {},
      required: []
    };
  }
  
  private inferCapabilities(toolName: string): string[] {
    const capabilities: Record<string, string[]> = {
      'ls': ['list', 'directory', 'files', 'browse'],
      'read_file': ['read', 'file', 'content', 'show'],
      'write_file': ['write', 'create', 'file', 'save'],
      'edit': ['modify', 'change', 'replace', 'edit'],
      'smart_edit': ['advanced_edit', 'pattern', 'insert', 'complex_edit'],
      'bash': ['execute', 'command', 'shell', 'run', 'system'],
      'git': ['version_control', 'commit', 'branch', 'repository', 'vcs'],
      'grep': ['search', 'pattern', 'text', 'find'],
      'rg': ['fast_search', 'regex', 'text', 'ripgrep'],
      'web': ['http', 'fetch', 'search', 'download', 'internet'],
      'glob': ['pattern_match', 'find', 'files', 'wildcard'],
      'memory': ['store', 'remember', 'persist', 'data', 'context']
    };
    
    return capabilities[toolName] || ['general'];
  }
  
  getStats(): any {
    return {
      totalTools: this.tools.size,
      totalAliases: this.aliases.size,
      categories: this.getCategories().map(cat => ({
        name: cat,
        count: this.getByCategory(cat).length,
        tools: this.getByCategory(cat)
      })),
      mostCapableTools: this.getAllMetadata()
        .sort((a, b) => b.capabilities.length - a.capabilities.length)
        .slice(0, 5)
        .map(m => ({ name: m.name, capabilities: m.capabilities.length }))
    };
  }
  
  // Generate tool schema for LLMs
  generateToolSchemas(): any[] {
    return this.getAllMetadata().map(meta => ({
      name: meta.name,
      description: `${meta.description} (Category: ${meta.category})`,
      parameters: {
        type: 'object',
        properties: this.generateParameterSchema(meta.name),
        required: this.getRequiredParameters(meta.name)
      }
    }));
  }
  
  private generateParameterSchema(toolName: string): Record<string, any> {
    // Tool-specific parameter schemas
    const schemas: Record<string, Record<string, any>> = {
      bash: {
        command: { type: 'string', description: 'Shell command to execute' }
      },
      file: {
        action: { type: 'string', enum: ['read', 'write'], description: 'File operation' },
        path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'Content to write (for write action)' }
      },
      edit: {
        path: { type: 'string', description: 'File to edit' },
        oldText: { type: 'string', description: 'Text to replace' },
        newText: { type: 'string', description: 'Replacement text' }
      },
      grep: {
        pattern: { type: 'string', description: 'Search pattern' },
        path: { type: 'string', description: 'Path to search' }
      },
      web: {
        action: { type: 'string', enum: ['search', 'fetch'], description: 'Web operation' },
        query: { type: 'string', description: 'Search query or URL' }
      },
      git: {
        action: { type: 'string', description: 'Git command (status, add, commit, etc.)' },
        message: { type: 'string', description: 'Commit message (optional)' }
      }
    };
    
    return schemas[toolName] || {};
  }
  
  private getRequiredParameters(toolName: string): string[] {
    const required: Record<string, string[]> = {
      bash: ['command'],
      file: ['action', 'path'],
      edit: ['path', 'oldText', 'newText'],
      grep: ['pattern'],
      web: ['action'],
      git: ['action']
    };
    
    return required[toolName] || [];
  }
}