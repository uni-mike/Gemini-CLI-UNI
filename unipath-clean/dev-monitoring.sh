#!/bin/bash

# UNIPATH Monitoring Development Server
# This script manages both frontend (React) and backend (Node.js) for the monitoring dashboard

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directories
PROJECT_ROOT="/Users/mike.admon/UNIPATH_PROJECT/gemini-cli/unipath-clean"
BACKEND_DIR="$PROJECT_ROOT/src/monitoring/backend"
FRONTEND_DIR="$PROJECT_ROOT/src/monitoring/react-dashboard"

# PID files to track processes
BACKEND_PID_FILE="$PROJECT_ROOT/.monitoring-backend.pid"
FRONTEND_PID_FILE="$PROJECT_ROOT/.monitoring-frontend.pid"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[MONITORING]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to cleanup processes
cleanup() {
    print_status "Cleaning up monitoring processes..."
    
    # Kill backend if running
    if [[ -f "$BACKEND_PID_FILE" ]]; then
        BACKEND_PID=$(cat "$BACKEND_PID_FILE")
        if kill -0 "$BACKEND_PID" 2>/dev/null; then
            print_status "Stopping backend (PID: $BACKEND_PID)..."
            kill "$BACKEND_PID"
            sleep 2
        fi
        rm -f "$BACKEND_PID_FILE"
    fi
    
    # Kill frontend if running
    if [[ -f "$FRONTEND_PID_FILE" ]]; then
        FRONTEND_PID=$(cat "$FRONTEND_PID_FILE")
        if kill -0 "$FRONTEND_PID" 2>/dev/null; then
            print_status "Stopping frontend (PID: $FRONTEND_PID)..."
            kill "$FRONTEND_PID"
            sleep 2
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi
    
    # Kill any remaining monitoring processes
    pkill -f "monitoring.*npm.*start" 2>/dev/null || true
    pkill -f "node.*server.js" 2>/dev/null || true
    pkill -f "vite.*monitoring" 2>/dev/null || true
    
    print_success "Cleanup complete"
}

# Function to check if ports are available
check_ports() {
    print_status "Checking if ports are available..."
    
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_error "Port 3000 is already in use (Frontend)"
        lsof -Pi :3000 -sTCP:LISTEN
        exit 1
    fi
    
    if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_error "Port 4000 is already in use (Backend)"
        lsof -Pi :4000 -sTCP:LISTEN
        exit 1
    fi
    
    print_success "Ports 3000 and 4000 are available"
}

# Function to check backend dependencies 
check_backend() {
    print_status "Checking backend dependencies..."
    cd "$BACKEND_DIR"
    
    if ! npm list tsx > /dev/null 2>&1; then
        print_status "Installing tsx for TypeScript execution..."
        npm install tsx
    fi
    
    print_success "Backend dependencies ready"
}

# Function to start backend
start_backend() {
    print_status "Starting backend on port 4000..."
    cd "$BACKEND_DIR"
    
    # Start backend in background and save PID using tsx for TypeScript
    nohup npx tsx server-simplified.ts > monitoring-backend.log 2>&1 &
    BACKEND_PID=$!
    echo "$BACKEND_PID" > "$BACKEND_PID_FILE"
    
    # Wait for backend to start
    print_status "Waiting for backend to start..."
    for i in {1..30}; do
        if curl -s http://localhost:4000/api/overview >/dev/null 2>&1; then
            print_success "Backend started successfully (PID: $BACKEND_PID)"
            return 0
        fi
        sleep 1
    done
    
    print_error "Backend failed to start within 30 seconds"
    cleanup
    exit 1
}

# Function to start frontend
start_frontend() {
    print_status "Starting frontend on port 3000..."
    cd "$FRONTEND_DIR"
    
    # Start frontend in background and save PID
    SKIP_PREFLIGHT_CHECK=true nohup npm start > monitoring-frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo "$FRONTEND_PID" > "$FRONTEND_PID_FILE"
    
    # Wait for frontend to start
    print_status "Waiting for frontend to start..."
    for i in {1..60}; do
        if curl -s http://localhost:3000 >/dev/null 2>&1; then
            print_success "Frontend started successfully (PID: $FRONTEND_PID)"
            return 0
        fi
        sleep 2
    done
    
    print_error "Frontend failed to start within 60 seconds"
    cleanup
    exit 1
}

# Function to show status
show_status() {
    print_status "Checking monitoring services status..."
    
    # Check backend
    if [[ -f "$BACKEND_PID_FILE" ]]; then
        BACKEND_PID=$(cat "$BACKEND_PID_FILE")
        if kill -0 "$BACKEND_PID" 2>/dev/null; then
            print_success "Backend running (PID: $BACKEND_PID) - http://localhost:4000"
        else
            print_error "Backend not running (stale PID file)"
            rm -f "$BACKEND_PID_FILE"
        fi
    else
        print_error "Backend not running"
    fi
    
    # Check frontend
    if [[ -f "$FRONTEND_PID_FILE" ]]; then
        FRONTEND_PID=$(cat "$FRONTEND_PID_FILE")
        if kill -0 "$FRONTEND_PID" 2>/dev/null; then
            print_success "Frontend running (PID: $FRONTEND_PID) - http://localhost:3000"
        else
            print_error "Frontend not running (stale PID file)"
            rm -f "$FRONTEND_PID_FILE"
        fi
    else
        print_error "Frontend not running"
    fi
}

# Function to show logs
show_logs() {
    case $1 in
        backend|be)
            if [[ -f "$BACKEND_DIR/monitoring-backend.log" ]]; then
                tail -f "$BACKEND_DIR/monitoring-backend.log"
            else
                print_error "Backend log file not found"
            fi
            ;;
        frontend|fe)
            if [[ -f "$FRONTEND_DIR/monitoring-frontend.log" ]]; then
                tail -f "$FRONTEND_DIR/monitoring-frontend.log"
            else
                print_error "Frontend log file not found"
            fi
            ;;
        *)
            print_error "Usage: $0 logs [backend|frontend|be|fe]"
            ;;
    esac
}

# Trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Main script logic
case "${1:-start}" in
    start)
        print_status "Starting UNIPATH Monitoring Development Server..."
        cleanup
        check_ports
        check_backend
        start_backend
        start_frontend
        
        print_success "Monitoring development server started!"
        print_status "Frontend: http://localhost:3000"
        print_status "Backend:  http://localhost:4000"
        print_status "Use './dev-monitoring.sh stop' to stop all services"
        print_status "Use './dev-monitoring.sh status' to check status"
        print_status "Use './dev-monitoring.sh logs [frontend|backend]' to view logs"
        
        # Keep script running to handle cleanup
        while true; do
            sleep 10
            # Check if processes are still running
            if [[ -f "$BACKEND_PID_FILE" ]] && [[ -f "$FRONTEND_PID_FILE" ]]; then
                BACKEND_PID=$(cat "$BACKEND_PID_FILE")
                FRONTEND_PID=$(cat "$FRONTEND_PID_FILE")
                if ! kill -0 "$BACKEND_PID" 2>/dev/null || ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
                    print_error "One or more processes stopped unexpectedly"
                    break
                fi
            else
                print_error "PID files missing, processes may have stopped"
                break
            fi
        done
        ;;
        
    stop)
        print_status "Stopping UNIPATH Monitoring Development Server..."
        cleanup
        ;;
        
    restart)
        print_status "Restarting UNIPATH Monitoring Development Server..."
        cleanup
        sleep 2
        exec "$0" start
        ;;
        
    status)
        show_status
        ;;
        
    logs)
        show_logs "$2"
        ;;
        
    *)
        echo "Usage: $0 {start|stop|restart|status|logs [frontend|backend]}"
        echo ""
        echo "Commands:"
        echo "  start    - Start both frontend and backend (default)"
        echo "  stop     - Stop both frontend and backend"
        echo "  restart  - Restart both services"
        echo "  status   - Show status of both services"
        echo "  logs     - Show logs (specify frontend or backend)"
        exit 1
        ;;
esac