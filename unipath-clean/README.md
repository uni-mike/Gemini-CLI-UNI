# UNIPATH Clean Architecture

🚀 Clean, simple, unified CLI with React Ink UI

## Structure

```
unipath-clean/
├── src/
│   ├── cli.tsx          # Main entry point
│   ├── config/          # Unified configuration
│   ├── core/            # Core functionality (DeepSeek, etc)
│   ├── ui/              # React Ink UI components
│   ├── tools/           # Tool integrations
│   └── utils/           # Utilities
├── dist/                # Compiled output
└── start-clean.sh       # Start script
```

## Features

- ✅ Clean React Ink UI with visual orchestration
- ✅ DeepSeek R1 integration with event-driven architecture
- ✅ Simple unified Config class
- ✅ No complex package separation
- ✅ Direct UI bridge (no console patching)

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

## Old Structure

The previous complex multi-package structure has been moved to `_OLD/` folder.