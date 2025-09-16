#!/usr/bin/env npx tsx
/**
 * Debug test for token data persistence issue
 * Traces token events through the entire chain
 */

import { PrismaClient } from '@prisma/client';
import { MonitoringBridge } from '../../../src/monitoring/backend/monitoring-bridge.js';
import { Orchestrator } from '../../../src/core/orchestrator.js';
import { Config } from '../../../src/config/Config.js';
import { EventEmitter } from 'events';

console.log('🔍 Testing Token Data Persistence\n');
console.log('=' .repeat(60));

// Create a mock DeepSeek client to emit token events
class MockDeepSeekClient extends EventEmitter {
  async testTokenEvent() {
    const tokenData = {
      promptTokens: 1500,
      completionTokens: 800,
      totalTokens: 2300,
      modelId: 'deepseek-test',
      timestamp: new Date().toISOString()
    };
    
    console.log('\n📤 Emitting token event from DeepSeek:', tokenData);
    this.emit('token-usage', tokenData);
    return tokenData;
  }
}

async function debugTokenPersistence() {
  const prisma = new PrismaClient();
  const config = new Config();
  await config.initialize();
  
  try {
    // 1. Check initial database state
    console.log('\n📊 Initial Database State:');
    const initialSessions = await prisma.session.count();
    const initialLogs = await prisma.executionLog.count();
    console.log(`  Sessions: ${initialSessions}`);
    console.log(`  Execution Logs: ${initialLogs}`);
    
    // 2. Create monitoring bridge
    console.log('\n🌉 Setting up Monitoring Bridge...');
    const monitoringBridge = new MonitoringBridge(prisma, process.cwd());
    await monitoringBridge.start();
    
    // 3. Create orchestrator and attach monitoring
    console.log('\n🎭 Creating Orchestrator...');
    const orchestrator = new Orchestrator(config);
    monitoringBridge.attachToOrchestrator(orchestrator);
    
    // Add logging to orchestrator
    orchestrator.on('token-usage', (data) => {
      console.log('  ✅ Orchestrator emitted token event:', data);
    });
    
    // 4. Test direct event emission from orchestrator
    console.log('\n🧪 Test 1: Direct Orchestrator Event');
    const directTokenData = {
      promptTokens: 500,
      completionTokens: 300,
      totalTokens: 800,
      modelId: 'test-direct',
      timestamp: new Date().toISOString()
    };
    orchestrator.emit('token-usage', directTokenData);
    
    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 5. Test with mock DeepSeek client
    console.log('\n🧪 Test 2: DeepSeek Client Event Chain');
    const mockClient = new MockDeepSeekClient();
    
    // Connect mock client to orchestrator
    mockClient.on('token-usage', (data) => {
      console.log('  ➡️ Forwarding from DeepSeek to Orchestrator');
      orchestrator.emit('token-usage', data);
    });
    
    await mockClient.testTokenEvent();
    
    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 6. Check HybridCollector's internal state
    console.log('\n🔍 Checking HybridCollector State:');
    const metrics = monitoringBridge.getAllMetrics();
    console.log('  Metrics sources:', Object.keys(metrics));
    if (metrics.combined?.tokens) {
      console.log('  Token metrics:', metrics.combined.tokens);
    }
    
    // 7. Query database directly for token data
    console.log('\n💾 Checking Database for Token Data:');
    
    // Check Sessions table
    const sessions = await prisma.session.findMany({
      orderBy: { startedAt: 'desc' },
      take: 5
    });
    
    console.log(`\n  Sessions (${sessions.length} found):`);
    for (const session of sessions) {
      console.log(`    ID: ${session.id}`);
      console.log(`    Tokens Used: ${session.tokensUsed}`);
      console.log(`    Started: ${session.startedAt}`);
    }
    
    // Check ExecutionLog table for token events
    const tokenLogs = await prisma.executionLog.findMany({
      where: {
        tool: { contains: 'token' }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    console.log(`\n  Token Logs (${tokenLogs.length} found):`);
    for (const log of tokenLogs) {
      console.log(`    Tool: ${log.tool}`);
      console.log(`    Success: ${log.success}`);
      console.log(`    Output: ${log.output}`);
    }
    
    // 8. Test manual database write
    console.log('\n🧪 Test 3: Manual Database Write');
    
    // Get or create session
    let activeSession = await prisma.session.findFirst({
      where: { endedAt: null },
      orderBy: { startedAt: 'desc' }
    });
    
    if (!activeSession) {
      // Create a test session
      activeSession = await prisma.session.create({
        data: {
          projectId: 'test-project-' + Date.now(),
          mode: 'concise',
          tokensUsed: 0
        }
      });
      console.log(`  Created test session: ${activeSession.id}`);
    }
    
    // Update session with token data
    const updatedSession = await prisma.session.update({
      where: { id: activeSession.id },
      data: {
        tokensUsed: activeSession.tokensUsed + directTokenData.totalTokens
      }
    });
    console.log(`  ✅ Updated session tokens: ${updatedSession.tokensUsed}`);
    
    // Create execution log for tokens
    const tokenLog = await prisma.executionLog.create({
      data: {
        projectId: activeSession.projectId || 'test-project',
        sessionId: activeSession.id,
        type: 'token',
        tool: 'token-usage',
        output: JSON.stringify(directTokenData),
        success: true,
        duration: 0
      }
    });
    console.log(`  ✅ Created token log: ${tokenLog.id}`);
    
    // 9. Verify persistence
    console.log('\n✅ Verification:');
    
    const finalSession = await prisma.session.findUnique({
      where: { id: activeSession.id }
    });
    console.log(`  Session ${activeSession.id} has ${finalSession?.tokensUsed} tokens`);
    
    const finalLogs = await prisma.executionLog.count({
      where: { sessionId: activeSession.id }
    });
    console.log(`  Session has ${finalLogs} execution logs`);
    
    // 10. Test MetricsCollector directly
    console.log('\n🧪 Test 4: Direct MetricsCollector Test');
    const { MetricsCollector } = await import('./src/monitoring/backend/MetricsCollector.js');
    const metricsCollector = MetricsCollector.getInstance(prisma);
    
    // Update tokens directly via MetricsCollector
    await metricsCollector.updateSessionTokens(3500);
    console.log('  ✅ Called updateSessionTokens with 3500 tokens');
    
    // Wait for database write
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await monitoringBridge.stop();
    
    // Final summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Final Summary:');
    
    const finalSessionCount = await prisma.session.count();
    const finalLogCount = await prisma.executionLog.count();
    const tokensInSessions = await prisma.session.aggregate({
      _sum: { tokensUsed: true }
    });
    
    console.log(`  Total Sessions: ${finalSessionCount}`);
    console.log(`  Total Logs: ${finalLogCount}`);
    console.log(`  Total Tokens in DB: ${tokensInSessions._sum.tokensUsed || 0}`);
    
    if (tokensInSessions._sum.tokensUsed && tokensInSessions._sum.tokensUsed > 0) {
      console.log('\n✅ SUCCESS: Token data is persisting to database!');
    } else {
      console.log('\n❌ ISSUE: Token data not persisting properly');
      console.log('  Debugging hints:');
      console.log('  - Check if sessionId is being set in MetricsCollector');
      console.log('  - Verify Prisma client is connected');
      console.log('  - Check for database write errors');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the debug test
debugTokenPersistence()
  .then(() => {
    console.log('\n✨ Token persistence debugging complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Debug test failed:', error);
    process.exit(1);
  });