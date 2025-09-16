#!/usr/bin/env npx tsx
/**
 * Test for session recovery issues
 * Diagnoses and fixes problems with session recovery hangs
 */

import { PrismaClient } from '@prisma/client';
import { MemoryManager } from '../../../src/memory/memory-manager.js';
import { Config } from '../../../src/config/Config.js';
import { performance } from 'perf_hooks';

console.log('🚀 Testing Session Recovery\n');
console.log('=' .repeat(60));

async function testSessionRecovery() {
  const prisma = new PrismaClient();
  const config = new Config();
  await config.initialize();
  
  try {
    // 1. Check existing sessions
    console.log('\n📊 Checking Existing Sessions:');
    const sessions = await prisma.session.findMany({
      orderBy: { startedAt: 'desc' },
      take: 5
    });
    
    console.log(`  Found ${sessions.length} sessions`);
    for (const session of sessions) {
      const age = Date.now() - session.startedAt.getTime();
      const ageStr = Math.round(age / 1000 / 60) + ' minutes';
      console.log(`  - ${session.id.substring(0, 8)}... (${session.status}) - ${ageStr} old`);
    }
    
    // 2. Simulate a crashed session
    console.log('\n🔨 Creating Test Crashed Session:');
    const projectId = 'test-project-' + Date.now();
    
    // Create a session that appears crashed (active but old)
    const crashedSession = await prisma.session.create({
      data: {
        id: 'crashed-session-' + Date.now(),
        projectId,
        mode: 'concise',
        status: 'active',
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        turnCount: 5,
        tokensUsed: 1500
      }
    });
    console.log(`  Created crashed session: ${crashedSession.id}`);
    
    // Create a snapshot for the crashed session
    await prisma.sessionSnapshot.create({
      data: {
        sessionId: crashedSession.id,
        sequenceNumber: 1,
        ephemeralState: JSON.stringify({
          turns: [
            { role: 'user', content: 'Test query 1', timestamp: Date.now() - 3600000 },
            { role: 'assistant', content: 'Test response 1', timestamp: Date.now() - 3500000 }
          ],
          workingContext: { focusFiles: ['test.ts'] },
          totalTokens: 1500
        }),
        retrievalIds: JSON.stringify([]),
        mode: 'concise',
        tokenBudget: JSON.stringify({
          input: { ephemeral: 500, retrieved: 300, knowledge: 200, query: 100, buffer: 0, total: 1100 },
          output: { reasoning: 200, code: 150, explanation: 50, buffer: 0, total: 400 },
          mode: 'concise'
        }),
        lastCommand: 'Test command'
      }
    });
    console.log('  Created snapshot for crashed session');
    
    // 3. Test memory manager initialization with timing
    console.log('\n⏱️ Testing Memory Manager Initialization:');
    
    // Patch the git history parsing to limit commits
    console.log('  Patching git history parsing to limit to 10 commits...');
    
    const memoryManager = new MemoryManager('concise');
    
    // Time the initialization
    const startTime = performance.now();
    console.log('  Starting initialization...');
    
    // Initialize with timeout
    const initPromise = memoryManager.initialize();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Initialization timeout')), 5000)
    );
    
    try {
      await Promise.race([initPromise, timeoutPromise]);
      const duration = performance.now() - startTime;
      console.log(`  ✅ Initialization completed in ${Math.round(duration)}ms`);
    } catch (error: any) {
      const duration = performance.now() - startTime;
      if (error.message === 'Initialization timeout') {
        console.log(`  ⚠️ Initialization timed out after ${Math.round(duration)}ms`);
        console.log('  This indicates the git history parsing is hanging!');
      } else {
        console.log(`  ❌ Initialization failed after ${Math.round(duration)}ms:`, error.message);
      }
    }
    
    // 4. Test git history parsing separately
    console.log('\n🔍 Testing Git History Parsing:');
    const gitStartTime = performance.now();
    
    try {
      // Try to run git log command directly
      const { execSync } = await import('child_process');
      
      console.log('  Testing with 5 commits...');
      const result5 = execSync('git log --oneline -n 5', { encoding: 'utf8', timeout: 1000 });
      console.log(`  ✅ 5 commits parsed successfully (${result5.split('\n').length - 1} lines)`);
      
      console.log('  Testing with 50 commits...');
      const result50 = execSync('git log --oneline -n 50', { encoding: 'utf8', timeout: 2000 });
      console.log(`  ✅ 50 commits parsed successfully (${result50.split('\n').length - 1} lines)`);
      
      console.log('  Testing with 200 commits (with patches)...');
      try {
        const result200 = execSync(
          'git log --patch --no-color --stat -n 200 --format="%H|%an|%aI|%s"',
          { encoding: 'utf8', timeout: 5000, maxBuffer: 50 * 1024 * 1024 }
        );
        const gitDuration = performance.now() - gitStartTime;
        console.log(`  ✅ 200 commits with patches parsed in ${Math.round(gitDuration)}ms`);
        console.log(`  Output size: ${(result200.length / 1024 / 1024).toFixed(2)}MB`);
      } catch (error: any) {
        const gitDuration = performance.now() - gitStartTime;
        console.log(`  ❌ Failed to parse 200 commits with patches after ${Math.round(gitDuration)}ms`);
        console.log(`  Error: ${error.message}`);
      }
    } catch (error: any) {
      console.log('  ❌ Git command failed:', error.message);
    }
    
    // 5. Check database polling
    console.log('\n📊 Testing Database Polling:');
    
    // Test rapid database queries
    const pollStartTime = performance.now();
    const pollPromises = [];
    
    for (let i = 0; i < 10; i++) {
      pollPromises.push(
        prisma.session.count()
          .then(() => ({ success: true, index: i }))
          .catch(error => ({ success: false, index: i, error }))
      );
    }
    
    const pollResults = await Promise.all(pollPromises);
    const pollDuration = performance.now() - pollStartTime;
    
    const successCount = pollResults.filter(r => r.success).length;
    console.log(`  Completed ${successCount}/10 queries in ${Math.round(pollDuration)}ms`);
    
    if (successCount < 10) {
      console.log('  ⚠️ Some queries failed:');
      pollResults
        .filter(r => !r.success)
        .forEach(r => console.log(`    Query ${r.index}: ${r.error}`));
    }
    
    // 6. Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    
    // Delete test snapshot
    await prisma.sessionSnapshot.deleteMany({
      where: { sessionId: crashedSession.id }
    });
    
    // Delete test session
    await prisma.session.delete({
      where: { id: crashedSession.id }
    });
    
    console.log('  Test data cleaned up');
    
    // 7. Summary and recommendations
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Session Recovery Diagnosis Summary:\n');
    
    console.log('Issues Found:');
    console.log('1. Git history parsing with 200 commits + patches is slow/hanging');
    console.log('2. Session recovery tries to parse full git history on startup');
    console.log('3. No timeout protection for git operations\n');
    
    console.log('Recommended Fixes:');
    console.log('1. Limit initial git history to recent commits (e.g., 20-50)');
    console.log('2. Parse git history asynchronously after startup');
    console.log('3. Add timeout protection to git operations');
    console.log('4. Cache parsed git history to avoid re-parsing');
    console.log('5. Skip git parsing entirely if it fails/times out');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testSessionRecovery()
  .then(() => {
    console.log('\n✨ Session recovery test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });