#!/usr/bin/env npx tsx
/**
 * Comprehensive test for embeddings-based memory retrieval and monitoring
 * Tests the complete flow of semantic search with monitoring integration
 */

import { PrismaClient } from '@prisma/client';
import { MemoryManager } from './src/memory/memory-manager.js';
import { MonitoringBridge } from './src/monitoring/backend/monitoring-bridge.js';
import { Orchestrator } from './src/core/orchestrator.js';
import { Config } from './src/config/Config.js';
import { EmbeddingsManager } from './src/memory/embeddings.js';
import { RetrievalLayer } from './src/memory/layers/retrieval.js';
import { TokenBudgetManager } from './src/memory/token-budget.js';
import * as fs from 'fs';
import * as path from 'path';

console.log('🧪 Testing Embeddings-based Memory & Monitoring Integration\n');
console.log('=' . repeat(60));

async function testEmbeddingsAndRetrieval() {
  const prisma = new PrismaClient();
  const config = new Config();
  await config.initialize();
  
  try {
    // 1. Test Embeddings Manager
    console.log('\n📊 Testing Embeddings Manager...');
    const embeddings = new EmbeddingsManager();
    
    // Test single embedding
    const testText = "The monitoring system tracks tool executions and memory usage";
    const embedding = await embeddings.embed(testText);
    console.log(`✅ Generated embedding with ${embedding.length} dimensions`);
    
    // Test batch embeddings
    const texts = [
      "React monitoring dashboard shows real-time metrics",
      "Memory layers include ephemeral, retrieval, and knowledge",
      "Tool execution tracking with success rates"
    ];
    const batchEmbeddings = await embeddings.embedBatch(texts);
    console.log(`✅ Generated ${batchEmbeddings.length} batch embeddings`);
    
    // Test cosine similarity
    const query = "monitoring metrics dashboard";
    const queryEmbedding = await embeddings.embed(query);
    
    for (let i = 0; i < texts.length; i++) {
      const similarity = embeddings.cosineSimilarity(queryEmbedding, batchEmbeddings[i]);
      console.log(`  Similarity with "${texts[i].substring(0, 40)}...": ${similarity.toFixed(3)}`);
    }
    
    // 2. Test Retrieval Layer with Semantic Search
    console.log('\n🔍 Testing Retrieval Layer with Semantic Search...');
    const projectId = 'flexicli-test-' + Date.now();
    const tokenBudget = new TokenBudgetManager('concise');
    const retrieval = new RetrievalLayer(prisma, embeddings, tokenBudget, projectId);
    
    // Ensure project exists with unique rootPath
    const testRootPath = path.join(process.cwd(), 'test-' + Date.now());
    await prisma.project.upsert({
      where: { id: projectId },
      create: {
        id: projectId,
        name: 'Test Project',
        rootPath: testRootPath
      },
      update: {}
    });
    
    // Store test chunks with different content
    const testChunks = [
      {
        path: 'monitoring/MetricsCollector.ts',
        content: 'The MetricsCollector class tracks real-time metrics including token usage, tool executions, and memory layers. It uses a singleton pattern and stores data in SQLite database.',
        chunkType: 'code' as const,
        metadata: { language: 'typescript' }
      },
      {
        path: 'memory/embeddings.ts',
        content: 'EmbeddingsManager integrates with Azure OpenAI to generate text embeddings for semantic search. It normalizes vectors and caches results for performance.',
        chunkType: 'code' as const,
        metadata: { language: 'typescript' }
      },
      {
        path: 'docs/monitoring.md',
        content: 'The monitoring dashboard provides real-time visibility into agent operations including pipeline stages, memory usage, and tool execution statistics.',
        chunkType: 'doc' as const,
        metadata: { format: 'markdown' }
      }
    ];
    
    const chunkIds = await retrieval.storeChunks(testChunks);
    console.log(`✅ Stored ${chunkIds.length} chunks with embeddings`);
    
    // Test semantic search
    const searchQueries = [
      "How does the monitoring system track metrics?",
      "Explain the embeddings and semantic search",
      "What information does the dashboard show?"
    ];
    
    for (const searchQuery of searchQueries) {
      console.log(`\n  Query: "${searchQuery}"`);
      const results = await retrieval.retrieve(searchQuery, { topK: 2 });
      
      for (const result of results) {
        console.log(`    📄 ${result.path} (similarity: ${result.similarity.toFixed(3)})`);
        console.log(`       "${result.content.substring(0, 60)}..."`);
      }
    }
    
    // 3. Test Memory Manager Integration
    console.log('\n🧠 Testing Memory Manager with Embeddings...');
    const memoryManager = new MemoryManager('concise');
    await memoryManager.initialize();
    
    // Add context and test retrieval
    await memoryManager.addContext('monitoring', {
      content: 'The monitoring system integrates with the agent through MonitoringBridge',
      path: 'monitoring/bridge.ts'
    });
    
    await memoryManager.addContext('tools', {
      content: 'Tool registry manages all available tools with categories and descriptions',
      path: 'tools/registry.ts'
    });
    
    // Build prompt with semantic retrieval
    const promptComponents = await memoryManager.buildPrompt(
      "How does monitoring integrate with the agent?",
      { includeExplanation: true }
    );
    
    console.log(`✅ Built prompt with ${promptComponents.retrieved.length} chars retrieved context`);
    console.log(`✅ Ephemeral: ${promptComponents.ephemeral.length} chars`);
    console.log(`✅ Knowledge: ${promptComponents.knowledge.length} chars`);
    
    // 4. Test Monitoring Bridge Integration
    console.log('\n🌉 Testing Monitoring Bridge with Memory Events...');
    const monitoringBridge = new MonitoringBridge(prisma, process.cwd());
    await monitoringBridge.start();
    
    // Create orchestrator and attach monitoring
    const orchestrator = new Orchestrator(config);
    orchestrator.setMemoryManager(memoryManager);
    monitoringBridge.attachToOrchestrator(orchestrator);
    monitoringBridge.attachToMemoryManager(memoryManager);
    
    console.log('✅ Monitoring bridge attached to orchestrator and memory manager');
    
    // 5. Check Database Persistence
    console.log('\n💾 Verifying Database Persistence...');
    
    // Check chunks are persisted
    const persistedChunks = await prisma.chunk.count({
      where: { projectId }
    });
    console.log(`✅ Found ${persistedChunks} chunks in database`);
    
    // Check sessions
    const sessions = await prisma.session.findMany({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
      take: 1
    });
    
    if (sessions.length > 0) {
      console.log(`✅ Active session: ${sessions[0].id}`);
      console.log(`  Mode: ${sessions[0].mode}`);
      console.log(`  Tokens: ${sessions[0].tokensUsed}`);
    }
    
    // 6. Test Cross-Validation with Monitoring Metrics
    console.log('\n📈 Testing Monitoring Metrics Collection...');
    const health = monitoringBridge.getHealth();
    console.log(`✅ Monitoring Health:`);
    console.log(`  Autonomous: ${health.autonomousRunning}`);
    console.log(`  Realtime: ${health.realtimeAttached}`);
    console.log(`  Modules: ${health.attachedModules.join(', ')}`);
    
    const metrics = monitoringBridge.getAllMetrics();
    console.log(`✅ Collected Metrics Sources:`);
    if (metrics.combined?.source) {
      console.log(`  Realtime: ${metrics.combined.source.realtime?.length || 0} metrics`);
      console.log(`  Autonomous: ${metrics.combined.source.autonomous?.length || 0} metrics`);
    }
    
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await monitoringBridge.stop();
    await memoryManager.cleanup();
    
    // Delete test chunks
    await prisma.chunk.deleteMany({
      where: { projectId }
    });
    
    // Delete test project
    await prisma.project.delete({
      where: { id: projectId }
    });
    
    console.log('✅ Cleanup complete');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testEmbeddingsAndRetrieval()
  .then(() => {
    console.log('\n' + '=' . repeat(60));
    console.log('✨ All embeddings and monitoring tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });