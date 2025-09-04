# Gemini CLI UNI - Azure OpenAI & DeepSeek Integration

A powerful CLI tool that extends Google's Gemini CLI with support for Azure OpenAI models (GPT-5, GPT-4o, GPT-4o-mini) and DeepSeek R1, with full tool support.

## =� Quick Start

### Available Models

| Model | Script | Speed | Best For |
|-------|--------|-------|----------|
| **GPT-4o-mini** | `./start-mini.sh` | � Fast (2-3s) | Quick queries, simple tasks |
| **GPT-4o** | `./start-4o.sh` | � Fast (3-5s) | General use, complex tasks |
| **DeepSeek R1** | `./start-deepseek.sh` | � Fast (3-5s) | Reasoning, analysis, code |
| **GPT-5** | `./start-azure.sh` | = Slow (10-20s) | When you need the best |
| **Gemini** | `npm run start` | � Fast (1-3s) | Native tool support |

## =� Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Set up your environment files
cp .env.example .env.mini     # For GPT-4o-mini
cp .env.example .env.4o        # For GPT-4o  
cp .env.example .env.deepseek  # For DeepSeek R1
cp .env.example .env           # For GPT-5/Azure
```

## =' Configuration

Edit the `.env` files with your API keys and endpoints:

```bash
# .env (for GPT-5)
AZURE_API_KEY=your-api-key-here
AZURE_ENDPOINT_URL=https://your-endpoint.openai.azure.com/
AZURE_DEPLOYMENT=gpt-5
AZURE_MODEL=gpt-5

# .env.deepseek (for DeepSeek R1)
AZURE_API_KEY=your-deepseek-api-key
AZURE_ENDPOINT_URL=https://your-endpoint.models.ai.azure.com
AZURE_DEPLOYMENT=DeepSeek-R1
```

## =� Usage Examples

### Simple Query
```bash
echo "What is the capital of France?" | ./start-mini.sh
```

### Code Review
```bash
echo "Review this code: $(cat app.js)" | ./start-4o.sh
```

### Complex Reasoning
```bash
./start-deepseek.sh
> Explain quantum computing implications for cryptography
```

### File Operations (Native Gemini)
```bash
npm run start
> /read package.json
> /shell npm test
> /write report.md
```

## =� Features

- **Multiple AI Models**: Seamlessly switch between GPT-5, GPT-4o, GPT-4o-mini, DeepSeek R1, and Gemini
- **Tool Support**: Full file operations, shell commands, and more via intelligent prompting
- **Rate Limiting**: Automatic retry with exponential backoff
- **Complex Task Handling**: Support for multi-step sequences and iterations
- **Easy Model Switching**: Simple startup scripts for each model

## 📚 Documentation

- [Model Quickstart Guide](docs/MODELS-QUICKSTART.md)
- [Azure Models Configuration](docs/AZURE-MODELS-GUIDE.md)
- [Azure Integration Details](docs/README-AZURE.md)
- [Azure Integration Success Story](docs/AZURE-INTEGRATION-SUCCESS.md)

## > Contributing

This is a customized fork focusing on Azure OpenAI and DeepSeek integration. For the original Gemini CLI, see [Google's repository](https://github.com/google/generative-ai-js).

## =� License

Apache 2.0 - See [LICENSE](LICENSE) file for details.