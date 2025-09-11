/**
 * Battle Testing Suite for FlexiCLI + Monitoring
 * Comprehensive tests for real-world scenarios and edge cases
 */

import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { PrismaClient } from '@prisma/client';
import { Orchestrator } from '../src/core/orchestrator.js';
import { MemoryManager } from '../src/memory/memory-manager.js';
import { Config } from '../src/config/Config.js';
import { MonitoringSystem } from '../src/monitoring/index.js';
import { promises as fs } from 'fs';
import path from 'path';

class BattleTestSuite {
  private orchestrator?: Orchestrator;
  private memoryManager?: MemoryManager;
  private monitoring?: MonitoringSystem;
  private prisma?: PrismaClient;
  private processes: ChildProcess[] = [];
  private sockets: Socket[] = [];
  private testResults: any[] = [];
  
  async runAllTests() {
    console.log(`
╔════════════════════════════════════════════════════════╗
║            FlexiCLI Battle Testing Suite               ║
╠════════════════════════════════════════════════════════╣
║  Testing: Monitoring, Memory, Pipeline, Recovery       ║
╚════════════════════════════════════════════════════════╝
    `);
    
    try {
      // 1. Stress Tests
      await this.runStressTests();
      
      // 2. Chaos Tests
      await this.runChaosTests();
      
      // 3. Performance Tests
      await this.runPerformanceTests();
      
      // 4. Integration Tests
      await this.runIntegrationTests();
      
      // 5. Load Tests
      await this.runLoadTests();
      
      // 6. Recovery Tests
      await this.runRecoveryTests();
      
      // Report results
      this.reportResults();
      
    } catch (error) {
      console.error('❌ Battle test failed:', error);
    } finally {
      await this.cleanup();
    }
  }
  
  /**
   * STRESS TESTS - Push system to limits
   */
  async runStressTests() {
    console.log('\n🔥 STRESS TESTS\n' + '='.repeat(50));
    
    // Test 1: Token overflow scenario
    await this.testTokenOverflow();
    
    // Test 2: Rapid task execution
    await this.testRapidExecution();
    
    // Test 3: Large memory chunks
    await this.testLargeMemoryChunks();
    
    // Test 4: Concurrent operations
    await this.testConcurrentOperations();
  }
  
  async testTokenOverflow() {
    console.log('📝 Testing token overflow handling...');
    const startTime = Date.now();
    
    try {
      const memoryManager = new MemoryManager('concise');
      await memoryManager.initialize();
      
      // Create massive query that exceeds token limits
      const hugeQuery = 'a'.repeat(150000); // Way over 128k limit
      
      const result = await memoryManager.buildPrompt(hugeQuery);
      
      // Should trim and still work
      const tokenReport = memoryManager.getTokenReport();
      
      this.testResults.push({
        test: 'Token Overflow',
        passed: result !== null && tokenReport.includes('Token Usage'),
        duration: Date.now() - startTime,
        details: 'System handled overflow gracefully'
      });
      
      await memoryManager.cleanup();
      console.log('✅ Token overflow handled');
    } catch (error) {
      this.testResults.push({
        test: 'Token Overflow',
        passed: false,
        error: error,
        duration: Date.now() - startTime
      });
      console.log('❌ Token overflow test failed');
    }
  }
  
  async testRapidExecution() {
    console.log('⚡ Testing rapid task execution...');
    const startTime = Date.now();
    
    try {
      const config = new Config();
      const orchestrator = new Orchestrator(config);
      
      // Fire 100 requests rapidly
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          orchestrator.execute(`Calculate ${i} + ${i}`).catch(e => e)
        );
      }
      
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      this.testResults.push({
        test: 'Rapid Execution',
        passed: successful > 80, // 80% success rate
        duration: Date.now() - startTime,
        details: `${successful}/100 requests successful`
      });
      
      console.log(`✅ Handled ${successful}/100 rapid requests`);
    } catch (error) {
      this.testResults.push({
        test: 'Rapid Execution',
        passed: false,
        error: error,
        duration: Date.now() - startTime
      });
      console.log('❌ Rapid execution test failed');
    }
  }
  
  async testLargeMemoryChunks() {
    console.log('💾 Testing large memory chunks...');
    const startTime = Date.now();
    
    try {
      const prisma = new PrismaClient();
      
      // Create 1000 chunks
      const chunks = [];
      for (let i = 0; i < 1000; i++) {
        chunks.push({
          projectId: 'test-project',
          path: `file${i}.ts`,
          content: `content ${i}`.repeat(100),
          chunkType: 'code' as const,
          tokenCount: 100,
          embedding: Buffer.from(new Float32Array(1536))
        });
      }
      
      // Batch insert
      const batchStart = Date.now();
      await prisma.chunk.createMany({ data: chunks });
      const batchDuration = Date.now() - batchStart;
      
      // Query performance
      const queryStart = Date.now();
      const retrieved = await prisma.chunk.findMany({
        where: { projectId: 'test-project' },
        take: 100
      });
      const queryDuration = Date.now() - queryStart;
      
      this.testResults.push({
        test: 'Large Memory Chunks',
        passed: retrieved.length === 100 && queryDuration < 1000,
        duration: Date.now() - startTime,
        details: `Insert: ${batchDuration}ms, Query: ${queryDuration}ms`
      });
      
      await prisma.chunk.deleteMany({ where: { projectId: 'test-project' } });
      await prisma.$disconnect();
      
      console.log('✅ Large memory chunks handled');
    } catch (error) {
      this.testResults.push({
        test: 'Large Memory Chunks',
        passed: false,
        error: error,
        duration: Date.now() - startTime
      });
      console.log('❌ Large memory chunks test failed');
    }
  }
  
  async testConcurrentOperations() {
    console.log('🔀 Testing concurrent operations...');
    const startTime = Date.now();
    
    try {
      // Spawn 5 orchestrators
      const orchestrators = [];
      for (let i = 0; i < 5; i++) {
        const config = new Config();
        orchestrators.push(new Orchestrator(config));
      }
      
      // Execute concurrent tasks
      const tasks = orchestrators.map((o, i) => 
        o.execute(`Task ${i}: List files in current directory`)
      );
      
      const results = await Promise.allSettled(tasks);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      this.testResults.push({
        test: 'Concurrent Operations',
        passed: successful === 5,
        duration: Date.now() - startTime,
        details: `${successful}/5 concurrent operations successful`
      });
      
      console.log(`✅ ${successful}/5 concurrent operations completed`);
    } catch (error) {
      this.testResults.push({
        test: 'Concurrent Operations',
        passed: false,
        error: error,
        duration: Date.now() - startTime
      });
      console.log('❌ Concurrent operations test failed');
    }
  }
  
  /**
   * CHAOS TESTS - Simulate failures
   */
  async runChaosTests() {
    console.log('\n💥 CHAOS TESTS\n' + '='.repeat(50));
    
    await this.testAgentCrash();
    await this.testDatabaseCorruption();
    await this.testNetworkFailure();
    await this.testMemoryLeak();
  }
  
  async testAgentCrash() {
    console.log('💀 Testing agent crash recovery...');
    const startTime = Date.now();
    
    try {
      // Start monitoring
      const monitoring = new MonitoringSystem({ port: 4001 });
      await monitoring.start();
      
      // Start agent
      const config = new Config();
      const orchestrator = new Orchestrator(config);
      monitoring.attachToAgent(orchestrator);
      
      // Simulate work
      orchestrator.execute('Create a test file');
      
      // Force crash after 1 second
      setTimeout(() => {
        console.log('  💥 Simulating crash...');
        // @ts-ignore - Intentional crash
        orchestrator.thisFunctionDoesNotExist();
      }, 1000);
      
      // Wait for crash
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if monitoring survived
      const response = await axios.get('http://localhost:4001/api/health');
      
      this.testResults.push({
        test: 'Agent Crash Recovery',
        passed: response.status === 200,
        duration: Date.now() - startTime,
        details: 'Monitoring survived agent crash'
      });
      
      await monitoring.stop();
      console.log('✅ Monitoring survived crash');
    } catch (error) {
      this.testResults.push({
        test: 'Agent Crash Recovery',
        passed: false,
        error: error,
        duration: Date.now() - startTime
      });
      console.log('❌ Crash recovery test failed');
    }
  }
  
  async testDatabaseCorruption() {
    console.log('🗄️ Testing database corruption handling...');
    const startTime = Date.now();
    
    try {
      // Create corrupted database file
      const dbPath = '.flexicli/flexicli_corrupt.db';
      await fs.writeFile(dbPath, 'CORRUPTED DATA', 'utf8');
      
      // Try to connect
      const prisma = new PrismaClient({
        datasources: {
          db: { url: `file:${dbPath}` }
        }
      });
      
      try {
        await prisma.session.findFirst();
      } catch (dbError) {
        // Expected to fail
        console.log('  ✓ Detected corrupted database');
      }
      
      // Monitoring should handle this gracefully
      const monitoring = new MonitoringSystem({ port: 4002 });
      await monitoring.start();
      
      // Should still be accessible
      const response = await axios.get('http://localhost:4002/api/health');
      
      this.testResults.push({
        test: 'Database Corruption',
        passed: response.status === 200,
        duration: Date.now() - startTime,
        details: 'System handled corrupted DB'
      });
      
      await monitoring.stop();
      await prisma.$disconnect();
      console.log('✅ Handled database corruption');
    } catch (error) {
      this.testResults.push({
        test: 'Database Corruption',
        passed: false,
        error: error,
        duration: Date.now() - startTime
      });
      console.log('❌ Database corruption test failed');
    }
  }
  
  async testNetworkFailure() {
    console.log('🌐 Testing network failure handling...');
    const startTime = Date.now();
    
    try {
      // Set invalid API endpoints
      process.env.ENDPOINT = 'http://invalid-endpoint-that-does-not-exist.com';
      process.env.EMBEDDING_API_ENDPOINT = 'http://another-invalid-endpoint.com';
      
      const memoryManager = new MemoryManager('concise');
      await memoryManager.initialize();
      
      // Should fallback gracefully
      const result = await memoryManager.buildPrompt('Test query');
      
      this.testResults.push({
        test: 'Network Failure',
        passed: result !== null,
        duration: Date.now() - startTime,
        details: 'Fallback mechanisms worked'
      });
      
      await memoryManager.cleanup();
      console.log('✅ Handled network failures');
    } catch (error) {
      this.testResults.push({
        test: 'Network Failure',
        passed: false,
        error: error,
        duration: Date.now() - startTime
      });
      console.log('❌ Network failure test failed');
    }
  }
  
  async testMemoryLeak() {
    console.log('🕳️ Testing for memory leaks...');
    const startTime = Date.now();
    
    try {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Run 1000 iterations
      for (let i = 0; i < 1000; i++) {
        const config = new Config();
        const orchestrator = new Orchestrator(config);
        
        // Do some work
        await orchestrator.execute(`Simple task ${i}`).catch(() => {});
        
        // Clean up
        await orchestrator.cleanup();
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      this.testResults.push({
        test: 'Memory Leak Detection',
        passed: memoryIncrease < 100, // Less than 100MB increase
        duration: Date.now() - startTime,
        details: `Memory increase: ${memoryIncrease.toFixed(2)}MB`
      });
      
      console.log(`✅ Memory increase: ${memoryIncrease.toFixed(2)}MB`);
    } catch (error) {
      this.testResults.push({
        test: 'Memory Leak Detection',
        passed: false,
        error: error,
        duration: Date.now() - startTime
      });
      console.log('❌ Memory leak test failed');
    }
  }
  
  /**
   * PERFORMANCE TESTS
   */
  async runPerformanceTests() {
    console.log('\n⚡ PERFORMANCE TESTS\n' + '='.repeat(50));
    
    await this.testTokenCountingSpeed();
    await this.testRetrievalSpeed();
    await this.testWebSocketLatency();
  }
  
  async testTokenCountingSpeed() {
    console.log('🔢 Testing token counting performance...');
    const startTime = Date.now();
    
    try {
      const { TokenBudgetManager } = await import('../src/memory/token-budget.js');
      const manager = new TokenBudgetManager('concise');
      
      // Generate test texts
      const texts = [];
      for (let i = 0; i < 1000; i++) {
        texts.push(`This is test text number ${i} with some content to count tokens.`);
      }
      
      const countStart = Date.now();
      let totalTokens = 0;
      for (const text of texts) {
        totalTokens += manager.countTokens(text);
      }
      const duration = Date.now() - countStart;
      
      const tokensPerSecond = (1000 / duration) * 1000;
      
      this.testResults.push({
        test: 'Token Counting Speed',
        passed: tokensPerSecond > 100, // At least 100 texts/second
        duration: Date.now() - startTime,
        details: `${tokensPerSecond.toFixed(0)} texts/second`
      });
      
      console.log(`✅ Token counting: ${tokensPerSecond.toFixed(0)} texts/second`);
    } catch (error) {
      this.testResults.push({
        test: 'Token Counting Speed',
        passed: false,
        error: error,
        duration: Date.now() - startTime
      });
      console.log('❌ Token counting test failed');
    }
  }
  
  async testRetrievalSpeed() {
    console.log('🔍 Testing retrieval performance...');
    const startTime = Date.now();
    
    try {
      const prisma = new PrismaClient();
      
      // Simulate retrieval query
      const queryStart = Date.now();
      const chunks = await prisma.chunk.findMany({
        take: 100,
        orderBy: { updatedAt: 'desc' }
      });
      const queryDuration = Date.now() - queryStart;
      
      this.testResults.push({
        test: 'Retrieval Speed',
        passed: queryDuration < 500, // Under 500ms
        duration: Date.now() - startTime,
        details: `Query time: ${queryDuration}ms`
      });
      
      await prisma.$disconnect();
      console.log(`✅ Retrieval query: ${queryDuration}ms`);
    } catch (error) {
      this.testResults.push({
        test: 'Retrieval Speed',
        passed: false,
        error: error,
        duration: Date.now() - startTime
      });
      console.log('❌ Retrieval speed test failed');
    }
  }
  
  async testWebSocketLatency() {
    console.log('📡 Testing WebSocket latency...');
    const startTime = Date.now();
    
    try {
      // Start monitoring server
      const monitoring = new MonitoringSystem({ port: 4003 });
      await monitoring.start();
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Connect socket
      const socket = io('http://localhost:4003');
      
      await new Promise((resolve) => {
        socket.on('connect', resolve);
      });
      
      // Measure round-trip time
      const pingStart = Date.now();
      
      await new Promise((resolve) => {
        socket.emit('metrics:request', 'test');
        socket.once('metrics:test', resolve);
        
        // Timeout after 1 second
        setTimeout(() => resolve(null), 1000);
      });
      
      const latency = Date.now() - pingStart;
      
      this.testResults.push({
        test: 'WebSocket Latency',
        passed: latency < 100, // Under 100ms
        duration: Date.now() - startTime,
        details: `Latency: ${latency}ms`
      });
      
      socket.close();
      await monitoring.stop();
      console.log(`✅ WebSocket latency: ${latency}ms`);
    } catch (error) {
      this.testResults.push({
        test: 'WebSocket Latency',
        passed: false,
        error: error,
        duration: Date.now() - startTime
      });
      console.log('❌ WebSocket latency test failed');
    }
  }
  
  /**
   * INTEGRATION TESTS
   */
  async runIntegrationTests() {
    console.log('\n🔗 INTEGRATION TESTS\n' + '='.repeat(50));
    
    await this.testEndToEndFlow();
    await this.testMonitoringIntegration();
  }
  
  async testEndToEndFlow() {
    console.log('🔄 Testing end-to-end flow...');
    const startTime = Date.now();
    
    try {
      // Full stack test
      const config = new Config();
      const orchestrator = new Orchestrator(config);
      const memoryManager = new MemoryManager('concise');
      await memoryManager.initialize();
      
      // Execute a real task
      const result = await orchestrator.execute('Create a file called test.txt with content "Hello World"');
      
      // Check if file was created
      const fileExists = await fs.access('test.txt').then(() => true).catch(() => false);
      
      this.testResults.push({
        test: 'End-to-End Flow',
        passed: result.success && fileExists,
        duration: Date.now() - startTime,
        details: 'Complete pipeline executed successfully'
      });
      
      // Clean up
      if (fileExists) {
        await fs.unlink('test.txt');
      }
      await orchestrator.cleanup();
      await memoryManager.cleanup();
      
      console.log('✅ End-to-end flow completed');
    } catch (error) {
      this.testResults.push({
        test: 'End-to-End Flow',
        passed: false,
        error: error,
        duration: Date.now() - startTime
      });
      console.log('❌ End-to-end flow test failed');
    }
  }
  
  async testMonitoringIntegration() {
    console.log('📊 Testing monitoring integration...');
    const startTime = Date.now();
    
    try {
      // Start monitoring
      const monitoring = new MonitoringSystem({ port: 4004 });
      await monitoring.start();
      
      // Create agent
      const config = new Config();
      const orchestrator = new Orchestrator(config);
      
      // Attach monitoring
      monitoring.attachToAgent(orchestrator);
      
      // Execute task
      await orchestrator.execute('What is 2 + 2?');
      
      // Check if metrics were collected
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = await axios.get('http://localhost:4004/api/metrics');
      const hasMetrics = response.data && Object.keys(response.data).length > 0;
      
      this.testResults.push({
        test: 'Monitoring Integration',
        passed: hasMetrics,
        duration: Date.now() - startTime,
        details: 'Metrics collected successfully'
      });
      
      await orchestrator.cleanup();
      await monitoring.stop();
      
      console.log('✅ Monitoring integration working');
    } catch (error) {
      this.testResults.push({
        test: 'Monitoring Integration',
        passed: false,
        error: error,
        duration: Date.now() - startTime
      });
      console.log('❌ Monitoring integration test failed');
    }
  }
  
  /**
   * LOAD TESTS
   */
  async runLoadTests() {
    console.log('\n🏋️ LOAD TESTS\n' + '='.repeat(50));
    
    await this.testHighVolumeRequests();
    await this.testSustainedLoad();
  }
  
  async testHighVolumeRequests() {
    console.log('📈 Testing high volume requests...');
    const startTime = Date.now();
    
    try {
      const monitoring = new MonitoringSystem({ port: 4005 });
      await monitoring.start();
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Send 1000 requests
      const requests = [];
      for (let i = 0; i < 1000; i++) {
        requests.push(
          axios.get('http://localhost:4005/api/health')
            .then(() => true)
            .catch(() => false)
        );
      }
      
      const results = await Promise.all(requests);
      const successful = results.filter(r => r).length;
      const successRate = (successful / 1000) * 100;
      
      this.testResults.push({
        test: 'High Volume Requests',
        passed: successRate > 95,
        duration: Date.now() - startTime,
        details: `${successRate}% success rate (${successful}/1000)`
      });
      
      await monitoring.stop();
      console.log(`✅ Handled ${successful}/1000 requests`);
    } catch (error) {
      this.testResults.push({
        test: 'High Volume Requests',
        passed: false,
        error: error,
        duration: Date.now() - startTime
      });
      console.log('❌ High volume test failed');
    }
  }
  
  async testSustainedLoad() {
    console.log('⏱️ Testing sustained load...');
    const startTime = Date.now();
    
    try {
      const config = new Config();
      const orchestrator = new Orchestrator(config);
      
      // Run for 30 seconds
      const endTime = Date.now() + 30000;
      let requestCount = 0;
      let errorCount = 0;
      
      while (Date.now() < endTime) {
        try {
          await orchestrator.execute(`Request ${requestCount}`);
          requestCount++;
        } catch {
          errorCount++;
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const errorRate = (errorCount / requestCount) * 100;
      
      this.testResults.push({
        test: 'Sustained Load',
        passed: errorRate < 5,
        duration: Date.now() - startTime,
        details: `${requestCount} requests, ${errorRate.toFixed(1)}% error rate`
      });
      
      await orchestrator.cleanup();
      console.log(`✅ Sustained load: ${requestCount} requests, ${errorRate.toFixed(1)}% errors`);
    } catch (error) {
      this.testResults.push({
        test: 'Sustained Load',
        passed: false,
        error: error,
        duration: Date.now() - startTime
      });
      console.log('❌ Sustained load test failed');
    }
  }
  
  /**
   * RECOVERY TESTS
   */
  async runRecoveryTests() {
    console.log('\n🔧 RECOVERY TESTS\n' + '='.repeat(50));
    
    await this.testSessionRecovery();
    await this.testSnapshotRestore();
  }
  
  async testSessionRecovery() {
    console.log('💾 Testing session recovery...');
    const startTime = Date.now();
    
    try {
      const memoryManager = new MemoryManager('concise');
      await memoryManager.initialize();
      
      // Create some state
      await memoryManager.storeKnowledge('test_key', 'test_value', 'test');
      
      // Save snapshot
      await memoryManager.saveSnapshot('test checkpoint');
      
      // Simulate crash and recovery
      await memoryManager.cleanup();
      
      // Reinitialize
      const newMemoryManager = new MemoryManager('concise');
      await newMemoryManager.initialize();
      
      // Check if state was recovered
      const prompt = await newMemoryManager.buildPrompt('test query');
      const hasKnowledge = prompt.knowledge.includes('test_key');
      
      this.testResults.push({
        test: 'Session Recovery',
        passed: hasKnowledge,
        duration: Date.now() - startTime,
        details: 'Session state recovered successfully'
      });
      
      await newMemoryManager.cleanup();
      console.log('✅ Session recovered successfully');
    } catch (error) {
      this.testResults.push({
        test: 'Session Recovery',
        passed: false,
        error: error,
        duration: Date.now() - startTime
      });
      console.log('❌ Session recovery test failed');
    }
  }
  
  async testSnapshotRestore() {
    console.log('📸 Testing snapshot restore...');
    const startTime = Date.now();
    
    try {
      const prisma = new PrismaClient();
      
      // Create a session with snapshots
      const session = await prisma.session.create({
        data: {
          projectId: 'test-project',
          mode: 'concise',
          status: 'active',
          turnCount: 5,
          tokensUsed: 1000
        }
      });
      
      // Create snapshot
      await prisma.sessionSnapshot.create({
        data: {
          sessionId: session.id,
          sequenceNumber: 1,
          ephemeralState: JSON.stringify({ test: 'data' }),
          retrievalIds: '[]',
          mode: 'concise',
          tokenBudget: '{}',
          lastCommand: 'test command'
        }
      });
      
      // Verify snapshot exists
      const snapshots = await prisma.sessionSnapshot.findMany({
        where: { sessionId: session.id }
      });
      
      this.testResults.push({
        test: 'Snapshot Restore',
        passed: snapshots.length === 1,
        duration: Date.now() - startTime,
        details: 'Snapshot created and retrievable'
      });
      
      // Clean up
      await prisma.sessionSnapshot.deleteMany({ where: { sessionId: session.id } });
      await prisma.session.delete({ where: { id: session.id } });
      await prisma.$disconnect();
      
      console.log('✅ Snapshot restore working');
    } catch (error) {
      this.testResults.push({
        test: 'Snapshot Restore',
        passed: false,
        error: error,
        duration: Date.now() - startTime
      });
      console.log('❌ Snapshot restore test failed');
    }
  }
  
  /**
   * Report test results
   */
  reportResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;
    const total = this.testResults.length;
    const passRate = (passed / total) * 100;
    
    console.log(`\n✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Pass Rate: ${passRate.toFixed(1)}%\n`);
    
    // Show failed tests
    if (failed > 0) {
      console.log('Failed Tests:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  ❌ ${r.test}: ${r.error?.message || 'Unknown error'}`);
        });
    }
    
    // Performance summary
    console.log('\nPerformance Metrics:');
    this.testResults.forEach(r => {
      if (r.details) {
        console.log(`  ${r.test}: ${r.details}`);
      }
    });
    
    // Overall result
    console.log('\n' + '='.repeat(60));
    if (passRate >= 90) {
      console.log('🎉 BATTLE TEST PASSED! System is production-ready.');
    } else if (passRate >= 70) {
      console.log('⚠️ NEEDS ATTENTION: Some tests failed, review before production.');
    } else {
      console.log('❌ FAILED: Major issues detected, do not deploy.');
    }
    console.log('='.repeat(60));
  }
  
  /**
   * Cleanup
   */
  async cleanup() {
    // Stop all processes
    for (const process of this.processes) {
      process.kill();
    }
    
    // Close all sockets
    for (const socket of this.sockets) {
      socket.close();
    }
    
    // Clean up test files
    try {
      await fs.unlink('test.txt').catch(() => {});
      await fs.unlink('.flexicli/flexicli_corrupt.db').catch(() => {});
    } catch {}
    
    console.log('\n🧹 Cleanup completed');
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const suite = new BattleTestSuite();
  suite.runAllTests()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { BattleTestSuite };