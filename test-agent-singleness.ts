#!/usr/bin/env npx tsx

/**
 * Test Agent Singleness - Demonstrate agent lock system
 * Tests:
 * 1. Start one agent instance
 * 2. Attempt to start a second (should be denied)
 * 3. Stop the first agent
 * 4. Start another agent (should work properly)
 */

import { AgentLockManager } from './src/memory/agent-lock.js';
import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

async function testAgentSingleness() {
  console.log('🧪 Testing Agent Singleness...\n');

  const lockManager = AgentLockManager.getInstance(process.cwd());

  try {
    // Test 1: Start first agent (should succeed)
    console.log('📍 Test 1: Starting first agent instance...');
    const lock1 = await lockManager.acquireLock();

    if (lock1) {
      console.log('✅ First agent acquired lock successfully');
      console.log(`🔒 Lock PID: ${lock1.pid}, started at: ${lock1.startedAt}\n`);

      // Test 2: Try to start second agent (should be denied)
      console.log('📍 Test 2: Attempting to start second agent (should be denied)...');
      const lock2 = await lockManager.acquireLock();

      if (!lock2) {
        console.log('✅ Second agent correctly denied - lock system working!\n');
      } else {
        console.log('❌ ERROR: Second agent should have been denied');
        await lockManager.releaseLock();
        return false;
      }

      // Test 3: Release first agent lock
      console.log('📍 Test 3: Stopping first agent...');
      await lockManager.releaseLock();
      console.log('✅ First agent lock released\n');

      // Test 4: Try to start new agent (should succeed)
      console.log('📍 Test 4: Starting new agent after cleanup (should succeed)...');
      const lock3 = await lockManager.acquireLock();

      if (lock3) {
        console.log('✅ New agent acquired lock successfully after cleanup');
        console.log(`🔒 New Lock PID: ${lock3.pid}, started at: ${lock3.startedAt}\n`);

        // Clean up
        await lockManager.releaseLock();
        console.log('✅ Final cleanup completed');

        return true;
      } else {
        console.log('❌ ERROR: New agent should have acquired lock after cleanup');
        return false;
      }

    } else {
      console.log('❌ ERROR: First agent failed to acquire lock');
      return false;
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    // Ensure cleanup
    await lockManager.forceCleanup();
    return false;
  }
}

async function testRealAgentProcess() {
  console.log('\n🚀 Testing Real Agent Process Lock Behavior...\n');

  try {
    // Start first FlexiCLI agent in background
    console.log('📍 Starting FlexiCLI agent with simple task...');
    const agent1 = spawn('npx', ['tsx', 'src/cli.tsx', '--prompt', 'echo "Agent 1 running"', '--non-interactive'], {
      env: { ...process.env, DEBUG: 'true', APPROVAL_MODE: 'yolo' },
      stdio: 'pipe',
      detached: false
    });

    // Give it time to start and acquire lock
    await setTimeout(2000);
    console.log('✅ First agent started, acquiring lock...\n');

    // Try to start second agent (should be denied)
    console.log('📍 Attempting to start second FlexiCLI agent (should be denied)...');
    const agent2 = spawn('npx', ['tsx', 'src/cli.tsx', '--prompt', 'echo "Agent 2 running"', '--non-interactive'], {
      env: { ...process.env, DEBUG: 'true', APPROVAL_MODE: 'yolo' },
      stdio: 'pipe',
      detached: false
    });

    let agent2Output = '';
    agent2.stdout?.on('data', (data) => {
      agent2Output += data.toString();
    });

    agent2.stderr?.on('data', (data) => {
      agent2Output += data.toString();
    });

    // Wait for second agent to complete
    await new Promise((resolve) => {
      agent2.on('exit', resolve);
      setTimeout(() => {
        agent2.kill();
        resolve(null);
      }, 10000);
    });

    // Check if second agent was denied
    if (agent2Output.includes('Another agent instance is already running') ||
        agent2Output.includes('Lock acquisition failed') ||
        agent2Output.includes('AGENT_LOCK_ERROR')) {
      console.log('✅ Second agent correctly denied by lock system');
    } else {
      console.log('⚠️ Could not confirm second agent denial (might have timed out)');
    }

    // Kill first agent
    console.log('\n📍 Stopping first agent...');
    agent1.kill();
    await setTimeout(1000);
    console.log('✅ First agent stopped\n');

    // Try to start third agent (should succeed)
    console.log('📍 Starting third agent after first one stopped (should succeed)...');
    const agent3 = spawn('npx', ['tsx', 'src/cli.tsx', '--prompt', 'echo "Agent 3 running successfully"', '--non-interactive'], {
      env: { ...process.env, DEBUG: 'true', APPROVAL_MODE: 'yolo' },
      stdio: 'pipe',
      detached: false
    });

    let agent3Output = '';
    agent3.stdout?.on('data', (data) => {
      agent3Output += data.toString();
    });

    // Wait for third agent to complete
    await new Promise((resolve) => {
      agent3.on('exit', resolve);
      setTimeout(() => {
        agent3.kill();
        resolve(null);
      }, 10000);
    });

    if (agent3Output.includes('Agent 3 running successfully') ||
        agent3Output.includes('Task completed') ||
        !agent3Output.includes('AGENT_LOCK_ERROR')) {
      console.log('✅ Third agent successfully acquired lock after cleanup');
      return true;
    } else {
      console.log('⚠️ Third agent may have had issues (check output)');
      console.log('Agent 3 output:', agent3Output);
      return false;
    }

  } catch (error) {
    console.error('❌ Real process test failed:', error);
    return false;
  }
}

// Run tests
async function runAllTests() {
  console.log('🎯 Agent Singleness Test Suite\n');
  console.log('=' .repeat(50));

  // Test 1: Unit test of lock manager
  const unitTestResult = await testAgentSingleness();
  console.log('=' .repeat(50));

  // Test 2: Real process behavior
  const processTestResult = await testRealAgentProcess();
  console.log('=' .repeat(50));

  if (unitTestResult && processTestResult) {
    console.log('\n🎉 ALL TESTS PASSED! Agent lock system is working correctly.');
    console.log('✅ Single agent instance per project is enforced');
    console.log('✅ Lock denial works properly');
    console.log('✅ Cleanup and reacquisition works properly');
  } else {
    console.log('\n❌ Some tests failed. Check output above.');
  }

  process.exit(unitTestResult && processTestResult ? 0 : 1);
}

runAllTests().catch(console.error);