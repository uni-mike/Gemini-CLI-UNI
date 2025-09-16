#!/bin/bash

# FlexiCLI Complete Test Suite
# Tests all agent and monitoring functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0
TESTS=()

# Test function
run_test() {
    local test_name="$1"
    local test_cmd="$2"
    
    echo -e "${BLUE}Running: ${test_name}${NC}"
    
    if eval "$test_cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASSED: ${test_name}${NC}"
        PASSED=$((PASSED + 1))
        TESTS+=("✅ ${test_name}")
    else
        echo -e "${RED}❌ FAILED: ${test_name}${NC}"
        FAILED=$((FAILED + 1))
        TESTS+=("❌ ${test_name}")
    fi
    echo ""
}

echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         FlexiCLI Complete Test Suite                   ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Clean up any previous test artifacts
rm -f test-*.txt 2>/dev/null

# Test 1: Monitoring Start
echo -e "${YELLOW}=== Testing Monitoring Control ===${NC}"
run_test "Stop monitoring" "./monitoring.sh stop"
sleep 2
run_test "Start monitoring" "./monitoring.sh start"
sleep 5
run_test "Check monitoring status" "./monitoring.sh status | grep 'Running'"

# Test 2: Agent Basic Commands
echo -e "${YELLOW}=== Testing Agent Basic Commands ===${NC}"
run_test "Agent help" "./agent.sh --help"
run_test "Simple math (2+2)" "APPROVAL_MODE=yolo ./agent.sh --prompt 'What is 2+2?' --non-interactive | grep -E '4|four'"
run_test "File creation" "APPROVAL_MODE=yolo ./agent.sh --prompt 'Create test-agent.txt with content Testing' --non-interactive && [ -f test-agent.txt ]"

# Test 3: Memory Pipeline
echo -e "${YELLOW}=== Testing Memory Pipeline ===${NC}"
run_test "Code search" "APPROVAL_MODE=yolo ./agent.sh --prompt 'Search for TokenBudget class' --non-interactive | grep -i token"
run_test "Memory storage" "sqlite3 .flexicli/flexicli.db 'SELECT COUNT(*) FROM Session' | grep -E '[0-9]+'"

# Test 4: Tool Execution
echo -e "${YELLOW}=== Testing Tool Execution ===${NC}"
run_test "Bash tool" "APPROVAL_MODE=yolo ./agent.sh --prompt 'Run echo Hello from bash' --non-interactive | grep -i hello"
run_test "Web search" "APPROVAL_MODE=yolo ./agent.sh --prompt 'Search web for TypeScript types' --non-interactive | grep -i type"

# Test 5: Monitoring API
echo -e "${YELLOW}=== Testing Monitoring API ===${NC}"
run_test "API health endpoint" "curl -s http://localhost:4000/api/health | grep -E 'ok|healthy'"
run_test "API metrics endpoint" "curl -s http://localhost:4000/api/metrics | grep -E 'tokens|memory'"
run_test "Dashboard access" "curl -s http://localhost:3000 | grep -E 'React|FlexiCLI'"

# Test 6: Token Economics
echo -e "${YELLOW}=== Testing Token Economics ===${NC}"
run_test "Token budgeting" "APPROVAL_MODE=yolo ./agent.sh --prompt 'Create a long detailed explanation of JavaScript' --non-interactive | wc -w | awk '{if($1<2000) exit 0; else exit 1}'"

# Test 7: Error Handling
echo -e "${YELLOW}=== Testing Error Handling ===${NC}"
run_test "Invalid command handling" "./agent.sh --invalid-flag 2>&1 | grep -i 'unknown'"
run_test "Monitoring stop/restart" "./monitoring.sh stop && sleep 2 && ./monitoring.sh start"

# Test 8: Concurrent Operations
echo -e "${YELLOW}=== Testing Concurrent Operations ===${NC}"
run_test "Multiple agent calls" "
    APPROVAL_MODE=yolo ./agent.sh --prompt 'Create test-1.txt' --non-interactive &
    APPROVAL_MODE=yolo ./agent.sh --prompt 'Create test-2.txt' --non-interactive &
    wait
    [ -f test-1.txt ] && [ -f test-2.txt ]
"

# Clean up test files
rm -f test-*.txt 2>/dev/null

# Summary
echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                   Test Summary                         ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Passed: ${PASSED}${NC}"
echo -e "${RED}Failed: ${FAILED}${NC}"
echo ""

echo "Test Results:"
for test in "${TESTS[@]}"; do
    echo "  $test"
done

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed successfully!${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  Some tests failed. Please review.${NC}"
    exit 1
fi