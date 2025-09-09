# gemini-cli

A command-line interface (CLI) tool for interacting with Google Gemini.

## Features
- Generate text completions
- Stream responses in real-time
- Configure API keys and models
- Support for text and image inputs
- Save conversation history

## Installation
bash
npm install -g gemini-cli

## Configuration
1. Obtain Google Gemini API key
2. Run setup:
bash
gemini config set --api-key=YOUR_API_KEY

## Usage
### Basic Prompt
bash
gemini generate "Explain quantum computing"

### Streaming Mode
bash
gemini stream "Write a poem about AI" --temperature=0.7

### Image Input
bash
gemini vision "describe this image" --image=./photo.png

##