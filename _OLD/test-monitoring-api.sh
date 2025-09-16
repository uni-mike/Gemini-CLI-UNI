#!/bin/bash

echo "🧪 Testing Monitoring API Integration"
echo "===================================="
echo ""

# Start monitoring in background
echo "📊 Starting monitoring system..."
node -e "
import('./dist/monitoring/index.js').then(async (module) => {
  const monitoring = await module.startStandaloneMonitoring(4000);
  console.log('✅ Monitoring server started on port 4000');
  
  // Keep alive for testing
  setTimeout(() => {
    console.log('Test timeout reached');
  }, 60000);
});
" &

MONITORING_PID=$!
echo "Monitoring PID: $MONITORING_PID"

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 3

# Test API endpoints
echo ""
echo "🔍 Testing API Endpoints:"
echo "========================"

# Health check
echo ""
echo "1. Health Check (/api/health):"
curl -s http://localhost:4000/api/health | head -1

# Metrics
echo ""
echo "2. Metrics (/api/metrics):"
curl -s http://localhost:4000/api/metrics | head -1

# Events
echo ""
echo "3. Events (/api/events?limit=5):"
curl -s "http://localhost:4000/api/events?limit=5" | head -1

# Sessions
echo ""
echo "4. Sessions (/api/sessions):"
curl -s http://localhost:4000/api/sessions | head -1

# Chunks
echo ""
echo "5. Chunks (/api/chunks):"
curl -s http://localhost:4000/api/chunks | head -1

# Knowledge
echo ""
echo "6. Knowledge (/api/knowledge):"
curl -s http://localhost:4000/api/knowledge | head -1

# Pipeline stages
echo ""
echo "7. Pipeline Stages (/api/pipeline):"
curl -s http://localhost:4000/api/pipeline | head -1

# Tools
echo ""
echo "8. Tools (/api/tools):"
curl -s http://localhost:4000/api/tools | head -1

# Clean up
echo ""
echo "🧹 Cleaning up..."
kill $MONITORING_PID 2>/dev/null
echo "✅ Test complete!"