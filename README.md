# UNIPATH CLI - Universal AI Interface

A powerful universal CLI tool with **full tool support** for DeepSeek R1 and Google Gemini, plus Azure OpenAI models (GPT-5, GPT-4o, GPT-4o-mini).

## 🚀 Quick Start - DeepSeek R1 Recommended!

### Available Models

| Model | Script | Speed | Tools | Best For |
|-------|--------|-------|-------|----------|
| **DeepSeek R1** ⭐ | `./start-deepseek.sh` | ⚡ Fast (3-5s) | ✅ **Full Tools** | **Reasoning, coding, file ops** |
| **Gemini** | `npm run start` | 🚀 Fast (1-3s) | ✅ **Full Tools** | Google's native with tools |
| **GPT-4o-mini** | `./start-mini.sh` | ⚡ Fast (2-3s) | ❌ Chat only | Quick queries, simple tasks |
| **GPT-4o** | `./start-4o.sh` | ⚡ Fast (3-5s) | ❌ Chat only | General use, complex tasks |
| **GPT-5** | `./start-azure.sh` | 🐌 Slow (10-20s) | ❌ Chat only | When you need the best |

## 🛠️ DeepSeek R1 - Full Tool Integration

DeepSeek R1 has **complete tool support** including:
- **File Operations**: Read, write, edit files with diff previews
- **Shell Commands**: Execute system commands with approval
- **Search Tools**: Grep, glob, ripgrep for code exploration  
- **Web Tools**: Search and fetch web content
- **Memory**: Save and recall context across sessions

## 🔒 Security & Approval Flow

DeepSeek R1 includes Claude-style approval flow:
- **Shows diffs** before making file changes
- **Previews commands** before shell execution  
- **Respects trust settings** for folders
- **AUTO_EDIT mode** for trusted environments

## 📦 Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Set up your environment files
cp .env.example .env.deepseek  # For DeepSeek R1 (recommended)
cp .env.example .env.mini      # For GPT-4o-mini
cp .env.example .env.4o        # For GPT-4o  
cp .env.example .env           # For GPT-5/Azure
```

## ⚙️ Configuration

Edit the `.env.deepseek` file with your API keys and endpoints:

```bash
# .env.deepseek (for DeepSeek R1 - recommended)
API_KEY=your-deepseek-api-key
ENDPOINT=https://your-endpoint.models.ai.azure.com
API_VERSION=2025-05-01-preview
MODEL=DeepSeek-R1-0528

# .env (for GPT-5)
AZURE_API_KEY=your-api-key-here
AZURE_ENDPOINT_URL=https://your-endpoint.openai.azure.com/
AZURE_DEPLOYMENT=gpt-5
AZURE_MODEL=gpt-5
```

## 🔧 Usage Examples

### DeepSeek R1 with Tools (Recommended)
```bash
# Interactive mode with full tools
./start-deepseek.sh

# Direct commands
echo "Read the file package.json and analyze it" | ./start-deepseek.sh
echo "Search for TODO comments in the codebase" | ./start-deepseek.sh  
echo "Run npm test and analyze the results" | ./start-deepseek.sh
```

### File Operations with DeepSeek R1
```bash
./start-deepseek.sh
> Edit src/app.js and fix the bug on line 25
> Create a new file docs/api.md with API documentation
> Search for all uses of 'deprecated' in the codebase
```

### Other Models (Chat Only)
```bash
# Simple queries
echo "What is the capital of France?" | ./start-mini.sh

# Code review (without tools)
echo "Review this code: $(cat app.js)" | ./start-4o.sh

# Complex reasoning
echo "Explain quantum computing implications" | ./start-azure.sh
```

### Using the UNIPATH Command
```bash
# After global installation
unipath "What files are in the current directory?"
unipath --model deepseek "Analyze this codebase with tools"
```

## ✨ Features

- **🎯 DeepSeek R1 Focus**: Best model with full tool integration
- **🛠️ Complete Tool Support**: File operations, shell commands, web access  
- **🔒 Security First**: Approval flow with diff previews
- **⚡ Multiple Models**: GPT-5, GPT-4o, GPT-4o-mini, DeepSeek R1, Gemini
- **🔄 Rate Limiting**: Automatic retry with exponential backoff
- **📋 Complex Tasks**: Multi-step sequences and tool chaining
- **🚀 Easy Switching**: Simple startup scripts for each model

## 📚 Documentation

- [Model Quickstart Guide](docs/MODELS-QUICKSTART.md)
- [Azure Models Configuration](docs/AZURE-MODELS-GUIDE.md)
- [Azure Integration Details](docs/README-AZURE.md)
- [Tool Integration Complete](UNIPATH_TOOLS_FINAL.md)
- [Approval Flow Fixed](APPROVAL_FLOW_FIXED.md)

## 🤝 Credits & Attribution

Based on Google's Gemini CLI, extended with:
- Multi-model support (Azure OpenAI, DeepSeek R1)
- Complete rebranding to UNIPATH
- Enhanced tool integration for DeepSeek R1
- Security improvements and approval flow

## 📄 License

Apache 2.0 License. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

**🌟 Recommended: Start with `./start-deepseek.sh` for the best experience with full tools!**