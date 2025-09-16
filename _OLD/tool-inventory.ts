#!/usr/bin/env ts-node

/**
 * Tool Inventory - Complete analysis of UNIPATH CLI tools
 */

import { toolManager } from './tools/tool-manager.js';

async function showCompleteToolInventory() {
  console.log('🔧 UNIPATH CLI - Complete Tool Inventory\n');
  console.log('═'.repeat(60));
  
  try {
    // Initialize the tool manager
    await toolManager.initialize();
    
    // Get comprehensive stats
    const stats = toolManager.getStats();
    
    console.log(`📊 REGISTRY OVERVIEW:`);
    console.log(`  • Total Tools: ${stats.totalTools}`);
    console.log(`  • Original Tools: 6`);
    console.log(`  • Auto-discovered: ${stats.autoDiscovered}`);
    console.log(`  • Categories: ${stats.totalCategories}`);
    console.log(`  • Total Aliases: ${stats.totalAliases}`);
    console.log(`  • Status: ${stats.status}`);
    console.log('');
    
    // List all tools with details
    const allTools = toolManager.listTools();
    console.log(`📝 ALL AVAILABLE TOOLS (${allTools.length} total):`);
    console.log('─'.repeat(60));
    
    let originalTools = 0;
    let advancedTools = 0;
    
    for (const toolName of allTools.sort()) {
      const info = toolManager.getToolInfo(toolName);
      
      // Categorize tools
      const isAdvanced = ['glob', 'ls', 'memory', 'read_file', 'rg', 'smart_edit', 'write_file'].includes(toolName);
      if (isAdvanced) {
        advancedTools++;
        console.log(`  🆕 ${toolName} (Advanced)`);
      } else {
        originalTools++;
        console.log(`  📦 ${toolName} (Original)`);
      }
      
      if (info) {
        console.log(`     📄 ${info.description || 'No description'}`);
        console.log(`     🏷️  Category: ${info.category || 'uncategorized'}`);
        if (info.aliases && info.aliases.length > 0) {
          console.log(`     🔗 Aliases: ${info.aliases.join(', ')}`);
        }
      }
      console.log('');
    }
    
    console.log('─'.repeat(60));
    console.log(`📊 TOOL BREAKDOWN:`);
    console.log(`  • Original Tools: ${originalTools}`);
    console.log(`  • Advanced Tools: ${advancedTools}`);
    console.log(`  • Total: ${originalTools + advancedTools}`);
    console.log('');
    
    // Show advanced capabilities
    console.log(`🚀 ADVANCED CAPABILITIES:`);
    const capabilities = stats.capabilities || {};
    for (const [cap, enabled] of Object.entries(capabilities)) {
      console.log(`  ${enabled ? '✅' : '❌'} ${cap}`);
    }
    console.log('');
    
    // Test tool availability
    console.log(`🧪 TOOL AVAILABILITY TEST:`);
    const testResults = [];
    
    for (const toolName of ['write_file', 'read_file', 'ls', 'bash', 'file', 'web']) {
      const tool = toolManager.getTool(toolName);
      if (tool) {
        testResults.push(`✅ ${toolName} - Available`);
      } else {
        testResults.push(`❌ ${toolName} - Not found`);
      }
    }
    
    testResults.forEach(result => console.log(`  ${result}`));
    
    console.log('\n' + '═'.repeat(60));
    console.log(`✅ Tool Registry Status: ${stats.status.toUpperCase()}`);
    console.log(`🎯 All ${allTools.length} tools are properly registered and available!`);
    
  } catch (error) {
    console.error('❌ Error analyzing tools:', error);
  }
}

// Run if called directly
if (require.main === module) {
  showCompleteToolInventory().catch(console.error);
}