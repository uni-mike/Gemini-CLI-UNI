#!/bin/bash

echo "=========================================="
echo "   UNIPATH CLI COMPREHENSIVE TEST SUITE"
echo "=========================================="
echo

# Clean up any test files from previous runs
rm -f test*.txt hello.txt data.json btc-report.txt eth-analysis.md crypto-report.md weather-report.txt base.txt file1.txt 2>/dev/null

# Test 1: Simple Arithmetic
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 TEST 1: Simple Arithmetic"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing: What is 15 + 27?"
APPROVAL_MODE=yolo ./start-deepseek.sh --prompt "What is 15 + 27?" --non-interactive 2>&1 | tail -5
echo

echo "Testing: Calculate 128 * 4"
APPROVAL_MODE=yolo ./start-deepseek.sh --prompt "Calculate 128 * 4" --non-interactive 2>&1 | tail -5
echo

# Test 2: Web Searches with Bottom Line
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 TEST 2: Web Searches (Bottom Line Check)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing: Bitcoin price"
APPROVAL_MODE=yolo ./start-deepseek.sh --prompt "Bitcoin price" --non-interactive 2>&1 | grep -A 3 "📊\|Bottom Line\|currently trading" | head -5
echo

echo "Testing: Ethereum price"
APPROVAL_MODE=yolo ./start-deepseek.sh --prompt "Ethereum price" --non-interactive 2>&1 | grep -A 3 "📊\|Bottom Line\|currently trading" | head -5
echo

echo "Testing: Current USD to EUR exchange rate"
APPROVAL_MODE=yolo ./start-deepseek.sh --prompt "Current USD to EUR exchange rate" --non-interactive 2>&1 | grep -A 3 "rate\|EUR\|exchange" -i | head -5
echo

# Test 3: File Operations
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 TEST 3: File Operations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing: create hello.txt with content 'Hello from UNIPATH'"
APPROVAL_MODE=yolo ./start-deepseek.sh --prompt "create hello.txt with content 'Hello from UNIPATH'" --non-interactive 2>&1 | grep -E "Created|WriteFile|hello.txt" | head -3
if [ -f hello.txt ]; then
  echo "✅ File created. Content:"
  cat hello.txt
else
  echo "❌ File not created"
fi
echo

echo "Testing: create test.md with # My Test File"
APPROVAL_MODE=yolo ./start-deepseek.sh --prompt "create test.md with # My Test File" --non-interactive 2>&1 | grep -E "Created|WriteFile|test.md" | head -3
if [ -f test.md ]; then
  echo "✅ File created. Content:"
  cat test.md
else
  echo "❌ File not created"
fi
echo

# Test 4: List files
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 TEST 4: List Files"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing: list files in current directory"
APPROVAL_MODE=yolo ./start-deepseek.sh --prompt "list files in current directory" --non-interactive 2>&1 | grep -E "List Directory|files|hello.txt|test.md" | head -5
echo

# Test 5: Complex Tasks (should detect but currently disabled)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 TEST 5: Complex Tasks (Orchestration Check)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing: search Bitcoin price then create btc-report.txt"
APPROVAL_MODE=yolo ./start-deepseek.sh --prompt "search Bitcoin price then create btc-report.txt" --non-interactive 2>&1 | grep -E "COMPLEX|SIMPLE|orchestration|WebSearch|WriteFile" | head -5
if [ -f btc-report.txt ]; then
  echo "✅ Report created"
else
  echo "❌ Report not created"
fi
echo

# Test 6: Edge Cases
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 TEST 6: Edge Cases"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing: What is Apple stock price?"
APPROVAL_MODE=yolo ./start-deepseek.sh --prompt "What is Apple stock price?" --non-interactive 2>&1 | grep -E "AAPL\|Apple\|stock\|\\$" -i | head -5
echo

echo "Testing: Gold price per ounce"
APPROVAL_MODE=yolo ./start-deepseek.sh --prompt "Gold price per ounce" --non-interactive 2>&1 | grep -E "gold\|ounce\|\\$\|USD" -i | head -5
echo

echo "Testing: create data.json with {\"test\": true}"
APPROVAL_MODE=yolo ./start-deepseek.sh --prompt "create a file called data.json with {\\\"test\\\": true}" --non-interactive 2>&1 | grep -E "Created|data.json|WriteFile" | head -3
if [ -f data.json ]; then
  echo "✅ JSON file created. Content:"
  cat data.json
else
  echo "❌ JSON file not created"
fi
echo

# Test 7: Check for errors
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 TEST 7: Error Detection"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Checking for common errors in last test:"
APPROVAL_MODE=yolo ./start-deepseek.sh --prompt "What is 2 + 2?" --non-interactive 2>&1 | grep -E "Error|error|failed|Failed|absolute_path|undefined" | head -5 || echo "✅ No errors detected"
echo

# Summary
echo "=========================================="
echo "   TEST SUMMARY"
echo "=========================================="
echo "Test files created during testing:"
ls -la *.txt *.md *.json 2>/dev/null | head -10 || echo "No test files found"
echo
echo "Cleaning up test files..."
rm -f test*.txt hello.txt data.json btc-report.txt eth-analysis.md crypto-report.md weather-report.txt base.txt file1.txt 2>/dev/null
echo "✅ Test suite complete!"