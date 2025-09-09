#!/usr/bin/env node
import 'dotenv/config';
import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import { Config } from './config/Config.js';
import { toolDiscovery } from './tools/auto-discovery.js';
import { Orchestrator } from './core/orchestrator.js';
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
  
  console.log('🚀 UNIPATH CLI - Clean Architecture');
  
  // Load configuration
  const config = new Config();
  await config.initialize();
  
  // Auto-discover and load all tools once at startup
  await toolDiscovery.discoverAndLoadTools();
  
  // Create orchestrator
  const orchestrator = new Orchestrator(config);
  
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
    
    process.exit(result.success ? 0 : 1);
  }
  
  // Check if we're in interactive mode
  if (config.isInteractive()) {
    // Render React Ink UI
    const instance = render(<App config={config} orchestrator={orchestrator} />);
    
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
      
      process.on('exit', () => {
        instance.unmount();
      });
    });
  } else {
    // Non-interactive mode without prompt
    console.log('Running in non-interactive mode...');
    if (argv.prompt) {
      const result = await orchestrator.execute(argv.prompt);
      console.log(result.success ? result.response : `Error: ${result.error}`);
    } else {
      console.log('No prompt provided. Use --prompt "your task" to execute a command.');
    }
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});