#!/usr/bin/env npx tsx
/**
 * Comprehensive database structure analysis before cleanup
 */

import { PrismaClient } from '@prisma/client';

console.log('🔍 DATABASE STRUCTURE ANALYSIS\n');
console.log('=' .repeat(50));

const prisma = new PrismaClient();

try {
  // Get all table counts
  console.log('📊 TABLE RECORD COUNTS:');
  const tables = [
    'project', 'session', 'sessionSnapshot', 'executionLog', 
    'knowledge', 'cache', 'chunk', 'gitCommit'
  ];

  const counts: Record<string, number> = {};
  
  for (const table of tables) {
    try {
      const modelDelegate = (prisma as any)[table];
      if (modelDelegate) {
        counts[table] = await modelDelegate.count();
        console.log(`  ${table}: ${counts[table]} records`);
      }
    } catch (error) {
      console.log(`  ${table}: Error - ${(error as Error).message}`);
    }
  }

  console.log('\n🔍 DETAILED ANALYSIS:');
  
  // Project details
  if (counts.project > 0) {
    const projects = await prisma.project.findMany({
      select: { id: true, name: true, rootPath: true, createdAt: true }
    });
    console.log(`\nProjects (${projects.length}):`);
    projects.forEach(p => {
      console.log(`  - ${p.name} (${p.id.substring(0,8)}...) at ${p.rootPath}`);
    });
  }

  // Session details
  if (counts.session > 0) {
    const sessions = await prisma.session.findMany({
      select: { id: true, mode: true, status: true, startedAt: true, turnCount: true, tokensUsed: true },
      orderBy: { startedAt: 'desc' },
      take: 5
    });
    console.log(`\nRecent Sessions (showing 5/${counts.session}):`);
    sessions.forEach(s => {
      const date = new Date(s.startedAt).toLocaleString();
      console.log(`  - ${s.id.substring(0,8)}... (${s.mode}, ${s.status}) ${s.turnCount} turns, ${s.tokensUsed} tokens - ${date}`);
    });
  }

  // Cache analysis
  if (counts.cache > 0) {
    const cacheByCategory = await prisma.cache.groupBy({
      by: ['category'],
      _count: { category: true },
      _avg: { accessCount: true, size: true }
    });
    
    console.log(`\nCache Analysis (${counts.cache} total):`);
    cacheByCategory.forEach(cat => {
      const avgAccess = cat._avg.accessCount?.toFixed(1) || '0';
      const avgSize = Math.round(cat._avg.size || 0);
      console.log(`  - ${cat.category}: ${cat._count.category} entries, avg ${avgAccess} accesses, ${avgSize} bytes avg`);
    });

    const topAccessed = await prisma.cache.findMany({
      select: { originalKey: true, category: true, accessCount: true },
      orderBy: { accessCount: 'desc' },
      take: 3
    });
    
    console.log('\n  Top accessed cache entries:');
    topAccessed.forEach((entry, i) => {
      console.log(`    ${i+1}. ${entry.originalKey.substring(0, 25)}... (${entry.accessCount}x)`);
    });
  }

  // Knowledge base
  if (counts.knowledge > 0) {
    const knowledgeTypes = await prisma.knowledge.groupBy({
      by: ['type'],
      _count: { type: true }
    });
    console.log(`\nKnowledge Base (${counts.knowledge} total):`);
    knowledgeTypes.forEach(kt => {
      console.log(`  - ${kt.type}: ${kt._count.type} entries`);
    });
  }

  // Execution logs
  if (counts.executionLog > 0) {
    const recentLogs = await prisma.executionLog.findMany({
      select: { toolName: true, status: true, executedAt: true },
      orderBy: { executedAt: 'desc' },
      take: 5
    });
    console.log(`\nRecent Tool Executions (showing 5/${counts.executionLog}):`);
    recentLogs.forEach(log => {
      const time = new Date(log.executedAt).toLocaleTimeString();
      console.log(`  - ${log.toolName}: ${log.status} at ${time}`);
    });
  }

  console.log('\n' + '=' .repeat(50));
  console.log('✅ Database analysis complete');

} catch (error) {
  console.error('❌ Analysis failed:', error);
} finally {
  await prisma.$disconnect();
}
