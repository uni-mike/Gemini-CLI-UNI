# UNIPATH Clean - Deployment Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ 
- npm 10+
- Azure API Key for DeepSeek R1

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/uni-mike/Gemini-CLI-UNI.git
cd Gemini-CLI-UNI/unipath-clean
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
Create `.env` file:
```bash
# Azure DeepSeek Configuration
API_KEY=your_azure_api_key_here
ENDPOINT=https://your-endpoint.services.ai.azure.com/models
API_VERSION=2024-05-01-preview
MODEL=DeepSeek-R1-0528

# Approval Mode (default/autoEdit/yolo)
APPROVAL_MODE=yolo

# Debug Mode
DEBUG=false
```

4. **Build the project**
```bash
npm run build
```

5. **Run the CLI**
```bash
./start-clean.sh --prompt "Your task here" --non-interactive
```

## 📦 Deployment Options

### Option 1: Local Installation
Perfect for development and testing.

### Option 2: Docker Container
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
ENTRYPOINT ["./start-clean.sh"]
```

### Option 3: NPM Package
```bash
npm pack
# Creates unipath-cli-0.3.0.tgz
npm install -g unipath-cli-0.3.0.tgz
```

## 🔧 Configuration

### Environment Variables
| Variable | Description | Required |
|----------|-------------|----------|
| API_KEY | Azure API key | Yes |
| ENDPOINT | Azure endpoint URL | Yes |
| MODEL | Model name | Yes |
| API_VERSION | API version | Yes |
| APPROVAL_MODE | Tool approval mode | No |
| DEBUG | Debug output | No |

### Approval Modes
- `default`: Ask for approval on sensitive tools
- `autoEdit`: Auto-approve edit operations
- `yolo`: Auto-approve all operations

## 📊 Available Tools

1. **bash** - Execute shell commands
2. **file** - Read/write files
3. **edit** - Modify files
4. **grep** - Search patterns
5. **web** - Web search/fetch
6. **git** - Version control

## 🎯 Usage Examples

### Simple Task
```bash
./start-clean.sh --prompt "What is 2+2?" --non-interactive
```

### File Operations
```bash
./start-clean.sh --prompt "Create config.json with default settings" --non-interactive
```

### Complex Multi-Step
```bash
./start-clean.sh --prompt "Create a Python script, test it, and document it" --non-interactive
```

### Interactive Mode
```bash
./start-clean.sh
# Opens React Ink UI for interactive sessions
```

## 🔍 Troubleshooting

### Issue: API Connection Failed
- Verify API_KEY is correct
- Check ENDPOINT URL format
- Ensure network connectivity

### Issue: Tool Execution Failed
- Check APPROVAL_MODE setting
- Verify file permissions
- Enable DEBUG=true for detailed output

### Issue: Build Errors
```bash
rm -rf node_modules dist
npm install
npm run build
```

## 📈 Performance Tuning

### Optimize Response Time
- Use `--non-interactive` for automation
- Set `APPROVAL_MODE=yolo` to skip confirmations
- Enable connection pooling in production

### Memory Management
- Default heap: 50MB
- For large operations: `NODE_OPTIONS="--max-old-space-size=512"`

## 🔐 Security Considerations

1. **API Key Management**
   - Never commit .env files
   - Use environment variables in production
   - Rotate keys regularly

2. **Tool Approval**
   - Use `default` mode for production
   - Restrict bash commands in shared environments
   - Audit tool usage logs

3. **File System Access**
   - Run with minimal permissions
   - Use containerization for isolation
   - Regular security audits

## 📝 Maintenance

### Updates
```bash
git pull origin main
npm update
npm run build
```

### Logs
- Application logs: Console output
- Debug logs: Set `DEBUG=true`
- Tool execution: Event emitters

### Health Checks
```bash
./start-clean.sh --prompt "What is 1+1?" --non-interactive
# Should return "2" quickly
```

## 🤝 Support

- GitHub Issues: https://github.com/uni-mike/Gemini-CLI-UNI/issues
- Documentation: See docs/ folder
- Version: 0.3.0

---

**UNIPATH Clean** - Simple, Powerful, Production-Ready