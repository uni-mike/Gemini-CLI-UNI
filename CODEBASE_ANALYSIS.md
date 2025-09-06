# Gemini CLI UNI - Codebase Analysis

## Project Overview
This is a sophisticated CLI tool that extends Google's Gemini CLI to support multiple AI models through a unified interface. It's a fork/extension that adds Azure OpenAI and DeepSeek integration while maintaining all original Gemini CLI features.

## Architecture

### Core Structure
```
gemini-cli/
├── packages/           # Monorepo structure
│   ├── cli/           # User interface and commands
│   └── core/          # Core logic and AI integrations
├── scripts/           # Build and utility scripts
├── docs/             # Documentation
└── start-*.sh        # Model-specific launchers
```

### Key Components

#### 1. **Multi-Model Support**
The project integrates multiple AI providers through a unified interface:

- **Google Gemini** - Native support (original)
- **Azure OpenAI** - GPT-5, GPT-4o, GPT-4o-mini
- **DeepSeek R1** - Via Azure AI services
- **Custom Models** - Extensible architecture

#### 2. **Model Switching Mechanism**
Each model has its own startup script that sets environment variables:
- `start-mini.sh` - GPT-4o-mini (fast, cost-effective)
- `start-4o.sh` - GPT-4o (balanced)
- `start-deepseek.sh` - DeepSeek R1 (reasoning)
- `start-azure.sh` - GPT-5 (most capable)

The `GEMINI_DEFAULT_AUTH_TYPE=azure-openai` environment variable triggers the Azure integration.

#### 3. **Core Integration Files**

**packages/core/src/core/**
- `contentGenerator.ts` - Routes between Gemini and Azure backends
- `azureOpenAIClient.ts` - Basic Azure OpenAI integration
- `azureOpenAIWithTools.ts` - Tool-enabled Azure integration
- `deepSeekWithTools.ts` - DeepSeek-specific implementation

**Key Logic:**
```typescript
// Intelligent endpoint detection
const isAzureAIModels = endpoint.includes('models.ai.azure.com') || 
                        endpoint.includes('services.ai.azure.com');

// Different URL formats
const baseURL = isAzureAIModels 
  ? endpoint.endsWith('/models') ? endpoint : `${endpoint}/models`
  : `${endpoint}/openai/deployments/${deployment}`;
```

#### 4. **Tool System**
The CLI maintains 20+ developer tools through intelligent bridging:
- File operations (read, write, edit)
- Shell commands
- Web search and fetch
- Git operations
- MCP (Model Context Protocol) servers
- Extensions system

Tools are bridged from Gemini format to OpenAI function calling format in `azureOpenAIWithTools.ts`.

#### 5. **Special Features**

**DeepSeek Thinking Tags:**
- DeepSeek R1 returns reasoning in `<think>` tags
- Buffering system filters these for clean output
- Preserves full response while hiding reasoning

**Rate Limiting:**
- Exponential backoff for API limits
- Automatic retry logic
- Configurable timeouts

**Authentication:**
- Multiple auth types (OAuth, API Key, Azure)
- Environment-based configuration
- Secure credential handling

## How It Works

### 1. **Startup Flow**
```
User runs ./start-deepseek.sh
→ Sets environment variables (API key, endpoint, model)
→ Sets GEMINI_DEFAULT_AUTH_TYPE=azure-openai
→ Runs npm start
→ Gemini CLI detects Azure auth type
→ Initializes AzureOpenAIClient instead of Gemini
→ Full CLI interface with Azure backend
```

### 2. **Request Processing**
```
User input
→ CommandService processes
→ ContentGenerator routes to correct backend
→ Azure/DeepSeek API call
→ Response filtering (remove think tags)
→ Stream to UI with status bar
```

### 3. **Tool Execution**
```
AI requests tool use
→ Convert from OpenAI format to Gemini tool
→ Execute via ToolRegistry
→ Return results to AI
→ Continue conversation
```

## Configuration

### Environment Variables
- `AZURE_API_KEY` - API key for Azure services
- `AZURE_ENDPOINT_URL` - Azure endpoint URL
- `AZURE_DEPLOYMENT` - Deployment name
- `AZURE_MODEL` - Model identifier
- `AZURE_OPENAI_API_VERSION` - API version
- `GEMINI_DEFAULT_AUTH_TYPE` - Auth type selector
- `GEMINI_CLI_DISABLE_NEXT_SPEAKER_CHECK` - Bypass Gemini-specific checks

### Configuration Files
- `.env.mini` - GPT-4o-mini config
- `.env.4o` - GPT-4o config
- `.env.deepseek` - DeepSeek config
- `.env` - Default/GPT-5 config

## Recent Fixes

### DeepSeek Integration (Latest)
1. **Endpoint Issue:** Updated from dead `models.ai.azure.com` to working `services.ai.azure.com`
2. **URL Construction:** Fixed path building for Azure AI services (`/models` path)
3. **Thinking Tags:** Added filtering to remove `<think>` tags from output
4. **Buffering:** Implemented multi-chunk buffering for streaming responses

## Technical Achievements

1. **Seamless Integration:** Azure models work through original Gemini interface
2. **Feature Preservation:** All 20+ tools work with all models
3. **Smart Routing:** Automatic detection of endpoint types
4. **Clean Output:** Intelligent filtering of model-specific artifacts
5. **Production Ready:** Error handling, retries, and logging

## Usage Patterns

### Quick Query
```bash
echo "Question" | ./start-mini.sh
```

### Interactive Session
```bash
./start-deepseek.sh
> Your question here
```

### File Operations
```bash
npm start
> /read package.json
> /shell npm test
> /write output.md
```

## Key Insights

1. **Monorepo Architecture:** Clean separation between CLI and core
2. **Extensible Design:** Easy to add new models/providers
3. **Environment-Driven:** Configuration through env vars allows easy switching
4. **Stream Processing:** Efficient handling of large responses
5. **Tool Abstraction:** Unified tool interface across all models

## Future Improvements

1. **Unified Config:** Single config file for all models
2. **Dynamic Model Detection:** Auto-detect available models
3. **Better Error Messages:** More informative Azure-specific errors
4. **Tool Optimization:** Model-specific tool configurations
5. **Performance Metrics:** Track and compare model performance

## Summary

This is a **production-quality CLI tool** that successfully bridges multiple AI providers through a single, powerful interface. The architecture is clean, extensible, and maintains all the sophisticated features of the original Gemini CLI while adding support for Azure OpenAI and DeepSeek models. The recent fixes have made DeepSeek R1 fully functional with proper response formatting.