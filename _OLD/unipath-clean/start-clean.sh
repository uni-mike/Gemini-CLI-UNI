#!/bin/bash
# UNIPATH Clean Start Script

# Set environment variables
export APPROVAL_MODE=${APPROVAL_MODE:-yolo}
export DEBUG=${DEBUG:-false}

# Suppress raw mode errors for Claude Code environment  
export FORCE_COLOR=1
# Only disable raw mode if explicitly requested
# export DISABLE_RAW_MODE=true

# Force rebuild to avoid old code usage
echo "🔄 Force rebuilding to ensure latest code..."
npm run build

# Run the clean CLI with proper UI
echo "🚀 Starting UNIPATH Clean Architecture..."
node dist/cli.js "$@" 2>/dev/null || node dist/cli.js "$@"