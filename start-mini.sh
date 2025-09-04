#!/bin/bash

# Start Gemini CLI with Azure OpenAI GPT-4o-mini
# This provides a fast, cost-effective alternative using GPT-4o-mini

echo "🚀 Starting Gemini CLI with Azure OpenAI GPT-4o-mini..."
echo "💰 Using cost-effective GPT-4o-mini model for faster responses"

# Load GPT-4o-mini configuration from .env.mini
if [ -f .env.mini ]; then
    set -a
    source .env.mini
    set +a
    echo "✅ Loaded configuration from .env.mini"
else
    echo "⚠️  .env.mini not found, using inline configuration"
    # Fallback to inline configuration
    export AZURE_API_KEY=9c5d0679299045e9bd3513baf6ae0e86
    export AZURE_ENDPOINT_URL=https://unipathai7556217047.cognitiveservices.azure.com/
    export AZURE_DEPLOYMENT=gpt-4o-mini
    export AZURE_MODEL=gpt-4o-mini
    export AZURE_OPENAI_API_VERSION=2024-12-01-preview
fi

# Force Azure OpenAI auth type
export GEMINI_DEFAULT_AUTH_TYPE=azure-openai

# Disable problematic Gemini features that don't work with OpenAI
export GEMINI_CLI_DISABLE_NEXT_SPEAKER_CHECK=true
export GEMINI_CLI_DISABLE_JSON_PARSING=true

# Display current configuration
echo "📋 Configuration:"
echo "   • Endpoint: ${AZURE_ENDPOINT_URL}"
echo "   • Model: ${AZURE_MODEL}"
echo "   • Deployment: ${AZURE_DEPLOYMENT}"
echo ""

# Start the Gemini CLI with all arguments passed through
echo "✨ Launching Gemini CLI with GPT-4o-mini backend..."
npm run start "$@"