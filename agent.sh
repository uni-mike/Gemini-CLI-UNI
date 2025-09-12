#!/bin/bash

# FlexiCLI Agent Control Script
# Manages the FlexiCLI agent independently of monitoring

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default settings
APPROVAL_MODE=${APPROVAL_MODE:-"default"}
NON_INTERACTIVE=false
PROMPT=""

# Help function
show_help() {
    echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║           FlexiCLI Agent Control Script                ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}Usage:${NC}"
    echo "  ./agent.sh [options]"
    echo ""
    echo -e "${GREEN}Options:${NC}"
    echo "  --prompt \"text\"      Run a single command and exit"
    echo "  --non-interactive    Run in non-interactive mode"
    echo "  --approval-mode MODE Set approval mode (default/yolo/strict)"
    echo "  --help               Show this help message"
    echo ""
    echo -e "${GREEN}Examples:${NC}"
    echo "  # Interactive mode"
    echo "  ./agent.sh"
    echo ""
    echo "  # Run a single command"
    echo "  ./agent.sh --prompt \"Create a README.md file\""
    echo ""
    echo "  # Non-interactive with auto-approval"
    echo "  APPROVAL_MODE=yolo ./agent.sh --prompt \"Fix the bug\" --non-interactive"
    echo ""
    echo -e "${GREEN}Commands in Interactive Mode:${NC}"
    echo "  /help, /?       Show available commands"
    echo "  /exit, /quit    Exit the CLI (Ctrl+C also works)"
    echo "  /clear          Clear the screen"
    echo "  /status         Show system status"
    echo "  /tools          List available tools"
    echo "  /memory         Show memory statistics"
    echo ""
    echo -e "${GREEN}Environment Variables:${NC}"
    echo "  APPROVAL_MODE       Set approval mode (default/yolo/strict)"
    echo "  ENABLE_MONITORING   Enable monitoring integration (true/false)"
    echo "  DEBUG              Enable debug logging (true/false)"
    echo ""
    echo -e "${BLUE}Note: To manage monitoring, use ./monitoring.sh${NC}"
    echo ""
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
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
echo -e "${CYAN}║                    FlexiCLI Agent                      ║${NC}"
echo -e "${CYAN}║          Intelligent CLI with Complete Memory          ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if monitoring is running and inform user
if lsof -i:4000 >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Monitoring detected on port 4000${NC}"
    export ENABLE_MONITORING=true
else
    echo -e "${YELLOW}ℹ Monitoring not running (use ./monitoring.sh start)${NC}"
    export ENABLE_MONITORING=false
fi
echo ""

# Export approval mode
export APPROVAL_MODE

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
echo -e "${GREEN}Configuration:${NC}"
echo -e "  • Approval: ${YELLOW}$APPROVAL_MODE${NC}"
if [ "$NON_INTERACTIVE" = true ]; then
    echo -e "  • Interactive: ${YELLOW}No${NC}"
else
    echo -e "  • Interactive: ${YELLOW}Yes${NC}"
fi
if [ "$ENABLE_MONITORING" = true ]; then
    echo -e "  • Monitoring: ${GREEN}Connected${NC}"
else
    echo -e "  • Monitoring: ${YELLOW}Not connected${NC}"
fi
echo ""

# Start the agent
if [ "$NON_INTERACTIVE" = true ] && [ -n "$PROMPT" ]; then
    echo -e "${GREEN}🚀 Executing command...${NC}"
    echo ""
    eval $CMD
else
    echo -e "${GREEN}🚀 Starting FlexiCLI Agent...${NC}"
    echo -e "${BLUE}   Type /help for commands or Ctrl+C to exit${NC}"
    echo ""
    eval $CMD
fi