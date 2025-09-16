#!/bin/bash

echo "==================================================================="
echo "      FLEXICLI MONITORING SYSTEM - COMPREHENSIVE TEST SUITE"
echo "==================================================================="
echo

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to test an API endpoint
test_api() {
    local endpoint=$1
    local description=$2
    local check_field=$3

    echo -n "Testing $description... "

    response=$(curl -s http://localhost:4000/api/$endpoint)

    if [ ! -z "$check_field" ]; then
        result=$(echo "$response" | python3 -c "import json, sys; data=json.load(sys.stdin); print('OK' if '$check_field' in str(data) else 'FAIL')" 2>/dev/null)
    else
        result=$(echo "$response" | python3 -c "import json, sys; json.load(sys.stdin); print('OK')" 2>/dev/null)
    fi

    if [ "$result" = "OK" ]; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((FAILED++))
        echo "  Response: $(echo "$response" | head -c 100)..."
    fi
}

echo "1. CHECKING MONITORING SERVICES"
echo "================================"

# Check backend
if curl -s http://localhost:4000/api/health | grep -q "ok"; then
    echo -e "Backend API: ${GREEN}✓ Running${NC} (port 4000)"
    ((PASSED++))
else
    echo -e "Backend API: ${RED}✗ Not running${NC}"
    ((FAILED++))
fi

# Check frontend
if curl -s http://localhost:3000 | grep -q "<!DOCTYPE html>"; then
    echo -e "Frontend UI: ${GREEN}✓ Running${NC} (port 3000)"
    ((PASSED++))
else
    echo -e "Frontend UI: ${RED}✗ Not running${NC}"
    ((FAILED++))
fi

echo
echo "2. TESTING API ENDPOINTS"
echo "========================"

test_api "health" "Health endpoint" "status"
test_api "overview" "Overview stats" "tokenUsage"
test_api "memory" "Memory layers" "layers"
test_api "tools" "Tools data" "tools"
test_api "sessions" "Sessions list" ""
test_api "pipeline" "Pipeline flow" "nodes"
test_api "projects" "Projects list" ""

echo
echo "3. CHECKING DATABASE DATA"
echo "========================="

echo -n "Checking ExecutionLog entries... "
exec_count=$(sqlite3 .flexicli/flexicli.db "SELECT COUNT(*) FROM ExecutionLog;" 2>/dev/null)
if [ "$exec_count" -gt 0 ]; then
    echo -e "${GREEN}✓ $exec_count entries${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ No entries${NC}"
fi

echo -n "Checking Chunk entries... "
chunk_count=$(sqlite3 .flexicli/flexicli.db "SELECT COUNT(*) FROM Chunk;" 2>/dev/null)
if [ "$chunk_count" -gt 0 ]; then
    echo -e "${GREEN}✓ $chunk_count chunks${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ No chunks${NC}"
fi

echo -n "Checking GitCommit entries... "
git_count=$(sqlite3 .flexicli/flexicli.db "SELECT COUNT(*) FROM GitCommit;" 2>/dev/null)
if [ "$git_count" -gt 0 ]; then
    echo -e "${GREEN}✓ $git_count commits${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ No commits${NC}"
fi

echo
echo "4. TESTING DATA FLOW"
echo "===================="

# Check memory API returns real chunk data
echo -n "Memory API shows real chunks... "
memory_response=$(curl -s http://localhost:4000/api/memory)
code_chunks=$(echo "$memory_response" | python3 -c "import json, sys; data=json.load(sys.stdin); print([l for l in data['layers'] if l['name'] == 'Code Index'][0]['chunks'])" 2>/dev/null)
if [ "$code_chunks" -gt 0 ]; then
    echo -e "${GREEN}✓ Code Index: $code_chunks chunks${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ No code chunks shown${NC}"
    ((FAILED++))
fi

# Check tools API returns executions with details
echo -n "Tools API shows execution details... "
tools_response=$(curl -s http://localhost:4000/api/tools)
has_details=$(echo "$tools_response" | python3 -c "import json, sys; data=json.load(sys.stdin); execs=data.get('recentExecutions', []); print('YES' if execs and 'details' in execs[0] else 'NO')" 2>/dev/null)
if [ "$has_details" = "YES" ]; then
    echo -e "${GREEN}✓ Execution details present${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ No execution details${NC}"
fi

# Check sessions have proper status
echo -n "Sessions show proper status... "
sessions_response=$(curl -s http://localhost:4000/api/sessions)
session_status=$(echo "$sessions_response" | python3 -c "import json, sys; data=json.load(sys.stdin); print('OK' if data and data[0].get('status') != 'crashed' else 'FAIL')" 2>/dev/null)
if [ "$session_status" = "OK" ]; then
    echo -e "${GREEN}✓ Status correctly shown${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ Status needs improvement${NC}"
fi

echo
echo "5. MONITORING UI FEATURES"
echo "========================="

echo -e "${YELLOW}Manual verification needed:${NC}"
echo "  • Open http://localhost:3000 in browser"
echo "  • Click on Tools tab - verify execution details show"
echo "  • Click on a tool - verify modal shows recent executions"
echo "  • Check Memory tab - verify chunks are displayed"
echo "  • Check Sessions tab - verify IDs are readable"
echo "  • Hover over truncated text - verify tooltips appear"

echo
echo "==================================================================="
echo "                        TEST RESULTS"
echo "==================================================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✓ ALL AUTOMATED TESTS PASSED!${NC}"
    echo "Please verify the UI features manually."
else
    echo -e "\n${YELLOW}⚠ Some tests failed. Review output above.${NC}"
fi

echo
echo "To run a live test with agent:"
echo "  ENABLE_MONITORING=true APPROVAL_MODE=yolo npx tsx src/cli.tsx \\"
echo "    --prompt \"Search for TypeScript best practices and create a summary\" \\"
echo "    --non-interactive"
echo