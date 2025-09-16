#!/bin/bash

echo "🧪 COMPREHENSIVE SERPAPI WEB SEARCH TESTS"
echo "=========================================="
echo ""

# Test 1: Bitcoin price (should return answer box)
echo "📝 Test 1: Bitcoin Price (with answer box)"
echo "------------------------------------------"
echo 'search for "Bitcoin price today" using web_search tool' | ./start-deepseek.sh 2>&1 &
TEST1_PID=$!
sleep 15
kill $TEST1_PID 2>/dev/null
echo ""

# Test 2: Latest news
echo "📝 Test 2: Latest News"
echo "----------------------"
echo 'search for "latest technology news" using web_search tool with search_type "news"' | ./start-deepseek.sh 2>&1 &
TEST2_PID=$!
sleep 15
kill $TEST2_PID 2>/dev/null
echo ""

# Test 3: Stock market
echo "📝 Test 3: Stock Market Info"
echo "----------------------------"
echo 'search for "Apple stock price AAPL" using web_search tool' | ./start-deepseek.sh 2>&1 &
TEST3_PID=$!
sleep 15
kill $TEST3_PID 2>/dev/null
echo ""

# Test 4: Complex task - search and create file
echo "📝 Test 4: Complex Task (Search + File Creation)"
echo "------------------------------------------------"
echo 'search for "top 5 programming languages 2025" and create a file called programming_trends.md with the results' | ./start-deepseek.sh 2>&1 &
TEST4_PID=$!
sleep 20
kill $TEST4_PID 2>/dev/null
echo ""

# Test 5: Academic search
echo "📝 Test 5: Academic Search"
echo "--------------------------"
echo 'search for "machine learning" using web_search tool with search_type "scholar"' | ./start-deepseek.sh 2>&1 &
TEST5_PID=$!
sleep 15
kill $TEST5_PID 2>/dev/null
echo ""

echo "✅ All tests completed!"
echo ""
echo "📊 Test Summary:"
echo "- Test 1: Bitcoin price with answer box"
echo "- Test 2: News search"
echo "- Test 3: Stock market info"
echo "- Test 4: Complex task (search + file creation)"
echo "- Test 5: Academic/scholar search"