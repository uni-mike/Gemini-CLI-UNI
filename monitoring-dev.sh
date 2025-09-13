#!/bin/bash

# FlexiCLI Monitoring Development Script (with Hot Reload)
# Starts both backend and frontend with hot reload enabled

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# PID file locations
BACKEND_PID_FILE="/tmp/flexicli-monitoring-backend-dev.pid"
FRONTEND_PID_FILE="/tmp/flexicli-monitoring-frontend-dev.pid"

# Help function
show_help() {
    echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║     FlexiCLI Monitoring Dev Script (Hot Reload)        ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}Usage:${NC}"
    echo "  ./monitoring-dev.sh [command]"
    echo ""
    echo -e "${GREEN}Commands:${NC}"
    echo "  start    Start monitoring with hot reload"
    echo "  stop     Stop monitoring services"
    echo "  restart  Restart monitoring services"
    echo "  status   Show monitoring status"
    echo "  logs     Show monitoring logs"
    echo "  help     Show this help message"
    echo ""
    echo -e "${GREEN}Features:${NC}"
    echo "  • Backend hot reload with tsx --watch"
    echo "  • Frontend hot reload with React dev server"
    echo "  • Auto-restart on file changes"
    echo ""
    echo -e "${GREEN}Dashboard Access:${NC}"
    echo "  Backend API: http://localhost:4000"
    echo "  Dashboard: http://localhost:3000"
    echo ""
    exit 0
}

# Check if port is in use
check_port() {
    local port=$1
    if lsof -i:$port >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Stop monitoring services
stop_monitoring() {
    echo -e "${YELLOW}⏹ Stopping monitoring services...${NC}"
    
    # Kill backend
    if [ -f $BACKEND_PID_FILE ]; then
        PID=$(cat $BACKEND_PID_FILE)
        if ps -p $PID > /dev/null 2>&1; then
            kill $PID 2>/dev/null || true
            echo -e "${GREEN}✓ Backend stopped${NC}"
        fi
        rm -f $BACKEND_PID_FILE
    fi
    
    # Kill frontend
    if [ -f $FRONTEND_PID_FILE ]; then
        PID=$(cat $FRONTEND_PID_FILE)
        if ps -p $PID > /dev/null 2>&1; then
            kill $PID 2>/dev/null || true
            echo -e "${GREEN}✓ Frontend stopped${NC}"
        fi
        rm -f $FRONTEND_PID_FILE
    fi
    
    # Kill any remaining processes on ports
    lsof -i:4000 | grep LISTEN | awk '{print $2}' | xargs kill -9 2>/dev/null || true
    lsof -i:3000 | grep LISTEN | awk '{print $2}' | xargs kill -9 2>/dev/null || true
    
    echo -e "${GREEN}✅ Monitoring services stopped${NC}"
}

# Start monitoring services with hot reload
start_monitoring() {
    echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║     Starting FlexiCLI Monitoring (Dev Mode)            ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Check if already running
    if check_port 4000; then
        echo -e "${YELLOW}⚠ Backend already running on port 4000${NC}"
        echo -e "${YELLOW}  Run './monitoring-dev.sh stop' first${NC}"
        exit 1
    fi

    if check_port 3000; then
        echo -e "${YELLOW}⚠ Frontend already running on port 3000${NC}"
        echo -e "${YELLOW}  Run './monitoring-dev.sh stop' first${NC}"
        exit 1
    fi

    # Start backend with hot reload
    echo -e "${BLUE}🚀 Starting backend with hot reload...${NC}"
    npx tsx --watch src/monitoring/backend/unified-server.ts > /tmp/flexicli-monitoring-backend-dev.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > $BACKEND_PID_FILE
    
    # Wait for backend to start
    echo -n "   Waiting for backend"
    for i in {1..10}; do
        if check_port 4000; then
            echo ""
            echo -e "${GREEN}✅ Backend started with hot reload on port 4000${NC}"
            break
        fi
        echo -n "."
        sleep 1
    done
    
    if ! check_port 4000; then
        echo ""
        echo -e "${RED}❌ Failed to start backend${NC}"
        echo -e "${YELLOW}Check logs: tail -f /tmp/flexicli-monitoring-backend-dev.log${NC}"
        exit 1
    fi

    # Start frontend with hot reload
    echo -e "${BLUE}🚀 Starting frontend with hot reload...${NC}"
    cd src/monitoring/react-dashboard
    BROWSER=none npm start > /tmp/flexicli-monitoring-frontend-dev.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > $FRONTEND_PID_FILE
    cd - > /dev/null
    
    # Wait for frontend to start
    echo -n "   Waiting for frontend"
    for i in {1..15}; do
        if check_port 3000; then
            echo ""
            echo -e "${GREEN}✅ Frontend started with hot reload on port 3000${NC}"
            break
        fi
        echo -n "."
        sleep 1
    done
    
    if ! check_port 3000; then
        echo ""
        echo -e "${RED}❌ Failed to start frontend${NC}"
        echo -e "${YELLOW}Check logs: tail -f /tmp/flexicli-monitoring-frontend-dev.log${NC}"
        exit 1
    fi

    echo ""
    echo -e "${GREEN}✨ Monitoring is running in development mode!${NC}"
    echo ""
    echo -e "${CYAN}📊 Dashboard: ${YELLOW}http://localhost:3000${NC}"
    echo -e "${CYAN}🔌 API Backend: ${YELLOW}http://localhost:4000${NC}"
    echo ""
    echo -e "${GREEN}🔄 Hot Reload Enabled:${NC}"
    echo -e "   • Backend will restart on .ts file changes"
    echo -e "   • Frontend will reload on .tsx/.css changes"
    echo ""
    echo -e "${BLUE}📝 View logs:${NC}"
    echo -e "   Backend: tail -f /tmp/flexicli-monitoring-backend-dev.log"
    echo -e "   Frontend: tail -f /tmp/flexicli-monitoring-frontend-dev.log"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop (or run './monitoring-dev.sh stop')${NC}"
}

# Show status
show_status() {
    echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║          FlexiCLI Monitoring Status                    ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Check backend
    if check_port 4000; then
        echo -e "${GREEN}✅ Backend: Running on port 4000${NC}"
        if [ -f $BACKEND_PID_FILE ]; then
            PID=$(cat $BACKEND_PID_FILE)
            echo -e "   PID: $PID"
        fi
    else
        echo -e "${RED}❌ Backend: Not running${NC}"
    fi
    
    # Check frontend
    if check_port 3000; then
        echo -e "${GREEN}✅ Frontend: Running on port 3000${NC}"
        if [ -f $FRONTEND_PID_FILE ]; then
            PID=$(cat $FRONTEND_PID_FILE)
            echo -e "   PID: $PID"
        fi
    else
        echo -e "${RED}❌ Frontend: Not running${NC}"
    fi
    
    echo ""
}

# Show logs
show_logs() {
    echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║          FlexiCLI Monitoring Logs                      ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Showing last 20 lines of each log...${NC}"
    echo ""
    
    echo -e "${BLUE}Backend Log:${NC}"
    if [ -f /tmp/flexicli-monitoring-backend-dev.log ]; then
        tail -20 /tmp/flexicli-monitoring-backend-dev.log
    else
        echo "No backend log found"
    fi
    
    echo ""
    echo -e "${BLUE}Frontend Log:${NC}"
    if [ -f /tmp/flexicli-monitoring-frontend-dev.log ]; then
        tail -20 /tmp/flexicli-monitoring-frontend-dev.log
    else
        echo "No frontend log found"
    fi
}

# Main command handler
case "${1:-}" in
    start)
        start_monitoring
        ;;
    stop)
        stop_monitoring
        ;;
    restart)
        stop_monitoring
        sleep 2
        start_monitoring
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Invalid command: ${1:-}${NC}"
        echo "Use './monitoring-dev.sh help' for usage information"
        exit 1
        ;;
esac