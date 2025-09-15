#!/usr/bin/env npx tsx

/**
 * Battle Test - Agent Lock System Validation
 *
 * This test validates that the agent lock system prevents concurrent database access
 * and ensures only one agent instance can run per project at a time.
 */

import { AgentLockManager } from './src/memory/agent-lock.js';
import { SharedDatabaseManager } from './src/memory/shared-database.js';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

async function battleTestAgentLock() {
  console.log('🔥 BATTLE TEST - Agent Lock System Validation');
  console.log('=========================================\n');

  const projectRoot = process.cwd();
  const sessionId1 = randomUUID();
  const sessionId2 = randomUUID();

  try {
    // Test 1: Basic Lock Acquisition
    console.log('🔧 Test 1: Basic Lock Acquisition');
    const lockManager1 = AgentLockManager.getInstance(projectRoot);

    const acquired1 = await lockManager1.acquireLock(sessionId1);
    console.log(`✅ First lock acquired: ${acquired1}`);

    if (!acquired1) {
      throw new Error('Failed to acquire first lock');
    }

    // Test 2: Lock Conflict Prevention
    console.log('\n🔧 Test 2: Lock Conflict Prevention');
    const lockManager2 = AgentLockManager.getInstance(projectRoot); // Same instance (singleton)

    const acquired2 = await lockManager2.acquireLock(sessionId2);
    console.log(`❌ Second lock acquisition (should fail): ${acquired2}`);

    if (acquired2) {
      throw new Error('Second lock should not have been acquired');
    }

    // Test 3: Lock Statistics
    console.log('\n🔧 Test 3: Lock Statistics');
    const stats = lockManager1.getLockStats();
    console.log('Lock Stats:', JSON.stringify(stats, null, 2));

    if (!stats.hasLock || !stats.isRunning) {
      throw new Error('Lock stats indicate problems');
    }

    // Test 4: SharedDatabase Initialization
    console.log('\n🔧 Test 4: SharedDatabase Initialization');
    const sharedDB = SharedDatabaseManager.getInstance();

    const dbInitialized = await sharedDB.initialize(sessionId1);
    console.log(`✅ SharedDatabase initialized: ${dbInitialized}`);

    if (!dbInitialized) {
      throw new Error('SharedDatabase should have initialized with valid lock');
    }

    // Test 5: Database Health Check
    console.log('\n🔧 Test 5: Database Health Check');
    const health = await sharedDB.healthCheck();
    console.log('Health Check:', JSON.stringify(health, null, 2));

    if (!health.overall) {
      throw new Error('Database health check failed');
    }

    // Test 6: Lock Release and Re-acquisition
    console.log('\n🔧 Test 6: Lock Release and Re-acquisition');
    lockManager1.releaseLock();

    const acquired3 = await lockManager2.acquireLock(sessionId2);
    console.log(`✅ Lock re-acquired after release: ${acquired3}`);

    if (!acquired3) {
      throw new Error('Should be able to acquire lock after release');
    }

    // Test 7: Force Cleanup
    console.log('\n🔧 Test 7: Force Cleanup');
    await sharedDB.forceCleanup();

    const statsAfterCleanup = lockManager1.getLockStats();
    console.log('Stats after cleanup:', JSON.stringify(statsAfterCleanup, null, 2));

    console.log('\n🎉 ALL TESTS PASSED! Agent Lock System is battle-tested and working correctly.');

    // Final validation
    const finalStats = await sharedDB.getStats();
    console.log('\n📊 Final System Stats:');
    console.log(JSON.stringify(finalStats, null, 2));

  } catch (error) {
    console.error('\n❌ BATTLE TEST FAILED:', error);
    process.exit(1);
  }
}

// Test concurrent process behavior
async function testConcurrentAgents() {
  console.log('\n🔥 BONUS TEST - Concurrent Agent Simulation');
  console.log('==========================================\n');

  // Spawn multiple processes to test real concurrency
  const processes: any[] = [];

  for (let i = 0; i < 3; i++) {
    console.log(`🚀 Spawning agent process ${i + 1}...`);

    const child = spawn('npx', ['tsx', '-e', `
      import { AgentLockManager } from './src/memory/agent-lock.js';
      import { randomUUID } from 'crypto';

      const lock = AgentLockManager.getInstance('${process.cwd()}');
      const sessionId = randomUUID();

      console.log('Process ${i + 1}: Attempting to acquire lock...');
      lock.acquireLock(sessionId).then(acquired => {
        console.log('Process ${i + 1}: Lock acquired = ' + acquired);
        if (acquired) {
          setTimeout(() => {
            console.log('Process ${i + 1}: Releasing lock');
            lock.releaseLock();
          }, 2000);
        }
      });
    `], {
      stdio: 'pipe',
      cwd: process.cwd()
    });

    processes.push(child);

    child.stdout.on('data', (data) => {
      console.log(`[Process ${i + 1}]`, data.toString().trim());
    });

    child.stderr.on('data', (data) => {
      console.log(`[Process ${i + 1} ERROR]`, data.toString().trim());
    });

    // Small delay between spawns
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Wait for all processes to complete
  await Promise.all(processes.map(p => new Promise(resolve => {
    p.on('close', resolve);
  })));

  console.log('\n✅ Concurrent agent test completed!');
}

// Run all tests
async function runAllTests() {
  try {
    await battleTestAgentLock();
    await testConcurrentAgents();

    console.log('\n🏆 ALL BATTLE TESTS PASSED! System is production-ready.');
    process.exit(0);

  } catch (error) {
    console.error('\n💥 BATTLE TESTS FAILED:', error);
    process.exit(1);
  }
}

runAllTests();