#!/bin/bash

echo "🚀 Starting FlexiCLI Agent with Integrated Monitoring"
echo "===================================================="
echo ""

# Build TypeScript
echo "📦 Building TypeScript..."
npx tsc

echo ""
echo "Starting agent with monitoring enabled..."
echo "Monitoring will be available at: http://localhost:4000"
echo ""

# Start the agent (monitoring is enabled by default in orchestrator)
node dist/cli.js "$@"