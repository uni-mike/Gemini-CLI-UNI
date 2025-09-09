#!/bin/bash

echo "🚀 FLEXICLI MEGA TEST - Testing ALL tools through the actual system"
echo "=================================================================="
echo ""

# Test each tool through FlexiCLI

echo "1️⃣ Testing BASH tool..."
./start-clean.sh --prompt "Use bash to run 'echo Testing bash tool'" --non-interactive

echo ""
echo "2️⃣ Testing FILE tool..."
./start-clean.sh --prompt "Create a file called test1.txt with content 'FlexiCLI rocks!'" --non-interactive

echo ""
echo "3️⃣ Testing READ_FILE tool..."
./start-clean.sh --prompt "Read the file package.json and show first 3 lines" --non-interactive

echo ""
echo "4️⃣ Testing WRITE_FILE tool..."
./start-clean.sh --prompt "Write a file called test2.txt with content 'Writing through FlexiCLI'" --non-interactive

echo ""
echo "5️⃣ Testing GLOB tool..."
./start-clean.sh --prompt "Use glob to find all .json files" --non-interactive

echo ""
echo "6️⃣ Testing LS tool..."
./start-clean.sh --prompt "List all files in the current directory" --non-interactive

echo ""
echo "7️⃣ Testing GREP tool..."
./start-clean.sh --prompt "Search for the word 'test' in all files" --non-interactive

echo ""
echo "8️⃣ Testing MEMORY tool..."
./start-clean.sh --prompt "Store in memory: key=flexitest value=success" --non-interactive

echo ""
echo "9️⃣ Testing GIT tool..."
./start-clean.sh --prompt "Check git status" --non-interactive

echo ""
echo "🔟 Testing EDIT tool..."
./start-clean.sh --prompt "Edit test1.txt to replace 'rocks' with 'is awesome'" --non-interactive

echo ""
echo "1️⃣1️⃣ Testing WEB tool..."
./start-clean.sh --prompt "Search the web for 'TypeScript 2025 features'" --non-interactive

echo ""
echo "1️⃣2️⃣ Testing SMART_EDIT..."
./start-clean.sh --prompt "Use smart edit to append ' - Updated!' to test2.txt" --non-interactive

echo ""
echo "1️⃣3️⃣ Testing RG (RipGrep)..."
./start-clean.sh --prompt "Use ripgrep to search for 'function' in all files" --non-interactive

echo ""
echo "🎯 MULTI-TOOL TEST: Complex operation"
./start-clean.sh --prompt "Create a Python file calc.py with an add function, then use bash to run it with python3" --non-interactive

echo ""
echo "🧹 Cleanup..."
rm -f test1.txt test2.txt calc.py flexi-test.txt .unipath-memory.json 2>/dev/null

echo ""
echo "✅ FLEXICLI MEGA TEST COMPLETE!"
echo "All tools tested through the actual FlexiCLI system!"