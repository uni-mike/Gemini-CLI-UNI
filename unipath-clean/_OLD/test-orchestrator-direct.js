import { DeepSeekOrchestrator } from './packages/core/dist/src/orchestration/DeepSeekOrchestrator.js';
import { Config } from './packages/core/dist/src/config/config.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.deepseek') });

async function testOrchestrator() {
  const config = new Config();
  config.set('endpoint', process.env.ENDPOINT);
  config.set('apiKey', process.env.API_KEY); 
  config.set('model', process.env.MODEL);
  config.set('apiVersion', process.env.API_VERSION);
  config.set('approvalMode', 'yolo');
  
  const orchestrator = new DeepSeekOrchestrator(null, config);
  
  console.log('Testing orchestrator with multi-step task...\n');
  
  try {
    const result = await orchestrator.orchestratePrompt('search Bitcoin price then create btc-report.txt');
    console.log('Result:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

testOrchestrator();