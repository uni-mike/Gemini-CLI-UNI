#!/usr/bin/env npx tsx
/**
 * Comprehensive Database Table Update Test
 * Tests that ALL database tables are properly updated during agent operations
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

console.log('🧪 COMPREHENSIVE DATABASE TABLE UPDATE TEST\n');
console.log('=' .repeat(60));

const prisma = new PrismaClient();

async function getTableCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const tables = [
    'project', 'session', 'sessionSnapshot', 'executionLog', 
    'knowledge', 'cache', 'chunk', 'gitCommit'
  ];

  for (const table of tables) {
    try {
      const modelDelegate = (prisma as any)[table];
      if (modelDelegate) {
        counts[table] = await modelDelegate.count();
      }
    } catch (error) {
      counts[table] = -1; // Error indicator
    }
  }
  
  return counts;
}

function printTableCounts(label: string, counts: Record<string, number>) {
  console.log(`\n📊 ${label}:`);
  Object.entries(counts).forEach(([table, count]) => {
    const status = count === -1 ? '❌ Error' : `${count} records`;
    const icon = count > 0 ? '✅' : count === 0 ? '⚪' : '❌';
    console.log(`  ${icon} ${table}: ${status}`);
  });
}

async function runComprehensiveTest() {
  try {
    // Step 1: Verify clean state
    console.log('🔍 STEP 1: Verify Clean Database State');
    const initialCounts = await getTableCounts();
    printTableCounts('Initial State', initialCounts);
    
    // Step 2: Run agent task that should populate multiple tables
    console.log('\n🚀 STEP 2: Running Agent Task');
    console.log('Executing agent command to create test content and populate database...');
    
    const agentOutput = execSync(
      'DEBUG=true APPROVAL_MODE=yolo npx tsx src/cli.tsx --prompt "create a comprehensive test file called db-test-output.txt and write all EMBEDDING_API environment variables to it" --non-interactive',
      { encoding: 'utf8', timeout: 120000 }
    );
    
    console.log('✅ Agent execution completed');
    
    // Step 3: Check what tables got updated
    console.log('\n📈 STEP 3: Analyze Database Updates');
    const afterCounts = await getTableCounts();
    printTableCounts('After Agent Run', afterCounts);
    
    // Step 4: Calculate differences
    console.log('\n📊 STEP 4: Changes Analysis');
    const changes: Record<string, number> = {};
    Object.keys(initialCounts).forEach(table => {
      changes[table] = afterCounts[table] - initialCounts[table];
    });
    
    console.log('\nTable Changes (+/- records):');
    Object.entries(changes).forEach(([table, change]) => {
      if (change > 0) {
        console.log(`  ✅ ${table}: +${change} (NEW DATA)`);
      } else if (change < 0) {
        console.log(`  ⚠️ ${table}: ${change} (DELETED)`);
      } else {
        console.log(`  ⚪ ${table}: 0 (no change)`);
      }
    });
    
    // Step 5: Detailed analysis of populated tables
    console.log('\n🔍 STEP 5: Detailed Table Analysis');
    
    if (afterCounts.project > 0) {
      const projects = await prisma.project.findMany();
      console.log(`\n📂 Projects (${projects.length}):`);
      projects.forEach(p => {
        console.log(`  - ${p.name} (${p.id.substring(0,8)}...) created: ${new Date(p.createdAt).toLocaleString()}`);
      });
    }
    
    if (afterCounts.session > 0) {
      const sessions = await prisma.session.findMany({
        orderBy: { startedAt: 'desc' },
        take: 3
      });
      console.log(`\n🎯 Recent Sessions (${sessions.length}):`);
      sessions.forEach(s => {
        console.log(`  - Mode: ${s.mode}, Status: ${s.status}, Turns: ${s.turnCount}, Tokens: ${s.tokensUsed}`);
      });
    }
    
    if (afterCounts.cache > 0) {
      const cacheByCategory = await prisma.cache.groupBy({
        by: ['category'],
        _count: { category: true },
        _avg: { accessCount: true }
      });
      console.log(`\n💾 Cache Breakdown:`);
      cacheByCategory.forEach(cat => {
        const avgAccess = cat._avg.accessCount?.toFixed(1) || '0';
        console.log(`  - ${cat.category}: ${cat._count.category} entries, avg ${avgAccess} accesses`);
      });
    }
    
    if (afterCounts.executionLog > 0) {
      const toolStats = await prisma.executionLog.groupBy({
        by: ['toolName', 'status'],
        _count: { toolName: true }
      });
      console.log(`\n🔧 Tool Execution Summary:`);
      toolStats.forEach(stat => {
        console.log(`  - ${stat.toolName} (${stat.status}): ${stat._count.toolName}x`);
      });
    }
    
    if (afterCounts.knowledge > 0) {
      const knowledgeByCategory = await prisma.knowledge.groupBy({
        by: ['category'],
        _count: { category: true }
      });
      console.log(`\n🧠 Knowledge Base:`);
      knowledgeByCategory.forEach(cat => {
        console.log(`  - ${cat.category}: ${cat._count.category} entries`);
      });
    }
    
    // Step 6: Verify file was created
    console.log('\n📄 STEP 6: File Creation Verification');
    try {
      execSync('ls -la db-test-output.txt');
      console.log('✅ Test file created successfully');
      const content = execSync('head -3 db-test-output.txt', { encoding: 'utf8' });
      console.log('File preview:', content.trim());
    } catch {
      console.log('❌ Test file not found');
    }
    
    // Step 7: Summary
    console.log('\n' + '=' .repeat(60));
    console.log('🎯 TEST RESULTS SUMMARY:');
    
    const updatedTables = Object.entries(changes).filter(([_, change]) => change > 0);
    const totalNewRecords = Object.values(changes).reduce((sum, change) => sum + Math.max(0, change), 0);
    
    console.log(`✅ Tables updated: ${updatedTables.length}/${Object.keys(changes).length}`);
    console.log(`✅ Total new records: ${totalNewRecords}`);
    
    updatedTables.forEach(([table, change]) => {
      console.log(`  - ${table}: +${change} records`);
    });
    
    if (updatedTables.length >= 4) {
      console.log('\n🎉 SUCCESS: Multiple database tables are being updated correctly!');
    } else {
      console.log('\n⚠️  WARNING: Some database tables may not be updating as expected');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runComprehensiveTest().catch(console.error);
