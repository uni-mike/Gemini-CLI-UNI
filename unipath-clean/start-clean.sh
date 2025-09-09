#!/bin/bash
# UNIPATH Clean Start Script

# Set environment variables
export APPROVAL_MODE=${APPROVAL_MODE:-yolo}
export DEBUG=${DEBUG:-false}

# Run the clean CLI
echo "🚀 Starting UNIPATH Clean Architecture..."
node dist/cli.js "$@"