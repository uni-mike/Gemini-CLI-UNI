# UNIPATH Clean Architecture

## Current Status

✅ **Foundation Complete**
- Clean folder structure (no package separation)
- React Ink UI with orchestration display
- Tool registry system
- Basic LLM provider interface
- Command-line argument parsing
- File, Web, and Bash tools

## Structure

```
src/
├── cli.tsx           # Main entry with yargs parsing
├── config/
│   └── Config.ts     # Unified configuration
├── core/
│   └── deepseek.ts   # DeepSeek orchestrator
├── llm/
│   └── provider.ts   # LLM provider interface
├── tools/
│   ├── base.ts       # Tool base class
│   ├── registry.ts   # Tool registry
│   ├── bash.ts       # Bash execution
│   ├── file.ts       # File operations
│   └── web.ts        # Web search/fetch
└── ui/
    ├── App.tsx       # Main UI component
    ├── DeepSeekUI.tsx # Orchestration UI
    └── OrchestrationDisplay.tsx
```

## Features Working

1. **CLI Arguments**
   - `--prompt` / `-p`: Execute a prompt
   - `--non-interactive`: Run without UI

2. **Tools Registered**
   - bash: Execute shell commands
   - file: Read/write files
   - web: Search and fetch web content

3. **UI Components**
   - React Ink terminal UI
   - Orchestration visualization
   - Interactive prompt input

## Next Steps

- [ ] Connect actual DeepSeek API
- [ ] Add approval system for tools
- [ ] Wire tools to LLM execution
- [ ] Add more providers (GPT, Gemini)

## Usage

```bash
# Interactive mode
./start-clean.sh

# Non-interactive with prompt
./start-clean.sh --prompt "Your task" --non-interactive

# With environment
APPROVAL_MODE=yolo ./start-clean.sh
```