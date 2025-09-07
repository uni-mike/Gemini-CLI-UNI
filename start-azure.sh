#!/bin/bash

# Load environment variables from .env file
set -a
[ -f .env ] && source .env
set +a

# Force Azure OpenAI auth type
export UNIPATH_DEFAULT_AUTH_TYPE=azure-openai

# Start the CLI
npm run start "$@"