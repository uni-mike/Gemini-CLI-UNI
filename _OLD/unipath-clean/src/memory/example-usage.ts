/**
 * Example usage of the FlexiCLI Memory Management System
 */

import { MemoryManager } from './memory-manager.js';
import { OperatingMode } from './constants.js';

async function exampleUsage() {
  // Initialize memory manager in concise mode
  const memory = new MemoryManager('concise');
  
  try {
    // Initialize the system (handles recovery, git parsing, etc.)
    await memory.initialize();
    console.log('✅ Memory system initialized');
    
    // Example 1: Simple query with memory context
    const userQuery = "How do I implement a new tool in this codebase?";
    const promptComponents = await memory.buildPrompt(userQuery);
    
    console.log('\n📋 Prompt Components:');
    console.log('- System:', promptComponents.systemPrompt.substring(0, 100) + '...');
    console.log('- Mode:', promptComponents.modeDeclaration);
    console.log('- Knowledge:', promptComponents.knowledge.substring(0, 100) + '...');
    console.log('- Ephemeral:', promptComponents.ephemeral.substring(0, 100) + '...');
    console.log('- Retrieved:', promptComponents.retrieved.substring(0, 100) + '...');
    
    // Get formatted messages for LLM
    const messages = memory.formatMessages(promptComponents);
    console.log(`\n💬 Formatted ${messages.length} messages for LLM`);
    
    // Simulate assistant response
    const assistantResponse = '{"code": "export class MyTool extends Tool { ... }", "explanation": null}';
    memory.addAssistantResponse(assistantResponse);
    
    // Example 2: Query with focus files
    const focusedQuery = "Update the bash tool to support timeout";
    const focusedPrompt = await memory.buildPrompt(focusedQuery, {
      focusFiles: ['src/tools/bash.ts'],
      includeExplanation: true
    });
    
    console.log('\n🎯 Focused query with file context');
    console.log('Token usage:', memory.getTokenReport());
    
    // Example 3: Store knowledge for future use
    await memory.storeKnowledge(
      'coding_style',
      'Use async/await instead of promises',
      'convention'
    );
    console.log('\n💡 Stored coding convention');
    
    // Example 4: Save important snapshot
    await memory.saveSnapshot('completed major refactoring');
    console.log('💾 Saved snapshot');
    
    // Example 5: Switch operating modes
    memory.setMode('deep' as OperatingMode);
    console.log('\n🔄 Switched to deep mode');
    
    const deepQuery = "Analyze and optimize the entire memory management system";
    const deepPrompt = await memory.buildPrompt(deepQuery);
    console.log('Deep mode token budget:', memory.getTokenReport());
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Clean up resources
    await memory.cleanup();
    console.log('\n🧹 Cleaned up resources');
  }
}

// Run example if this file is executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  exampleUsage().catch(console.error);
}