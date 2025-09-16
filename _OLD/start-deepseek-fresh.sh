#!/bin/bash

# DeepSeek Fresh Start Script
# Forces a clean build and ensures no old processes

echo "🧹 Cleaning up old processes..."
pkill -f "start-deepseek" 2>/dev/null || true
pkill -f "unipath-cli" 2>/dev/null || true
pkill -f "node.*start.js" 2>/dev/null || true

echo "🚀 Starting fresh DeepSeek instance (no build, direct source)..."
echo "🧠 Using DeepSeek R1 for advanced reasoning and analysis"

# Load DeepSeek configuration from .env.deepseek (same as start-deepseek.sh)
if [ -f .env.deepseek ]; then
    echo "📋 Loading configuration from .env.deepseek"
    # Read and parse the DeepSeek config
    export AZURE_API_KEY=$(grep "^API_KEY=" .env.deepseek | cut -d'=' -f2)
    export AZURE_ENDPOINT_URL=$(grep "^ENDPOINT=" .env.deepseek | cut -d'=' -f2)
    export AZURE_OPENAI_API_VERSION=$(grep "^API_VERSION=" .env.deepseek | cut -d'=' -f2)
    export AZURE_MODEL=$(grep "^MODEL=" .env.deepseek | cut -d'=' -f2)
    export AZURE_DEPLOYMENT=$AZURE_MODEL
    
    # Display actual configuration
    echo "✅ Loaded configuration from .env.deepseek"
    echo "📋 Configuration:"
    echo "   • Endpoint: ${AZURE_ENDPOINT_URL}"
    echo "   • Model: ${AZURE_MODEL}"
    echo "   • API Version: ${AZURE_OPENAI_API_VERSION}"
    echo ""
    echo "💡 Note: DeepSeek R1 is known for strong reasoning and code capabilities"
    echo "✨ Launching UNIPATH CLI with DeepSeek R1 backend..."
    echo ""
    
    # Force Azure OpenAI auth type
    export UNIPATH_DEFAULT_AUTH_TYPE=azure-openai
    export UNIPATH_CLI_DISABLE_NEXT_SPEAKER_CHECK=true
    
    # Ensure APPROVAL_MODE is exported for React Ink UI mode
    # If not already set, default to yolo for React Ink UI
    if [ -z "$APPROVAL_MODE" ]; then
        export APPROVAL_MODE=yolo
        echo "🎯 Setting APPROVAL_MODE=yolo for React Ink UI"
    else
        echo "🎯 Using APPROVAL_MODE=$APPROVAL_MODE"
    fi
else
    echo "❌ .env.deepseek file not found!"
    exit 1
fi

# Ensure we have the latest React Ink UI code built
echo "🔧 Building latest code to ensure React Ink UI is active..."
npm run build > /dev/null 2>&1

# Start the CLI with React Ink orchestration UI
echo "🚀 Starting UNIPATH CLI with React Ink orchestration UI..."
# Note: APPROVAL_MODE=yolo forces interactive mode to enable React Ink UI
# Remove --prompt and --non-interactive flags to enable React Ink UI mode
FILTERED_ARGS=()
PROMPT_TEXT=""
SKIP_NEXT=false

for arg in "$@"; do
    if [ "$SKIP_NEXT" = true ]; then
        PROMPT_TEXT="$arg"
        SKIP_NEXT=false
    elif [ "$arg" = "--prompt" ] || [ "$arg" = "-p" ]; then
        SKIP_NEXT=true
    elif [ "$arg" = "--non-interactive" ]; then
        # Skip this flag to enable interactive mode
        continue
    elif [[ "$arg" == --prompt=* ]]; then
        PROMPT_TEXT="${arg#--prompt=}"
    else
        FILTERED_ARGS+=("$arg")
    fi
done

# Start the CLI in interactive mode, with prompt piped as input if provided
if [ -n "$PROMPT_TEXT" ]; then
    echo "$PROMPT_TEXT" | npm start "${FILTERED_ARGS[@]}"
else
    npm start "${FILTERED_ARGS[@]}"
fi