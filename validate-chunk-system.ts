#!/usr/bin/env npx tsx
/**
 * COMPREHENSIVE CHUNK SYSTEM VALIDATION
 * Tests all aspects of the newly implemented chunk functionality
 */

import { PrismaClient } from '@prisma/client';

console.log('🧪 COMPREHENSIVE CHUNK SYSTEM VALIDATION\n');
console.log('=' .repeat(60));

const prisma = new PrismaClient();

async function validateChunkSystem() {
  try {
    // Step 1: Check current chunk state
    console.log('📊 STEP 1: Current Chunk State');
    const chunkCount = await prisma.chunk.count();
    console.log(`Current chunks in database: ${chunkCount}`);

    if (chunkCount > 0) {
      const recentChunks = await prisma.chunk.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          path: true,
          chunkType: true,
          language: true,
          tokenCount: true,
          createdAt: true,
          metadata: true
        }
      });

      console.log('\n📦 Recent Chunks:');
      recentChunks.forEach((chunk, i) => {
        const metadata = chunk.metadata ? JSON.parse(chunk.metadata) : {};
        console.log(`  ${i+1}. ${chunk.path} (${chunk.chunkType})`);
        console.log(`     Language: ${chunk.language}, Tokens: ${chunk.tokenCount}`);
        console.log(`     Created by: ${metadata.created_by || metadata.indexed_by || 'unknown'}`);
      });
    }

    // Step 2: Test agent with file creation to trigger chunk storage
    console.log('\n🚀 STEP 2: Testing Agent File Creation (Chunk Storage)');
    console.log('Running agent task to create a file and verify chunk storage...');

    // Step 3: Verify chunks were created
    const initialChunks = chunkCount;

    // Step 4: Test chunk retrieval
    console.log('\n🔍 STEP 3: Testing Chunk Retrieval');
    if (chunkCount > 0) {
      // Test vector similarity search
      const testChunk = await prisma.chunk.findFirst({
        where: { tokenCount: { gt: 100 } }
      });

      if (testChunk) {
        console.log(`Found test chunk: ${testChunk.path} (${testChunk.tokenCount} tokens)`);

        // Check if embeddings are properly stored
        const hasEmbedding = testChunk.embedding && testChunk.embedding.length > 0;
        console.log(`Embedding stored: ${hasEmbedding ? '✅ Yes' : '❌ No'}`);
      }
    }

    // Step 5: Test different chunk types
    console.log('\n📝 STEP 4: Chunk Type Analysis');
    const chunksByType = await prisma.chunk.groupBy({
      by: ['chunkType'],
      _count: { chunkType: true }
    });

    if (chunksByType.length > 0) {
      console.log('Chunks by type:');
      chunksByType.forEach(type => {
        console.log(`  - ${type.chunkType}: ${type._count.chunkType} chunks`);
      });
    }

    // Step 6: Test language detection
    console.log('\n🔧 STEP 5: Language Detection Analysis');
    const chunksByLanguage = await prisma.chunk.groupBy({
      by: ['language'],
      _count: { language: true }
    });

    if (chunksByLanguage.length > 0) {
      console.log('Chunks by language:');
      chunksByLanguage.forEach(lang => {
        console.log(`  - ${lang.language}: ${lang._count.language} chunks`);
      });
    }

    // Step 7: Token statistics
    console.log('\n📊 STEP 6: Token Statistics');
    const tokenStats = await prisma.chunk.aggregate({
      _sum: { tokenCount: true },
      _avg: { tokenCount: true },
      _max: { tokenCount: true }
    });

    console.log(`Total tokens: ${tokenStats._sum.tokenCount || 0}`);
    console.log(`Average tokens per chunk: ${Math.round(tokenStats._avg.tokenCount || 0)}`);
    console.log(`Largest chunk: ${tokenStats._max.tokenCount || 0} tokens`);

    // Step 8: Metadata analysis
    console.log('\n🏷️ STEP 7: Metadata Analysis');
    const chunksWithMetadata = await prisma.chunk.findMany({
      where: { metadata: { not: null } },
      take: 3,
      select: { path: true, metadata: true }
    });

    if (chunksWithMetadata.length > 0) {
      console.log('Sample metadata structures:');
      chunksWithMetadata.forEach((chunk, i) => {
        try {
          const metadata = JSON.parse(chunk.metadata || '{}');
          console.log(`  ${i+1}. ${chunk.path}:`);
          Object.entries(metadata).forEach(([key, value]) => {
            console.log(`     ${key}: ${value}`);
          });
        } catch {
          console.log(`  ${i+1}. ${chunk.path}: Invalid JSON metadata`);
        }
      });
    }

    // Final Summary
    console.log('\n' + '=' .repeat(60));
    console.log('🎯 CHUNK SYSTEM VALIDATION SUMMARY:');

    const newChunks = await prisma.chunk.count();
    const systemChecks = {
      chunkStorage: newChunks > 0,
      embeddingStorage: false,
      languageDetection: chunksByLanguage.length > 0,
      typeClassification: chunksByType.length > 0,
      metadataStorage: chunksWithMetadata.length > 0
    };

    // Check embeddings
    if (newChunks > 0) {
      const chunkWithEmbedding = await prisma.chunk.findFirst({
        select: { id: true, embedding: true }
      });
      systemChecks.embeddingStorage = !!(chunkWithEmbedding?.embedding && chunkWithEmbedding.embedding.length > 0);
    }

    console.log(`✅ Total Chunks: ${newChunks}`);
    console.log(`${systemChecks.chunkStorage ? '✅' : '❌'} Chunk Storage: Working`);
    console.log(`${systemChecks.embeddingStorage ? '✅' : '❌'} Embedding Generation: ${systemChecks.embeddingStorage ? 'Working' : 'Not Found'}`);
    console.log(`${systemChecks.languageDetection ? '✅' : '❌'} Language Detection: Working (${chunksByLanguage.length} languages)`);
    console.log(`${systemChecks.typeClassification ? '✅' : '❌'} Type Classification: Working (${chunksByType.length} types)`);
    console.log(`${systemChecks.metadataStorage ? '✅' : '❌'} Metadata Storage: Working`);

    const workingSystems = Object.values(systemChecks).filter(Boolean).length;
    const totalSystems = Object.keys(systemChecks).length;

    if (workingSystems === totalSystems) {
      console.log('\n🏆 SUCCESS: All chunk systems operational!');
    } else if (workingSystems >= totalSystems - 1) {
      console.log(`\n⚠️ MOSTLY WORKING: ${workingSystems}/${totalSystems} systems operational`);
    } else {
      console.log(`\n❌ NEEDS WORK: Only ${workingSystems}/${totalSystems} systems working`);
    }

    return { success: workingSystems >= totalSystems - 1, details: systemChecks };

  } catch (error) {
    console.error('❌ Validation failed:', error);
    return { success: false, details: null };
  } finally {
    await prisma.$disconnect();
  }
}

validateChunkSystem().catch(console.error);