#!/usr/bin/env node
import { toolDiscovery } from './dist/tools/auto-discovery.js';
import { globalRegistry } from './dist/tools/registry.js';

async function testToolAlignment() {
  console.log('🔍 Testing Tool Alignment...\n');
  
  // Discover and load all tools
  await toolDiscovery.discoverAndLoadTools();
  
  // Get all tools from registry
  const tools = globalRegistry.getAllTools();
  
  console.log(`✅ Found ${tools.length} tools:\n`);
  
  // Check each tool for proper alignment
  let allAligned = true;
  
  for (const tool of tools) {
    const hasSchema = tool.parameterSchema && Array.isArray(tool.parameterSchema);
    const status = hasSchema ? '✅' : '❌';
    
    console.log(`${status} ${tool.name.padEnd(15)} - ${tool.description}`);
    
    if (hasSchema) {
      console.log(`   Parameters: ${tool.parameterSchema.length}`);
      for (const param of tool.parameterSchema) {
        const req = param.required ? 'required' : 'optional';
        console.log(`     - ${param.name} (${param.type}, ${req})`);
      }
    } else {
      console.log('   ⚠️  Missing parameterSchema!');
      allAligned = false;
    }
    console.log();
  }
  
  if (allAligned) {
    console.log('🎉 All tools are properly aligned with parameter schemas!');
  } else {
    console.log('⚠️  Some tools are missing parameter schemas!');
    process.exit(1);
  }
}

testToolAlignment().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});