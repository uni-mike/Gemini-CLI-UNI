/**
 * Example: How to add monitoring to existing CLI
 * Monitoring is OPTIONAL - agent works fine without it
 */

import { Orchestrator } from './core/orchestrator.js';
import { MemoryManager } from './memory/memory-manager.js';
import { Config } from './config/Config.js';
import { MonitoringSystem } from './monitoring/backend/index.js';

async function startCLIWithOptionalMonitoring() {
  // Normal agent initialization
  const config = new Config();
  const orchestrator = new Orchestrator(config);
  const memoryManager = new MemoryManager('concise');
  await memoryManager.initialize();
  
  // Optional monitoring (only if enabled)
  let monitoring: MonitoringSystem | null = null;
  
  if (process.env.ENABLE_MONITORING === 'true') {
    try {
      monitoring = new MonitoringSystem({
        port: parseInt(process.env.MONITORING_PORT || '4000')
      });
      
      // Start monitoring (works even if agent crashes later)
      await monitoring.start();
      
      // Attach to agent for real-time data (optional)
      monitoring.attachToAgent(orchestrator, memoryManager);
      
      console.log('✅ Monitoring enabled at http://localhost:4000');
    } catch (error) {
      console.warn('⚠️ Monitoring failed to start, continuing without it:', error);
      // Agent continues to work without monitoring
    }
  }
  
  // Agent runs normally whether monitoring is attached or not
  orchestrator.on('orchestration-complete', (result) => {
    console.log('Task completed:', result);
  });
  
  // If agent crashes, monitoring continues
  process.on('uncaughtException', (error) => {
    console.error('Agent crashed:', error);
    if (monitoring) {
      console.log('📊 Monitoring continues - check http://localhost:4000');
      monitoring.detachFromAgent();
    }
  });
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down...');
    
    if (monitoring) {
      await monitoring.stop();
    }
    
    await memoryManager.cleanup();
    process.exit(0);
  });
  
  return { orchestrator, memoryManager, monitoring };
}

// Example usage
if (import.meta.url === `file://${process.argv[1]}`) {
  startCLIWithOptionalMonitoring().catch(console.error);
}