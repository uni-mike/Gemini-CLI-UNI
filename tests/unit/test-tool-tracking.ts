#!/usr/bin/env npx tsx
/**
 * Test for tool execution tracking
 * Verifies that tool executions are properly tracked and persisted
 */

import { PrismaClient } from '@prisma/client';
import { MonitoringBridge } from './src/monitoring/backend/monitoring-bridge.js';
import { Orchestrator } from './src/core/orchestrator.js';
import { Config } from './src/config/Config.js';

console.log('🔧 Testing Tool Execution Tracking\n');
console.log('=' .repeat(60));

async function testToolTracking() {
  const prisma = new PrismaClient();
  const config = new Config();
  await config.initialize();
  
  try {
    // 1. Check initial state
    console.log('\n📊 Initial Database State:');
    const initialLogs = await prisma.executionLog.count();
    console.log(`  Execution Logs: ${initialLogs}`);
    
    // 2. Setup monitoring
    console.log('\n🌉 Setting up Monitoring...');
    const monitoringBridge = new MonitoringBridge(prisma, process.cwd());
    await monitoringBridge.start();
    
    // 3. Create orchestrator and attach
    const orchestrator = new Orchestrator(config);
    monitoringBridge.attachToOrchestrator(orchestrator);
    
    // 4. Simulate tool executions
    console.log('\n🧪 Simulating Tool Executions:');
    
    // Test 1: Successful tool execution
    const toolSuccess = {
      tool: 'read-file',
      success: true,
      duration: 125,
      input: { file_path: '/test/file.ts' },
      output: { content: 'file contents here' }
    };
    
    console.log('  📄 Executing read-file (success)...');
    orchestrator.emit('tool-execution', toolSuccess);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Test 2: Failed tool execution
    const toolFailure = {
      tool: 'write-file',
      success: false,
      duration: 45,
      input: { file_path: '/protected/file.ts', content: 'test' },
      error: 'Permission denied'
    };
    
    console.log('  ❌ Executing write-file (failure)...');
    orchestrator.emit('tool-execution', toolFailure);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Test 3: Search tool
    const toolSearch = {
      tool: 'grep',
      success: true,
      duration: 350,
      input: { pattern: 'function', path: '/src' },
      output: { matches: 42, files: ['file1.ts', 'file2.ts'] }
    };
    
    console.log('  🔍 Executing grep (search)...');
    orchestrator.emit('tool-execution', toolSearch);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Test 4: Shell command
    const toolShell = {
      tool: 'shell',
      success: true,
      duration: 1250,
      input: { command: 'npm test' },
      output: { stdout: 'All tests passed!', stderr: '' }
    };
    
    console.log('  🐚 Executing shell (npm test)...');
    orchestrator.emit('tool-execution', toolShell);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 5. Direct MetricsCollector test
    console.log('\n🧪 Direct MetricsCollector Test:');
    const { MetricsCollector } = await import('./src/monitoring/backend/MetricsCollector.js');
    const metricsCollector = MetricsCollector.getInstance(prisma);
    
    // Record tool execution directly
    metricsCollector.recordToolExecution('web-search', true, 500);
    console.log('  ✅ Recorded web-search execution');
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 6. Check database persistence
    console.log('\n💾 Checking Database Persistence:');
    
    const executionLogs = await prisma.executionLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    console.log(`\n  Execution Logs (${executionLogs.length} found):`);
    for (const log of executionLogs) {
      console.log(`    Tool: ${log.tool}`);
      console.log(`    Type: ${log.type}`);
      console.log(`    Success: ${log.success}`);
      console.log(`    Duration: ${log.duration}ms`);
      if (log.errorMessage) {
        console.log(`    Error: ${log.errorMessage}`);
      }
      console.log('    ---');
    }
    
    // 7. Check tool statistics
    console.log('\n📈 Tool Statistics:');
    
    // Group by tool
    const toolStats = await prisma.executionLog.groupBy({
      by: ['tool'],
      _count: true,
      _avg: { duration: true },
      where: {
        createdAt: {
          gte: new Date(Date.now() - 60000) // Last minute
        }
      }
    });
    
    for (const stat of toolStats) {
      console.log(`  ${stat.tool}: ${stat._count} executions, avg ${Math.round(stat._avg.duration || 0)}ms`);
    }
    
    // 8. Check success rate
    const successCount = await prisma.executionLog.count({
      where: { success: true }
    });
    const totalCount = await prisma.executionLog.count();
    const successRate = totalCount > 0 ? (successCount / totalCount * 100).toFixed(1) : 0;
    
    console.log(`\n  Overall Success Rate: ${successRate}%`);
    console.log(`  Successful: ${successCount}`);
    console.log(`  Failed: ${totalCount - successCount}`);
    
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await monitoringBridge.stop();
    
    // Final summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Final Summary:');
    
    const finalLogCount = await prisma.executionLog.count();
    console.log(`  Total Execution Logs: ${finalLogCount}`);
    console.log(`  New Logs Created: ${finalLogCount - initialLogs}`);
    
    if (finalLogCount > initialLogs) {
      console.log('\n✅ SUCCESS: Tool executions are being tracked!');
    } else {
      console.log('\n❌ ISSUE: Tool executions not persisting');
      console.log('  Check:');
      console.log('  - Tool execution events are emitted correctly');
      console.log('  - MonitoringBridge is listening to tool-execution events');
      console.log('  - Database writes are successful');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testToolTracking()
  .then(() => {
    console.log('\n✨ Tool tracking test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });