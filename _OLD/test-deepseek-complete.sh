#!/bin/bash

# Comprehensive test for DeepSeek with all functionality
echo "🧪 COMPREHENSIVE DEEPSEEK TEST SUITE"
echo "====================================="
echo ""

# Test 1: Web Search
echo "📝 Test 1: Web Search Tool"
echo "--------------------------"
echo 'search for "Bitcoin price today" using web_search tool' | ./start-deepseek.sh 2>&1 | head -50
echo ""
sleep 2

# Test 2: File Creation with Approval
echo "📝 Test 2: File Creation"
echo "-----------------------"
echo 'create a file called test_output.md with content "# Test File\nThis is a test"' | ./start-deepseek.sh 2>&1 | head -50
echo ""
sleep 2

# Test 3: List Files
echo "📝 Test 3: List Files"
echo "--------------------"
echo 'list all markdown files in the current directory' | ./start-deepseek.sh 2>&1 | head -50
echo ""
sleep 2

# Test 4: Read File
echo "📝 Test 4: Read File"
echo "-------------------"
echo 'read the README.md file' | ./start-deepseek.sh 2>&1 | head -50
echo ""
sleep 2

# Test 5: Complex Task
echo "📝 Test 5: Complex Task (Web Search + File Creation)"
echo "---------------------------------------------------"
echo 'search for "latest AI news" and create a file called ai_news.md with the results' | ./start-deepseek.sh 2>&1 | head -100
echo ""

echo "✅ Test suite complete!"