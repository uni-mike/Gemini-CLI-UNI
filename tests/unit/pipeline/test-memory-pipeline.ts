#!/usr/bin/env npx tsx
/**
 * Test Memory Pipeline
 * Verifies all memory layers are working correctly
 */

import { MemoryManager } from '../../../src/memory/memory-manager.js';
import { ProjectManager } from '../../../src/memory/project-manager.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

async function testMemoryPipeline() {
  console.log('🧪 Testing Memory Pipeline Integration\n');
  
  // 1. Check project structure
  console.log('1️⃣ Checking project structure...');
  const projectManager = new ProjectManager();
  await projectManager.initializeWithDatabase();
  
  const metadata = projectManager.getMetadata();
  console.log('✅ Project:', metadata.name);
  console.log('✅ Project ID:', metadata.projectId);
  console.log('✅ Root Path:', metadata.rootPath);
  
  // Check directories - only logs needed now (cache/sessions moved to database)
  const dirs = [
    '.flexicli',
    '.flexicli/logs'
  ];

  for (const dir of dirs) {
    const path = join(process.cwd(), dir);
    if (existsSync(path)) {
      console.log(`✅ Directory exists: ${dir}`);
    } else {
      console.log(`❌ Missing directory: ${dir}`);
    }
  }

  // Verify database-only architecture
  const deprecatedDirs = ['.flexicli/cache', '.flexicli/sessions', '.flexicli/checkpoints'];
  for (const dir of deprecatedDirs) {
    const path = join(process.cwd(), dir);
    if (!existsSync(path)) {
      console.log(`✅ Directory cleaned up (now database-only): ${dir}`);
    } else {
      console.log(`⚠️ Legacy directory still exists: ${dir}`);
    }
  }
  
  // 2. Test Memory Manager initialization
  console.log('\n2️⃣ Initializing Memory Manager...');
  const memoryManager = new MemoryManager('concise');
  
  try {
    await memoryManager.initialize();
    console.log('✅ Memory Manager initialized');
  } catch (error) {
    console.error('❌ Memory Manager initialization failed:', error);
    return;
  }
  
  // 3. Test prompt building with all layers
  console.log('\n3️⃣ Testing prompt building with all memory layers...');
  const testQuery = 'How does the monitoring system work?';
  
  try {
    const promptComponents = await memoryManager.buildPrompt(testQuery, {
      includeExplanation: true,
      focusFiles: ['src/monitoring/backend/MetricsCollector.ts']
    });
    
    console.log('✅ System Prompt:', promptComponents.systemPrompt.substring(0, 100) + '...');
    console.log('✅ Mode Declaration:', promptComponents.modeDeclaration.substring(0, 100) + '...');
    console.log('✅ Knowledge Layer:', promptComponents.knowledge.substring(0, 100) + '...');
    console.log('✅ Ephemeral Layer:', promptComponents.ephemeral.substring(0, 100) + '...');
    console.log('✅ Retrieved Layer:', promptComponents.retrieved.substring(0, 100) + '...');
    console.log('✅ Output Contract:', promptComponents.outputContract);
    
  } catch (error) {
    console.error('❌ Prompt building failed:', error);
  }
  
  // 4. Test knowledge storage
  console.log('\n4️⃣ Testing knowledge storage...');
  try {
    await memoryManager.storeKnowledge(
      'monitoring_enabled',
      'true',
      'configuration'
    );
    console.log('✅ Knowledge stored successfully');
  } catch (error) {
    console.error('❌ Knowledge storage failed:', error);
  }
  
  // 5. Test assistant response tracking
  console.log('\n5️⃣ Testing assistant response tracking...');
  try {
    memoryManager.addAssistantResponse('Test response from assistant');
    console.log('✅ Assistant response tracked');
  } catch (error) {
    console.error('❌ Response tracking failed:', error);
  }
  
  // 6. Test snapshot saving
  console.log('\n6️⃣ Testing snapshot saving...');
  try {
    await memoryManager.saveSnapshot('test_run');
    console.log('✅ Snapshot saved');
  } catch (error) {
    console.error('❌ Snapshot saving failed:', error);
  }
  
  // 7. Check token usage
  console.log('\n7️⃣ Token usage report:');
  console.log(memoryManager.getTokenReport());
  
  // 8. Check database contents
  console.log('\n8️⃣ Checking database contents...');
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: `file:${projectManager.getDbPath()}`
      }
    }
  });
  
  try {
    const chunkCount = await prisma.chunk.count();
    const commitCount = await prisma.gitCommit.count();
    const knowledgeCount = await prisma.knowledge.count();
    const sessionCount = await prisma.session.count();
    const snapshotCount = await prisma.sessionSnapshot.count();
    
    console.log(`✅ Chunks: ${chunkCount}`);
    console.log(`✅ Git Commits: ${commitCount}`);
    console.log(`✅ Knowledge Entries: ${knowledgeCount}`);
    console.log(`✅ Sessions: ${sessionCount}`);
    console.log(`✅ Snapshots: ${snapshotCount}`);
    
  } catch (error) {
    console.error('❌ Database query failed:', error);
  } finally {
    await prisma.$disconnect();
  }
  
  // 9. Test embeddings (if configured)
  console.log('\n9️⃣ Testing embeddings...');
  if (process.env.EMBEDDING_API_KEY) {
    const { EmbeddingsManager } = await import('./src/memory/embeddings.js');
    const embeddings = new EmbeddingsManager();
    
    try {
      const embedding = await embeddings.embed('Test text for embedding');
      console.log(`✅ Embedding generated: ${embedding.length} dimensions`);
      
      const similarity = embeddings.cosineSimilarity(embedding, embedding);
      console.log(`✅ Self-similarity: ${similarity.toFixed(4)} (should be ~1.0)`);
      
    } catch (error) {
      console.error('❌ Embeddings test failed:', error);
    }
  } else {
    console.log('⚠️  Embeddings not configured (missing EMBEDDING_API_KEY)');
  }
  
  // 10. Clean up
  console.log('\n🧹 Cleaning up...');
  await memoryManager.cleanup();
  console.log('✅ Cleanup complete');
  
  console.log('\n✨ Memory pipeline test complete!');
}

// Run the test
testMemoryPipeline().catch(console.error);