#!/bin/bash

# Start UNIPATH CLI with DeepSeek R1 via Azure AI
# DeepSeek R1 is a highly capable open model with strong reasoning capabilities

echo "🚀 Starting UNIPATH CLI with DeepSeek R1..."
echo "🧠 Using DeepSeek R1 for advanced reasoning and analysis"

# Load DeepSeek configuration from .env.deepseek
if [ -f .env.deepseek ]; then
    # Read and parse the DeepSeek config
    export AZURE_API_KEY=$(grep "^API_KEY=" .env.deepseek | cut -d'=' -f2)
    export AZURE_ENDPOINT_URL=$(grep "^ENDPOINT=" .env.deepseek | cut -d'=' -f2)
    export AZURE_OPENAI_API_VERSION=$(grep "^API_VERSION=" .env.deepseek | cut -d'=' -f2)
    export AZURE_MODEL=$(grep "^MODEL=" .env.deepseek | cut -d'=' -f2)
    export AZURE_DEPLOYMENT=$AZURE_MODEL
    export APPROVAL_MODE=$(grep "^APPROVAL_MODE=" .env.deepseek | cut -d'=' -f2)
    echo "✅ Loaded configuration from .env.deepseek"
else
    echo "⚠️  .env.deepseek not found, using inline configuration"
    # Fallback to inline configuration
    export AZURE_API_KEY=9c5d0679299045e9bd3513baf6ae0e86
    export AZURE_ENDPOINT_URL=https://unipathai7556217047.services.ai.azure.com/models
    export AZURE_OPENAI_API_VERSION=2024-05-01-preview
    export AZURE_DEPLOYMENT=DeepSeek-R1-0528
    export AZURE_MODEL=DeepSeek-R1-0528
fi

# Force Azure OpenAI auth type
export UNIPATH_DEFAULT_AUTH_TYPE=azure-openai

# Disable problematic UNIPATH features that don't work with OpenAI-compatible endpoints
export UNIPATH_CLI_DISABLE_NEXT_SPEAKER_CHECK=true
export UNIPATH_CLI_DISABLE_JSON_PARSING=true

# Display current configuration
echo "📋 Configuration:"
echo "   • Endpoint: ${AZURE_ENDPOINT_URL}"
echo "   • Model: ${AZURE_MODEL}"
echo "   • API Version: ${AZURE_OPENAI_API_VERSION}"
echo ""
echo "💡 Note: DeepSeek R1 is known for strong reasoning and code capabilities"
echo ""

# Check for --non-interactive flag and set environment variable
for arg in "$@"; do
    if [ "$arg" = "--non-interactive" ]; then
        export UNIPATH_NON_INTERACTIVE=true
        break
    fi
done

# Start the UNIPATH CLI with all arguments passed through
echo "✨ Launching UNIPATH CLI with DeepSeek R1 backend..."
npm run start "$@"