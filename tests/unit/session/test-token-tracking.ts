#!/usr/bin/env node

import { Orchestrator } from './src/core/orchestrator.js';
import { PrismaClient } from '@prisma/client';

async function testTokenTracking() {
  console.log('🧪 Testing Token Tracking functionality...\n');

  const prisma = new PrismaClient();

  try {
    // Initialize orchestrator
    const orchestrator = new Orchestrator();
    await orchestrator.initialize();

    const testPrompt = 'Create a simple test file called token-test.txt with content "Testing token tracking"';

    console.log('📝 Running test prompt:', testPrompt);
    console.log('⏳ Waiting for orchestration...\n');

    // Listen for token events
    let tokensCaptured = false;
    orchestrator.on('token-usage', (usage) => {
      console.log('📊 Token usage event captured:', usage);
      tokensCaptured = true;
    });

    // Execute the prompt
    const result = await orchestrator.orchestrate(testPrompt);

    console.log('\n✅ Orchestration complete');
    console.log('📊 Tokens captured:', tokensCaptured);

    // Check session for token count
    const sessionId = orchestrator.getSessionId();
    if (sessionId) {
      const session = await prisma.session.findUnique({
        where: { id: sessionId }
      });

      console.log('\n📈 Session token count:', session?.tokensUsed || 0);

      if (session?.tokensUsed && session.tokensUsed > 0) {
        console.log('✅ Token tracking is working! Tokens used:', session.tokensUsed);
      } else {
        console.log('❌ Token tracking not working - tokens still 0');
      }
    } else {
      console.log('❌ No session ID available');
    }

    // Cleanup
    await orchestrator.cleanup();
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testTokenTracking().catch(console.error);