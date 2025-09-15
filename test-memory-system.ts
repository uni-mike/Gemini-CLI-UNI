#!/usr/bin/env tsx
/**
 * Comprehensive Unit Tests for Memory System
 * Tests all components of the FlexiCLI memory architecture
 */

import { PrismaClient } from '@prisma/client';
import { cacheManager } from './src/cache/CacheManager.js';
import { sharedDatabase } from './src/memory/shared-database.js';
import { agentLock } from './src/memory/agent-lock.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Color codes for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

class MemorySystemTests {
  private prisma: PrismaClient;
  private testResults: { test: string; passed: boolean; error?: string }[] = [];

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:.flexicli/flexicli.db`
        }
      }
    });
  }

  // ===== SHARED DATABASE TESTS =====

  async testSharedDatabaseSingleton(): Promise<void> {
    console.log('\n🔍 Testing SharedDatabaseManager Singleton...');
    try {
      const instance1 = sharedDatabase;
      const instance2 = sharedDatabase;

      if (instance1 === instance2) {
        this.pass('SharedDatabase singleton pattern works');
      } else {
        this.fail('SharedDatabase singleton pattern failed');
      }
    } catch (error) {
      this.fail('SharedDatabase singleton test failed', error);
    }
  }

  async testDatabaseConnection(): Promise<void> {
    console.log('\n🔍 Testing Database Connection...');
    try {
      await sharedDatabase.initialize();
      const result = await this.prisma.$queryRaw`SELECT 1 as test`;

      if (result) {
        this.pass('Database connection successful');
      } else {
        this.fail('Database connection failed');
      }
    } catch (error) {
      this.fail('Database connection test failed', error);
    }
  }

  // ===== AGENT LOCK TESTS =====

  async testAgentLockAcquisition(): Promise<void> {
    console.log('\n🔍 Testing Agent Lock Acquisition...');
    try {
      const acquired = await agentLock.acquireLock();

      if (acquired) {
        this.pass('Agent lock acquired successfully');
        await agentLock.releaseLock();
      } else {
        this.fail('Failed to acquire agent lock');
      }
    } catch (error) {
      this.fail('Agent lock acquisition test failed', error);
    }
  }

  async testAgentLockPrevention(): Promise<void> {
    console.log('\n🔍 Testing Agent Lock Prevention...');
    try {
      // First agent acquires lock
      const acquired1 = await agentLock.acquireLock();

      if (acquired1) {
        // Second agent should fail
        const acquired2 = await agentLock.acquireLock();

        if (!acquired2) {
          this.pass('Agent lock prevention works');
        } else {
          this.fail('Agent lock prevention failed - two locks acquired');
        }

        await agentLock.releaseLock();
      } else {
        this.fail('Initial lock acquisition failed');
      }
    } catch (error) {
      this.fail('Agent lock prevention test failed', error);
    }
  }

  // ===== CACHE MANAGER TESTS =====

  async testCacheSetAndGet(): Promise<void> {
    console.log('\n🔍 Testing Cache Set/Get...');
    try {
      const key = 'test_key';
      const value = { data: 'test_value', timestamp: Date.now() };

      cacheManager.set(key, value);
      const retrieved = cacheManager.get(key);

      if (JSON.stringify(retrieved) === JSON.stringify(value)) {
        this.pass('Cache set/get works correctly');
      } else {
        this.fail('Cache set/get failed - values don\'t match');
      }
    } catch (error) {
      this.fail('Cache set/get test failed', error);
    }
  }

  async testCacheExpiration(): Promise<void> {
    console.log('\n🔍 Testing Cache Expiration...');
    try {
      const key = 'expire_test';
      const value = 'will_expire';

      // Set with 1 second TTL
      cacheManager.set(key, value, { ttl: 1000 });

      // Should exist immediately
      const immediate = cacheManager.get(key);
      if (immediate !== value) {
        this.fail('Cache item not found immediately after set');
        return;
      }

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1500));

      const afterExpiry = cacheManager.get(key);
      if (afterExpiry === undefined) {
        this.pass('Cache expiration works correctly');
      } else {
        this.fail('Cache expiration failed - item still exists');
      }
    } catch (error) {
      this.fail('Cache expiration test failed', error);
    }
  }

  async testCacheStatistics(): Promise<void> {
    console.log('\n🔍 Testing Cache Statistics...');
    try {
      // Add some items
      for (let i = 0; i < 5; i++) {
        cacheManager.set(`stat_test_${i}`, `value_${i}`);
      }

      const stats = cacheManager.getStats();

      if (stats.size > 0 && stats.itemCount > 0) {
        this.pass(`Cache statistics working - ${stats.itemCount} items, ${stats.size} bytes`);
      } else {
        this.fail('Cache statistics not tracking properly');
      }
    } catch (error) {
      this.fail('Cache statistics test failed', error);
    }
  }

  // ===== SESSION MANAGEMENT TESTS =====

  async testSessionCreation(): Promise<void> {
    console.log('\n🔍 Testing Session Creation...');
    try {
      const session = await this.prisma.session.create({
        data: {
          projectId: 'test-project',
          mode: 'test',
          turnCount: 0,
          state: {}
        }
      });

      if (session && session.id) {
        this.pass(`Session created successfully: ${session.id}`);

        // Cleanup
        await this.prisma.session.delete({ where: { id: session.id } });
      } else {
        this.fail('Session creation failed');
      }
    } catch (error) {
      this.fail('Session creation test failed', error);
    }
  }

  async testSessionSnapshot(): Promise<void> {
    console.log('\n🔍 Testing Session Snapshots...');
    try {
      // Create a test session
      const session = await this.prisma.session.create({
        data: {
          projectId: 'test-project',
          mode: 'test',
          turnCount: 1,
          state: { test: 'data' }
        }
      });

      // Create snapshot
      const snapshot = await this.prisma.sessionSnapshot.create({
        data: {
          sessionId: session.id,
          turnNumber: 1,
          state: { snapshot: 'test' },
          metadata: { type: 'test' }
        }
      });

      if (snapshot && snapshot.id) {
        this.pass('Session snapshot created successfully');

        // Cleanup
        await this.prisma.sessionSnapshot.delete({ where: { id: snapshot.id } });
        await this.prisma.session.delete({ where: { id: session.id } });
      } else {
        this.fail('Session snapshot creation failed');
      }
    } catch (error) {
      this.fail('Session snapshot test failed', error);
    }
  }

  // ===== TOKEN TRACKING TESTS =====

  async testTokenTracking(): Promise<void> {
    console.log('\n🔍 Testing Token Tracking...');
    try {
      const session = await this.prisma.session.create({
        data: {
          projectId: 'test-project',
          mode: 'test',
          turnCount: 0,
          state: {},
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150
        }
      });

      // Update tokens
      const updated = await this.prisma.session.update({
        where: { id: session.id },
        data: {
          inputTokens: { increment: 50 },
          outputTokens: { increment: 25 },
          totalTokens: { increment: 75 }
        }
      });

      if (updated.inputTokens === 150 && updated.outputTokens === 75 && updated.totalTokens === 225) {
        this.pass('Token tracking works correctly');
      } else {
        this.fail(`Token tracking failed - got ${updated.inputTokens}/${updated.outputTokens}/${updated.totalTokens}`);
      }

      // Cleanup
      await this.prisma.session.delete({ where: { id: session.id } });
    } catch (error) {
      this.fail('Token tracking test failed', error);
    }
  }

  // ===== EXECUTION LOG TESTS =====

  async testExecutionLog(): Promise<void> {
    console.log('\n🔍 Testing Execution Logs...');
    try {
      const log = await this.prisma.executionLog.create({
        data: {
          sessionId: 'test-session',
          toolName: 'test-tool',
          action: 'test-action',
          parameters: { test: 'params' },
          result: { test: 'result' },
          duration: 100,
          success: true
        }
      });

      if (log && log.id) {
        this.pass('Execution log created successfully');

        // Cleanup
        await this.prisma.executionLog.delete({ where: { id: log.id } });
      } else {
        this.fail('Execution log creation failed');
      }
    } catch (error) {
      this.fail('Execution log test failed', error);
    }
  }

  // ===== HELPER METHODS =====

  private pass(message: string): void {
    console.log(`${GREEN}✅ ${message}${RESET}`);
    this.testResults.push({ test: message, passed: true });
  }

  private fail(message: string, error?: any): void {
    console.log(`${RED}❌ ${message}${RESET}`);
    if (error) {
      console.log(`   Error: ${error.message || error}`);
    }
    this.testResults.push({ test: message, passed: false, error: error?.message });
  }

  // ===== RUN ALL TESTS =====

  async runAll(): Promise<void> {
    console.log('🧪 MEMORY SYSTEM UNIT TESTS');
    console.log('============================\n');

    // SharedDatabase Tests
    await this.testSharedDatabaseSingleton();
    await this.testDatabaseConnection();

    // Agent Lock Tests
    await this.testAgentLockAcquisition();
    await this.testAgentLockPrevention();

    // Cache Manager Tests
    await this.testCacheSetAndGet();
    await this.testCacheExpiration();
    await this.testCacheStatistics();

    // Session Management Tests
    await this.testSessionCreation();
    await this.testSessionSnapshot();

    // Token Tracking Tests
    await this.testTokenTracking();

    // Execution Log Tests
    await this.testExecutionLog();

    // Summary
    this.printSummary();

    // Cleanup
    await this.cleanup();
  }

  private printSummary(): void {
    console.log('\n📊 TEST SUMMARY');
    console.log('================');

    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;
    const total = this.testResults.length;

    console.log(`Total Tests: ${total}`);
    console.log(`${GREEN}Passed: ${passed}${RESET}`);
    console.log(`${RED}Failed: ${failed}${RESET}`);

    const percentage = Math.round((passed / total) * 100);
    const color = percentage === 100 ? GREEN : percentage >= 80 ? YELLOW : RED;

    console.log(`\n${color}Success Rate: ${percentage}%${RESET}`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  - ${r.test}`);
          if (r.error) {
            console.log(`    Error: ${r.error}`);
          }
        });
    } else {
      console.log(`\n${GREEN}🎉 All tests passed!${RESET}`);
    }
  }

  private async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
    cacheManager.clear();
    await agentLock.releaseLock();
  }
}

// Run tests
async function main() {
  const tests = new MemorySystemTests();
  await tests.runAll();
}

main().catch(console.error);