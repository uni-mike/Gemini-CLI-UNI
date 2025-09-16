#!/bin/bash

echo "🧪 Testing Agent-Monitoring Integration"
echo "======================================="
echo ""

# Build first
echo "📦 Building TypeScript..."
npx tsc

# Start monitoring in background
echo "📊 Starting monitoring system..."
node -e "
import('./dist/monitoring/index.js').then(async (module) => {
  const monitoring = await module.startStandaloneMonitoring(4000);
  console.log('✅ Monitoring server started');
});
" &
MONITORING_PID=$!

# Wait for monitoring to start
sleep 3

# Start agent with simple task
echo ""
echo "🤖 Starting agent with test task..."
DEBUG=true timeout 10 ./start-clean.sh --prompt "What is 2+2?" --non-interactive &
AGENT_PID=$!

# Wait for agent to process
sleep 5

# Check API for data
echo ""
echo "📡 Checking monitoring data:"
echo "============================"
echo ""

echo "1. Health Check:"
curl -s http://localhost:4000/api/health | python3 -m json.tool | head -5

echo ""
echo "2. Metrics (should have data):"
curl -s http://localhost:4000/api/metrics | python3 -m json.tool | head -10

echo ""
echo "3. Events (should have agent events):"
curl -s "http://localhost:4000/api/events?limit=5" | python3 -m json.tool | head -20

echo ""
echo "4. Sessions (should have active session):"
curl -s http://localhost:4000/api/sessions | python3 -m json.tool | head -10

echo ""
echo "5. Pipeline status:"
curl -s http://localhost:4000/api/pipeline | python3 -m json.tool | head -10

# Clean up
echo ""
echo "🧹 Cleaning up..."
kill $MONITORING_PID 2>/dev/null
kill $AGENT_PID 2>/dev/null
pkill -f "node.*monitoring" 2>/dev/null
pkill -f "node.*start-clean" 2>/dev/null

echo "✅ Integration test complete!"