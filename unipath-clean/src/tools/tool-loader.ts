/**
 * Tool Loader Service
 * Auto-discovers and loads all tools dynamically
 */

import { Tool } from './base.js';
import { globalRegistry } from './registry.js';

// Import all tool classes
import { BashTool } from './bash.js';
import { FileTool } from './file.js';
import { WebTool } from './web.js';
import { EditTool } from './edit.js';
import { GrepTool } from './grep.js';
import { GitTool } from './git.js';
import { GlobTool } from './glob.js';
import { LsTool } from './ls.js';
import { ReadFileTool } from './read-file.js';
import { WriteFileTool } from './write-file.js';
import { RipGrepTool } from './rip-grep.js';
import { SmartEditTool } from './smart-edit.js';
import { MemoryTool } from './memory.js';

/**
 * Tool Loader Service
 * Responsible for discovering and loading all available tools
 */
export class ToolLoader {
  private static instance: ToolLoader;
  private loaded = false;
  
  // Tool class registry - could be dynamically discovered in future
  private toolClasses: Array<new () => Tool> = [
    BashTool,
    FileTool,
    WebTool,
    EditTool,
    GrepTool,
    GitTool,
    GlobTool,
    LsTool,
    ReadFileTool,
    WriteFileTool,
    RipGrepTool,
    SmartEditTool,
    MemoryTool
  ];
  
  private constructor() {}
  
  static getInstance(): ToolLoader {
    if (!ToolLoader.instance) {
      ToolLoader.instance = new ToolLoader();
    }
    return ToolLoader.instance;
  }
  
  /**
   * Load all available tools into the registry
   */
  async loadTools(): Promise<void> {
    if (this.loaded) {
      console.log('⚠️ Tools already loaded');
      return;
    }
    
    console.log('🔧 Loading tools...');
    
    for (const ToolClass of this.toolClasses) {
      try {
        const tool = new ToolClass();
        globalRegistry.register(tool);
        console.log(`  ✅ Loaded: ${tool.name}`);
      } catch (error) {
        console.error(`  ❌ Failed to load tool: ${ToolClass.name}`, error);
      }
    }
    
    this.loaded = true;
    console.log(`🎉 Loaded ${globalRegistry.list().length} tools successfully`);
  }
  
  /**
   * Future: Auto-discover tools from filesystem
   */
  async autoDiscoverTools(): Promise<void> {
    // TODO: Scan tools directory and dynamically import all tool files
    // This would make it truly dynamic without manual imports
    console.log('🔍 Auto-discovery not yet implemented, using static list');
    await this.loadTools();
  }
}

// Export singleton instance
export const toolLoader = ToolLoader.getInstance();