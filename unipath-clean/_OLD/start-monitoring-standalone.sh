#!/bin/bash

echo "🚀 Starting FlexiCLI Monitoring System (Standalone)"
echo "=================================================="
echo ""

# Build TypeScript if needed
if [ ! -d "dist" ]; then
    echo "📦 Building TypeScript..."
    npx tsc
fi

# Start monitoring
echo "📊 Starting monitoring server..."
node -e "
import('./dist/monitoring/backend/index.js').then(async (module) => {
  const monitoring = await module.startStandaloneMonitoring(4000);
  console.log('');
  console.log('✅ Monitoring is running!');
  console.log('');
  console.log('📊 Open http://localhost:4000 in your browser');
  console.log('');
  console.log('The monitoring system will:');
  console.log('  • Poll database for sessions/chunks/logs');
  console.log('  • Watch log files for changes');
  console.log('  • Collect system metrics');
  console.log('  • Work even if agent crashes');
  console.log('');
  console.log('Press Ctrl+C to stop monitoring');
});
"