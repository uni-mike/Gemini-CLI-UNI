#!/bin/bash

echo "🔬 Testing DeepSeek with Crypto Price Research Task"
echo "===================================================="
echo ""

# Create test input file
cat > test-crypto-input.txt << 'EOF'
Research Bitcoin price for the last 7 days and create an MD file with all this information. Then research Litecoin for the same period and update the MD file with the new data added.
EOF

echo "📝 Test Request:"
echo "----------------"
cat test-crypto-input.txt
echo ""
echo "🚀 Starting DeepSeek with the task..."
echo ""

# Run with timeout and capture output
timeout 60 bash -c './start-deepseek.sh < test-crypto-input.txt' 2>&1 | tee crypto-test-output.log &
PID=$!

# Monitor for 60 seconds
SECONDS=0
while [ $SECONDS -lt 60 ]; do
    if ! ps -p $PID > /dev/null 2>&1; then
        echo "✅ Process completed"
        break
    fi
    echo -n "."
    sleep 2
done

if ps -p $PID > /dev/null 2>&1; then
    echo ""
    echo "⚠️ Process still running after 60 seconds - likely stuck"
    echo "Killing process..."
    kill -9 $PID 2>/dev/null
    
    echo ""
    echo "📋 Last 50 lines of output:"
    echo "----------------------------"
    tail -50 crypto-test-output.log
fi

echo ""
echo "🔍 Checking for created files:"
ls -la *.md 2>/dev/null | grep -v README || echo "No MD files created"

echo ""
echo "📊 Test Complete"