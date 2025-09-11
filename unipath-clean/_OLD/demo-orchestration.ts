#!/usr/bin/env node

/**
 * Demonstration of the new DeepSeek Orchestration System
 * Shows how the three-role architecture prevents stuck states
 */

import { DeepSeekOrchestrator } from './packages/core/src/orchestration/DeepSeekOrchestrator';

async function demonstrateOrchestration() {
  console.log('🎭 DeepSeek Orchestration Demo');
  console.log('═'.repeat(60));
  console.log();

  const orchestrator = new DeepSeekOrchestrator();

  // Example 1: Simple task
  console.log('Example 1: Simple Task');
  console.log('─'.repeat(40));
  await orchestrator.orchestratePrompt('Search for TODO comments in the code');
  console.log();

  // Example 2: Complex multi-step task
  console.log('Example 2: Complex Multi-Step Task');
  console.log('─'.repeat(40));
  const complexPrompt = `
    Analyze this codebase comprehensively:
    1. Search for TypeScript files
    2. Read package.json
    3. Find all test files
    4. Check for security issues
    5. Create a summary report
  `;
  
  await orchestrator.orchestratePrompt(complexPrompt);
  console.log();

  // Example 3: Demonstrating recovery from stuck state
  console.log('Example 3: Recovery from Stuck State');
  console.log('─'.repeat(40));
  
  // Simulate a task that might get stuck
  const problematicPrompt = `
    Run these operations:
    1. Web search for "best practices React 2025"
    2. Read all files in src directory
    3. Run npm test
    4. Deploy to production
  `;

  // Monitor status while running
  const statusInterval = setInterval(() => {
    const status = orchestrator.getStatus();
    if (status.healthStatus === 'stuck') {
      console.log('⚠️  Stuck detected - orchestrator will auto-recover');
    }
  }, 5000);

  await orchestrator.orchestratePrompt(problematicPrompt);
  clearInterval(statusInterval);

  console.log();
  console.log('✅ Demo complete - No stuck states!');
}

// Run the demo
demonstrateOrchestration().catch(console.error);