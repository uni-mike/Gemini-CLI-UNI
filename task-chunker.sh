#!/bin/bash

# UNIPATH Task Chunker for DeepSeek
# Breaks down complex prompts into manageable chunks

echo "🧠 UNIPATH Task Chunker for DeepSeek"
echo "======================================"
echo ""

if [ $# -eq 0 ]; then
    echo "Usage: $0 <complex-task-file.txt>"
    echo ""
    echo "This script helps DeepSeek handle complex tasks by:"
    echo "1. Breaking them into smaller, focused chunks"
    echo "2. Creating clear TODO lists"
    echo "3. Executing step-by-step with DeepSeek"
    echo ""
    echo "Example: $0 mega-test-input.txt"
    exit 1
fi

TASK_FILE=$1
CHUNKED_FILE="chunked-$(basename $TASK_FILE)"

if [ ! -f "$TASK_FILE" ]; then
    echo "❌ Error: File '$TASK_FILE' not found"
    exit 1
fi

echo "📋 Processing complex task: $TASK_FILE"
echo "🔄 Creating chunked version: $CHUNKED_FILE"

# Create the chunked version
cat > "$CHUNKED_FILE" << EOF
I have a complex multi-step task that needs to be broken down into smaller, manageable chunks. Please help me create a clear TODO list with 5-7 focused steps.

ORIGINAL COMPLEX TASK:
$(cat "$TASK_FILE")

Please:
1. Break this down into 5-7 smaller, focused tasks
2. Identify specific tools needed for each step  
3. Create a clear execution order
4. Make each step simple enough that it won't overwhelm the system

Format as a numbered TODO list with tool requirements for each step.
EOF

echo "✅ Created chunked version: $CHUNKED_FILE"
echo ""
echo "🚀 Now running with DeepSeek..."
echo ""

./start-deepseek.sh --approval-mode auto < "$CHUNKED_FILE"