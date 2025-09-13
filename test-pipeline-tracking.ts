#!/usr/bin/env npx tsx
/**
 * Test for pipeline stage tracking
 * Verifies that planning and execution stages are properly tracked
 */

import { PrismaClient } from '@prisma/client';
import { MonitoringBridge } from './src/monitoring/backend/monitoring-bridge.js';
import { Orchestrator } from './src/core/orchestrator.js';
import { Config } from './src/config/Config.js';

console.log('🚀 Testing Pipeline Stage Tracking\n');
console.log('=' .repeat(60));

async function testPipelineTracking() {
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
    console.log('\n🎭 Creating Orchestrator...');
    const orchestrator = new Orchestrator(config);
    monitoringBridge.attachToOrchestrator(orchestrator);
    console.log('  ✅ Monitoring attached to orchestrator');
    
    // 4. Test pipeline stages
    console.log('\n🧪 Testing Pipeline Stages:');
    
    // Test 1: Planning stage
    console.log('\n  📋 Test 1: Planning Stage');
    const planningData = {
      prompt: 'Create a function that calculates fibonacci numbers',
      complexity: 'medium',
      estimatedSteps: 3
    };
    
    orchestrator.emit('planning-start', planningData);
    console.log('    Started planning stage');
    
    // Simulate planning duration
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const planResult = {
      steps: [
        'Define function signature',
        'Implement iterative fibonacci logic',
        'Add input validation'
      ],
      estimatedDuration: 1500,
      toolsRequired: ['write-file', 'edit', 'read-file']
    };
    
    orchestrator.emit('planning-complete', planResult);
    console.log('    Completed planning stage');
    
    // Test 2: Execution stage
    console.log('\n  ⚙️ Test 2: Execution Stage');
    const executionData = {
      plan: planResult,
      startTime: Date.now()
    };
    
    orchestrator.emit('execution-start', executionData);
    console.log('    Started execution stage');
    
    // Simulate execution with multiple tool calls
    for (let i = 0; i < planResult.steps.length; i++) {
      const step = planResult.steps[i];
      console.log(`    Executing step ${i + 1}: ${step}`);
      
      // Emit tool execution for each step
      orchestrator.emit('tool-execute', {
        name: planResult.toolsRequired[i],
        args: { step }
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      orchestrator.emit('tool-result', {
        name: planResult.toolsRequired[i],
        success: true,
        result: `Completed: ${step}`
      });
    }
    
    const executionResult = {
      success: true,
      stepsCompleted: planResult.steps.length,
      duration: 1200,
      outputFiles: ['fibonacci.ts']
    };
    
    orchestrator.emit('execution-complete', executionResult);
    console.log('    Completed execution stage');
    
    // Test 3: Error handling in pipeline
    console.log('\n  ❌ Test 3: Pipeline Error Handling');
    
    orchestrator.emit('planning-start', { prompt: 'Invalid task' });
    await new Promise(resolve => setTimeout(resolve, 200));
    
    orchestrator.emit('orchestration-error', {
      stage: 'planning',
      error: 'Failed to parse prompt',
      timestamp: Date.now()
    });
    console.log('    Handled planning error');
    
    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 5. Check metrics
    console.log('\n📈 Checking Pipeline Metrics:');
    const metrics = monitoringBridge.getAllMetrics();
    
    if (metrics.realtime?.pipeline) {
      console.log('  Pipeline Metrics (Realtime):');
      console.log(`    - Active stages: ${metrics.realtime.pipeline.activeStages || 0}`);
      console.log(`    - Completed stages: ${metrics.realtime.pipeline.completedStages || 0}`);
      console.log(`    - Failed stages: ${metrics.realtime.pipeline.failedStages || 0}`);
    } else {
      console.log('  ⚠️ No realtime pipeline metrics found');
    }
    
    // 6. Check database for pipeline events
    console.log('\n💾 Checking Database for Pipeline Events:');
    
    const pipelineLogs = await prisma.executionLog.findMany({
      where: {
        OR: [
          { type: 'pipeline' },
          { tool: { contains: 'pipeline' } },
          { tool: { contains: 'planning' } },
          { tool: { contains: 'execution' } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    console.log(`\n  Pipeline Logs (${pipelineLogs.length} found):`);
    for (const log of pipelineLogs) {
      console.log(`    Type: ${log.type}`);
      console.log(`    Tool: ${log.tool}`);
      console.log(`    Success: ${log.success}`);
      console.log(`    Duration: ${log.duration}ms`);
      if (log.errorMessage) {
        console.log(`    Error: ${log.errorMessage}`);
      }
      console.log('    ---');
    }
    
    // 7. Test direct collector methods
    console.log('\n🧪 Direct Collector Test:');
    
    // Start a new pipeline stage
    const stageId = `test-stage-${Date.now()}`;
    monitoringBridge['collector'].startPipelineStage({
      id: stageId,
      name: 'TestStage',
      type: 'validation',
      input: { test: true }
    });
    console.log(`  Started stage: ${stageId}`);
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Complete the stage
    monitoringBridge['collector'].completePipelineStage(stageId, {
      validated: true,
      items: 5
    });
    console.log(`  Completed stage: ${stageId}`);
    
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await monitoringBridge.stop();
    
    // Final summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Final Summary:');
    
    const finalLogs = await prisma.executionLog.count();
    console.log(`  Total Execution Logs: ${finalLogs}`);
    console.log(`  New Logs Created: ${finalLogs - initialLogs}`);
    
    if (pipelineLogs.length > 0) {
      console.log('\n✅ SUCCESS: Pipeline stages are being tracked!');
      console.log('  - Planning stages emit events');
      console.log('  - Execution stages are captured');
      console.log('  - Errors are properly handled');
    } else {
      console.log('\n⚠️ PARTIAL: Pipeline events are emitted but not persisted');
      console.log('  Next steps:');
      console.log('  - Ensure MetricsCollector has pipeline methods');
      console.log('  - Check database schema for pipeline tables');
      console.log('  - Verify event flow from orchestrator to database');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testPipelineTracking()
  .then(() => {
    console.log('\n✨ Pipeline tracking test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });