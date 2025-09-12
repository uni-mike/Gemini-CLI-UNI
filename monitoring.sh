#!/bin/bash

# FlexiCLI Monitoring Control Script
# Manages the monitoring dashboard independently

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# PID file locations
BACKEND_PID_FILE="/tmp/flexicli-monitoring-backend.pid"
FRONTEND_PID_FILE="/tmp/flexicli-monitoring-frontend.pid"

# Help function
show_help() {
    echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║          FlexiCLI Monitoring Control Script            ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}Usage:${NC}"
    echo "  ./monitoring.sh [command]"
    echo ""
    echo -e "${GREEN}Commands:${NC}"
    echo "  start    Start monitoring services (backend + dashboard)"
    echo "  stop     Stop monitoring services"
    echo "  restart  Restart monitoring services"
    echo "  status   Show monitoring status"
    echo "  logs     Show monitoring logs"
    echo "  help     Show this help message"
    echo ""
    echo -e "${GREEN}Dashboard Access:${NC}"
    echo "  Once started, access the dashboard at http://localhost:3000"
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

# Start monitoring services
start_monitoring() {
    echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║           Starting FlexiCLI Monitoring                 ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Check if already running
    if check_port 4000; then
        echo -e "${YELLOW}⚠ Monitoring backend already running on port 4000${NC}"
    else
        echo -e "${BLUE}🚀 Starting monitoring backend...${NC}"
        npx tsx src/monitoring/backend/unified-server.ts > /tmp/flexicli-monitoring-backend.log 2>&1 &
        echo $! > $BACKEND_PID_FILE
        sleep 2
        
        if check_port 4000; then
            echo -e "${GREEN}✅ Backend started successfully on port 4000${NC}"
        else
            echo -e "${RED}❌ Failed to start backend${NC}"
            exit 1
        fi
    fi

    if check_port 3000; then
        echo -e "${YELLOW}⚠ Monitoring dashboard already running on port 3000${NC}"
    else
        echo -e "${BLUE}🚀 Starting monitoring dashboard...${NC}"
        cd src/monitoring/react-dashboard && npm start > /tmp/flexicli-monitoring-frontend.log 2>&1 &
        echo $! > $FRONTEND_PID_FILE
        cd - > /dev/null
        sleep 3
        
        if check_port 3000; then
            echo -e "${GREEN}✅ Dashboard started successfully${NC}"
        else
            echo -e "${RED}❌ Failed to start dashboard${NC}"
            exit 1
        fi
    fi

    echo ""
    echo -e "${GREEN}✨ Monitoring is active!${NC}"
    echo -e "${CYAN}📊 Dashboard: ${YELLOW}http://localhost:3000${NC}"
    echo -e "${CYAN}🔌 API Backend: ${YELLOW}http://localhost:4000${NC}"
    echo ""
    echo -e "${BLUE}Tip: Use './monitoring.sh logs' to view logs${NC}"
}

# Stop monitoring services
stop_monitoring() {
    echo -e "${YELLOW}🛑 Stopping FlexiCLI Monitoring...${NC}"
    
    # Stop backend
    if [ -f $BACKEND_PID_FILE ]; then
        PID=$(cat $BACKEND_PID_FILE)
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            echo -e "${GREEN}✅ Backend stopped${NC}"
        fi
        rm -f $BACKEND_PID_FILE
    else
        # Try to find and kill by port
        if check_port 4000; then
            lsof -ti:4000 | xargs kill 2>/dev/null || true
            echo -e "${GREEN}✅ Backend stopped (by port)${NC}"
        fi
    fi
    
    # Stop frontend
    if [ -f $FRONTEND_PID_FILE ]; then
        PID=$(cat $FRONTEND_PID_FILE)
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            echo -e "${GREEN}✅ Dashboard stopped${NC}"
        fi
        rm -f $FRONTEND_PID_FILE
    else
        # Try to find and kill by port
        if check_port 3000; then
            lsof -ti:3000 | xargs kill 2>/dev/null || true
            echo -e "${GREEN}✅ Dashboard stopped (by port)${NC}"
        fi
    fi
    
    echo -e "${GREEN}✅ Monitoring services stopped${NC}"
}

# Show monitoring status
show_status() {
    echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║          FlexiCLI Monitoring Status                    ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Check backend
    if check_port 4000; then
        echo -e "${GREEN}✅ Backend: Running on port 4000${NC}"
    else
        echo -e "${RED}❌ Backend: Not running${NC}"
    fi
    
    # Check frontend
    if check_port 3000; then
        echo -e "${GREEN}✅ Dashboard: Running on port 3000${NC}"
        echo -e "${CYAN}   Access at: ${YELLOW}http://localhost:3000${NC}"
    else
        echo -e "${RED}❌ Dashboard: Not running${NC}"
    fi
    
    echo ""
}

# Show logs
show_logs() {
    echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║          FlexiCLI Monitoring Logs                      ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if [ -f /tmp/flexicli-monitoring-backend.log ]; then
        echo -e "${YELLOW}Backend logs (last 20 lines):${NC}"
        tail -20 /tmp/flexicli-monitoring-backend.log
        echo ""
    fi
    
    if [ -f /tmp/flexicli-monitoring-frontend.log ]; then
        echo -e "${YELLOW}Dashboard logs (last 20 lines):${NC}"
        tail -20 /tmp/flexicli-monitoring-frontend.log
    fi
}

# Main command handler
case "${1:-start}" in
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
        echo -e "${RED}Unknown command: $1${NC}"
        echo "Use './monitoring.sh help' for usage information"
        exit 1
        ;;
esac