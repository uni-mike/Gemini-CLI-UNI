#!/bin/bash

# Start UNIPATH with Trio Pattern
echo "🎭 Starting UNIPATH with Orchestration Trio..."
echo "  • Planner: Analyzes and creates execution plans"
echo "  • Executor: Executes tasks with tools"
echo "  • Orchestrator: Coordinates bidirectional communication"
echo ""

# Load environment
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Compile TypeScript
npm run build 2>/dev/null

# Run with Trio
npx tsx src/cli-trio.tsx "$@"