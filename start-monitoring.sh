#!/bin/bash

# FlexiCLI Monitoring - Standalone Service
# Independent monitoring dashboard that observes agent activity

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     FlexiCLI Monitoring - Standalone Service          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Kill any existing processes on ports 3000 and 4000
echo -e "${YELLOW}🔄 Checking for existing processes...${NC}"
lsof -ti:4000 | xargs -r kill -9 2>/dev/null && echo -e "${BLUE}   Killed process on port 4000${NC}"
lsof -ti:3000 | xargs -r kill -9 2>/dev/null && echo -e "${BLUE}   Killed process on port 3000${NC}"
sleep 1

# Start unified monitoring server with dynamic memory allocation
echo -e "${YELLOW}🚀 Starting unified monitoring server...${NC}"
# Ensure we're in the project root for correct database path resolution
cd "$(dirname "$0")"
# Allow Node.js to dynamically allocate memory as needed
npx tsx --watch src/monitoring/backend/unified-server.ts &
BACKEND_PID=$!
echo -e "${BLUE}   Backend PID: $BACKEND_PID${NC}"

# Wait for backend to start
sleep 3

# Check if backend started successfully
if curl -s http://localhost:4000/api/health > /dev/null; then
    echo -e "${GREEN}✅ Backend server started successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Backend may still be starting...${NC}"
fi

# Start frontend dashboard with dynamic memory allocation
echo -e "${YELLOW}🎨 Starting frontend dashboard...${NC}"
cd src/monitoring/react-dashboard
# Clean install if needed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}   Installing dependencies...${NC}"
    npm install > /dev/null 2>&1
fi
npm start &
FRONTEND_PID=$!
echo -e "${BLUE}   Frontend PID: $FRONTEND_PID${NC}"
cd - > /dev/null

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║            Monitoring Services Running                 ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Backend API:  http://localhost:4000                  ║${NC}"
echo -e "${GREEN}║  Frontend UI:  http://localhost:3000                  ║${NC}"
echo -e "${GREEN}║  Mode:         Standalone (No agent required)         ║${NC}"
echo -e "${GREEN}║  Data Source:  Database + Agent Events (if available) ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop monitoring${NC}"

# Cleanup on exit
trap "echo ''; echo -e '${YELLOW}🛑 Stopping monitoring services...${NC}'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo -e '${GREEN}✅ Monitoring stopped${NC}'" EXIT

# Keep script running
wait