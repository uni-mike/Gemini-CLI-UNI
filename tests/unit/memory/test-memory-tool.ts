#!/usr/bin/env npx tsx
/**
 * Test the memory retrieval tool directly
 */

import { MemoryRetrievalTool } from './src/tools/memory-retrieval.js';
import { SharedDatabaseManager } from './src/memory/shared-database.js';

async function testMemoryTool() {
  console.log('🧪 Testing Memory Retrieval Tool...\n');

  // Initialize database
  const dbManager = SharedDatabaseManager.getInstance();
  await dbManager.initialize('test-session');

  // Create tool instance
  const memoryTool = new MemoryRetrievalTool();

  // Test 1: Get all data layers
  console.log('📊 Test 1: Get all data layers');
  const result1 = await memoryTool.execute({ action: 'get_all_layers' });
  if (result1.success) {
    console.log('✅ Success!');
    const data = JSON.parse(result1.output || '{}');
    console.log('Summary:', data.summary);
  } else {
    console.log('❌ Failed:', result1.error);
  }

  // Test 2: Get recent sessions
  console.log('\n📊 Test 2: Get recent sessions');
  const result2 = await memoryTool.execute({ action: 'get_sessions' });
  if (result2.success) {
    console.log('✅ Success!');
    console.log(result2.output?.substring(0, 200) + '...');
  } else {
    console.log('❌ Failed:', result2.error);
  }

  // Test 3: Get knowledge base
  console.log('\n📊 Test 3: Get knowledge base');
  const result3 = await memoryTool.execute({ action: 'get_knowledge' });
  if (result3.success) {
    console.log('✅ Success!');
    console.log(result3.output?.substring(0, 200) + '...');
  } else {
    console.log('❌ Failed:', result3.error);
  }

  // Test 4: Search memories
  console.log('\n📊 Test 4: Search memories');
  const result4 = await memoryTool.execute({ action: 'search', query: 'memory' });
  if (result4.success) {
    console.log('✅ Success!');
    console.log(result4.output?.substring(0, 200) + '...');
  } else {
    console.log('❌ Failed:', result4.error);
  }

  // Cleanup
  dbManager.disconnect();
  process.exit(0);
}

testMemoryTool().catch(console.error);