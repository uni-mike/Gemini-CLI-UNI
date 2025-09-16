#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import { Executor } from './src/core/executor.js';
import { globalRegistry } from './src/tools/registry.js';
import { BashTool } from './src/tools/bash.js';
import { FileTool } from './src/tools/file.js';

async function testExecutionLog() {
  console.log('🧪 Testing ExecutionLog functionality...\n');

  // Initialize Prisma
  const prisma = new PrismaClient();

  // Register tools
  globalRegistry.register(new BashTool());
  globalRegistry.register(new FileTool());

  // Create executor with a test session ID
  const executor = new Executor();
  const testSessionId = 'test-session-' + Date.now();
  executor.setSession(testSessionId);

  console.log(`📋 Session ID: ${testSessionId}\n`);

  // Test 1: Execute a bash command
  console.log('Test 1: Executing bash command...');
  const bashTask = {
    id: 'task-1',
    description: 'List files in current directory',
    type: 'tool' as const,
    tools: ['bash'],
    arguments: {
      bash: {
        command: 'ls -la | head -5'
      }
    },
    priority: 1
  };

  const bashResult = await executor.executeTask(bashTask);
  console.log('✅ Bash command executed\n');

  // Test 2: Execute a file write
  console.log('Test 2: Writing test file...');
  const writeTask = {
    id: 'task-2',
    description: 'Create test file',
    type: 'tool' as const,
    tools: ['write_file'],
    arguments: {
      write_file: {
        file_path: './test-execution-output.txt',
        content: 'ExecutionLog test successful at ' + new Date().toISOString()
      }
    },
    priority: 1
  };

  const writeResult = await executor.executeTask(writeTask);
  console.log('✅ File written\n');

  // Check ExecutionLog table
  console.log('📊 Checking ExecutionLog table...');
  const logs = await prisma.executionLog.findMany({
    where: {
      sessionId: testSessionId
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  console.log(`Found ${logs.length} execution logs:\n`);

  for (const log of logs) {
    console.log(`  - Tool: ${log.tool}`);
    console.log(`    Type: ${log.type}`);
    console.log(`    Success: ${log.success}`);
    console.log(`    Duration: ${log.duration}ms`);
    console.log(`    Input length: ${log.input?.length || 0} chars`);
    console.log(`    Output length: ${log.output?.length || 0} chars`);
    if (log.errorMessage) {
      console.log(`    Error: ${log.errorMessage}`);
    }
    console.log();
  }

  // Clean up test file
  const cleanupTask = {
    id: 'task-3',
    description: 'Clean up test file',
    type: 'tool' as const,
    tools: ['bash'],
    arguments: {
      bash: {
        command: 'rm -f test-execution-output.txt'
      }
    },
    priority: 1
  };

  await executor.executeTask(cleanupTask);

  // Final check
  const finalCount = await prisma.executionLog.count({
    where: {
      sessionId: testSessionId
    }
  });

  console.log(`✅ Total ExecutionLog entries created: ${finalCount}`);

  if (finalCount >= 3) {
    console.log('\n🎉 ExecutionLog test PASSED! Logging is working correctly.');
  } else {
    console.log('\n❌ ExecutionLog test FAILED! Expected at least 3 logs.');
  }

  await prisma.$disconnect();
}

// Run the test
testExecutionLog().catch(console.error);