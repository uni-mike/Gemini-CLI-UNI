#!/usr/bin/env tsx
/**
 * Comprehensive Unit Tests for Memory System
 * Tests all components of the FlexiCLI memory architecture
 */

import { PrismaClient } from '@prisma/client';
import { CacheManager } from '../../../src/cache/CacheManager.js';
import { SharedDatabaseManager } from '../../../src/memory/shared-database.js';
import { AgentLockManager } from '../../../src/memory/agent-lock.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

// Color codes for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

class MemorySystemTests {
  private prisma: PrismaClient | null = null;
  private testResults: { test: string; passed: boolean; error?: string }[] = [];
  private sharedDb: SharedDatabaseManager;
  private agentLock: AgentLockManager;
  private cacheManager: CacheManager;
  private testSessionId: string;
  private testProjectRoot: string;
  private testProjectId: string | null = null;

  constructor() {
    // Use a unique session ID for test isolation
    this.testSessionId = `test-${randomUUID()}`;
    this.testProjectRoot = process.cwd();

    // Get singleton instances
    this.sharedDb = SharedDatabaseManager.getInstance();
    this.agentLock = AgentLockManager.getInstance(this.testProjectRoot);
    this.cacheManager = CacheManager.getInstance();
  }

  async setup(): Promise<void> {
    try {
      // Initialize shared database first
      await this.sharedDb.initialize(this.testSessionId);

      // Get Prisma client from shared database
      this.prisma = this.sharedDb.getPrisma();

      // Ensure test project exists
      await this.ensureTestProject();
    } catch (error: any) {
      console.error(`${RED}Setup failed: ${error.message}${RESET}`);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      // Clean up test data
      if (this.prisma) {
        // Delete test sessions
        await this.prisma.session.deleteMany({
          where: { id: { contains: 'test-' } }
        });

        // Delete test execution logs
        await this.prisma.executionLog.deleteMany({
          where: { sessionId: { contains: 'test-' } }
        });

        // Delete test snapshots
        await this.prisma.sessionSnapshot.deleteMany({
          where: { sessionId: { contains: 'test-' } }
        });
      }

      // Release agent lock if held
      if (this.agentLock.hasLock()) {
        this.agentLock.releaseLock();
      }

      // Disconnect database
      this.sharedDb.disconnect();
    } catch (error: any) {
      console.error(`${RED}Cleanup failed: ${error.message}${RESET}`);
    }
  }

  private async ensureTestProject(): Promise<void> {
    if (!this.prisma) throw new Error('Prisma not initialized');

    // Upsert test project (create or update)
    const project = await this.prisma.project.upsert({
      where: { rootPath: this.testProjectRoot },
      update: {
        name: 'Test Project'
      },
      create: {
        id: 'test-project',
        name: 'Test Project',
        rootPath: this.testProjectRoot
      }
    });

    // Store project ID for use in tests
    this.testProjectId = project.id;
  }

  // ===== SHARED DATABASE TESTS =====

  async testSharedDatabaseSingleton(): Promise<void> {
    console.log('\n🔍 Testing SharedDatabaseManager Singleton...');
    try {
      const instance1 = SharedDatabaseManager.getInstance();
      const instance2 = SharedDatabaseManager.getInstance();

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
      if (!this.prisma) throw new Error('Prisma not initialized');

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
      // First ensure lock is released
      if (this.agentLock.hasLock()) {
        this.agentLock.releaseLock();
      }

      const acquired = await this.agentLock.acquireLock(this.testSessionId);

      if (acquired) {
        this.pass('Agent lock acquired successfully');
        this.agentLock.releaseLock();
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
      // Create two separate lock instances for testing
      const lock1 = AgentLockManager.getInstance(this.testProjectRoot);
      const lock2 = AgentLockManager.getInstance(this.testProjectRoot); // Should return same instance (singleton)

      // First agent acquires lock
      const acquired1 = await lock1.acquireLock(`${this.testSessionId}-1`);

      if (acquired1) {
        // Second agent should fail
        const acquired2 = await lock2.acquireLock(`${this.testSessionId}-2`);

        if (!acquired2) {
          this.pass('Agent lock prevention works');
        } else {
          this.fail('Agent lock prevention failed - two locks acquired');
          lock2.releaseLock();
        }

        lock1.releaseLock();
      } else {
        this.fail('Failed to acquire first lock');
      }
    } catch (error) {
      this.fail('Agent lock prevention test failed', error);
    }
  }

  // ===== CACHE MANAGER TESTS =====

  async testCacheOperations(): Promise<void> {
    console.log('\n🔍 Testing Cache Operations...');
    try {
      const testKey = 'test-cache-key';
      const testValue = { test: 'data', timestamp: Date.now() };

      // Set cache value with 60 second TTL
      this.cacheManager.set(testKey, testValue, { ttl: 60000 });

      // Get cache value
      const retrieved = this.cacheManager.get(testKey);

      if (retrieved && retrieved.test === testValue.test) {
        this.pass('Cache set/get operations work');

        // Clean up
        this.cacheManager.delete(testKey);
      } else {
        this.fail('Cache operations failed - value mismatch');
      }
    } catch (error) {
      this.fail('Cache operations test failed', error);
    }
  }

  async testCacheDeletion(): Promise<void> {
    console.log('\n🔍 Testing Cache Deletion...');
    try {
      // NOTE: Cache is configured with allowStale: true and updateAgeOnGet: true
      // which can affect expiration behavior. This test verifies manual deletion.
      const testKey = 'test-expire-key-' + Date.now();
      const testValue = 'test-value';

      // Set cache value
      this.cacheManager.set(testKey, testValue, { ttl: 60000 });

      // Value should exist
      const exists = this.cacheManager.has(testKey);
      if (!exists) {
        this.fail('Cache value not found after setting');
        return;
      }

      // Delete the value manually
      const deleted = this.cacheManager.delete(testKey);

      // Value should be gone
      const afterDelete = this.cacheManager.get(testKey);

      if (deleted && !afterDelete) {
        this.pass('Cache deletion works correctly');
      } else {
        this.fail('Cache deletion failed');
      }
    } catch (error) {
      this.fail('Cache deletion test failed', error);
    }
  }

  // ===== SESSION TESTS =====

  async testSessionCreation(): Promise<void> {
    console.log('\n🔍 Testing Session Creation...');
    try {
      if (!this.prisma) throw new Error('Prisma not initialized');

      const session = await this.prisma.session.create({
        data: {
          id: `test-session-${Date.now()}`,
          projectId: this.testProjectId!,
          mode: 'test',
          turnCount: 0,
          tokensUsed: 0
        }
      });

      if (session && session.id) {
        this.pass('Session created successfully');

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
      if (!this.prisma) throw new Error('Prisma not initialized');

      // Create a test session
      const session = await this.prisma.session.create({
        data: {
          id: `test-session-${Date.now()}`,
          projectId: this.testProjectId!,
          mode: 'test',
          turnCount: 1,
          tokensUsed: 0
        }
      });

      // Create snapshot
      const snapshot = await this.prisma.sessionSnapshot.create({
        data: {
          sessionId: session.id,
          sequenceNumber: 1,
          ephemeralState: JSON.stringify({ test: 'state' }),
          retrievalIds: JSON.stringify(['test-id-1', 'test-id-2']),
          mode: 'test',
          tokenBudget: JSON.stringify({ input: 1000, output: 1000 })
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
      if (!this.prisma) throw new Error('Prisma not initialized');

      const sessionId = `test-session-${Date.now()}`;
      const session = await this.prisma.session.create({
        data: {
          id: sessionId,
          projectId: this.testProjectId!,
          mode: 'test',
          turnCount: 0,
          tokensUsed: 150
        }
      });

      // Update tokens
      const updated = await this.prisma.session.update({
        where: { id: session.id },
        data: {
          tokensUsed: { increment: 75 }
        }
      });

      if (updated.tokensUsed === 225) {
        this.pass('Token tracking works correctly');
      } else {
        this.fail(`Token tracking failed - expected 225, got ${updated.tokensUsed}`);
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
      if (!this.prisma) throw new Error('Prisma not initialized');

      const log = await this.prisma.executionLog.create({
        data: {
          projectId: this.testProjectId!,
          sessionId: this.testSessionId,
          tool: 'test-tool',
          input: JSON.stringify({ test: 'params' }),
          output: JSON.stringify({ test: 'result' }),
          duration: 100,
          success: true
        }
      });

      if (log && log.id) {
        this.pass('Execution log created successfully');

        // Verify retrieval
        const retrieved = await this.prisma.executionLog.findUnique({
          where: { id: log.id }
        });

        if (retrieved && retrieved.tool === 'test-tool') {
          this.pass('Execution log retrieval works');
        } else {
          this.fail('Execution log retrieval failed');
        }

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
    console.log(`${GREEN}✓ ${message}${RESET}`);
    this.testResults.push({ test: message, passed: true });
  }

  private fail(message: string, error?: any): void {
    const errorMessage = error ? `: ${error.message || error}` : '';
    console.log(`${RED}✗ ${message}${errorMessage}${RESET}`);
    this.testResults.push({
      test: message,
      passed: false,
      error: errorMessage
    });
  }

  // ===== RUN ALL TESTS =====

  async runAll(): Promise<void> {
    console.log(`${YELLOW}========================================${RESET}`);
    console.log(`${YELLOW}   FlexiCLI Memory System Unit Tests${RESET}`);
    console.log(`${YELLOW}========================================${RESET}`);

    try {
      // Setup
      await this.setup();
      console.log(`${GREEN}✓ Test environment setup complete${RESET}\n`);

      // Run tests
      await this.testSharedDatabaseSingleton();
      await this.testDatabaseConnection();
      await this.testAgentLockAcquisition();
      await this.testAgentLockPrevention();
      await this.testCacheOperations();
      await this.testCacheDeletion();
      await this.testSessionCreation();
      await this.testSessionSnapshot();
      await this.testTokenTracking();
      await this.testExecutionLog();

      // Summary
      console.log(`\n${YELLOW}========================================${RESET}`);
      console.log(`${YELLOW}            Test Summary${RESET}`);
      console.log(`${YELLOW}========================================${RESET}`);

      const passed = this.testResults.filter(r => r.passed).length;
      const failed = this.testResults.filter(r => !r.passed).length;
      const total = this.testResults.length;
      const percentage = Math.round((passed / total) * 100);

      console.log(`\nTests Passed: ${GREEN}${passed}${RESET}/${total}`);
      console.log(`Tests Failed: ${failed > 0 ? RED : GREEN}${failed}${RESET}/${total}`);
      console.log(`Pass Rate: ${percentage >= 80 ? GREEN : percentage >= 50 ? YELLOW : RED}${percentage}%${RESET}\n`);

      if (failed > 0) {
        console.log(`${RED}Failed Tests:${RESET}`);
        this.testResults.filter(r => !r.passed).forEach(r => {
          console.log(`  ${RED}✗ ${r.test}${r.error || ''}${RESET}`);
        });
      }

      // Cleanup
      await this.cleanup();
      console.log(`\n${GREEN}✓ Test cleanup complete${RESET}`);

      // Exit with appropriate code
      process.exit(failed > 0 ? 1 : 0);
    } catch (error: any) {
      console.error(`${RED}Fatal error during test execution: ${error.message}${RESET}`);
      await this.cleanup();
      process.exit(1);
    }
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tests = new MemorySystemTests();
  tests.runAll().catch(console.error);
}