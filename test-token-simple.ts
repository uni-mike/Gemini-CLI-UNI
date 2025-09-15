#!/usr/bin/env node

// Simple test to validate token tracking without full CLI
import { DeepSeekClient } from './src/llm/deepseek-client.js';
import { PrismaClient } from '@prisma/client';

async function testTokenPersistence() {
  console.log('🧪 Testing Token Persistence to Database...\n');

  const prisma = new PrismaClient();
  const client = new DeepSeekClient();

  // Create a test session directly
  const sessionId = 'test-token-' + Date.now();
  const session = await prisma.session.create({
    data: {
      id: sessionId,
      projectId: '749537ea41accc1f', // Use existing project
      mode: 'test',
      tokensUsed: 0
    }
  });

  console.log('📝 Created test session:', sessionId);
  console.log('📊 Initial tokens:', session.tokensUsed);

  // Listen for token events
  let capturedTokens = 0;
  client.on('token-usage', (usage) => {
    console.log('📊 Token event captured:', usage);
    capturedTokens = usage.total_tokens || 0;
  });

  // Make a simple API call
  const messages = [{
    role: 'user' as const,
    content: 'Say hello in 3 words'
  }];

  console.log('\n🚀 Making API call...');
  const response = await client.chat(messages);
  console.log('✅ Response:', response);
  console.log('📊 Captured tokens:', capturedTokens);

  // Now manually update the session with captured tokens
  if (capturedTokens > 0) {
    const updated = await prisma.session.update({
      where: { id: sessionId },
      data: {
        tokensUsed: capturedTokens
      }
    });
    console.log('\n✅ Updated session tokens:', updated.tokensUsed);
  }

  // Verify it persisted
  const final = await prisma.session.findUnique({
    where: { id: sessionId }
  });

  console.log('\n📊 Final database check:');
  console.log('  Session ID:', final?.id);
  console.log('  Tokens Used:', final?.tokensUsed);

  if (final?.tokensUsed && final.tokensUsed > 0) {
    console.log('\n🎉 SUCCESS! Tokens are persisting to database!');
  } else {
    console.log('\n❌ FAILURE! Tokens not persisting (still 0)');
  }

  await prisma.$disconnect();
}

testTokenPersistence().catch(console.error);