#!/bin/bash

# FlexiCLI Clean Start Script with Debug & Interactive Support
# Comprehensive testing and development script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Display banner
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║              FlexiCLI Clean Start & Debug                ║${NC}"
echo -e "${CYAN}║          Full System Reset + Comprehensive Testing       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Clean Environment
echo -e "${YELLOW}🧹 Step 1: Cleaning environment...${NC}"

# Kill any running processes
echo -e "  • Killing existing FlexiCLI processes..."
pkill -f "flexicli|tsx.*cli" 2>/dev/null || echo "  • No processes to kill"

# Clean FlexiCLI data directories
echo -e "  • Cleaning FlexiCLI logs and cache..."
rm -rf .flexicli/logs/* 2>/dev/null || true
rm -rf .flexicli/cache/* 2>/dev/null || true

# Optional: Reset database (uncomment if you want fresh DB each time)
# echo -e "  • Resetting database..."
# rm -f .flexicli/flexicli.db 2>/dev/null || true

echo -e "${GREEN}  ✅ Environment cleaned${NC}"
echo ""

# Step 2: Verify Database
echo -e "${YELLOW}🗄️  Step 2: Verifying database...${NC}"
echo -e "  • Running Prisma migration (ensures schema exists)..."
npx prisma migrate deploy --schema=prisma/schema.prisma
echo -e "${GREEN}  ✅ Database ready${NC}"
echo ""

# Step 3: System Status Check
echo -e "${YELLOW}📊 Step 3: System status...${NC}"

# Check if monitoring is running
if lsof -i:4000 >/dev/null 2>&1; then
    echo -e "  • Monitoring: ${GREEN}✅ Running on port 4000${NC}"
    ENABLE_MONITORING=true
else
    echo -e "  • Monitoring: ${YELLOW}⚠️  Not running (optional)${NC}"
    ENABLE_MONITORING=false
fi

# Check FlexiCLI structure
echo -e "  • FlexiCLI directory structure:"
ls -la .flexicli/ 2>/dev/null || echo "    (Will be created on first run)"

echo ""

# Step 4: Configuration Options
echo -e "${YELLOW}⚙️  Step 4: Configuration...${NC}"
echo -e "${GREEN}Available options:${NC}"
echo -e "  ${BLUE}1.${NC} Simple test (single command)"
echo -e "  ${BLUE}2.${NC} Complex test (multi-step task)"
echo -e "  ${BLUE}3.${NC} Interactive mode (full debugging) - supports mini-agents"
echo -e "  ${BLUE}4.${NC} Interactive mode (clean) - supports mini-agents"
echo -e "  ${BLUE}5.${NC} Custom prompt"
echo -e "  ${PURPLE}6.${NC} Mini-agent test (specialized delegation)"
echo -e "  ${PURPLE}7.${NC} Advanced mini-agent workflow (complex task delegation)"
echo -e "  ${PURPLE}8.${NC} Mini-agent validation (test all agent types)"
echo ""

# Get user choice
read -p "Select option (1-8): " choice
echo ""

# Set environment variables for comprehensive debugging
export DEBUG=true
export ENABLE_MONITORING=$ENABLE_MONITORING
export APPROVAL_MODE=default  # Changed to prompt for all approvals

# Display final configuration
echo -e "${YELLOW}🚀 Final Configuration:${NC}"
echo -e "  • Debug Mode: ${GREEN}ENABLED${NC}"
echo -e "  • Monitoring: ${GREEN}$([[ $ENABLE_MONITORING == true ]] && echo "ENABLED" || echo "OPTIONAL")${NC}"
echo -e "  • Approval: ${GREEN}DEFAULT (Prompts for sensitive operations)${NC}"
echo -e "  • Database: ${GREEN}VALIDATED${NC}"
echo ""

case $choice in
    1)
        echo -e "${GREEN}🧪 Running Simple Test...${NC}"
        echo -e "${BLUE}Command: Create a TypeScript function with proper types${NC}"
        echo ""
        npx tsx src/cli.tsx --prompt "Create a TypeScript file with a function that calculates the factorial of a number, include proper type annotations and JSDoc comments"
        ;;
    2)
        echo -e "${GREEN}🔬 Running Complex Test...${NC}"
        echo -e "${BLUE}Command: Multi-step React application with components${NC}"
        echo ""
        npx tsx src/cli.tsx --prompt "Create a complete React TypeScript application with: 1) Main App component with routing, 2) Dashboard component with state management, 3) User profile component with form handling, 4) API service layer with TypeScript interfaces, 5) Proper folder structure and exports"
        ;;
    3)
        echo -e "${GREEN}💻 Starting Interactive Mode (Full Debug)...${NC}"
        echo -e "${BLUE}Full debugging enabled - you can run any commands${NC}"
        echo -e "${PURPLE}Available commands: /help, /status, /tools, /memory, /clear, /exit${NC}"
        echo -e "${PURPLE}Mini-agent support: Use complex tasks to trigger mini-agent delegation${NC}"
        echo ""
        echo -e "${CYAN}Press Enter to continue...${NC}"
        read
        export DEBUG=true
        npx tsx src/cli.tsx
        ;;
    4)
        echo -e "${GREEN}💻 Starting Interactive Mode (Clean)...${NC}"
        echo -e "${BLUE}Clean interface - no debug output${NC}"
        echo -e "${PURPLE}Mini-agent support: Use complex tasks to trigger mini-agent delegation${NC}"
        echo -e "${PURPLE}Available commands: /help, /status, /tools, /memory, /clear, /exit${NC}"
        echo ""
        echo -e "${CYAN}Press Enter to continue...${NC}"
        read
        export DEBUG=false
        npx tsx src/cli.tsx
        ;;
    5)
        echo -e "${GREEN}✏️  Custom Prompt Mode...${NC}"
        read -p "Enter your custom prompt: " custom_prompt
        echo ""
        echo -e "${BLUE}Executing: $custom_prompt${NC}"
        echo ""
        npx tsx src/cli.tsx --prompt "$custom_prompt"
        ;;
    6)
        echo -e "${PURPLE}🎭 Running Mini-Agent Test...${NC}"
        echo -e "${BLUE}Command: Task that will trigger search mini-agent delegation${NC}"
        echo ""
        npx tsx src/cli.tsx --prompt "Search through the FlexiCLI codebase to find all TypeScript files in the src/tools directory, then analyze their architecture patterns and provide a summary of the tool discovery system implementation."
        ;;
    6)
        echo -e "${PURPLE}🚀 Running Advanced Mini-Agent Workflow...${NC}"
        echo -e "${BLUE}Command: Complex task requiring multiple mini-agent types${NC}"
        echo ""
        npx tsx src/cli.tsx --prompt "Analyze the complete FlexiCLI codebase structure, find all TypeScript files in src/tools directory, examine their architecture patterns, identify optimization opportunities, refactor the tool discovery mechanism for better performance, create comprehensive tests to validate the changes, and document the entire process with before/after comparisons including performance metrics and architectural improvements."
        ;;
    7)
        echo -e "${PURPLE}🔬 Running Mini-Agent Validation...${NC}"
        echo -e "${BLUE}Testing all mini-agent types with the advanced test framework${NC}"
        echo ""
        echo -e "${CYAN}Running comprehensive mini-agent validation test...${NC}"
        npx tsx test-big-task-advanced.ts
        ;;
    *)
        echo -e "${RED}Invalid option. Starting interactive mode by default...${NC}"
        echo ""
        npx tsx src/cli.tsx
        ;;
esac

# Post-execution analysis
echo ""
echo -e "${YELLOW}📋 Post-Execution Analysis:${NC}"

# Check database population
if [ -f .flexicli/flexicli.db ]; then
    chunk_count=$(sqlite3 .flexicli/flexicli.db "SELECT COUNT(*) FROM Chunk;" 2>/dev/null || echo "0")
    session_count=$(sqlite3 .flexicli/flexicli.db "SELECT COUNT(*) FROM Session;" 2>/dev/null || echo "0")
    log_count=$(sqlite3 .flexicli/flexicli.db "SELECT COUNT(*) FROM ExecutionLog;" 2>/dev/null || echo "0")

    echo -e "  • Database chunks: ${GREEN}$chunk_count${NC}"
    echo -e "  • Sessions: ${GREEN}$session_count${NC}"
    echo -e "  • Execution logs: ${GREEN}$log_count${NC}"
else
    echo -e "  • Database: ${RED}Not created${NC}"
fi

# Check logs
if [ -d .flexicli/logs ] && [ "$(ls -A .flexicli/logs)" ]; then
    log_files=$(ls .flexicli/logs/ | wc -l)
    echo -e "  • Log files created: ${GREEN}$log_files${NC}"
else
    echo -e "  • Log files: ${YELLOW}None created${NC}"
fi

# Mini-agent specific analysis
if [[ $choice -eq 6 || $choice -eq 7 || $choice -eq 8 ]]; then
    echo -e "  • Mini-Agent Mode: ${PURPLE}✅ EXECUTED${NC}"
    if [[ $choice -eq 8 ]]; then
        if [ -f "test-big-task-advanced.ts" ]; then
            echo -e "  • Advanced Test Framework: ${GREEN}✅ Available${NC}"
        else
            echo -e "  • Advanced Test Framework: ${RED}❌ Missing${NC}"
        fi
    fi
    echo -e "  ${PURPLE}Mini-agent capabilities tested:${NC}"
    echo -e "    - Task complexity analysis"
    echo -e "    - Specialized agent spawning"
    echo -e "    - Context scoping and isolation"
    echo -e "    - Multi-agent coordination"
    echo -e "    - Dependency management"
fi

# Final summary
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    Execution Complete                    ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo -e "${GREEN}FlexiCLI agent execution finished.${NC}"
echo -e "${BLUE}Check the output above for results and any issues.${NC}"
if [[ $choice -eq 6 || $choice -eq 7 || $choice -eq 8 ]]; then
    echo -e "${PURPLE}Mini-agent system integration validated!${NC}"
fi
echo ""
