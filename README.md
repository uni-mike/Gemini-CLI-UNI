# UNIPATH CLI - Universal AI Interface

A powerful universal CLI tool that provides seamless integration with multiple AI models including Azure OpenAI (GPT-5, GPT-4o, GPT-4o-mini), DeepSeek R1, and Google Gemini, with full tool support.

## =� Quick Start

### Available Models

| Model | Script | Speed | Best For |
|-------|--------|-------|----------|
| **GPT-4o-mini** | `./start-mini.sh` | � Fast (2-3s) | Quick queries, simple tasks |
| **GPT-4o** | `./start-4o.sh` | � Fast (3-5s) | General use, complex tasks |
| **DeepSeek R1** | `./start-deepseek.sh` | � Fast (3-5s) | Reasoning, analysis, code |
| **GPT-5** | `./start-azure.sh` | = Slow (10-20s) | When you need the best |
| **Gemini** | `npm run start` | 🚀 Fast (1-3s) | Google's native model |

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

### File Operations (with UNIPATH)
```bash
npm run start
> /read package.json
> /shell npm test
> /write report.md
```

### Using the UNIPATH Command
```bash
# After global installation
unipath "What files are in the current directory?"
unipath --model gpt-4o "Explain this codebase"
```

## =� Features

- **Universal AI Interface**: Seamlessly switch between GPT-5, GPT-4o, GPT-4o-mini, DeepSeek R1, and Google Gemini
- **Tool Support**: Full file operations, shell commands, and more via intelligent prompting
- **Rate Limiting**: Automatic retry with exponential backoff
- **Complex Task Handling**: Support for multi-step sequences and iterations
- **Easy Model Switching**: Simple startup scripts for each model

## 📚 Documentation

- [Model Quickstart Guide](docs/MODELS-QUICKSTART.md)
- [Azure Models Configuration](docs/AZURE-MODELS-GUIDE.md)
- [Azure Integration Details](docs/README-AZURE.md)
- [Azure Integration Success Story](docs/AZURE-INTEGRATION-SUCCESS.md)

## 🤝 Credits & Attribution

**UNIPATH CLI** is based on and extends [Google's Gemini CLI](https://github.com/google/generative-ai-js), which is licensed under the Apache License, Version 2.0.

### Original Work
- **Gemini CLI** - Copyright 2025 Google LLC
- Repository: https://github.com/google/generative-ai-js
- License: Apache License, Version 2.0

### Modifications & Extensions
- **UNIPATH CLI** - Copyright 2025 Mike Admon and Contributors
- Added support for Azure OpenAI models (GPT-5, GPT-4o, GPT-4o-mini)
- Added DeepSeek R1 integration
- Created universal AI interface system
- Implemented UNIPATH branding and configuration

## > Contributing

UNIPATH CLI is a universal AI interface that extends the original Google Gemini CLI with support for multiple AI providers. Based on [Google's Gemini CLI](https://github.com/google/generative-ai-js).

### Repository

GitHub: [uni-mike/Gemini-CLI-UNI](https://github.com/uni-mike/Gemini-CLI-UNI)

## =� License

Apache 2.0 - See [LICENSE](LICENSE) and [NOTICE](NOTICE) files for details.

This software is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.