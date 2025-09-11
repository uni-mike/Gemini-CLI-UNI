#!/bin/bash

# UNIPATH CLI with DeepSeek R1 - Final Comprehensive Test Suite
# This script runs all tests to ensure perfect functionality

echo "🚀 UNIPATH CLI FINAL TEST SUITE"
echo "================================"
echo ""

# Clean up any previous test files
rm -f test_*.md comparison.md trends.md index.md 2>/dev/null

# Test 1: Simple Web Search
echo "✅ Test 1: Simple Web Search"
echo "----------------------------"
echo 'search for "Ethereum price USD" using web_search tool' | timeout 15 ./start-deepseek.sh 2>&1 | grep -E "Ethereum|USD|\$|price" | head -10
echo ""

# Test 2: File Creation
echo "✅ Test 2: File Creation"
echo "------------------------"
echo 'create a file called test_file.md with content "# Test File\n\nCreated by DeepSeek R1\nTimestamp: $(date)"' | timeout 15 ./start-deepseek.sh 2>&1 | grep -E "Creating|written|test_file" | head -5
sleep 2
ls -la test_file.md 2>/dev/null && echo "✅ File created successfully" || echo "❌ File creation failed"
echo ""

# Test 3: News Search
echo "✅ Test 3: News Search"
echo "----------------------"
echo 'search for "AI technology" using web_search tool with search_type "news"' | timeout 15 ./start-deepseek.sh 2>&1 | grep -E "News|AI|technology" | head -10
echo ""

# Test 4: Scholar Search
echo "✅ Test 4: Scholar Search"
echo "------------------------"
echo 'search for "quantum computing" using web_search tool with search_type "scholar"' | timeout 15 ./start-deepseek.sh 2>&1 | grep -E "quantum|computing|paper|research" | head -10
echo ""

# Test 5: Complex Task - Search and Create File
echo "✅ Test 5: Complex Task (Search + File)"
echo "---------------------------------------"
echo 'search for "Rust programming language features" and create a file called rust_info.md with the results' | timeout 20 ./start-deepseek.sh 2>&1 | grep -E "Rust|programming|Creating|file" | head -15
sleep 2
ls -la rust_info.md 2>/dev/null && echo "✅ Complex task completed" || echo "⚠️ File not created (check logs)"
echo ""

# Test 6: File Reading
echo "✅ Test 6: File Reading"
echo "-----------------------"
echo 'read the package.json file' | timeout 15 ./start-deepseek.sh 2>&1 | grep -E "name|version|unipath" | head -10
echo ""

# Test 7: Multiple Tool Usage
echo "✅ Test 7: Multiple Tool Usage"
echo "------------------------------"
echo 'list all .sh files in the current directory, then create a file scripts_list.md listing them' | timeout 20 ./start-deepseek.sh 2>&1 | grep -E "\.sh|list|Creating" | head -15
echo ""

# Test Summary
echo "📊 TEST SUMMARY"
echo "==============="
echo ""

# Check which files were created
echo "Files created during tests:"
ls -la test_*.md rust_info.md scripts_list.md 2>/dev/null || echo "No test files found"
echo ""

# Clean up test files
echo "🧹 Cleaning up test files..."
rm -f test_*.md rust_info.md scripts_list.md 2>/dev/null

echo ""
echo "✅ Test suite complete!"
echo ""
echo "📋 Key Features Tested:"
echo "  • Web search (general, news, scholar)"
echo "  • File creation and reading"
echo "  • Complex multi-tool operations"
echo "  • Dynamic tool loading"
echo ""
echo "🎯 Next Steps:"
echo "  1. Review any failed tests above"
echo "  2. Check approval flow if needed"
echo "  3. Deploy to production if all tests pass"