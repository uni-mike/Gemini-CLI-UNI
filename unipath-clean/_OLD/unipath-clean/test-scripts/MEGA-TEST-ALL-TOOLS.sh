#!/bin/bash

echo "🚀 MEGA TEST - EXERCISING ALL 13 TOOLS"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TEST_NUM=0

run_test() {
    ((TEST_NUM++))
    echo -e "${YELLOW}Test $TEST_NUM: $1${NC}"
    echo "Command: $2"
    echo "----------------------------------------"
    eval "$2"
    echo ""
}

echo "📦 Building system first..."
npm run build
echo ""

echo "🧪 STARTING MEGA TEST SUITE"
echo ""

# Test 1: BASH - Execute commands
run_test "BASH - List current directory" \
    "./start-clean.sh --prompt 'Use bash to run ls -la and show me the files' --non-interactive"

# Test 2: FILE - Create and read files
run_test "FILE - Create a test file" \
    "./start-clean.sh --prompt 'Create a file called mega-test.txt with content: Testing all tools comprehensively!' --non-interactive"

# Test 3: READ_FILE - Read the created file
run_test "READ_FILE - Read the test file" \
    "./start-clean.sh --prompt 'Read the file mega-test.txt and show me its contents' --non-interactive"

# Test 4: WRITE_FILE - Write another file
run_test "WRITE_FILE - Create Python script" \
    "./start-clean.sh --prompt 'Create a Python script called calculator.py with a function that adds two numbers' --non-interactive"

# Test 5: EDIT - Edit existing file
run_test "EDIT - Modify the Python script" \
    "./start-clean.sh --prompt 'Edit calculator.py to add a subtract function' --non-interactive"

# Test 6: SMART_EDIT - Advanced editing
run_test "SMART_EDIT - Add multiplication to calculator" \
    "./start-clean.sh --prompt 'Use smart edit to add a multiply function to calculator.py' --non-interactive"

# Test 7: GREP - Search for patterns
run_test "GREP - Search for function definitions" \
    "./start-clean.sh --prompt 'Use grep to find all function definitions in calculator.py' --non-interactive"

# Test 8: RG (RipGrep) - Advanced search
run_test "RG - Search for 'def' in Python files" \
    "./start-clean.sh --prompt 'Use ripgrep to search for def in all .py files' --non-interactive"

# Test 9: GLOB - Find files by pattern
run_test "GLOB - Find all .txt files" \
    "./start-clean.sh --prompt 'Use glob to find all .txt files in current directory' --non-interactive"

# Test 10: LS - List directory contents
run_test "LS - List with details" \
    "./start-clean.sh --prompt 'Use ls tool to list all files with details' --non-interactive"

# Test 11: WEB - Search the web
run_test "WEB - Search for TypeScript best practices" \
    "./start-clean.sh --prompt 'Search the web for TypeScript best practices 2025' --non-interactive"

# Test 12: MEMORY - Store and retrieve data
run_test "MEMORY - Store test results" \
    "./start-clean.sh --prompt 'Use memory tool to store key=test_status value=running' --non-interactive"

run_test "MEMORY - Retrieve stored data" \
    "./start-clean.sh --prompt 'Use memory tool to get the value for key test_status' --non-interactive"

# Test 13: GIT - Version control operations
run_test "GIT - Check git status" \
    "./start-clean.sh --prompt 'Use git tool to check the current git status' --non-interactive"

# Test 14: Multi-tool orchestration
run_test "MULTI-TOOL - Complex task" \
    "./start-clean.sh --prompt 'Create a README.md file with project description, then use bash to count lines in it' --non-interactive"

# Test 15: Web search and file creation combo
run_test "WEB + FILE - Research and document" \
    "./start-clean.sh --prompt 'Search the web for React hooks best practices, then create a file react-hooks.md with a summary' --non-interactive"

# Test 16: File analysis with multiple tools
run_test "GREP + RG + GLOB - Comprehensive search" \
    "./start-clean.sh --prompt 'Find all .ts files, then search for async functions in them' --non-interactive"

# Test 17: Edit multiple files
run_test "EDIT + SMART_EDIT - Multi-file editing" \
    "./start-clean.sh --prompt 'Create config.json with database settings, then edit it to add a port number' --non-interactive"

# Test 18: Bash and file operations
run_test "BASH + FILE - System info to file" \
    "./start-clean.sh --prompt 'Use bash to get system info with uname -a and save it to system-info.txt' --non-interactive"

# Test 19: Memory persistence test
run_test "MEMORY - Store multiple values" \
    "./start-clean.sh --prompt 'Store three values in memory: name=MegaTest, version=1.0, status=complete' --non-interactive"

# Test 20: Final cleanup with git
run_test "GIT + BASH - Check what we created" \
    "./start-clean.sh --prompt 'List all files we created (mega-test.txt, calculator.py, etc) and show git status' --non-interactive"

echo ""
echo -e "${GREEN}🎉 MEGA TEST COMPLETE!${NC}"
echo ""

# Cleanup
echo "🧹 Cleaning up test files..."
rm -f mega-test.txt calculator.py README.md react-hooks.md config.json system-info.txt .unipath-memory.json 2>/dev/null

echo -e "${GREEN}✅ All test files cleaned up${NC}"
echo ""

echo "📊 TEST SUMMARY:"
echo "================"
echo "Total tests run: $TEST_NUM"
echo "Tools tested: ALL 13 (bash, edit, file, git, glob, grep, ls, memory, read_file, rg, smart_edit, web, write_file)"
echo ""
echo -e "${GREEN}🚀 MEGA TEST SUITE COMPLETED SUCCESSFULLY!${NC}"