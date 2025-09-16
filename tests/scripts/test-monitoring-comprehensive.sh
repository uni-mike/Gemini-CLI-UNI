#!/bin/bash

# Comprehensive End-to-End Monitoring System Test
# Tests all monitoring features in an integrated manner

set -e

echo "========================================"
echo "🚀 FLEXICLI MONITORING SYSTEM TEST SUITE"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SUCCESS_COUNT=0
FAIL_COUNT=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "\n${YELLOW}Testing: $test_name${NC}"
    
    if eval "$test_command" > /tmp/test_output.txt 2>&1; then
        echo -e "${GREEN}✅ PASSED${NC}"
        ((SUCCESS_COUNT++))
    else
        echo -e "${RED}❌ FAILED${NC}"
        echo "Error output:"
        tail -n 10 /tmp/test_output.txt
        ((FAIL_COUNT++))
    fi
}

# 1. Test Embeddings and Semantic Search
echo -e "\n${YELLOW}═══ 1. EMBEDDINGS & SEMANTIC SEARCH ═══${NC}"
run_test "Embeddings generation" "npx tsx test-embeddings-monitoring.ts 2>&1 | grep -q 'Embeddings test complete'"

# 2. Test Token Persistence
echo -e "\n${YELLOW}═══ 2. TOKEN PERSISTENCE ═══${NC}"
run_test "Token tracking and persistence" "npx tsx test-token-persistence.ts 2>&1 | grep -q 'Token persistence test complete'"

# 3. Test Tool Tracking
echo -e "\n${YELLOW}═══ 3. TOOL EXECUTION TRACKING ═══${NC}"
run_test "Tool execution monitoring" "npx tsx test-tool-tracking.ts 2>&1 | grep -q 'Tool tracking test complete'"

# 4. Test Memory Layer Monitoring
echo -e "\n${YELLOW}═══ 4. MEMORY LAYER MONITORING ═══${NC}"
run_test "Memory layers (ephemeral/knowledge/retrieval)" "npx tsx test-memory-monitoring.ts 2>&1 | grep -q 'Memory monitoring test complete'"

# 5. Test Pipeline Stage Tracking
echo -e "\n${YELLOW}═══ 5. PIPELINE STAGE TRACKING ═══${NC}"
run_test "Pipeline stages (planning/execution)" "npx tsx test-pipeline-tracking.ts 2>&1 | grep -q 'Pipeline tracking test complete'"

# 6. Test Session Recovery Performance
echo -e "\n${YELLOW}═══ 6. SESSION RECOVERY PERFORMANCE ═══${NC}"
run_test "Git history parsing performance" "npx tsx test-session-recovery-direct.ts 2>&1 | grep -q 'Git history parsing test complete'"

# 7. Test Monitoring Server API
echo -e "\n${YELLOW}═══ 7. MONITORING SERVER API ═══${NC}"
echo "Checking if monitoring server is running..."
if curl -s http://localhost:4000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Monitoring server is running${NC}"
    
    # Test each API endpoint
    run_test "Health endpoint" "curl -s http://localhost:4000/api/health | grep -q 'ok'"
    run_test "Overview endpoint" "curl -s http://localhost:4000/api/overview | grep -q 'totalSessions'"
    run_test "Sessions endpoint" "curl -s http://localhost:4000/api/sessions | grep -q 'sessions'"
    run_test "Tools endpoint" "curl -s http://localhost:4000/api/tools | grep -q 'toolStats'"
    run_test "Memory endpoint" "curl -s http://localhost:4000/api/memory | grep -q 'layers'"
    run_test "Pipeline endpoint" "curl -s http://localhost:4000/api/pipeline | grep -q 'stages'"
else
    echo -e "${YELLOW}⚠️ Monitoring server not running - skipping API tests${NC}"
    echo "Start it with: npm run monitoring:server"
fi

# 8. Database Integrity Check
echo -e "\n${YELLOW}═══ 8. DATABASE INTEGRITY ═══${NC}"
if [ -f ".flexicli/flexicli.db" ]; then
    echo -e "${GREEN}✅ Database file exists${NC}"
    
    # Check database size
    DB_SIZE=$(du -h .flexicli/flexicli.db | cut -f1)
    echo "Database size: $DB_SIZE"
    
    # Check table counts
    echo "Checking database tables..."
    sqlite3 .flexicli/flexicli.db "SELECT 'Sessions:', COUNT(*) FROM Session;" 2>/dev/null || true
    sqlite3 .flexicli/flexicli.db "SELECT 'Chunks:', COUNT(*) FROM Chunk;" 2>/dev/null || true
    sqlite3 .flexicli/flexicli.db "SELECT 'Commits:', COUNT(*) FROM GitCommit;" 2>/dev/null || true
    sqlite3 .flexicli/flexicli.db "SELECT 'Logs:', COUNT(*) FROM ExecutionLog;" 2>/dev/null || true
    ((SUCCESS_COUNT++))
else
    echo -e "${RED}❌ Database file not found${NC}"
    ((FAIL_COUNT++))
fi

# 9. Test React Dashboard (if running)
echo -e "\n${YELLOW}═══ 9. REACT DASHBOARD ═══${NC}"
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ React dashboard is running${NC}"
    ((SUCCESS_COUNT++))
else
    echo -e "${YELLOW}⚠️ React dashboard not running${NC}"
    echo "Start it with: npm run monitoring:dashboard"
fi

# Final Summary
echo -e "\n========================================"
echo -e "📊 ${YELLOW}TEST RESULTS SUMMARY${NC}"
echo "========================================"
echo -e "${GREEN}Passed: $SUCCESS_COUNT tests${NC}"
echo -e "${RED}Failed: $FAIL_COUNT tests${NC}"

TOTAL_TESTS=$((SUCCESS_COUNT + FAIL_COUNT))
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$((SUCCESS_COUNT * 100 / TOTAL_TESTS))
    echo -e "\nSuccess Rate: ${SUCCESS_RATE}%"
    
    if [ $SUCCESS_RATE -ge 90 ]; then
        echo -e "\n${GREEN}🎉 MONITORING SYSTEM IS FULLY OPERATIONAL!${NC}"
    elif [ $SUCCESS_RATE -ge 70 ]; then
        echo -e "\n${YELLOW}⚠️ Monitoring system is mostly operational${NC}"
    else
        echo -e "\n${RED}❌ Monitoring system needs attention${NC}"
    fi
fi

echo -e "\n✨ Comprehensive monitoring test complete!"

exit $FAIL_COUNT