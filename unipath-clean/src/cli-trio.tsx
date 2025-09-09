#!/usr/bin/env node

/**
 * UNIPATH CLI with Trio Pattern
 * Features the orchestration Trio: Planner, Executor, Orchestrator
 */

import React from 'react';
import { render } from 'ink';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { Config } from './config/Config';
import { OrchestratorTrio } from './core/orchestrator-trio';
import { toolManager } from './tools/tool-manager';
import { App } from './ui/App';

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('prompt', {
      alias: 'p',
      type: 'string',
      description: 'Task to execute'
    })
    .option('non-interactive', {
      type: 'boolean',
      description: 'Run in non-interactive mode',
      default: false
    })
    .option('trio-verbose', {
      type: 'boolean',
      description: 'Show Trio communication',
      default: false
    })
    .help()
    .argv;

  console.log('🎭 UNIPATH CLI with Orchestration Trio');
  console.log('  • Planner: Analyzes and plans tasks');
  console.log('  • Executor: Executes tasks with tools');
  console.log('  • Orchestrator: Coordinates and mediates\n');

  // Initialize configuration
  const config = new Config();
  await config.initialize();

  // Initialize advanced tool manager with auto-discovery
  await toolManager.initialize();
  const stats = toolManager.getStats();
  console.log(`🔧 ${stats.totalTools} tools ready (${stats.totalAliases} aliases)\n`);

  // Create orchestrator with Trio
  const orchestrator = new OrchestratorTrio(config);

  // Set up Trio communication monitoring if verbose
  if (argv['trio-verbose']) {
    orchestrator.on('trio-message', (message) => {
      const arrow = message.to === 'all' ? '📢' : '→';
      const icon = message.type === 'question' ? '❓' : 
                   message.type === 'response' ? '✅' :
                   message.type === 'adjustment' ? '🔧' : '📋';
      console.log(`  ${icon} ${message.from} ${arrow} ${message.to}: ${message.content}`);
    });
  }

  // Check if we have a prompt for non-interactive mode
  if (argv.prompt && argv['non-interactive']) {
    console.log(`📝 Executing: ${argv.prompt}\n`);
    
    // Set up event listeners for non-interactive output
    orchestrator.on('orchestration-start', ({ prompt }) => {
      console.log('🎬 Orchestration starting...\n');
    });

    orchestrator.on('trio-message', (message) => {
      if (!argv['trio-verbose'] && message.type === 'status') {
        console.log(`  📋 ${message.content}`);
      }
    });

    orchestrator.on('orchestration-complete', ({ response, results }) => {
      console.log('\n✨ Orchestration complete!');
      if (argv['trio-verbose']) {
        console.log(orchestrator.visualizeTrioCommunication());
      }
    });

    try {
      const result = await orchestrator.execute(argv.prompt);
      
      console.log(`\n📊 Results:`);
      console.log(result.response);
      
      if (result.results) {
        const successful = result.results.filter((r: any) => r.success).length;
        const total = result.results.length;
        console.log(`\n✅ Success rate: ${successful}/${total} tasks`);
      }
      
      if (argv['trio-verbose'] && result.trioConversation) {
        console.log(`\n🎭 Trio exchanged ${result.trioConversation.length} messages`);
      }
      
      process.exit(result.success ? 0 : 1);
    } catch (error: any) {
      console.error(`\n❌ Error: ${error.message}`);
      process.exit(1);
    }
  }

  // Interactive mode
  if (!argv['non-interactive']) {
    console.log('🎨 Starting interactive mode with React Ink UI...\n');
    
    // Note: App would need to be updated to work with OrchestratorTrio
    // For now, showing a simple message
    console.log('Interactive mode with Trio coming soon!');
    console.log('Use --non-interactive flag to test the Trio pattern.');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});