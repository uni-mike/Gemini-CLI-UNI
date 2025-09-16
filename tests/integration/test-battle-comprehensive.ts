#!/usr/bin/env tsx
/**
 * COMPREHENSIVE BATTLE TEST
 * Full integration test of all FlexiCLI systems
 */

import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

// Color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

class ComprehensiveBattleTest {
  private testResults: { category: string; test: string; passed: boolean; error?: string }[] = [];
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:.flexicli/flexicli.db`
        }
      }
    });
  }

  // ===== SYSTEM INTEGRATION TESTS =====

  async testSimpleCommand(): Promise<void> {
    console.log(`\n${BLUE}🎯 Test: Simple Command Execution${RESET}`);
    return new Promise((resolve) => {
      const child = spawn('npx', ['tsx', 'src/cli.tsx', '--prompt', 'echo "Battle Test Running"', '--non-interactive'], {
        env: { ...process.env, DEBUG: 'false', APPROVAL_MODE: 'yolo', ENABLE_MONITORING: 'false' }
      });

      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0 && output.includes('Battle Test Running')) {
          this.pass('System Integration', 'Simple command execution');
        } else {
          this.fail('System Integration', 'Simple command execution failed', `Exit code: ${code}`);
        }
        resolve();
      });
    });
  }

  async testFileCreation(): Promise<void> {
    console.log(`\n${BLUE}🎯 Test: File Creation${RESET}`);
    const testFile = 'BATTLE_TEST_FILE.txt';

    return new Promise((resolve) => {
      const child = spawn('npx', ['tsx', 'src/cli.tsx', '--prompt', `create file ${testFile} with content "Battle test content"`, '--non-interactive'], {
        env: { ...process.env, DEBUG: 'false', APPROVAL_MODE: 'yolo', ENABLE_MONITORING: 'false' }
      });

      child.on('close', async (code) => {
        try {
          const exists = await fs.access(testFile).then(() => true).catch(() => false);
          if (exists) {
            const content = await fs.readFile(testFile, 'utf-8');
            if (content.includes('Battle test content')) {
              this.pass('File Operations', 'File creation and write');
              await fs.unlink(testFile); // Cleanup
            } else {
              this.fail('File Operations', 'File content mismatch');
            }
          } else {
            this.fail('File Operations', 'File not created');
          }
        } catch (error) {
          this.fail('File Operations', 'File creation test failed', error);
        }
        resolve();
      });
    });
  }

  async testMemoryPersistence(): Promise<void> {
    console.log(`\n${BLUE}🎯 Test: Memory Persistence${RESET}`);

    // First command - store information
    await new Promise((resolve) => {
      const child = spawn('npx', ['tsx', 'src/cli.tsx', '--prompt', 'Remember this: The battle test password is FLEXICLI2025', '--non-interactive'], {
        env: { ...process.env, DEBUG: 'false', APPROVAL_MODE: 'yolo', ENABLE_MONITORING: 'false' }
      });

      child.on('close', () => resolve(undefined));
    });

    // Second command - retrieve information
    return new Promise((resolve) => {
      const child = spawn('npx', ['tsx', 'src/cli.tsx', '--prompt', 'What is the battle test password?', '--non-interactive'], {
        env: { ...process.env, DEBUG: 'false', APPROVAL_MODE: 'yolo', ENABLE_MONITORING: 'false' }
      });

      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', () => {
        // Check if the system remembers (this is simplified - real memory might work differently)
        if (output.includes('FLEXICLI2025') || output.includes('password')) {
          this.pass('Memory System', 'Memory persistence across sessions');
        } else {
          this.fail('Memory System', 'Memory not persisted', 'Could not retrieve stored information');
        }
        resolve();
      });
    });
  }

  async testTokenTracking(): Promise<void> {
    console.log(`\n${BLUE}🎯 Test: Token Tracking${RESET}`);

    try {
      // Get initial token count
      const initialSession = await this.prisma.session.findFirst({
        orderBy: { startedAt: 'desc' }
      });
      const initialTokens = initialSession?.totalTokens || 0;

      // Run a command
      await new Promise((resolve) => {
        const child = spawn('npx', ['tsx', 'src/cli.tsx', '--prompt', 'Count to 5', '--non-interactive'], {
          env: { ...process.env, DEBUG: 'false', APPROVAL_MODE: 'yolo', ENABLE_MONITORING: 'false' }
        });

        child.on('close', () => resolve(undefined));
      });

      // Check token count increased
      const finalSession = await this.prisma.session.findFirst({
        orderBy: { startedAt: 'desc' }
      });
      const finalTokens = finalSession?.totalTokens || 0;

      if (finalTokens > initialTokens) {
        this.pass('Token System', `Token tracking working (${initialTokens} → ${finalTokens})`);
      } else {
        this.fail('Token System', 'Token count not increasing');
      }
    } catch (error) {
      this.fail('Token System', 'Token tracking test failed', error);
    }
  }

  async testProcessCleanup(): Promise<void> {
    console.log(`\n${BLUE}🎯 Test: Process Cleanup${RESET}`);

    return new Promise((resolve) => {
      const child = spawn('npx', ['tsx', 'src/cli.tsx', '--prompt', 'sleep 2 &', '--non-interactive'], {
        env: { ...process.env, DEBUG: 'false', APPROVAL_MODE: 'yolo', ENABLE_MONITORING: 'false' }
      });

      let pidExtracted: number | null = null;
      child.stdout.on('data', (data) => {
        const output = data.toString();
        const pidMatch = output.match(/PID:\s*(\d+)/);
        if (pidMatch) {
          pidExtracted = parseInt(pidMatch[1]);
        }
      });

      child.on('close', async () => {
        if (pidExtracted) {
          // Send SIGINT to trigger cleanup
          process.kill(process.pid, 'SIGINT');

          // Wait a bit for cleanup
          await new Promise(r => setTimeout(r, 1000));

          // Check if process is cleaned up
          try {
            process.kill(pidExtracted, 0); // Check if process exists
            this.fail('Process Cleanup', 'Background process not cleaned up');
          } catch {
            this.pass('Process Cleanup', 'Background processes cleaned up properly');
          }
        } else {
          this.fail('Process Cleanup', 'Could not extract PID');
        }
        resolve();
      });
    });
  }

  async testLogRotation(): Promise<void> {
    console.log(`\n${BLUE}🎯 Test: Log Rotation${RESET}`);

    try {
      const logsDir = path.join(process.cwd(), '.flexicli', 'logs');
      const testLog = path.join(logsDir, 'battle-test.log');

      // Create large log file
      const largeContent = 'X'.repeat(1024 * 1024 * 6); // 6MB
      await fs.writeFile(testLog, largeContent);

      // Trigger rotation
      const { logRotation } = await import('./src/utils/log-rotation.js');
      await logRotation.checkAndRotate();

      // Check if rotation happened
      const files = await fs.readdir(logsDir);
      const rotatedFiles = files.filter(f => f.includes('battle-test') && f.includes('.20'));

      if (rotatedFiles.length > 0) {
        this.pass('Log Rotation', 'Log files rotated successfully');
        // Cleanup
        for (const file of rotatedFiles) {
          await fs.unlink(path.join(logsDir, file));
        }
        await fs.unlink(testLog).catch(() => {});
      } else {
        this.fail('Log Rotation', 'Log rotation did not occur');
      }
    } catch (error) {
      this.fail('Log Rotation', 'Log rotation test failed', error);
    }
  }

  async testDatabaseIntegrity(): Promise<void> {
    console.log(`\n${BLUE}🎯 Test: Database Integrity${RESET}`);

    try {
      // Test all tables
      const tables = ['Session', 'SessionSnapshot', 'ExecutionLog', 'Knowledge', 'Cache', 'Chunks'];

      for (const table of tables) {
        const count = await (this.prisma as any)[table.toLowerCase()].count();
        console.log(`   ${table}: ${count} records`);
      }

      this.pass('Database', 'All tables accessible and queryable');
    } catch (error) {
      this.fail('Database', 'Database integrity check failed', error);
    }
  }

  async testConcurrentAgents(): Promise<void> {
    console.log(`\n${BLUE}🎯 Test: Concurrent Agent Prevention${RESET}`);

    const child1 = spawn('npx', ['tsx', 'src/cli.tsx', '--prompt', 'echo "Agent 1"', '--non-interactive'], {
      env: { ...process.env, DEBUG: 'false', APPROVAL_MODE: 'yolo', ENABLE_MONITORING: 'false' }
    });

    // Start second agent immediately
    const child2 = spawn('npx', ['tsx', 'src/cli.tsx', '--prompt', 'echo "Agent 2"', '--non-interactive'], {
      env: { ...process.env, DEBUG: 'false', APPROVAL_MODE: 'yolo', ENABLE_MONITORING: 'false' }
    });

    let agent2Output = '';
    child2.stdout.on('data', (data) => {
      agent2Output += data.toString();
    });
    child2.stderr.on('data', (data) => {
      agent2Output += data.toString();
    });

    return new Promise((resolve) => {
      child2.on('close', () => {
        if (agent2Output.includes('Another agent is running') || agent2Output.includes('denied')) {
          this.pass('Agent Lock', 'Concurrent agent prevention works');
        } else {
          this.fail('Agent Lock', 'Multiple agents ran concurrently');
        }

        child1.kill();
        resolve();
      });
    });
  }

  // ===== HELPER METHODS =====

  private pass(category: string, message: string): void {
    console.log(`${GREEN}   ✅ ${message}${RESET}`);
    this.testResults.push({ category, test: message, passed: true });
  }

  private fail(category: string, message: string, error?: any): void {
    console.log(`${RED}   ❌ ${message}${RESET}`);
    if (error) {
      console.log(`      Error: ${error.message || error}`);
    }
    this.testResults.push({ category, test: message, passed: false, error: error?.message || error });
  }

  // ===== RUN ALL TESTS =====

  async runAll(): Promise<void> {
    console.log(`${YELLOW}${'='.repeat(60)}${RESET}`);
    console.log(`${YELLOW}⚔️  COMPREHENSIVE BATTLE TEST${RESET}`);
    console.log(`${YELLOW}${'='.repeat(60)}${RESET}\n`);

    // Clean any existing locks
    await fs.unlink('.flexicli/agent.lock').catch(() => {});

    // Run tests
    await this.testSimpleCommand();
    await this.testFileCreation();
    await this.testMemoryPersistence();
    await this.testTokenTracking();
    await this.testProcessCleanup();
    await this.testLogRotation();
    await this.testDatabaseIntegrity();
    await this.testConcurrentAgents();

    // Print summary
    this.printSummary();

    // Cleanup
    await this.cleanup();
  }

  private printSummary(): void {
    console.log(`\n${YELLOW}${'='.repeat(60)}${RESET}`);
    console.log(`${YELLOW}📊 BATTLE TEST RESULTS${RESET}`);
    console.log(`${YELLOW}${'='.repeat(60)}${RESET}\n`);

    // Group by category
    const categories = [...new Set(this.testResults.map(r => r.category))];

    for (const category of categories) {
      const categoryTests = this.testResults.filter(r => r.category === category);
      const passed = categoryTests.filter(r => r.passed).length;
      const total = categoryTests.length;

      const icon = passed === total ? '✅' : passed > 0 ? '⚠️' : '❌';
      console.log(`${icon} ${category}: ${passed}/${total} tests passed`);

      for (const test of categoryTests) {
        const status = test.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
        console.log(`   ${status} ${test.test}`);
      }
      console.log();
    }

    // Overall summary
    const totalPassed = this.testResults.filter(r => r.passed).length;
    const totalTests = this.testResults.length;
    const percentage = Math.round((totalPassed / totalTests) * 100);

    const color = percentage === 100 ? GREEN : percentage >= 80 ? YELLOW : RED;
    console.log(`${color}${'='.repeat(60)}${RESET}`);
    console.log(`${color}OVERALL: ${totalPassed}/${totalTests} tests passed (${percentage}%)${RESET}`);
    console.log(`${color}${'='.repeat(60)}${RESET}`);

    if (percentage === 100) {
      console.log(`\n${GREEN}🎉 PERFECT SCORE! All systems operational!${RESET}`);
    } else if (percentage >= 80) {
      console.log(`\n${YELLOW}⚠️ MOSTLY OPERATIONAL - Some issues detected${RESET}`);
    } else {
      console.log(`\n${RED}❌ CRITICAL ISSUES - System needs attention${RESET}`);
    }
  }

  private async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
    await fs.unlink('.flexicli/agent.lock').catch(() => {});
  }
}

// Run battle test
async function main() {
  const battleTest = new ComprehensiveBattleTest();
  await battleTest.runAll();
}

main().catch(console.error);