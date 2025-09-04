#!/bin/bash

# DeepSeek Fresh Start Script
# Forces a clean build and ensures no old processes

echo "🧹 Cleaning up old processes..."
pkill -f "start-deepseek" 2>/dev/null || true
pkill -f "gemini-cli" 2>/dev/null || true
pkill -f "node.*start.js" 2>/dev/null || true

echo "🔨 Force rebuilding..."
npm run build

echo "🚀 Starting fresh DeepSeek instance..."
echo "🧠 Using DeepSeek R1 for advanced reasoning and analysis"
echo "✅ Loaded configuration from .env.deepseek"
echo "📋 Configuration:"
echo "   • Endpoint: https://DeepSeek-R1-rkcob.eastus.models.ai.azure.com"
echo "   • Model: DeepSeek-R1-rkcob"
echo "   • API Version: 2024-05-01-preview"
echo ""
echo "💡 Note: DeepSeek R1 is known for strong reasoning and code capabilities"
echo "✨ Launching Gemini CLI with DeepSeek R1 backend..."
echo ""

# Load DeepSeek configuration from .env.deepseek (same as start-deepseek.sh)
if [ -f .env.deepseek ]; then
    echo "📋 Loading configuration from .env.deepseek"
    # Read and parse the DeepSeek config
    export AZURE_API_KEY=$(grep "^API_KEY=" .env.deepseek | cut -d'=' -f2)
    export AZURE_ENDPOINT_URL=$(grep "^ENDPOINT=" .env.deepseek | cut -d'=' -f2)
    export AZURE_OPENAI_API_VERSION=$(grep "^API_VERSION=" .env.deepseek | cut -d'=' -f2)
    export AZURE_MODEL=$(grep "^MODEL=" .env.deepseek | cut -d'=' -f2)
    export AZURE_DEPLOYMENT=$AZURE_MODEL
    
    # Force Azure OpenAI auth type
    export GEMINI_DEFAULT_AUTH_TYPE=azure-openai
    export GEMINI_CLI_DISABLE_NEXT_SPEAKER_CHECK=true
else
    echo "❌ .env.deepseek file not found!"
    exit 1
fi

# Start the CLI
npm run start