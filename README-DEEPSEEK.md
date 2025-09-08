# 🚀 UNIPATH DeepSeek CLI

**The Ultimate DeepSeek-Powered Development Assistant**

UNIPATH DeepSeek CLI is a cutting-edge command-line interface deeply integrated with DeepSeek AI for intelligent code assistance, task orchestration, and automated development workflows.

## 🎯 Why UNIPATH + DeepSeek?

- **Deep Integration**: Built specifically for DeepSeek's capabilities
- **Intelligent Orchestration**: Three-role architecture prevents stuck states
- **Smart Task Management**: Automatic task decomposition and parallel execution
- **Recovery Mechanisms**: Self-healing from stuck or failed operations
- **Visual Progress Tracking**: Real-time feedback on complex operations

## 🎭 Three-Role Architecture

### 1. **Planner** 📝
- Analyzes task complexity
- Decomposes complex prompts into manageable tasks
- Identifies dependencies
- Optimizes execution order

### 2. **Executor** 🔧
- Maps tasks to appropriate tools
- Executes with timeout protection
- Handles retries automatically
- Provides isolated execution environment

### 3. **Orchestrator** 🎼
- Monitors overall health
- Detects and recovers from stuck states
- Manages parallel execution
- Provides real-time progress updates

## 🛠️ Key Features

### Intelligent Task Chunking
```bash
# Automatically breaks down complex tasks
./start-deepseek.sh < complex-task.txt
```

### Visual Progress Tracking
```
🎭 Task Orchestration Progress
──────────────────────────────────────────────────
Progress: ████████████████░░░░░░░░░░░░░ 53%
Total: 15 | ✅ Completed: 8 | ⠋ In Progress: 3 | ❌ Failed: 0

Active Tasks:
  1. Searching for TypeScript files...
  2. Reading package.json...
  3. Analyzing code patterns...

Elapsed: 2m 15s | Remaining: ~2m
Status: 🟢 Healthy
```

### Automatic Recovery
- Detects stuck tasks after timeout
- Aborts and retries with simpler approach
- Prevents entire system from hanging

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/unipath/deepseek-cli.git
cd deepseek-cli

# Install dependencies
npm install

# Set up DeepSeek API key
export DEEPSEEK_API_KEY="your-api-key"

# Run the CLI
./start-deepseek.sh
```

## 🔧 Configuration

Create a `.deepseek.config.json`:

```json
{
  "apiKey": "your-deepseek-api-key",
  "model": "deepseek-coder",
  "approvalMode": "manual",
  "orchestration": {
    "enabled": true,
    "maxConcurrentTasks": 3,
    "defaultTimeoutMs": 30000,
    "maxRetries": 2
  },
  "trustedFolders": [
    "~/projects/myapp"
  ]
}
```

## 📚 Usage Examples

### Simple Task
```bash
echo "Search for TODO comments in the code" | ./start-deepseek.sh
```

### Complex Multi-Step Task
```bash
cat << EOF | ./start-deepseek.sh
1. Analyze the entire codebase
2. Find security vulnerabilities
3. Check for outdated dependencies
4. Run all tests
5. Generate a comprehensive report
EOF
```

### With Orchestration Control
```javascript
// Use the orchestrator directly
import { DeepSeekOrchestrator } from '@unipath/deepseek-cli';

const orchestrator = new DeepSeekOrchestrator();

// Monitor progress
orchestrator.on('progress', (progress) => {
  console.log(`Progress: ${progress.completed}/${progress.total}`);
});

// Execute complex task
await orchestrator.orchestratePrompt(complexPrompt);
```

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│         User Prompt                  │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│         Orchestrator                 │
│   (Health Monitor + Progress)        │
└─────────────┬───────────────────────┘
              │
     ┌────────┴────────┐
     ▼                 ▼
┌──────────┐    ┌──────────┐
│  Planner │    │ Executor │
│          │    │          │
│ • Analyze│    │ • Map    │
│ • Decompose   │ • Execute│
│ • Optimize    │ • Retry  │
└──────────┘    └──────────┘
```

## 🚦 Health Monitoring

The system continuously monitors:
- Task execution times
- Progress intervals
- Resource usage
- Response times

Health states:
- 🟢 **Healthy**: All systems operating normally
- 🟡 **Degraded**: Slower than expected but functional
- 🔴 **Stuck**: No progress, initiating recovery

## 🔄 Recovery Mechanisms

1. **Timeout Protection**: Each task has configurable timeout
2. **Automatic Retry**: Failed tasks retry with exponential backoff
3. **Task Abortion**: Stuck tasks are forcefully terminated
4. **Fallback Strategies**: Complex tasks simplified on failure
5. **System Reset**: Full reset if too many tasks stuck

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

Built with ❤️ for the DeepSeek community by UNIPATH team.

---

**UNIPATH DeepSeek CLI** - Where AI meets intelligent orchestration.