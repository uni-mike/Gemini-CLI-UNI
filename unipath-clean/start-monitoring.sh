#!/bin/bash

# Start Monitoring System
# Works independently of agent - reads from DB, logs, and files

echo "🚀 Starting FlexiCLI Monitoring System..."
echo "This will monitor the .flexicli/ directory for agent activity"
echo ""

# Build if needed
if [ ! -d "dist" ]; then
    echo "📦 Building TypeScript..."
    npx tsc
fi

# Build React UI if needed
if [ ! -d "monitoring-ui/build" ]; then
    echo "🎨 Building monitoring UI..."
    cd monitoring-ui
    npm run build
    cd ..
fi

# Start monitoring server
echo "Starting monitoring server..."
cat << 'EOF'

╔════════════════════════════════════════════════════════╗
║           FlexiCLI Monitoring System                   ║
╠════════════════════════════════════════════════════════╣
║  Mode: AUTONOMOUS (no agent required)                  ║
║  Dashboard: http://localhost:4000                      ║
║                                                         ║
║  Monitoring:                                            ║
║  ✓ Database (.flexicli/flexicli.db)                   ║
║  ✓ Log files (.flexicli/logs/)                        ║
║  ✓ Session snapshots (.flexicli/sessions/)            ║
║  ✓ Cache files (.flexicli/cache/)                     ║
║                                                         ║
║  The agent can start/stop/crash - monitoring continues ║
╚════════════════════════════════════════════════════════╝

EOF

# Create a simple Node.js script to start monitoring
node -e "
import('./dist/monitoring/index.js').then(async (module) => {
  const monitoring = await module.startStandaloneMonitoring(4000);
  console.log('✅ Monitoring is running');
  console.log('📊 Open http://localhost:4000 in your browser');
  console.log('');
  console.log('Press Ctrl+C to stop monitoring');
});
"