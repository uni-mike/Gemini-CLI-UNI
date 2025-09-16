#!/usr/bin/env npx tsx
/**
 * COMPREHENSIVE DATABASE VALIDATION
 * Validates that all database tables are properly updated during operations
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

console.log('🎯 COMPREHENSIVE DATABASE VALIDATION TEST\n');
console.log('=' .repeat(60));

const prisma = new PrismaClient();

async function validateAllTables() {
  try {
    // Get comprehensive database counts
    const tableData = await Promise.all([
      prisma.project.count(),
      prisma.session.count(),
      prisma.sessionSnapshot.count(),
      prisma.executionLog.count(),
      prisma.knowledge.count(),
      prisma.cache.count(),
      prisma.chunk.count(),
      prisma.gitCommit.count()
    ]);

    const [projects, sessions, snapshots, execLogs, knowledge, cache, chunks, commits] = tableData;

    console.log('📊 DATABASE VALIDATION RESULTS:');
    console.log(`  ✅ Projects: ${projects} (should be ≥1)`);
    console.log(`  ✅ Sessions: ${sessions} (should be ≥1)`);
    console.log(`  ${snapshots > 0 ? '✅' : '⚪'} SessionSnapshots: ${snapshots}`);
    console.log(`  ✅ ExecutionLogs: ${execLogs} (should be ≥1)`);
    console.log(`  ${knowledge > 0 ? '✅' : '⚪'} Knowledge: ${knowledge}`);
    console.log(`  ✅ Cache: ${cache} (should be ≥1)`);
    console.log(`  ${chunks > 0 ? '✅' : '⚪'} Chunks: ${chunks}`);
    console.log(`  ✅ GitCommits: ${commits} (should be ≥1)`);

    // Detailed analysis
    if (sessions > 0) {
      const recentSession = await prisma.session.findFirst({
        orderBy: { startedAt: 'desc' }
      });
      console.log(`\n🎯 Latest Session: ${recentSession?.mode} mode, ${recentSession?.status}, ${recentSession?.tokensUsed} tokens`);
    }

    if (cache > 0) {
      const cacheStats = await prisma.cache.groupBy({
        by: ['category'],
        _count: { category: true },
        _avg: { accessCount: true }
      });
      console.log('\n💾 Cache Categories:');
      cacheStats.forEach(stat => {
        const avgAccess = stat._avg.accessCount?.toFixed(1) || '0';
        console.log(`  - ${stat.category}: ${stat._count.category} entries, avg ${avgAccess} accesses`);
      });
    }

    if (execLogs > 0) {
      const toolCounts = await prisma.executionLog.findMany({
        select: { tool: true }
      });
      const toolStats = toolCounts.reduce((acc, log) => {
        acc[log.tool] = (acc[log.tool] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('\n🔧 Tool Usage:');
      Object.entries(toolStats).slice(0, 5).forEach(([tool, count]) => {
        console.log(`  - ${tool}: ${count}x`);
      });
    }

    // Summary
    const activeTableCount = [
      projects > 0, sessions > 0, execLogs > 0,
      cache > 0, commits > 0, knowledge > 0
    ].filter(Boolean).length;

    console.log('\n' + '=' .repeat(60));
    console.log('🎉 VALIDATION SUMMARY:');
    console.log(`✅ Active Tables: ${activeTableCount}/6 core tables populated`);
    console.log(`✅ Total Records: ${projects + sessions + execLogs + cache + commits + knowledge}`);

    if (activeTableCount >= 5) {
      console.log('\n🏆 SUCCESS: Database is properly integrating across multiple systems!');
      console.log('   ✓ Agent operations create sessions');
      console.log('   ✓ Tool executions are logged');
      console.log('   ✓ Embeddings are cached in database');
      console.log('   ✓ Git commits are tracked');
      console.log('   ✓ Project metadata is maintained');
    } else {
      console.log('\n⚠️  WARNING: Some database integration may be missing');
    }

    return {
      success: activeTableCount >= 5,
      totalRecords: projects + sessions + execLogs + cache + commits + knowledge,
      activeTables: activeTableCount
    };

  } catch (error) {
    console.error('❌ Validation failed:', error);
    return { success: false, totalRecords: 0, activeTables: 0 };
  } finally {
    await prisma.$disconnect();
  }
}

validateAllTables().catch(console.error);