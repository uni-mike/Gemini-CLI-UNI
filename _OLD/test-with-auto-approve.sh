#!/bin/bash

# Test mega prompt with automatic approval responses
# This script simulates user input for the approval prompts

echo "🧪 Testing mega prompt with interactive approval..."
echo "📝 Will auto-approve with option 2 (AUTO_EDIT mode)"
echo ""

# Create a response file that will feed "2" to the first prompt
# This will enable AUTO_EDIT mode for the rest of the session
echo "2" > approval_responses.txt

# Run the mega test with the responses piped in
./start-deepseek.sh < mega-test-input.txt < approval_responses.txt

echo ""
echo "✅ Test complete"