#!/bin/bash

# Start Gemini CLI with DeepSeek R1 via Azure AI
# DeepSeek R1 is a highly capable open model with strong reasoning capabilities

echo "🚀 Starting Gemini CLI with DeepSeek R1..."
echo "🧠 Using DeepSeek R1 for advanced reasoning and analysis"

# Load DeepSeek configuration from .env.deepseek
if [ -f .env.deepseek ]; then
    # Read and parse the DeepSeek config
    export AZURE_API_KEY=$(grep "^API_KEY=" .env.deepseek | cut -d'=' -f2)
    export AZURE_ENDPOINT_URL=$(grep "^ENDPOINT=" .env.deepseek | cut -d'=' -f2)
    export AZURE_OPENAI_API_VERSION=$(grep "^API_VERSION=" .env.deepseek | cut -d'=' -f2)
    export AZURE_MODEL=$(grep "^MODEL=" .env.deepseek | cut -d'=' -f2)
    export AZURE_DEPLOYMENT=$AZURE_MODEL
    echo "✅ Loaded configuration from .env.deepseek"
else
    echo "⚠️  .env.deepseek not found, using inline configuration"
    # Fallback to inline configuration
    export AZURE_API_KEY=ENv2QR226JPye4UjaTXaSJN0H0A4B9ms
    export AZURE_ENDPOINT_URL=https://DeepSeek-R1-rkcob.eastus.models.ai.azure.com
    export AZURE_OPENAI_API_VERSION=2024-05-01-preview
    export AZURE_DEPLOYMENT=DeepSeek-R1-rkcob
    export AZURE_MODEL=DeepSeek-R1-rkcob
fi

# Force Azure OpenAI auth type
export GEMINI_DEFAULT_AUTH_TYPE=azure-openai

# Disable problematic Gemini features that don't work with OpenAI-compatible endpoints
export GEMINI_CLI_DISABLE_NEXT_SPEAKER_CHECK=true
export GEMINI_CLI_DISABLE_JSON_PARSING=true

# Display current configuration
echo "📋 Configuration:"
echo "   • Endpoint: ${AZURE_ENDPOINT_URL}"
echo "   • Model: ${AZURE_MODEL}"
echo "   • API Version: ${AZURE_OPENAI_API_VERSION}"
echo ""
echo "💡 Note: DeepSeek R1 is known for strong reasoning and code capabilities"
echo ""

# Start the Gemini CLI with all arguments passed through
echo "✨ Launching Gemini CLI with DeepSeek R1 backend..."
npm run start "$@"