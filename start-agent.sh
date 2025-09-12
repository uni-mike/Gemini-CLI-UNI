#!/bin/bash

# FlexiCLI Agent - Main CLI Service
# The actual agent that executes commands

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║            FlexiCLI Agent - Main Service              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if monitoring integration is requested
if [ "$1" == "--with-monitoring" ] || [ "$ENABLE_MONITORING" == "true" ]; then
    export ENABLE_MONITORING=true
    echo -e "${YELLOW}📊 Monitoring integration enabled${NC}"
    echo -e "${BLUE}   Agent will attach to monitoring at http://localhost:4000${NC}"
    
    # Remove the flag from arguments if present
    if [ "$1" == "--with-monitoring" ]; then
        shift
    fi
else
    echo -e "${YELLOW}ℹ️  Running without monitoring (use --with-monitoring to enable)${NC}"
fi

# Pass all arguments to the agent
echo -e "${GREEN}🚀 Starting agent in development mode...${NC}"
echo ""

# Use the monitoring-aware CLI if monitoring is enabled
if [ "$ENABLE_MONITORING" == "true" ]; then
    npx tsx src/cli-with-monitoring.ts "$@"
else
    npx tsx src/cli.tsx "$@"
fi