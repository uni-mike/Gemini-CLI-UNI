#!/bin/bash

# DeepSeek Fresh Start Script
# Forces a clean build and ensures no old processes

echo "🧹 Cleaning up old processes..."
pkill -f "start-deepseek" 2>/dev/null || true
pkill -f "unipath-cli" 2>/dev/null || true
pkill -f "node.*start.js" 2>/dev/null || true

echo "🔨 Force rebuilding..."
npm run build

echo "🚀 Starting fresh DeepSeek instance..."
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
else
    echo "❌ .env.deepseek file not found!"
    exit 1
fi

# Start the CLI
npm run start