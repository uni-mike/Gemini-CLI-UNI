# UNIPATH Clean Architecture

🚀 Clean, unified CLI with Planner-Executor-Orchestrator trio and dynamic tool system

## Structure

```
unipath-clean/
├── src/
│   ├── cli.tsx          # Main entry point
│   ├── config/          # Unified configuration
│   ├── core/            # Orchestrator, Planner, Executor
│   ├── llm/             # DeepSeek R1 integration
│   ├── ui/              # React Ink UI components
│   ├── tools/           # Dynamic tool system with schemas
│   └── utils/           # Utilities
├── start-clean.sh       # Main start script
└── TOOLS.md             # Tool system documentation
```

## Features

- ✅ Planner-Executor-Orchestrator trio architecture
- ✅ Dynamic tool discovery with parameter schemas
- ✅ DeepSeek R1 integration (NO MOCKS, NO HARDCODING)
- ✅ React Ink UI with visual orchestration
- ✅ Event-driven architecture
- ✅ All tools inherit base class with getAvailableTools()

## Usage

```bash
# Interactive mode
./start-clean.sh

# With orchestration
APPROVAL_MODE=yolo ./start-clean.sh

# Non-interactive
./start-clean.sh --prompt "your task here" --non-interactive
```

## Build

```bash
npm install
npm run build
npm start
```

## Available Tools

13 production-ready tools with full parameter schemas:
- bash, edit, file, git, glob, grep, ls
- memory, read-file, rip-grep, smart-edit
- web (search & fetch), write-file

See TOOLS.md for detailed documentation.