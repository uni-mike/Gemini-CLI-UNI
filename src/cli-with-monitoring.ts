#!/usr/bin/env node
/**
 * CLI with Monitoring Integration
 * Starts the agent with monitoring attached for real-time observability
 */

import 'dotenv/config';
import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import { Config } from './config/Config.js';
import { toolDiscovery } from './tools/auto-discovery.js';
import { Orchestrator } from './core/orchestrator.js';
import { MemoryManager } from './memory/memory-manager.js';
import { MonitoringSystem } from './monitoring/backend/index.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

async function main() {
  // Parse command line arguments
  const argv = await yargs(hideBin(process.argv))
    .option('prompt', {
      alias: 'p',
      type: 'string',
      description: 'Prompt to execute'
    })
    .option('non-interactive', {
      type: 'boolean',
      description: 'Run in non-interactive mode'
    })
    .argv;
  
  console.log('🚀 FlexiCLI - With Monitoring Integration');
  
  // Load configuration
  const config = new Config();
  await config.initialize();
  
  // Initialize memory manager
  const memoryManager = new MemoryManager('concise');
  await memoryManager.initialize();
  
  // Auto-discover and load all tools once at startup
  await toolDiscovery.discoverAndLoadTools();
  
  // Create orchestrator
  const orchestrator = new Orchestrator(config);
  
  // Connect memory manager to orchestrator for monitoring
  orchestrator.setMemoryManager(memoryManager);
  
  // Initialize and attach monitoring
  let monitoring: MonitoringSystem | null = null;
  
  try {
    monitoring = new MonitoringSystem({
      port: parseInt(process.env.MONITORING_PORT || '4000')
    });
    
    // Start monitoring (works even if agent crashes later)
    await monitoring.start();
    
    // Attach to agent for real-time data
    monitoring.attachToAgent(orchestrator, memoryManager);
    
    console.log('✅ Monitoring active at http://localhost:4000');
  } catch (error) {
    console.warn('⚠️  Monitoring failed to start, continuing without it:', error);
    // Agent continues to work without monitoring
  }
  
  // Check if we have a prompt for non-interactive mode
  if (argv.prompt && argv['non-interactive']) {
    console.log(`\n📝 Executing: ${argv.prompt}\n`);
    
    // Set up event listeners for non-interactive output
    orchestrator.on('tool-execute', ({ name, args }) => {
      console.log(`  🔧 Running tool: ${name}`);
      if (config.getDebugMode()) {
        console.log(`     Args: ${JSON.stringify(args, null, 2)}`);
      }
    });
    
    orchestrator.on('tool-result', ({ name, result }) => {
      if (result.success) {
        console.log(`  ✅ ${name} completed`);
        if (config.getDebugMode() && result.output) {
          console.log(`     Output: ${result.output.substring(0, 200)}${result.output.length > 200 ? '...' : ''}`);
        }
      } else {
        console.log(`  ❌ ${name} failed: ${result.error}`);
      }
    });
    
    const result = await orchestrator.execute(argv.prompt);
    
    if (result.success) {
      console.log(`\n✨ Response:\n${result.response}\n`);
      if (result.toolsUsed && result.toolsUsed.length > 0) {
        console.log(`📊 Tools used: ${result.toolsUsed.join(', ')}\n`);
      }
    } else {
      console.error(`\n❌ Error: ${result.error}\n`);
    }
    
    // End session before exiting
    await memoryManager.cleanup();
    if (monitoring) {
      await monitoring.stop();
    }
    
    process.exit(result.success ? 0 : 1);
  }
  
  // Check if we're in interactive mode
  if (config.isInteractive()) {
    // Render React Ink UI
    const instance = render(React.createElement(App, { config, orchestrator }));
    
    // Prevent the process from exiting in interactive mode
    await new Promise<void>((resolve) => {
      process.on('SIGINT', () => {
        instance.unmount();
        resolve();
      });
      
      process.on('SIGTERM', () => {
        instance.unmount();
        resolve();
      });
    });
  }
  
  // Clean up on exit
  await memoryManager.cleanup();
  if (monitoring) {
    await monitoring.stop();
  }
}

// Run the main function
main().catch(console.error);