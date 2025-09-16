#!/usr/bin/env npx tsx

import { globalRegistry } from '../../../src/tools/registry.js';
import { MemoryRetrievalTool } from '../../../src/tools/memory-retrieval.js';
import { SharedDatabaseManager } from '../../../src/memory/shared-database.js';

async function test() {
  console.log('🧪 Testing Memory Retrieval Tool Registration...\n');

  // Initialize database
  const dbManager = SharedDatabaseManager.getInstance();
  await dbManager.initialize('test-session');

  // Register tool
  const memoryTool = new MemoryRetrievalTool();
  globalRegistry.register(memoryTool);

  console.log('✅ Tool registered as:', memoryTool.name);
  console.log('📝 Description:', memoryTool.description);

  // Test via registry
  console.log('\n🔧 Testing via registry.execute...');
  const result1 = await globalRegistry.execute('memory_retrieval', { action: 'get_knowledge' });
  console.log(result1.success ? '✅ SUCCESS' : '❌ FAILED');
  if (result1.output) {
    console.log('Output:', result1.output.substring(0, 200));
  }

  // Test get_all_layers
  console.log('\n🔧 Testing get_all_layers...');
  const result2 = await globalRegistry.execute('memory_retrieval', { action: 'get_all_layers' });
  console.log(result2.success ? '✅ SUCCESS' : '❌ FAILED');
  if (result2.output) {
    const data = JSON.parse(result2.output);
    console.log('Data layer summary:', data.summary);
  }

  dbManager.disconnect();
  process.exit(0);
}

test().catch(console.error);