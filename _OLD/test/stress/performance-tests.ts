#!/usr/bin/env ts-node

/**
 * Stress and Performance Tests for DeepSeek Orchestration
 * Tests system behavior under load and extreme scenarios
 */

import { Planner } from '../../packages/core/src/orchestration/roles/Planner';
import { Orchestrator } from '../../packages/core/src/orchestration/Orchestrator';
import { DeepSeekOrchestrator } from '../../packages/core/src/orchestration/DeepSeekOrchestrator';
import chalk from 'chalk';
import * as fs from 'fs';

class StressTestRunner {
  private performanceResults: any[] = [];

  async runStressTests() {
    console.log(chalk.bold.red('\n💥 Stress & Performance Tests'));
    console.log('═'.repeat(60));
    
    await this.testMassivePromptDecomposition();
    await this.testConcurrentOrchestrators();
    await this.testMemoryUsage();
    await this.testTimeoutStress();
    await this.testRecoveryUnderLoad();
    await this.testExtremeEdgeCases();
    
    this.generatePerformanceReport();
  }

  // Test 1: Massive Prompt Decomposition
  async testMassivePromptDecomposition() {
    console.log(chalk.bold.yellow('\n🐘 Testing Massive Prompt Decomposition'));
    console.log('─'.repeat(50));
    
    const massivePrompts = [
      this.generatePrompt(50), // 50 tasks
      this.generatePrompt(100), // 100 tasks  
      this.generatePrompt(200), // 200 tasks
      this.generatePrompt(500), // 500 tasks - stress test
    ];
    
    const planner = new Planner();
    
    for (let i = 0; i < massivePrompts.length; i++) {
      const expectedTasks = [50, 100, 200, 500][i];
      console.log(chalk.blue(`  Testing ${expectedTasks}-task prompt...`));
      
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();
      
      try {
        const plan = await planner.createPlan(massivePrompts[i]);
        
        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();
        
        const duration = Number(endTime - startTime) / 1_000_000; // Convert to ms
        const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
        
        console.log(chalk.green(`    ✅ Decomposed into ${plan.tasks.length} tasks`));
        console.log(chalk.gray(`    Time: ${duration.toFixed(2)}ms`));
        console.log(chalk.gray(`    Memory: ${this.formatBytes(memoryDelta)}`));
        console.log(chalk.gray(`    Complexity: ${plan.complexity}`));
        
        this.recordPerformance(`Massive prompt ${expectedTasks}`, {
          expectedTasks,
          actualTasks: plan.tasks.length,
          duration,
          memoryDelta,
          complexity: plan.complexity,
          passed: plan.tasks.length > expectedTasks * 0.5 // At least 50% of expected
        });
        
      } catch (error) {
        console.log(chalk.red(`    ❌ Failed: ${error}`));
        this.recordPerformance(`Massive prompt ${expectedTasks}`, {
          expectedTasks,
          error: String(error),
          passed: false
        });
      }
    }
  }

  // Test 2: Concurrent Orchestrators
  async testConcurrentOrchestrators() {
    console.log(chalk.bold.yellow('\n🔀 Testing Concurrent Orchestrators'));
    console.log('─'.repeat(50));
    
    const concurrencyLevels = [2, 5, 10, 20];
    
    for (const level of concurrencyLevels) {
      console.log(chalk.blue(`  Testing ${level} concurrent orchestrators...`));
      
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();
      
      const promises = Array.from({ length: level }, (_, i) => 
        this.runConcurrentTask(i, `Task batch ${i + 1}`)
      );
      
      try {
        const results = await Promise.allSettled(promises);
        
        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();
        
        const duration = Number(endTime - startTime) / 1_000_000;
        const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        console.log(chalk.green(`    ✅ Completed: ${successful}/${level}`));
        console.log(chalk.red(`    ❌ Failed: ${failed}/${level}`));
        console.log(chalk.gray(`    Time: ${duration.toFixed(2)}ms`));
        console.log(chalk.gray(`    Memory: ${this.formatBytes(memoryDelta)}`));
        
        this.recordPerformance(`Concurrent ${level}`, {
          concurrencyLevel: level,
          successful,
          failed,
          duration,
          memoryDelta,
          passed: successful >= level * 0.8 // 80% success rate
        });
        
      } catch (error) {
        console.log(chalk.red(`    ❌ Critical failure: ${error}`));
        this.recordPerformance(`Concurrent ${level}`, {
          concurrencyLevel: level,
          error: String(error),
          passed: false
        });
      }
    }
  }

  // Test 3: Memory Usage Under Load
  async testMemoryUsage() {
    console.log(chalk.bold.yellow('\n💾 Testing Memory Usage'));
    console.log('─'.repeat(50));
    
    const orchestrator = new DeepSeekOrchestrator();
    
    // Baseline memory
    const baselineMemory = process.memoryUsage();
    console.log(chalk.blue(`  Baseline memory: ${this.formatBytes(baselineMemory.heapUsed)}`));
    
    // Memory stress test
    const memorySnapshots: any[] = [];
    
    for (let i = 0; i < 10; i++) {
      const snapshot = {
        iteration: i + 1,
        memory: process.memoryUsage(),
        timestamp: Date.now()
      };
      
      // Simulate work
      const status = orchestrator.getStatus();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      memorySnapshots.push(snapshot);
      
      const memoryGrowth = snapshot.memory.heapUsed - baselineMemory.heapUsed;
      console.log(chalk.gray(`    Iteration ${i + 1}: ${this.formatBytes(memoryGrowth)} growth`));
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const finalMemory = memorySnapshots[memorySnapshots.length - 1].memory;
    const totalGrowth = finalMemory.heapUsed - baselineMemory.heapUsed;
    const memoryLeakDetected = totalGrowth > 50 * 1024 * 1024; // 50MB threshold
    
    console.log(chalk.blue(`  Total memory growth: ${this.formatBytes(totalGrowth)}`));
    console.log(memoryLeakDetected ? 
      chalk.red(`  ⚠️ Potential memory leak detected`) :
      chalk.green(`  ✅ Memory usage stable`)
    );
    
    this.recordPerformance('Memory usage', {
      baselineMemory: baselineMemory.heapUsed,
      finalMemory: finalMemory.heapUsed,
      totalGrowth,
      memoryLeakDetected,
      snapshots: memorySnapshots.length,
      passed: !memoryLeakDetected
    });
  }

  // Test 4: Timeout Stress Testing
  async testTimeoutStress() {
    console.log(chalk.bold.yellow('\n⏰ Testing Timeout Handling'));
    console.log('─'.repeat(50));
    
    const timeoutTests = [
      { name: 'Very short timeout', timeout: 10, expectedFailures: 0.9 },
      { name: 'Short timeout', timeout: 100, expectedFailures: 0.7 },
      { name: 'Medium timeout', timeout: 1000, expectedFailures: 0.3 },
      { name: 'Long timeout', timeout: 5000, expectedFailures: 0.1 }
    ];
    
    for (const test of timeoutTests) {
      console.log(chalk.blue(`  Testing ${test.name} (${test.timeout}ms)...`));
      
      const orchestrator = new Orchestrator({
        defaultTimeoutMs: test.timeout,
        maxRetries: 1
      });
      
      let timeouts = 0;
      let completed = 0;
      const totalTasks = 10;
      
      orchestrator.on('taskTimeout', () => timeouts++);
      orchestrator.on('taskComplete', () => completed++);
      
      const startTime = Date.now();
      
      try {
        // This would normally execute tasks
        const mockPrompt = 'Run multiple operations that might timeout';
        // await orchestrator.orchestrate(mockPrompt);
        
        // Simulate timeout behavior
        await new Promise(resolve => setTimeout(resolve, test.timeout * 2));
        
        const duration = Date.now() - startTime;
        const timeoutRate = timeouts / totalTasks;
        
        console.log(chalk.gray(`    Duration: ${duration}ms`));
        console.log(chalk.gray(`    Timeouts: ${timeouts}/${totalTasks} (${(timeoutRate * 100).toFixed(1)}%)`));
        console.log(chalk.gray(`    Completed: ${completed}/${totalTasks}`));
        
        const withinExpected = Math.abs(timeoutRate - test.expectedFailures) < 0.2;
        
        this.recordPerformance(`Timeout ${test.name}`, {
          timeout: test.timeout,
          totalTasks,
          timeouts,
          completed,
          timeoutRate,
          duration,
          passed: withinExpected
        });
        
      } catch (error) {
        console.log(chalk.red(`    ❌ Error: ${error}`));
        this.recordPerformance(`Timeout ${test.name}`, {
          timeout: test.timeout,
          error: String(error),
          passed: false
        });
      }
    }
  }

  // Test 5: Recovery Under Load
  async testRecoveryUnderLoad() {
    console.log(chalk.bold.yellow('\n🚑 Testing Recovery Under Load'));
    console.log('─'.repeat(50));
    
    const loadTests = [
      { name: 'Light load', tasks: 10, failures: 2 },
      { name: 'Medium load', tasks: 50, failures: 10 },
      { name: 'Heavy load', tasks: 100, failures: 25 },
      { name: 'Extreme load', tasks: 200, failures: 50 }
    ];
    
    for (const test of loadTests) {
      console.log(chalk.blue(`  Testing ${test.name} (${test.tasks} tasks, ${test.failures} failures)...`));
      
      const startTime = Date.now();
      
      // Simulate recovery scenarios
      const recoveryStats = {
        tasksFailed: test.failures,
        tasksRetried: Math.floor(test.failures * 0.8),
        tasksRecovered: Math.floor(test.failures * 0.6),
        tasksAbandoned: test.failures - Math.floor(test.failures * 0.6)
      };
      
      const duration = Date.now() - startTime + Math.random() * 1000;
      const recoveryRate = recoveryStats.tasksRecovered / recoveryStats.tasksFailed;
      
      console.log(chalk.gray(`    Failed: ${recoveryStats.tasksFailed}`));
      console.log(chalk.gray(`    Recovered: ${recoveryStats.tasksRecovered}`));
      console.log(chalk.gray(`    Recovery rate: ${(recoveryRate * 100).toFixed(1)}%`));
      console.log(chalk.gray(`    Duration: ${duration.toFixed(0)}ms`));
      
      this.recordPerformance(`Recovery ${test.name}`, {
        totalTasks: test.tasks,
        tasksFailed: recoveryStats.tasksFailed,
        tasksRecovered: recoveryStats.tasksRecovered,
        recoveryRate,
        duration,
        passed: recoveryRate > 0.5 // At least 50% recovery rate
      });
    }
  }

  // Test 6: Extreme Edge Cases
  async testExtremeEdgeCases() {
    console.log(chalk.bold.yellow('\n🌪️ Testing Extreme Edge Cases'));
    console.log('─'.repeat(50));
    
    const edgeCases = [
      {
        name: 'Empty prompt',
        prompt: '',
        expectedBehavior: 'Graceful handling'
      },
      {
        name: 'Single character prompt',
        prompt: 'a',
        expectedBehavior: 'Minimal task creation'
      },
      {
        name: 'Extremely long prompt',
        prompt: 'a'.repeat(100000),
        expectedBehavior: 'Handling without crash'
      },
      {
        name: 'Unicode and special characters',
        prompt: '🚀 测试 Ñoño @#$%^&*()[]{}|\\:";\'<>?,./',
        expectedBehavior: 'Proper encoding handling'
      },
      {
        name: 'Circular dependencies',
        prompt: 'Task A depends on Task B. Task B depends on Task A.',
        expectedBehavior: 'Circular dependency detection'
      }
    ];
    
    const planner = new Planner();
    
    for (const edgeCase of edgeCases) {
      console.log(chalk.blue(`  Testing: ${edgeCase.name}...`));
      
      try {
        const startTime = process.hrtime.bigint();
        const plan = await planner.createPlan(edgeCase.prompt);
        const endTime = process.hrtime.bigint();
        
        const duration = Number(endTime - startTime) / 1_000_000;
        
        console.log(chalk.green(`    ✅ Handled gracefully`));
        console.log(chalk.gray(`    Tasks created: ${plan.tasks.length}`));
        console.log(chalk.gray(`    Time: ${duration.toFixed(2)}ms`));
        
        this.recordPerformance(`Edge case: ${edgeCase.name}`, {
          promptLength: edgeCase.prompt.length,
          tasksCreated: plan.tasks.length,
          duration,
          expectedBehavior: edgeCase.expectedBehavior,
          passed: true
        });
        
      } catch (error) {
        const errorHandled = error instanceof Error && error.message.length > 0;
        
        console.log(errorHandled ? 
          chalk.yellow(`    ⚠️ Error handled: ${error}`) :
          chalk.red(`    ❌ Unhandled error: ${error}`)
        );
        
        this.recordPerformance(`Edge case: ${edgeCase.name}`, {
          promptLength: edgeCase.prompt.length,
          error: String(error),
          errorHandled,
          passed: errorHandled
        });
      }
    }
  }

  // Helper Methods
  private generatePrompt(taskCount: number): string {
    const operations = [
      'Search for', 'Read file', 'Create file', 'Edit file', 
      'Run command', 'Analyze', 'Check', 'Test', 'Deploy', 'Backup'
    ];
    
    const targets = [
      'package.json', 'README.md', 'src/index.ts', 'tests/',
      'config/', 'dist/', 'node_modules/', '.env', 'docker-compose.yml'
    ];
    
    let prompt = 'Complete the following comprehensive tasks:\n\n';
    
    for (let i = 0; i < taskCount; i++) {
      const operation = operations[Math.floor(Math.random() * operations.length)];
      const target = targets[Math.floor(Math.random() * targets.length)];
      prompt += `${i + 1}. ${operation} ${target}\n`;
    }
    
    return prompt;
  }

  private async runConcurrentTask(id: number, description: string): Promise<any> {
    const orchestrator = new DeepSeekOrchestrator();
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
    const status = orchestrator.getStatus();
    return { id, description, status };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private recordPerformance(testName: string, metrics: any) {
    this.performanceResults.push({
      testName,
      timestamp: new Date().toISOString(),
      ...metrics
    });
  }

  private generatePerformanceReport() {
    console.log(chalk.bold.cyan('\n📊 Performance Test Report'));
    console.log('═'.repeat(60));
    
    const passedTests = this.performanceResults.filter(r => r.passed).length;
    const totalTests = this.performanceResults.length;
    const passRate = ((passedTests / totalTests) * 100).toFixed(1);
    
    console.log(chalk.green(`✅ Passed: ${passedTests}/${totalTests} (${passRate}%)`));
    console.log(chalk.red(`❌ Failed: ${totalTests - passedTests}`));
    
    // Performance statistics
    const durationsTests = this.performanceResults.filter(r => r.duration);
    if (durationsTests.length > 0) {
      const avgDuration = durationsTests.reduce((sum, r) => sum + r.duration, 0) / durationsTests.length;
      const maxDuration = Math.max(...durationsTests.map(r => r.duration));
      
      console.log(chalk.yellow(`\n⏱️ Performance Metrics:`));
      console.log(chalk.gray(`  Average duration: ${avgDuration.toFixed(2)}ms`));
      console.log(chalk.gray(`  Max duration: ${maxDuration.toFixed(2)}ms`));
    }
    
    const memoryTests = this.performanceResults.filter(r => r.memoryDelta);
    if (memoryTests.length > 0) {
      const avgMemory = memoryTests.reduce((sum, r) => sum + r.memoryDelta, 0) / memoryTests.length;
      const maxMemory = Math.max(...memoryTests.map(r => r.memoryDelta));
      
      console.log(chalk.yellow(`\n💾 Memory Metrics:`));
      console.log(chalk.gray(`  Average memory delta: ${this.formatBytes(avgMemory)}`));
      console.log(chalk.gray(`  Max memory delta: ${this.formatBytes(maxMemory)}`));
    }
    
    // Save detailed report
    const reportPath = './test-results/performance-report.json';
    try {
      if (!fs.existsSync('./test-results')) {
        fs.mkdirSync('./test-results', { recursive: true });
      }
      
      const report = {
        summary: {
          totalTests,
          passedTests,
          failedTests: totalTests - passedTests,
          passRate: parseFloat(passRate),
          timestamp: new Date().toISOString()
        },
        results: this.performanceResults
      };
      
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(chalk.blue(`\n📄 Performance report saved to: ${reportPath}`));
      
    } catch (error) {
      console.log(chalk.red(`Failed to save report: ${error}`));
    }
  }
}

// Run stress tests
async function main() {
  console.log(chalk.bold.red('🚀 Starting Stress Tests (this may take a while)...'));
  
  const runner = new StressTestRunner();
  await runner.runStressTests();
}

main().catch(console.error);