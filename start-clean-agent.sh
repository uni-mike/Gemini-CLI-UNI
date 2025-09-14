#!/bin/bash

# FlexiCLI Clean Agent Startup Script
# Kills all running agent processes and starts fresh interactive debug session

set -e

echo "🧹 FlexiCLI Clean Agent Startup - $(date)"
echo "=================================================="

# Step 1: Kill ALL existing FlexiCLI and related processes
echo "🔪 Killing all existing agent processes..."

# Kill by process name patterns
pkill -f "npx tsx.*cli.tsx" 2>/dev/null || echo "  ✓ No cli.tsx processes found"
pkill -f "unified-server" 2>/dev/null || echo "  ✓ No unified-server processes found"
pkill -f "npm run dev" 2>/dev/null || echo "  ✓ No npm dev processes found"
pkill -f "monitoring" 2>/dev/null || echo "  ✓ No monitoring processes found"

# Kill by port (in case processes are bound to specific ports)
lsof -ti:4000 2>/dev/null | xargs kill -9 2>/dev/null || echo "  ✓ Port 4000 clear"
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || echo "  ✓ Port 3000 clear"

# Wait for processes to fully terminate
echo "⏳ Waiting for cleanup..."
sleep 3

# Step 2: Verify clean state
echo "🔍 Verifying clean state..."
REMAINING_PROCESSES=$(ps aux | grep -E "(tsx.*cli|unified-server|npm.*dev)" | grep -v grep | wc -l)
if [ "$REMAINING_PROCESSES" -gt 0 ]; then
    echo "⚠️  Warning: $REMAINING_PROCESSES processes still running"
    ps aux | grep -E "(tsx.*cli|unified-server|npm.*dev)" | grep -v grep
else
    echo "  ✅ All processes cleaned up successfully"
fi

# Step 3: Navigate to project directory
echo "📁 Navigating to FlexiCLI directory..."
cd "$(dirname "$0")"
pwd

# Step 4: Start clean agent with debug and interactive mode
echo "🚀 Starting FlexiCLI Agent in clean interactive debug mode..."
echo "   - Debug mode: ENABLED"
echo "   - Interactive mode: ENABLED"
echo "   - Monitoring: DISABLED (for clean testing)"
echo "   - Model: DeepSeek-V3.1"
echo ""
echo "To test with monitoring, set ENABLE_MONITORING=true"
echo "=================================================="
echo ""

# Start the agent
DEBUG=true ENABLE_MONITORING=false npx tsx src/cli.tsx

echo ""
echo "🏁 FlexiCLI Agent session ended - $(date)"