# UNIPATH CLI Modular Architecture

## Core Principles

1. **NO MONOLITHIC FILES**: Every file should have a single, clear responsibility
2. **Maximum 500 lines per file**: If a file exceeds this, it needs to be refactored
3. **Clear separation of concerns**: Each module handles one specific aspect
4. **Use composition over inheritance**: Prefer combining small modules over deep inheritance

## DeepSeek Integration Architecture

### The Trio Pattern (Orchestrator/Executor/Planner)

The DeepSeek integration follows a clean trio pattern that ensures resilience and maintainability:

```
┌──────────────────────────────────────┐
│   DeepSeekWithOrchestration          │ ← Entry point (extends refactored base)
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│   DeepSeekOrchestrator               │ ← Coordinates the trio
├──────────────────────────────────────┤
│ • Manages complex task breakdown     │
│ • Handles error recovery              │
│ • Coordinates parallel execution     │
└──────┬───────────┬───────────┬──────┘
       │           │           │
       ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Planner  │ │ Executor │ │ Progress │
│          │ │          │ │ Tracker  │
├──────────┤ ├──────────┤ ├──────────┤
│ Creates  │ │ Runs     │ │ Shows    │
│ task     │ │ tasks    │ │ status   │
│ plans    │ │ safely   │ │ updates  │
└──────────┘ └──────────┘ └──────────┘
```

### Modular File Structure

```
packages/core/src/
├── ai-clients/
│   ├── deepseek/
│   │   ├── DeepSeekClient.ts        (Main client - 480 lines)
│   │   ├── DeepSeekPrompts.ts       (Prompt templates - 180 lines)
│   │   ├── DeepSeekMessageParser.ts (Parse responses - 220 lines)
│   │   ├── DeepSeekToolExecutor.ts  (Execute tools - 220 lines)
│   │   └── index.ts                 (Public exports)
│   └── shared/
│       ├── formatters/
│       │   ├── ToolDisplayFormatter.ts
│       │   ├── ResultFormatter.ts
│       │   └── AnsiColors.ts
│       └── utils/
│           └── DebugLogger.ts
├── orchestration/
│   ├── Orchestrator.ts      (Main orchestrator)
│   ├── Planner.ts           (Task planning)
│   ├── Executor.ts          (Task execution)
│   ├── ProgressTracker.ts   (UI updates)
│   └── DeepSeekOrchestrator.ts (DeepSeek-specific)
└── core/
    ├── deepSeekWithToolsRefactored.ts (Bridge - 66 lines)
    └── deepSeekWithOrchestration.ts   (Entry point - 181 lines)
```

## Key Benefits

1. **Maintainability**: Each file is small and focused
2. **Testability**: Individual modules can be tested in isolation
3. **Reusability**: Shared components (formatters, utils) can be used across different AI clients
4. **Resilience**: The trio pattern ensures proper error handling and recovery
5. **Scalability**: New AI clients can reuse the same patterns and shared components

## Rules for Future Development

### DO ✅
- Create new files when adding new functionality
- Use the shared formatters and utilities
- Follow the trio pattern for complex operations
- Keep files under 500 lines
- Use TypeScript interfaces for contracts
- Write focused, single-purpose classes

### DON'T ❌
- Add new methods to existing large files
- Create "utility" classes with mixed responsibilities
- Use inheritance chains deeper than 2 levels
- Mix UI formatting with business logic
- Put multiple unrelated classes in one file
- Create files over 500 lines

## Example: Adding a New AI Client

If adding support for a new AI model (e.g., Claude), follow this pattern:

```
ai-clients/
└── claude/
    ├── ClaudeClient.ts         (Main client logic)
    ├── ClaudePrompts.ts        (Prompt templates)
    ├── ClaudeMessageParser.ts  (Response parsing)
    ├── ClaudeToolExecutor.ts   (Tool execution)
    └── index.ts                (Public API)
```

Then create a bridge in `core/`:
```typescript
// claudeWithOrchestration.ts
import { ClaudeClient } from '../ai-clients/claude/index.js';
import { Orchestrator } from '../orchestration/Orchestrator.js';
// ... integrate with trio pattern
```

## Monitoring File Sizes

Run this command periodically to check for files that need refactoring:
```bash
find packages -name "*.ts" -exec wc -l {} \; | sort -rn | head -20
```

Any file over 500 lines should be reviewed for refactoring opportunities.

## Migration from Monolithic Code

Old monolithic files have been moved to `/_OLD/` folder. These files:
- Should NEVER be imported
- Serve as reference only
- Will cause build errors if accidentally imported (by design)

If you see an error like "Module not found: deepSeekWithTools", it means:
1. You're trying to use old code
2. Update the import to use `deepSeekWithToolsRefactored` or `deepSeekWithOrchestration`
3. Check this document for the correct modular approach

## Conclusion

The modular architecture ensures UNIPATH CLI remains maintainable, testable, and scalable. By following these patterns, we avoid the complexity that comes from monolithic files and ensure the codebase remains clean and professional.