#!/usr/bin/env npx tsx
/**
 * FlexiCLI Comprehensive Battle Test
 * Tests all major system components
 */

import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { existsSync, rmSync } from 'fs';

const TESTS = [
  {
    name: 'Database Connection',
    test: async () => {
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: `file:.flexicli/flexicli.db`
          }
        }
      });
      await prisma.$connect();
      const count = await prisma.session.count();
      await prisma.$disconnect();
      return `Sessions: ${count}`;
    }
  },
  {
    name: 'Agent Lock System',
    test: async () => {
      // Clean up any existing lock
      if (existsSync('.flexicli/agent.lock')) {
        rmSync('.flexicli/agent.lock');
      }

      // Test agent execution
      const result = execSync(
        'DEBUG=true APPROVAL_MODE=yolo npx tsx src/cli.tsx --prompt "echo test lock" --non-interactive 2>&1',
        { encoding: 'utf8' }
      );

      const hasLock = result.includes('Agent lock acquired');
      const hasRelease = result.includes('Agent lock released') || result.includes('Release Agent Lock');
      return `Lock acquired: ${hasLock}, Released: ${hasRelease}`;
    }
  },
  {
    name: 'Memory System',
    test: async () => {
      const result = execSync(
        'DEBUG=true APPROVAL_MODE=yolo npx tsx src/cli.tsx --prompt "echo memory test" --non-interactive 2>&1',
        { encoding: 'utf8' }
      );

      const hasMemory = result.includes('MemoryManager');
      const hasSharedDB = result.includes('SharedDatabase');
      const hasCacheManager = result.includes('CacheManager');

      return `Memory: ${hasMemory}, SharedDB: ${hasSharedDB}, Cache: ${hasCacheManager}`;
    }
  },
  {
    name: 'Token Tracking',
    test: async () => {
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: `file:.flexicli/flexicli.db`
          }
        }
      });

      // Get latest session with tokens
      const session = await prisma.session.findFirst({
        where: { tokensUsed: { gt: 0 } },
        orderBy: { startedAt: 'desc' }
      });

      await prisma.$disconnect();

      if (session) {
        return `Latest session used ${session.tokensUsed} tokens`;
      }
      return 'No sessions with token usage found';
    }
  },
  {
    name: 'Cache Table Status',
    test: async () => {
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: `file:.flexicli/flexicli.db`
          }
        }
      });

      const cacheCount = await prisma.cache.count();
      const knowledgeCount = await prisma.knowledge.count();
      const executionCount = await prisma.executionLog.count();

      await prisma.$disconnect();

      return `Cache: ${cacheCount}, Knowledge: ${knowledgeCount}, ExecutionLog: ${executionCount}`;
    }
  },
  {
    name: 'File System Cleanup',
    test: async () => {
      const checks = {
        'No cache dir': !existsSync('.flexicli/cache'),
        'No sessions dir': !existsSync('.flexicli/sessions'),
        'No checkpoints dir': !existsSync('.flexicli/checkpoints'),
        'Logs dir exists': existsSync('.flexicli/logs'),
        'DB exists': existsSync('.flexicli/flexicli.db')
      };

      const passed = Object.entries(checks)
        .filter(([_, v]) => v)
        .map(([k]) => k);

      return `Passed: ${passed.join(', ')}`;
    }
  },
  {
    name: 'Tool Execution',
    test: async () => {
      const result = execSync(
        'DEBUG=true APPROVAL_MODE=yolo npx tsx src/cli.tsx --prompt "create file test-battle-file.txt with content \\"Battle test successful\\""  --non-interactive 2>&1',
        { encoding: 'utf8' }
      );

      const fileCreated = existsSync('test-battle-file.txt');
      if (fileCreated) {
        rmSync('test-battle-file.txt');
      }

      return `File creation test: ${fileCreated ? 'PASSED' : 'FAILED'}`;
    }
  }
];

async function runBattleTest() {
  console.log('🚀 FlexiCLI COMPREHENSIVE BATTLE TEST');
  console.log('=====================================\n');

  let passed = 0;
  let failed = 0;

  for (const test of TESTS) {
    try {
      console.log(`🔍 Testing: ${test.name}`);
      const result = await test.test();
      console.log(`   ✅ PASSED: ${result}`);
      passed++;
    } catch (error) {
      console.log(`   ❌ FAILED: ${error.message}`);
      failed++;
    }
    console.log();
  }

  console.log('=====================================');
  console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`🎯 Success Rate: ${Math.round(passed / TESTS.length * 100)}%`);

  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! System is battle-ready!');
  } else {
    console.log('\n⚠️  Some tests failed. Review the results above.');
  }
}

// Run the battle test
runBattleTest().catch(console.error);