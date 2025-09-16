#!/usr/bin/env tsx
/**
 * Test Session Recovery After Crash
 * Tests if FlexiCLI can recover from a crashed session
 */

import { PrismaClient } from '@prisma/client';
import { spawn, execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:.flexicli/flexicli.db`
    }
  }
});

async function simulateCrash() {
  console.log('🔴 TEST: Session Recovery After Crash\n');

  try {
    // 1. Start a session
    console.log('1️⃣ Starting new session...');
    const child = spawn('npx', ['tsx', 'src/cli.tsx', '--prompt', 'Starting test session', '--non-interactive'], {
      env: { ...process.env, DEBUG: 'false', APPROVAL_MODE: 'yolo', ENABLE_MONITORING: 'false' },
      stdio: 'pipe'
    });

    // Wait for session to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 2. Get the session ID
    const latestSession = await prisma.session.findFirst({
      orderBy: { startedAt: 'desc' }
    });

    if (!latestSession) {
      throw new Error('No session found');
    }

    console.log(`2️⃣ Session started: ${latestSession.id}`);
    console.log(`   Mode: ${latestSession.mode}, Turn: ${latestSession.turnCount}`);

    // 3. Kill the process abruptly (simulate crash)
    console.log('3️⃣ Simulating crash (SIGKILL)...');
    child.kill('SIGKILL');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. Check session status
    const crashedSession = await prisma.session.findUnique({
      where: { id: latestSession.id }
    });

    console.log(`4️⃣ Session status after crash:`);
    console.log(`   Ended at: ${crashedSession?.endedAt || 'NOT SET (crashed)'}`);
    console.log(`   State: ${crashedSession?.state || 'undefined'}`);

    // 5. Check for session snapshots
    const snapshots = await prisma.sessionSnapshot.findMany({
      where: { sessionId: latestSession.id },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`5️⃣ Session snapshots: ${snapshots.length} found`);
    if (snapshots.length > 0) {
      console.log(`   Latest snapshot: ${snapshots[0].createdAt}`);
    }

    // 6. Try to recover the session
    console.log('6️⃣ Attempting recovery...');
    const recovery = spawn('npx', ['tsx', 'src/cli.tsx', '--prompt', 'Recover from crash', '--non-interactive'], {
      env: { ...process.env, DEBUG: 'false', APPROVAL_MODE: 'yolo', ENABLE_MONITORING: 'false' },
      stdio: 'pipe'
    });

    let recoveryOutput = '';
    recovery.stdout.on('data', (data) => {
      recoveryOutput += data.toString();
    });

    await new Promise(resolve => setTimeout(resolve, 3000));
    recovery.kill();

    // 7. Check if recovery detected the crash
    const hasRecovery = recoveryOutput.includes('crash') ||
                        recoveryOutput.includes('recover') ||
                        recoveryOutput.includes('restore');

    console.log(`7️⃣ Recovery detection: ${hasRecovery ? '✅ DETECTED' : '❌ NOT DETECTED'}`);

    // 8. Check new session
    const newSession = await prisma.session.findFirst({
      orderBy: { startedAt: 'desc' }
    });

    const isNewSession = newSession && newSession.id !== latestSession.id;
    console.log(`8️⃣ New session created: ${isNewSession ? '✅ YES' : '❌ NO'}`);

    // Summary
    console.log('\n📊 TEST RESULTS:');
    console.log('==============');
    console.log(`✅ Session crash simulated`);
    console.log(`${snapshots.length > 0 ? '✅' : '❌'} Snapshots exist`);
    console.log(`${!crashedSession?.endedAt ? '✅' : '❌'} Session marked as crashed`);
    console.log(`${hasRecovery ? '✅' : '⚠️'} Recovery mechanism detected`);
    console.log(`${isNewSession ? '✅' : '❌'} New session created after crash`);

    const score = [
      true, // crash simulated
      snapshots.length > 0,
      !crashedSession?.endedAt,
      hasRecovery,
      isNewSession
    ].filter(Boolean).length;

    console.log(`\n🎯 Score: ${score}/5`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

simulateCrash().catch(console.error);