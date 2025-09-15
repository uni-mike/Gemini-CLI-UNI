#!/usr/bin/env npx tsx

/**
 * Test Cache and Embeddings Integration
 */

import { EmbeddingsManager } from './src/memory/embeddings.js';
import { cacheManager } from './src/cache/CacheManager.js';

async function testCacheEmbeddings() {
  console.log('🧪 Testing Cache-Embeddings Integration...');

  try {
    // Initialize embeddings manager
    const embeddings = new EmbeddingsManager();

    // Check cache stats before
    console.log('📊 Cache stats before:', cacheManager.getStats());
    const dbStatsBefore = await cacheManager.getDatabaseStats();
    console.log('📊 Database stats before:', dbStatsBefore);

    // Generate some embeddings (this should use fallback if no API keys)
    console.log('🧠 Generating test embeddings...');
    const testTexts = [
      'FlexiCLI is a powerful command-line interface tool',
      'Memory management system with database persistence',
      'Cache layer with LRU and database integration'
    ];

    for (const text of testTexts) {
      console.log(`📝 Processing: "${text.substring(0, 40)}..."`);
      const embedding = await embeddings.embed(text);
      console.log(`✅ Generated embedding of dimension: ${embedding.length}`);
    }

    // Check cache stats after
    console.log('📊 Cache stats after:', cacheManager.getStats());
    const dbStatsAfter = await cacheManager.getDatabaseStats();
    console.log('📊 Database stats after:', dbStatsAfter);

    // Force cache persistence
    console.log('💾 Forcing cache persistence...');
    await (cacheManager as any).persistCache();

    // Check final database state
    const finalStats = await cacheManager.getDatabaseStats();
    console.log('📊 Final database stats:', finalStats);

    console.log('🎉 Cache-Embeddings Integration Test Complete!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test
testCacheEmbeddings().then(() => process.exit(0)).catch(console.error);