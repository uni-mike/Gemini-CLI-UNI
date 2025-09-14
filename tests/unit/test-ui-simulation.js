#!/usr/bin/env node

// Simulate what the React UI would fetch and display

async function testMonitoringUI() {
  console.log("=== SIMULATING UI DATA FETCHING ===\n");

  const BASE_URL = 'http://localhost:4000';

  try {
    // 1. Overview Tab
    console.log("1. OVERVIEW TAB:");
    const overview = await fetch(`${BASE_URL}/api/overview`).then(r => r.json());
    console.log(`   Token Usage: ${overview.tokenUsage || 0}`);
    console.log(`   Active Tasks: ${overview.activeTasks || 0}`);
    console.log(`   Completed Tasks: ${overview.completedTasks || 0}`);

    // 2. Tools Tab
    console.log("\n2. TOOLS TAB:");
    const tools = await fetch(`${BASE_URL}/api/tools`).then(r => r.json());
    console.log(`   Total Tools: ${tools.tools?.length || 0}`);
    console.log(`   Tools with executions: ${tools.tools?.filter(t => t.executions > 0).length || 0}`);
    if (tools.recentExecutions?.length > 0) {
      const exec = tools.recentExecutions[0];
      console.log(`   Latest execution:`);
      console.log(`     Tool: ${exec.tool}`);
      console.log(`     Details: ${JSON.stringify(exec.details).substring(0, 50)}...`);
      console.log(`     Output: ${JSON.stringify(exec.output).substring(0, 50)}...`);
    }

    // 3. Memory Tab
    console.log("\n3. MEMORY TAB:");
    const memory = await fetch(`${BASE_URL}/api/memory`).then(r => r.json());
    if (memory.layers) {
      memory.layers.forEach(layer => {
        console.log(`   ${layer.name}: ${layer.chunks || 0} chunks`);
      });
    }

    // 4. Sessions Tab
    console.log("\n4. SESSIONS TAB:");
    const sessions = await fetch(`${BASE_URL}/api/sessions`).then(r => r.json());
    console.log(`   Total Sessions: ${sessions.length || 0}`);
    if (sessions[0]) {
      console.log(`   Latest Session:`);
      console.log(`     ID: ${sessions[0].id}`);
      console.log(`     Status: ${sessions[0].status}`);
      console.log(`     Tokens: ${sessions[0].tokensUsed}`);
    }

    // 5. Pipeline Tab
    console.log("\n5. PIPELINE TAB:");
    const pipeline = await fetch(`${BASE_URL}/api/pipeline`).then(r => r.json());
    console.log(`   Nodes: ${pipeline.nodes?.length || 0}`);
    console.log(`   Edges: ${pipeline.edges?.length || 0}`);
    console.log(`   Total Executions: ${pipeline.stats?.totalExecutions || 0}`);

    console.log("\n=== UI SIMULATION COMPLETE ===");

  } catch (error) {
    console.error("Error fetching data:", error.message);
    console.log("\nMake sure the monitoring backend is running on port 4000");
  }
}

testMonitoringUI();