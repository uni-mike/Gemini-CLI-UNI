#!/usr/bin/env npx tsx

import 'dotenv/config';
import { DeepSeekClient } from '../../../src/llm/deepseek-client.js';

async function testDeepSeekIsolated() {
  console.log('=== Testing DeepSeek Client in Isolation ===\n');

  const client = new DeepSeekClient({ timeout: 10000 }); // 10 second timeout

  // Listen to events
  client.on('retry', (data) => {
    console.log(`🔄 Retry event: attempt ${data.attempt}/${data.maxRetries}`);
  });

  client.on('timeout', (data) => {
    console.log(`⏱️ Timeout event: ${data.message}`);
  });

  client.on('error', (error) => {
    console.log(`❌ Error event:`, error);
  });

  client.on('token-usage', (usage) => {
    console.log(`📊 Token usage:`, usage);
  });

  try {
    // Test 1: Simple question without tools
    console.log('Test 1: Simple question without tools');
    const response1 = await client.chat(
      [{ role: 'user', content: 'What is 2 + 2? Reply with just the number.' }],
      [],
      false
    );
    console.log('Response:', response1);
    console.log('✅ Test 1 passed\n');

    // Test 2: JSON response
    console.log('Test 2: JSON response');
    const response2 = await client.chat(
      [{
        role: 'user',
        content: 'Return a JSON object with a "result" field containing the sum of 5 + 3'
      }],
      [],
      true // forceJson
    );
    console.log('Response:', response2);
    const parsed = JSON.parse(response2);
    console.log('Parsed:', parsed);
    console.log('✅ Test 2 passed\n');

    // Test 3: Complex prompt with JSON
    console.log('Test 3: Complex task decomposition');
    const complexPrompt = `REQUEST: "Create a simple calculator function"

IMPORTANT: Return ONLY valid JSON. No explanations, no thinking, no markdown.

Output format:
{"type":"tasks","tasks":[{"description":"[task]","filename":"calculator.ts","content":"[code]"}]}`;

    const response3 = await client.chat(
      [{ role: 'user', content: complexPrompt }],
      [],
      true // forceJson
    );
    console.log('Response length:', response3.length);
    const parsed3 = JSON.parse(response3);
    console.log('Task count:', parsed3.tasks?.length || 0);
    console.log('✅ Test 3 passed\n');

    console.log('=== All tests passed! ===');

  } catch (error: any) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

testDeepSeekIsolated().catch(console.error);