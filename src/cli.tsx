#!/usr/bin/env node
import 'dotenv/config';
import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import { Config } from './config/Config.js';
import { toolDiscovery } from './tools/auto-discovery.js';
import { Orchestrator } from './core/orchestrator.js';
import { MemoryManager } from './memory/memory-manager.js';
import { MonitoringBridge } from './monitoring/backend/monitoring-bridge.js';
import { PrismaClient } from '@prisma/client';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import axios from 'axios';

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

  // CRITICAL DB VALIDATION - DO NOT REMOVE OR MODIFY!
  // Always validate database schema exists before proceeding to prevent Prisma errors
  // This prevents "Table does not exist" errors when agent starts with fresh/cleared DB
  try {
    const prismaClient = new PrismaClient();

    // Test basic database connectivity by checking if any table exists
    await prismaClient.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' LIMIT 1`;

    // Quick validation - try to query a core table to ensure schema is deployed
    try {
      await prismaClient.project.findFirst();
    } catch (schemaError: any) {
      if (schemaError.code === 'P2021') {
        console.log('📊 Database schema not found, initializing...');
        console.log('🔧 Running Prisma migrations to create tables...');

        // Import spawn to run Prisma migrate
        const { spawn } = await import('child_process');
        const migrateProcess = spawn('npx', ['prisma', 'migrate', 'deploy'], {
          stdio: 'inherit',
          cwd: process.cwd()
        });

        await new Promise<void>((resolve, reject) => {
          migrateProcess.on('close', (code) => {
            if (code === 0) {
              console.log('✅ Database schema initialized successfully');
              resolve();
            } else {
              reject(new Error(`Prisma migrate failed with code ${code}`));
            }
          });
          migrateProcess.on('error', reject);
        });

        // Verify schema was created
        await prismaClient.project.findFirst();
        console.log('✅ Database schema validation completed');
      } else {
        throw schemaError;
      }
    }

    await prismaClient.$disconnect();
  } catch (dbError) {
    console.error('❌ Critical database error:', dbError);
    console.error('💡 Try running: npx prisma migrate deploy');
    process.exit(1);
  }
  
  // Initialize memory manager
  const memoryManager = new MemoryManager('concise');
  await memoryManager.initialize();
  
  // Auto-discover and load all tools once at startup
  await toolDiscovery.discoverAndLoadTools();
  
  // Create orchestrator
  const orchestrator = new Orchestrator(config);
  
  // Connect memory manager to orchestrator for monitoring
  orchestrator.setMemoryManager(memoryManager);
  
  // Check if monitoring is available and attach
  const monitoringEnabled = process.env.ENABLE_MONITORING === 'true';
  let monitoringBridge: MonitoringBridge | null = null;
  
  if (monitoringEnabled) {
    try {
      // Check if monitoring server is running
      const response = await axios.get('http://localhost:4000/api/health', { timeout: 1000 });
      if (response.data.status === 'healthy') {
        console.log('📊 Monitoring server detected, attaching bridge...');
        
        try {
          // Create monitoring bridge - wrap in try-catch to handle initialization errors
          const prisma = new PrismaClient();
          monitoringBridge = new MonitoringBridge(prisma, process.cwd());
          await monitoringBridge.start();
          
          // Attach to orchestrator for real-time events
          monitoringBridge.attachToOrchestrator(orchestrator);
          
          // Also attach to memory manager if it has events
          if (memoryManager && typeof memoryManager.on === 'function') {
            monitoringBridge.attachToMemoryManager(memoryManager);
          }
          
          // Try to notify the monitoring server that an agent has connected
          // Don't fail if monitoring is unavailable - agent should work independently
          try {
            await axios.post('http://localhost:4000/api/attach-agent', {
              agentId: process.pid,
              projectId: 'flexicli-default',
              timestamp: new Date().toISOString()
            }, { timeout: 1000 });
            console.log('✅ Monitoring bridge attached and registered successfully');
          } catch (attachError) {
            console.log('⚠️ Could not register with monitoring server, continuing without registration');
          }
        } catch (bridgeError) {
          console.log('⚠️ Failed to initialize monitoring bridge:', (bridgeError as Error).message);
          console.log('📊 Continuing without monitoring integration');
          monitoringBridge = null;
        }
      }
    } catch (error) {
      console.log('📊 Monitoring server not available, running without monitoring');
    }
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
      if (result.response) {
        console.log(`\n✨ Response:\n${result.response}\n`);
      } else {
        console.log(`\n✅ Task completed successfully.\n`);
      }
      if (result.toolsUsed && result.toolsUsed.length > 0) {
        console.log(`📊 Tools used: ${result.toolsUsed.join(', ')}\n`);
      }
    } else {
      console.error(`\n❌ Error: ${result.error || 'Task execution failed'}\n`);
    }
    
    // Cleanup before exiting
    await memoryManager.cleanup();
    
    // Detach monitoring if it was attached
    if (monitoringBridge) {
      monitoringBridge.detach();
    }
    
    process.exit(result.success ? 0 : 1);
  }
  
  // Check if we're in interactive mode
  if (config.isInteractive()) {
    // Render React Ink UI
    const instance = render(<App config={config} orchestrator={orchestrator} />);
    
    // Prevent the process from exiting in interactive mode
    await new Promise<void>((resolve) => {
      process.on('SIGINT', async () => {
        instance.unmount();
        await memoryManager.cleanup();
        if (monitoringBridge) {
          monitoringBridge.detach();
        }
        resolve();
      });
      
      process.on('SIGTERM', async () => {
        instance.unmount();
        await memoryManager.cleanup();
        if (monitoringBridge) {
          monitoringBridge.detach();
        }
        resolve();
      });
      
      process.on('exit', async () => {
        instance.unmount();
        await memoryManager.cleanup();
        if (monitoringBridge) {
          monitoringBridge.detach();
        }
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