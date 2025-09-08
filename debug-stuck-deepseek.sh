#!/bin/bash

echo "🔍 DeepSeek Diagnostic Tool"
echo "=========================="

# Check if DeepSeek is running
DEEPSEEK_PID=$(ps aux | grep -E "start\.js|deepseek" | grep -v grep | head -1 | awk '{print $2}')

if [ -n "$DEEPSEEK_PID" ]; then
    echo "✅ DeepSeek process found (PID: $DEEPSEEK_PID)"
    
    echo ""
    echo "🧠 Memory usage:"
    ps -p $DEEPSEEK_PID -o pid,ppid,pcpu,pmem,vsz,rss,comm
    
    echo ""
    echo "🔄 CPU usage (5 second sample):"
    top -pid $DEEPSEEK_PID -l 2 -n 0 | tail -1
    
    echo ""
    echo "📊 Process status:"
    ps -p $DEEPSEEK_PID -o state,pid,comm
    
    echo ""
    echo "🕒 How long has it been running?"
    ps -p $DEEPSEEK_PID -o etime,pid,comm
    
else
    echo "❌ No DeepSeek process found"
fi

echo ""
echo "🔧 Suggested actions:"
echo "1. If CPU is high: DeepSeek is working but slow"
echo "2. If CPU is low: DeepSeek might be stuck waiting"
echo "3. If memory is very high: Possible memory leak"
echo "4. Kill with: pkill -f start.js"