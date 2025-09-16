// Simple script to capture raw DeepSeek response
import { DeepSeekClient } from './src/llm/deepseek-client.js';
import fs from 'fs';

const client = new DeepSeekClient('dummy-key', 'DeepSeek-V3.1', 'https://unipathai7556217047.services.ai.azure.com/openai/v1');

// Capture the raw response
client.on('finish', (response) => {
  console.log('Raw DeepSeek response length:', response.length);
  fs.writeFileSync('./debug-response.txt', response);
  console.log('Response saved to debug-response.txt');
});

// Simple test call
const prompt = 'Create design documentation for plant watering app with Mermaid diagram. Return JSON format.';
try {
  const response = await client.generateResponse(prompt, [], true); // forceJson = true
  console.log('Final response:', response);
} catch (error) {
  console.error('Error:', error.message);
}