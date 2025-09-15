#!/usr/bin/env node

// Real agent test bypassing UI for token tracking validation
import 'dotenv/config';
import { Config } from './src/config/Config.js';
import { toolDiscovery } from './src/tools/auto-discovery.js';
import { ApprovalManager } from './src/approval/approval-manager.js';
import { globalRegistry } from './src/tools/registry.js';
import { Orchestrator } from './src/core/orchestrator.js';
import { MemoryManager } from './src/memory/memory-manager.js';
import { PrismaClient } from '@prisma/client';

async function testRealAgent() {
  console.log('🧪 Testing Token Tracking with Real Agent...\n');

  // Initialize everything like the real CLI does
  const config = new Config();
  await config.initialize();

  const memoryManager = new MemoryManager('concise');
  await memoryManager.initialize();

  await toolDiscovery.discoverAndLoadTools();

  const approvalManager = new ApprovalManager(config);
  globalRegistry.setApprovalManager(approvalManager);

  const orchestrator = new Orchestrator(config);
  orchestrator.setMemoryManager(memoryManager);

  // Listen for logging
  let tokenEvents = [];
  orchestrator.on('tool-execute', ({ name, args }) => {
    console.log(`  🔧 Tool: ${name}`);
  });

  orchestrator.on('tool-result', ({ name, result }) => {
    console.log(`  ✅ ${name} completed`);
  });

  // Execute a real task
  const prompt = 'Create a simple file called real-test.txt with content "Testing token tracking"';
  console.log(`📝 Executing: ${prompt}\n`);

  const result = await orchestrator.execute(prompt);

  if (result.success) {
    console.log('\n✨ Task completed successfully');
  } else {
    console.log('\n❌ Task failed:', result.error);
  }

  // Check the database for tokens
  const prisma = new PrismaClient();
  const sessions = await prisma.session.findMany({
    where: { tokensUsed: { gt: 0 } },
    orderBy: { startedAt: 'desc' },
    take: 5
  });

  console.log('\n📊 Database Check - Sessions with tokens:');
  for (const session of sessions) {
    console.log(`  ${session.id.substring(0, 20)}... : ${session.tokensUsed} tokens`);
  }

  // Check the latest session (should be from this test)
  const latestSession = await prisma.session.findFirst({
    orderBy: { startedAt: 'desc' }
  });

  console.log('\n📊 Latest session:');
  console.log(`  ID: ${latestSession?.id}`);
  console.log(`  Tokens: ${latestSession?.tokensUsed}`);
  console.log(`  Mode: ${latestSession?.mode}`);

  if (latestSession?.tokensUsed && latestSession.tokensUsed > 0) {
    console.log('\n🎉 SUCCESS! Tokens are being tracked in real agent execution!');
  } else {
    console.log('\n❌ FAILURE! Tokens are still 0 in real agent execution');

    // Additional debugging
    console.log('\n🔍 Debugging info:');
    console.log('  Memory manager initialized:', !!memoryManager);
    console.log('  Session ID from memory:', memoryManager.getSessionId());
  }

  await memoryManager.cleanup();
  approvalManager.cleanup();
  await prisma.$disconnect();
}

testRealAgent().catch(console.error);