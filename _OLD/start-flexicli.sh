#!/bin/bash

# FlexiCLI Unified Startup Script - Development Mode
# Starts the FlexiCLI agent with optional monitoring

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting FlexiCLI in development mode...${NC}"

# No build needed in dev mode - using tsx directly

# Check if monitoring should be started
if [ "$1" != "--no-monitoring" ]; then
    echo -e "${GREEN}📊 Starting monitoring server in dev mode...${NC}"
    npx tsx --watch src/monitoring/backend/unified-server.ts &
    MONITORING_PID=$!
    echo "Monitoring server PID: $MONITORING_PID (with hot reload)"
    sleep 2
fi

# Pass all arguments except the first if it's a flag
if [[ "$1" == --* ]]; then
    shift
fi

# Start FlexiCLI in dev mode
echo -e "${GREEN}✨ Starting FlexiCLI agent in dev mode...${NC}"
npx tsx --watch src/cli.tsx "$@"

# Cleanup on exit
if [ ! -z "$MONITORING_PID" ]; then
    echo -e "${YELLOW}Stopping monitoring server...${NC}"
    kill $MONITORING_PID 2>/dev/null || true
fi