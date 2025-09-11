#!/usr/bin/env node

/**
 * Tool Inventory Script - Shows all available tools in UNIPATH CLI
 */

import { toolManager } from './src/tools/tool-manager.js';

async function showToolInventory() {
  console.log('🔧 UNIPATH CLI Tool Inventory\n');
  
  // Initialize the tool manager
  await toolManager.initialize();
  
  // Get comprehensive stats
  const stats = toolManager.getStats();
  console.log(`📊 Registry Stats:`);
  console.log(`  • Total Tools: ${stats.totalTools}`);
  console.log(`  • Categories: ${stats.totalCategories}`);
  console.log(`  • Auto-discovered: ${stats.autoDiscovered}`);
  console.log(`  • Aliases: ${stats.totalAliases}`);
  console.log('');
  
  // List all tools
  const allTools = toolManager.listTools();
  console.log(`📝 All Available Tools (${allTools.length}):`);
  
  for (const toolName of allTools.sort()) {
    const info = toolManager.getToolInfo(toolName);
    if (info) {
      console.log(`  ✅ ${toolName}`);
      console.log(`     📝 ${info.description || 'No description'}`);
      console.log(`     🏷️  Category: ${info.category || 'uncategorized'}`);
      if (info.aliases && info.aliases.length > 0) {
        console.log(`     🔗 Aliases: ${info.aliases.join(', ')}`);
      }
      console.log('');
    } else {
      console.log(`  ❓ ${toolName} (no metadata)`);
    }
  }
  
  // Show tools by category
  console.log(`📂 Tools by Category:`);
  const categories = stats.categories || [];
  for (const category of categories.sort()) {
    const categoryTools = toolManager.getToolsByCategory(category);
    console.log(`  📁 ${category}: ${categoryTools.join(', ')}`);
  }
  console.log('');
  
  // Show capabilities
  console.log(`🚀 Advanced Capabilities:`);
  const capabilities = stats.capabilities || {};
  for (const [cap, enabled] of Object.entries(capabilities)) {
    console.log(`  ${enabled ? '✅' : '❌'} ${cap}`);
  }
}

showToolInventory().catch(console.error);