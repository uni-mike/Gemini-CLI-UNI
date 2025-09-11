/**
 * Central Tools Registry
 * Auto-registers all available tools
 */

import { globalRegistry } from './registry.js';
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
 * Initialize and register all tools
 * This is the SINGLE source of truth for tool registration
 */
export function registerAllTools(): void {
  // Core tools
  globalRegistry.register(new BashTool());
  globalRegistry.register(new FileTool());
  globalRegistry.register(new WebTool());
  globalRegistry.register(new EditTool());
  
  // Search tools
  globalRegistry.register(new GrepTool());
  globalRegistry.register(new RipGrepTool());
  globalRegistry.register(new GlobTool());
  
  // File system tools
  globalRegistry.register(new LsTool());
  globalRegistry.register(new ReadFileTool());
  globalRegistry.register(new WriteFileTool());
  globalRegistry.register(new SmartEditTool());
  
  // Version control
  globalRegistry.register(new GitTool());
  
  // Advanced tools
  globalRegistry.register(new MemoryTool());
  
  console.log(`✅ Registered ${globalRegistry.list().length} tools`);
}

// Export registry for external access
export { globalRegistry };