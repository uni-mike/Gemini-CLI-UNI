/**
 * Auto-Discovery Service
 * Dynamically discovers and loads all tools from the filesystem
 */

import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Tool } from './base.js';
import { globalRegistry } from './registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ToolAutoDiscovery {
  private static instance: ToolAutoDiscovery;
  private loaded = false;
  
  // Files to exclude from tool discovery
  private excludeFiles = [
    'base.ts',
    'base.js',
    'registry.ts', 
    'registry.js',
    'index.ts',
    'index.js',
    'tool-loader.ts',
    'tool-loader.js',
    'tool-manager.ts',
    'tool-manager.js',
    'advanced-registry.ts',
    'advanced-registry.js',
    'auto-discovery.ts',
    'auto-discovery.js'
  ];
  
  private constructor() {}
  
  static getInstance(): ToolAutoDiscovery {
    if (!ToolAutoDiscovery.instance) {
      ToolAutoDiscovery.instance = new ToolAutoDiscovery();
    }
    return ToolAutoDiscovery.instance;
  }
  
  /**
   * Dynamically discover and load all tools from the tools directory
   */
  async discoverAndLoadTools(): Promise<void> {
    if (this.loaded) {
      console.log('⚠️ Tools already loaded');
      return;
    }
    
    // Silent auto-discovery
    
    try {
      // Read all files in the tools directory
      const files = readdirSync(__dirname);
      const toolFiles = files.filter(file => {
        return (file.endsWith('.js') || file.endsWith('.ts')) && 
               !this.excludeFiles.includes(file);
      });
      
      // Dynamically import each tool file
      let loadedCount = 0;
      for (const file of toolFiles) {
        try {
          const modulePath = join(__dirname, file);
          const module = await import(modulePath);
          
          // Find the Tool class in the module
          for (const exportName in module) {
            const ExportedClass = module[exportName];
            
            // Check if it's a Tool class
            if (this.isToolClass(ExportedClass)) {
              try {
                const toolInstance = new ExportedClass();
                globalRegistry.register(toolInstance);
                loadedCount++;
              } catch (err) {
                // Silently skip non-instantiable exports
              }
            }
          }
        } catch (error) {
          // Silently skip files that fail to import
        }
      }
      
      this.loaded = true;
      const toolCount = globalRegistry.list().length;
      console.log(`✅ Loaded ${toolCount} tools`);
      
    } catch (error) {
      console.error('❌ Tool discovery failed:', error);
      throw error;
    }
  }
  
  /**
   * Check if a class is a Tool subclass
   */
  private isToolClass(cls: any): boolean {
    if (!cls || typeof cls !== 'function') return false;
    
    // Check if it has a prototype and extends Tool
    try {
      const instance = Object.create(cls.prototype);
      return instance instanceof Tool || 
             (instance.execute && instance.name && instance.description);
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const toolDiscovery = ToolAutoDiscovery.getInstance();