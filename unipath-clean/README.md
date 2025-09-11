# UNIPATH FlexiCLI

A powerful AI-driven CLI tool with monitoring dashboard, built on Azure DeepSeek R1 integration.

## 🚀 Quick Start

```bash
# Interactive mode
./start-clean.sh

# Non-interactive with prompt
./start-clean.sh --prompt "Your task" --non-interactive

# Start monitoring dashboard
./dev-monitoring.sh start
```

## 📊 Features

- **AI Integration**: Azure-hosted DeepSeek R1 model
- **Tool System**: Bash, file operations, web search, etc.
- **React UI**: Clean terminal interface with React Ink
- **Monitoring Dashboard**: Real-time metrics and visualization
- **Multi-step Tasks**: Complex task orchestration
- **Easy Development**: Single script for all services

## 📁 Project Structure

```
├── src/                     # Core application
│   ├── cli.tsx             # Entry point
│   ├── core/               # Orchestrators
│   ├── llm/                # LLM clients
│   ├── tools/              # Tool implementations
│   ├── ui/                 # React Ink UI
│   └── monitoring/         # Dashboard system
├── docs/                   # Documentation
├── dev-monitoring.sh       # Development server
├── start-clean.sh          # Main CLI script
└── _OLD/                   # Archived files
```

## 🔧 Configuration

Create a `.env` file:

```bash
API_KEY=your_azure_api_key
ENDPOINT=https://your-resource.services.ai.azure.com/models
API_VERSION=2024-05-01-preview
MODEL=DeepSeek-R1-0528
APPROVAL_MODE=yolo
DEBUG=false
```

## 📖 Documentation

See the `docs/` directory for detailed documentation:

- `FEATURES.md` - Complete feature overview
- `ARCHITECTURE.md` - System architecture
- `DEPLOYMENT_GUIDE.md` - Deployment instructions

## 🎯 Development

```bash
# Start both frontend and backend
./dev-monitoring.sh start

# View logs
./dev-monitoring.sh logs frontend
./dev-monitoring.sh logs backend

# Stop all services
./dev-monitoring.sh stop
```

## 📈 Status

- ✅ 90% feature complete
- ✅ 100% foundation ready
- ✅ 90% tools implemented
- ✅ 85% UI features done
- ✅ 100% monitoring dashboard functional

---

Last Updated: 2025-09-11