#!/bin/bash

# Start UNIPATH CLI with Azure OpenAI GPT-4o
# This provides a fast, high-quality alternative to GPT-5

echo "🚀 Starting UNIPATH CLI with Azure OpenAI GPT-4o..."
echo "⚡ Using GPT-4o for fast, high-quality responses"

# Load GPT-4o configuration from .env.4o
if [ -f .env.4o ]; then
    set -a
    source .env.4o
    set +a
    echo "✅ Loaded configuration from .env.4o"
else
    echo "⚠️  .env.4o not found, using inline configuration"
    # Fallback to inline configuration
    export AZURE_API_KEY=9c5d0679299045e9bd3513baf6ae0e86
    export AZURE_ENDPOINT_URL=https://unipathai7556217047.cognitiveservices.azure.com/
    export AZURE_DEPLOYMENT=gpt-4o
    export AZURE_MODEL=gpt-4o
    export AZURE_OPENAI_API_VERSION=2024-12-01-preview
fi

# Force Azure OpenAI auth type
export UNIPATH_DEFAULT_AUTH_TYPE=azure-openai

# Disable problematic UNIPATH features that don't work with OpenAI
export UNIPATH_CLI_DISABLE_NEXT_SPEAKER_CHECK=true
export UNIPATH_CLI_DISABLE_JSON_PARSING=true

# Display current configuration
echo "📋 Configuration:"
echo "   • Endpoint: ${AZURE_ENDPOINT_URL}"
echo "   • Model: ${AZURE_MODEL}"
echo "   • Deployment: ${AZURE_DEPLOYMENT}"
echo ""

# Start the UNIPATH CLI with all arguments passed through
echo "✨ Launching UNIPATH CLI with GPT-4o backend..."
npm run start "$@"