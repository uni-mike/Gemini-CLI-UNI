#!/usr/bin/env npx tsx
/**
 * Test for memory layer monitoring
 * Verifies that memory layer events (ephemeral, knowledge, retrieval) are tracked
 */

import { PrismaClient } from '@prisma/client';
import { MonitoringBridge } from '../../../src/monitoring/backend/monitoring-bridge.js';
import { MemoryManager } from '../../../src/memory/memory-manager.js';
import { Orchestrator } from '../../../src/core/orchestrator.js';
import { Config } from '../../../src/config/Config.js';
import path from 'path';

console.log('🧠 Testing Memory Layer Monitoring\n');
console.log('=' .repeat(60));

async function testMemoryMonitoring() {
  const prisma = new PrismaClient();
  const config = new Config();
  await config.initialize();
  
  try {
    // 1. Initial state
    console.log('\n📊 Initial Database State:');
    const initialChunks = await prisma.chunk.count();
    const initialLogs = await prisma.executionLog.count();
    console.log(`  Chunks: ${initialChunks}`);
    console.log(`  Execution Logs: ${initialLogs}`);
    
    // 2. Setup monitoring
    console.log('\n🌉 Setting up Monitoring...');
    const projectRoot = path.join(process.cwd(), 'test-memory-' + Date.now());
    const monitoringBridge = new MonitoringBridge(prisma, projectRoot);
    await monitoringBridge.start();
    
    // 3. Create orchestrator and memory manager
    console.log('\n🎭 Creating Orchestrator and Memory Manager...');
    const orchestrator = new Orchestrator(config);
    
    // Initialize memory manager with test config
    const memoryManager = new MemoryManager('concise');
    
    await memoryManager.initialize();
    console.log('  ✅ Memory Manager initialized');
    
    // 4. Attach monitoring to both
    monitoringBridge.attachToOrchestrator(orchestrator);
    monitoringBridge.attachToMemoryManager(memoryManager);
    console.log('  ✅ Monitoring attached to both components');
    
    // 5. Test memory operations
    console.log('\n🧪 Testing Memory Layer Operations:');
    
    // Test 1: Build prompt (which triggers memory layer events)
    console.log('\n  🏗️ Test 1: Build Prompt with Memory Layers');
    const prompt = await memoryManager.buildPrompt('How does the monitoring system work?', {
      includeExplanation: false,
      focusFiles: ['monitoring-bridge.ts', 'memory-manager.ts']
    });
    
    console.log('    Prompt built with:');
    console.log(`      - System: ${prompt.systemPrompt ? prompt.systemPrompt.length + ' chars' : 'none'}`);
    console.log(`      - Ephemeral: ${prompt.ephemeral ? prompt.ephemeral.length + ' chars' : 'none'}`);
    console.log(`      - Knowledge: ${prompt.knowledge ? prompt.knowledge.length + ' chars' : 'none'}`);
    console.log(`      - Retrieved: ${prompt.retrieved ? prompt.retrieved.length + ' chars' : 'none'}`);
    console.log(`      - User Query: ${prompt.userQuery ? prompt.userQuery.length + ' chars' : 'none'}`);
    
    // Test 2: Store knowledge
    console.log('\n  📚 Test 2: Knowledge Layer');
    await memoryManager.storeKnowledge('test-doc', 'This is important knowledge about testing.', 'documentation');
    await memoryManager.storeKnowledge('api-doc', 'API documentation for the monitoring system.', 'api');
    console.log('    Stored 2 knowledge documents');
    
    // Test 3: Add assistant response (updates ephemeral)
    console.log('\n  📝 Test 3: Ephemeral Memory');
    memoryManager.addAssistantResponse('I understand you want to know about the monitoring system. It tracks metrics, tools, and memory layers.');
    console.log('    Added assistant response to ephemeral memory');
    
    // Test 4: Build another prompt to trigger retrieval
    console.log('\n  🔍 Test 4: Retrieval with Another Prompt');
    const prompt2 = await memoryManager.buildPrompt('Show me the API documentation', {
      includeExplanation: true
    });
    
    console.log('    Second prompt built with:');
    console.log(`      - Ephemeral: ${prompt2.ephemeral ? prompt2.ephemeral.length + ' chars' : 'none'}`);
    console.log(`      - Knowledge: ${prompt2.knowledge ? prompt2.knowledge.length + ' chars' : 'none'}`);
    console.log(`      - Retrieved: ${prompt2.retrieved ? prompt2.retrieved.length + ' chars' : 'none'}`);
    
    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 6. Check metrics from monitoring
    console.log('\n📈 Checking Monitoring Metrics:');
    const metrics = monitoringBridge.getAllMetrics();
    
    if (metrics.realtime?.memory) {
      console.log('  Memory Metrics (Realtime):');
      console.log(`    - Ephemeral: ${metrics.realtime.memory.ephemeral || 0} items`);
      console.log(`    - Knowledge: ${metrics.realtime.memory.knowledge || 0} items`);
      console.log(`    - Retrieval: ${metrics.realtime.memory.retrieval || 0} queries`);
    } else {
      console.log('  ⚠️ No realtime memory metrics found');
    }
    
    if (metrics.realtime?.tokens) {
      console.log('  Token Metrics:');
      console.log(`    - Input tokens: ${metrics.realtime.tokens.input?.total || 0}`);
      console.log(`    - Output tokens: ${metrics.realtime.tokens.output?.total || 0}`);
    }
    
    // 7. Check database for memory events
    console.log('\n💾 Checking Database for Memory Events:');
    
    // Check chunks table
    const chunks = await prisma.chunk.findMany({
      where: {
        projectId: projectRoot
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`\n  Chunks (${chunks.length} found):`);
    for (const chunk of chunks.slice(0, 3)) {
      console.log(`    ID: ${chunk.id}`);
      console.log(`    Type: ${chunk.chunkType}`);
      console.log(`    Content: ${chunk.content.substring(0, 50)}...`);
      console.log(`    Has Embedding: ${chunk.embedding ? 'Yes' : 'No'}`);
      console.log('    ---');
    }
    
    // Check for memory-related execution logs
    const memoryLogs = await prisma.executionLog.findMany({
      where: {
        OR: [
          { tool: { contains: 'memory' } },
          { type: 'memory' }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    console.log(`\n  Memory Logs (${memoryLogs.length} found):`);
    for (const log of memoryLogs) {
      console.log(`    Tool: ${log.tool}`);
      console.log(`    Type: ${log.type}`);
      console.log(`    Success: ${log.success}`);
      console.log('    ---');
    }
    
    // 8. Test memory event emission
    console.log('\n🧪 Testing Direct Memory Events:');
    
    // Emit memory events directly to see if they're captured
    orchestrator.emit('memory-update', {
      type: 'ephemeral',
      action: 'add',
      count: 2
    });
    
    orchestrator.emit('memory-update', {
      type: 'knowledge',
      action: 'store',
      documents: 2
    });
    
    orchestrator.emit('memory-update', {
      type: 'retrieval',
      action: 'search',
      query: 'test query',
      results: 0
    });
    
    console.log('  ✅ Emitted 3 memory events');
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 9. Final verification
    console.log('\n✅ Verification:');
    
    const finalChunks = await prisma.chunk.count();
    const finalLogs = await prisma.executionLog.count();
    
    console.log(`  New Chunks Created: ${finalChunks - initialChunks}`);
    console.log(`  New Logs Created: ${finalLogs - initialLogs}`);
    
    // Check if memory layers are reporting
    const health = monitoringBridge.getHealth();
    console.log('\n  Monitoring Health:');
    console.log(`    - Autonomous Running: ${health.autonomousRunning}`);
    console.log(`    - Realtime Attached: ${health.realtimeAttached}`);
    console.log(`    - Attached Modules: ${health.attachedModules.join(', ')}`);
    
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await monitoringBridge.stop();
    await memoryManager.close();
    
    // Final summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Final Summary:');
    
    if (finalChunks > initialChunks) {
      console.log('  ✅ Memory chunks are being stored');
    } else {
      console.log('  ❌ Memory chunks not being stored');
    }
    
    if (metrics.realtime?.memory) {
      console.log('  ✅ Memory metrics are being tracked');
    } else {
      console.log('  ❌ Memory metrics not being tracked');
      console.log('\n  Issues to fix:');
      console.log('  - MemoryManager needs to emit events for monitoring');
      console.log('  - MonitoringBridge needs listeners for memory events');
      console.log('  - MetricsCollector needs methods to track memory operations');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testMemoryMonitoring()
  .then(() => {
    console.log('\n✨ Memory monitoring test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });