#!/usr/bin/env node
import 'dotenv/config';
import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.tsx';
import { Config } from './config/Config.js';
import { toolDiscovery } from './tools/auto-discovery.js';
import { ApprovalManager } from './approval/approval-manager.js';
import { globalRegistry } from './tools/registry.js';
import { Orchestrator } from './core/orchestrator.js';
import { MemoryManager } from './memory/memory-manager.js';
import { MonitoringBridge } from './monitoring/backend/monitoring-bridge.js';
import { PrismaClient } from '@prisma/client';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import axios from 'axios';

// Global SIGINT handler to ensure Ctrl+C always works
process.on('SIGINT', () => {
  console.log('\n❌ Interrupted by user');
  process.exit(130); // Standard exit code for SIGINT
});

// Prevent any unhandled promise rejections from blocking exit
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  process.exit(1);
});

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

  // CRITICAL DB VALIDATION WITH CONCURRENT PROTECTION - DO NOT REMOVE OR MODIFY!
  // Always validate database schema exists before proceeding to prevent Prisma errors
  // This prevents "Table does not exist" errors when agent starts with fresh/cleared DB
  // RACE CONDITION FIX: Use file-based lock to prevent multiple agents running migrations simultaneously
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const lockFile = path.join(process.cwd(), '.flexicli', 'migration.lock');
    const maxWaitTime = 30000; // 30 seconds maximum wait
    const checkInterval = 100; // Check every 100ms

    // Ensure .flexicli directory exists
    try {
      await fs.mkdir(path.join(process.cwd(), '.flexicli'), { recursive: true });
    } catch (e) {
      // Directory might already exist
    }

    // Wait for any ongoing migrations to complete
    let waitTime = 0;
    while (waitTime < maxWaitTime) {
      try {
        await fs.access(lockFile);
        // Lock file exists, another agent is running migrations
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waitTime += checkInterval;
        continue;
      } catch {
        // Lock file doesn't exist, we can proceed
        break;
      }
    }

    if (waitTime >= maxWaitTime) {
      console.log('⚠️ Migration lock timeout, removing stale lock file...');
      try {
        await fs.unlink(lockFile);
      } catch (e) {
        // Lock file might have been removed by another process
      }
    }

    const prismaClient = new PrismaClient();

    // Test basic database connectivity by checking if any table exists
    await prismaClient.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' LIMIT 1`;

    // Quick validation - try to query a core table to ensure schema is deployed
    try {
      await prismaClient.project.findFirst();
    } catch (schemaError: any) {
      if (schemaError.code === 'P2021') {
        console.log('📊 Database schema not found, initializing...');

        // Create lock file to prevent race conditions with other agents
        try {
          await fs.writeFile(lockFile, JSON.stringify({
            pid: process.pid,
            startTime: new Date().toISOString()
          }));
          console.log('🔒 Database migration lock acquired');
        } catch (lockError) {
          console.log('⚠️ Could not create migration lock, proceeding anyway...');
        }

        try {
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
        } finally {
          // Always remove lock file, even if migration fails
          try {
            await fs.unlink(lockFile);
            console.log('🔓 Database migration lock released');
          } catch (unlockError) {
            console.log('⚠️ Could not remove migration lock file');
          }
        }
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

  // Initialize approval manager and attach to registry
  const approvalManager = new ApprovalManager(config);
  globalRegistry.setApprovalManager(approvalManager);

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
  
  // Check if we have a prompt - execute it directly without UI
  if (argv.prompt) {
    console.log(`\n📝 Executing: ${argv.prompt}\n`);

    // Set up event listeners for output
    orchestrator.on('tool-execute', ({ name, args }) => {
      console.log(`  🔧 Running tool: ${name}`);
      if (config.getDebugMode()) {
        console.log(`     Args: ${JSON.stringify(args, null, 2)}`);
      }
    });

    orchestrator.on('tool-result', ({ name, result }) => {
      if (result.success) {
        console.log(`  ✅ ${name} completed`);
        // Always show bash command output (not just in debug mode)
        if (name === 'bash' && result.output && result.output.trim()) {
          const outputLines = result.output.trim().split('\n');
          if (outputLines.length <= 20) {
            // Show all lines if 20 or fewer
            outputLines.forEach((line: string) => console.log(`     ${line}`));
          } else {
            // Show first 20 lines with indication of more
            outputLines.slice(0, 20).forEach((line: string) => console.log(`     ${line}`));
            console.log(`     ... (${outputLines.length - 20} more lines)`);
          }
        } else if (config.getDebugMode() && result.output) {
          // For other tools, show limited output in debug mode
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
    approvalManager.cleanup();

    // Detach monitoring if it was attached
    if (monitoringBridge) {
      monitoringBridge.detach();
    }

    process.exit(result.success ? 0 : 1);
  }

  // Check if we're in interactive mode without a prompt
  if (config.isInteractive() && !argv.prompt) {
    // Enable UI mode for approval manager
    approvalManager.setUIMode(true);

    // Render React Ink UI with approval manager
    const instance = render(<App config={config} orchestrator={orchestrator} approvalManager={approvalManager} />);

    // Keep the process alive - the global SIGINT handler will handle Ctrl+C
    await instance.waitUntilExit();

    // Cleanup on normal exit
    await memoryManager.cleanup();
    approvalManager.cleanup();
    if (monitoringBridge) {
      monitoringBridge.detach();
    }
  } else if (!config.isInteractive()) {
    // Non-interactive mode without prompt
    console.log('Running in non-interactive mode...');
    console.log('No prompt provided. Use --prompt "your task" to execute a command.');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});