#!/bin/bash

# FlexiCLI - Unified Startup Script
# The main entry point for FlexiCLI with optional monitoring

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse command line arguments
ENABLE_MONITORING=false
NON_INTERACTIVE=false
PROMPT=""
APPROVAL_MODE=${APPROVAL_MODE:-"default"}

# Help function
show_help() {
    echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                 FlexiCLI Usage Guide                   ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}Usage:${NC}"
    echo "  ./start.sh [options]"
    echo ""
    echo -e "${GREEN}Options:${NC}"
    echo "  --with-monitoring    Enable monitoring dashboard (http://localhost:3000)"
    echo "  --prompt \"text\"      Run a single command and exit"
    echo "  --non-interactive    Run in non-interactive mode"
    echo "  --approval-mode MODE Set approval mode (default/yolo/strict)"
    echo "  --help               Show this help message"
    echo ""
    echo -e "${GREEN}Examples:${NC}"
    echo "  # Interactive mode with monitoring"
    echo "  ./start.sh --with-monitoring"
    echo ""
    echo "  # Run a single command"
    echo "  ./start.sh --prompt \"Create a README.md file\""
    echo ""
    echo "  # Non-interactive with auto-approval"
    echo "  APPROVAL_MODE=yolo ./start.sh --prompt \"Fix the bug\" --non-interactive"
    echo ""
    echo -e "${GREEN}Commands in Interactive Mode:${NC}"
    echo "  /help, /?       Show available commands"
    echo "  /exit, /quit    Exit the CLI (Ctrl+C also works)"
    echo "  /clear          Clear the screen"
    echo "  /status         Show system status"
    echo ""
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --with-monitoring)
            ENABLE_MONITORING=true
            shift
            ;;
        --prompt)
            PROMPT="$2"
            shift 2
            ;;
        --non-interactive)
            NON_INTERACTIVE=true
            shift
            ;;
        --approval-mode)
            APPROVAL_MODE="$2"
            shift 2
            ;;
        --help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Display startup banner
echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                      FlexiCLI                          ║${NC}"
echo -e "${CYAN}║        Intelligent CLI with Complete Memory            ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Export approval mode
export APPROVAL_MODE

# Start monitoring if requested
if [ "$ENABLE_MONITORING" = true ]; then
    echo -e "${YELLOW}📊 Starting monitoring services...${NC}"
    
    # Check if monitoring is already running
    if lsof -i:4000 >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Monitoring backend already running on port 4000${NC}"
    else
        echo -e "${BLUE}   Starting monitoring backend...${NC}"
        npx tsx src/monitoring/backend/unified-server.ts > /dev/null 2>&1 &
        MONITORING_BACKEND_PID=$!
        sleep 2
    fi
    
    if lsof -i:3000 >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Monitoring dashboard already running on port 3000${NC}"
    else
        echo -e "${BLUE}   Starting monitoring dashboard...${NC}"
        cd src/monitoring/react-dashboard && npm start > /dev/null 2>&1 &
        MONITORING_FRONTEND_PID=$!
        cd - > /dev/null
        sleep 3
    fi
    
    echo -e "${GREEN}✅ Monitoring active at http://localhost:3000${NC}"
    echo ""
    
    # Enable monitoring integration in agent
    export ENABLE_MONITORING=true
fi

# Build the command
CMD="npx tsx src/cli.tsx"

# Add prompt if provided
if [ -n "$PROMPT" ]; then
    CMD="$CMD --prompt \"$PROMPT\""
fi

# Add non-interactive flag if set
if [ "$NON_INTERACTIVE" = true ]; then
    CMD="$CMD --non-interactive"
fi

# Display mode information
echo -e "${GREEN}Mode Configuration:${NC}"
echo -e "  • Approval: ${YELLOW}$APPROVAL_MODE${NC}"
if [ "$NON_INTERACTIVE" = true ]; then
    echo -e "  • Interactive: ${YELLOW}No${NC}"
else
    echo -e "  • Interactive: ${YELLOW}Yes${NC}"
fi
if [ "$ENABLE_MONITORING" = true ]; then
    echo -e "  • Monitoring: ${YELLOW}Enabled${NC}"
else
    echo -e "  • Monitoring: ${YELLOW}Disabled${NC}"
fi
echo ""

# Start the agent
if [ "$NON_INTERACTIVE" = true ] && [ -n "$PROMPT" ]; then
    echo -e "${GREEN}🚀 Executing command...${NC}"
    echo ""
    eval $CMD
else
    echo -e "${GREEN}🚀 Starting FlexiCLI in interactive mode...${NC}"
    echo -e "${BLUE}   Type /help for commands or Ctrl+C to exit${NC}"
    echo ""
    eval $CMD
fi

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"
    
    if [ ! -z "$MONITORING_BACKEND_PID" ]; then
        kill $MONITORING_BACKEND_PID 2>/dev/null || true
        echo -e "${BLUE}   Stopped monitoring backend${NC}"
    fi
    
    if [ ! -z "$MONITORING_FRONTEND_PID" ]; then
        kill $MONITORING_FRONTEND_PID 2>/dev/null || true
        echo -e "${BLUE}   Stopped monitoring dashboard${NC}"
    fi
    
    echo -e "${GREEN}✅ FlexiCLI shutdown complete${NC}"
}

# Set up cleanup on exit
trap cleanup EXIT