# Azure OpenAI Models Configuration Guide

## 🚀 Available Configurations

### 1. GPT-5 (Premium Model)
**Script:** `./start-azure.sh` or use manual export

```bash
# Using script
./start-azure.sh

# Or manual configuration
export AZURE_API_KEY=your-azure-api-key-here
export AZURE_ENDPOINT_URL=https://mike-mazsz1c6-eastus2.openai.azure.com/
export AZURE_DEPLOYMENT=gpt-5
export AZURE_MODEL=gpt-5
export AZURE_OPENAI_API_VERSION=2024-12-01-preview
export GEMINI_DEFAULT_AUTH_TYPE=azure-openai
export GEMINI_CLI_DISABLE_NEXT_SPEAKER_CHECK=true

npm run start
```

**Characteristics:**
- Model: `gpt-5-2025-08-07`
- High-quality responses
- Slower response time (~10-20 seconds)
- Higher cost per token

---

### 2. GPT-4o-mini (Cost-Effective)
**Script:** `./start-mini.sh`

```bash
# Using script (auto-loads .env.mini)
./start-mini.sh

# For quick commands
./start-mini.sh "your question here"

# For interactive mode
./start-mini.sh
```

**Configuration (.env.mini):**
```env
AZURE_API_KEY=9c5d0679299045e9bd3513baf6ae0e86
AZURE_ENDPOINT_URL=https://unipathai7556217047.cognitiveservices.azure.com/
AZURE_DEPLOYMENT=gpt-4o-mini
AZURE_MODEL=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-12-01-preview
```

**Characteristics:**
- Model: `gpt-4o-mini`
- Fast responses (~2-5 seconds)
- Cost-effective
- Good for quick queries and development

---

## ⚠️ Current Limitations

### Tool/Function Calling
**Status:** ❌ Not currently working with Azure OpenAI integration

The Gemini CLI tools (file operations, shell commands, web search) require function calling support. Our current Azure integration bypasses the Gemini-specific implementations, which means:

- ✅ **Working:** Basic chat and Q&A
- ✅ **Working:** Code generation and explanations
- ❌ **Not Working:** File read/write tools
- ❌ **Not Working:** Shell command execution
- ❌ **Not Working:** Web search and fetch

### Why Tools Don't Work
1. **Format Mismatch:** Gemini uses a different function calling format than OpenAI
2. **Response Parsing:** Tool responses expect Gemini's JSON structure
3. **Bypass Mode:** We disabled JSON parsing to avoid errors, which also disabled tools

---

## 🛠️ Usage Recommendations

### For Chat/Q&A/Code Generation:
Use either model with the startup scripts:
```bash
./start-mini.sh  # Fast, cheap
./start-azure.sh # Premium quality
```

### For Tool-Heavy Work:
Use the original Gemini CLI without Azure:
```bash
npm run start  # Uses Google Gemini with full tool support
```

### For Mixed Workflows:
Switch between them as needed:
```bash
# Quick code review with GPT-4o-mini
./start-mini.sh "review this function: ..."

# Complex tool operations with Gemini
npm run start
# > /read file.ts
# > /shell npm test
```

---

## 🔧 Fixing Tool Support (Future Work)

To enable tools with Azure OpenAI, we would need to:

1. **Implement OpenAI Function Calling:**
   - Convert Gemini tool definitions to OpenAI function schemas
   - Map tool calls between formats
   - Handle response parsing differences

2. **Create Tool Adapter Layer:**
   ```typescript
   class AzureToolAdapter {
     convertGeminiToolToOpenAI(tool: GeminiTool): OpenAIFunction
     executeToolCall(call: OpenAIFunctionCall): ToolResponse
     formatToolResponse(response: any): GeminiToolResponse
   }
   ```

3. **Update Response Handling:**
   - Parse OpenAI function_call responses
   - Execute tools locally
   - Format results for CLI display

---

## 📊 Model Comparison

| Feature | GPT-5 | GPT-4o-mini | Original Gemini |
|---------|-------|-------------|-----------------|
| Chat/Q&A | ✅ Excellent | ✅ Good | ✅ Excellent |
| Code Generation | ✅ Excellent | ✅ Good | ✅ Excellent |
| Response Speed | ⚠️ 10-20s | ✅ 2-5s | ✅ 1-3s |
| Cost | 💰💰💰 | 💰 | 💰💰 |
| Tool Support | ❌ | ❌ | ✅ Full |
| File Operations | ❌ | ❌ | ✅ |
| Shell Commands | ❌ | ❌ | ✅ |
| Web Search | ❌ | ❌ | ✅ |

---

## 🎯 Quick Decision Guide

**Use GPT-4o-mini (`./start-mini.sh`) when:**
- You need fast responses
- Doing simple Q&A or code reviews
- Cost is a concern
- Don't need file/shell tools

**Use GPT-5 (`./start-azure.sh`) when:**
- You need the best quality responses
- Working on complex problems
- Response time isn't critical
- Don't need file/shell tools

**Use Original Gemini (`npm run start`) when:**
- You need to read/write files
- You need to execute shell commands
- You need web search functionality
- You want the full CLI experience with all tools

---

## 📝 Example Workflows

### Code Review (GPT-4o-mini)
```bash
./start-mini.sh "Review this code for security issues: $(cat app.js)"
```

### Architecture Discussion (GPT-5)
```bash
./start-azure.sh
> Explain the tradeoffs between microservices and monoliths
> How would you design a real-time chat system?
```

### Full Development (Original Gemini)
```bash
npm run start
> /read package.json
> what dependencies are outdated?
> /shell npm outdated
> /write updated-deps.md with the upgrade plan
```