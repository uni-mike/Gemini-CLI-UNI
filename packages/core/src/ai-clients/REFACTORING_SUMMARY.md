# DeepSeek Integration Refactoring Documentation

## Overview
The DeepSeek integration has been refactored from a monolithic 1700+ line file into a clean, modular architecture with proper separation of concerns.

## Architecture

### Directory Structure
```
packages/core/src/ai-clients/
├── deepseek/
│   ├── DeepSeekClient.ts          # Main orchestrator (400 lines)
│   ├── DeepSeekPrompts.ts         # Prompt management (126 lines)
│   ├── DeepSeekMessageParser.ts   # Message parsing (200 lines)
│   ├── DeepSeekToolExecutor.ts    # Tool execution (400 lines)
│   └── index.ts                   # Module exports
├── shared/
│   ├── formatters/
│   │   ├── AnsiColors.ts          # Color theming
│   │   ├── DiffFormatter.ts       # Git-diff style output
│   │   ├── ToolDisplayFormatter.ts # Claude Code-style displays
│   │   ├── ResultFormatter.ts     # Result formatting
│   │   └── index.ts
│   └── utils/
│       └── DebugLogger.ts         # Debug/verbose logging
└── REFACTORING_SUMMARY.md         # This document
```

## Key Features

### 1. Dynamic Tool Registry Integration
- **100% dynamic** - no hardcoded tools
- Automatically discovers and uses all tools from the registry
- Smart tool name mapping (snake_case, kebab-case, CamelCase)
- Full parameter extraction from tool schemas

### 2. Streaming Progress Display
- Real-time progress callbacks
- Tool execution counters
- Claude Code-style visual indicators
- Progress updates during long operations

### 3. Approval System Integration
- Respects `APPROVAL_MODE` environment variable
- Supports: `default`, `yolo`, `auto-edit` modes
- Non-interactive mode support
- Session-based approval state

### 4. Complex Task Handling
- Automatic task complexity analysis
- Smart task chunking for multi-step operations
- Step-by-step execution with progress
- Handles numbered lists and conjunctions

### 5. Error Recovery & Resilience
- Automatic retry logic (3 attempts)
- Exponential backoff for rate limiting
- Request timeout handling (2 minutes)
- Detailed error messages with recovery hints

### 6. Enhanced Debug/Verbose Mode
- `DEBUG=true` - Enable debug logging
- `VERBOSE=true` - Enable detailed output
- Performance metrics
- Sanitized API request/response logging
- Tool execution traces

### 7. No Token Limits
- **NEVER limits max_tokens** - lets the model use what it needs
- Full responses without truncation
- Complete tool execution results

## Module Descriptions

### DeepSeekClient
Main orchestrator that coordinates all components:
- Manages conversation state
- Handles API communication with retry logic
- Orchestrates tool execution
- Implements complex task chunking
- Provides streaming response generation

### DeepSeekPrompts
Centralized prompt management:
- System prompt generation
- Tool description formatting
- Continuation prompts
- Task complexity analysis prompts

### DeepSeekMessageParser
Robust message parsing with multiple format support:
- `<tool_use>` format parsing
- JSON code block format
- Function call format
- Tool call deduplication
- Message extraction and cleaning

### DeepSeekToolExecutor
Tool execution with approval flows:
- Registry-first execution
- Emergency fallback implementations
- Approval flow integration
- Result formatting
- Error handling

### Shared Formatters
Reusable formatting components:
- **AnsiColors**: Terminal color support
- **DiffFormatter**: Git-diff style output with color
- **ToolDisplayFormatter**: Claude Code-style tool displays
- **ResultFormatter**: Rich result formatting with previews

### DebugLogger
Comprehensive debug logging:
- Timestamp-based logging
- Request/response logging
- Performance metrics
- Sensitive data sanitization

## Migration Guide

### From Old to New

#### Old Usage (monolithic):
```typescript
import { DeepSeekWithTools } from './deepSeekWithTools.js';

const deepseek = new DeepSeekWithTools(config);
deepseek.setConfirmationCallback(callback);
const response = await deepseek.sendMessageWithTools(message);
```

#### New Usage (refactored):
```typescript
import { DeepSeekWithTools } from './deepSeekWithToolsRefactored.js';

const deepseek = new DeepSeekWithTools(config);
deepseek.setConfirmationCallback(callback);
deepseek.setProgressCallback(progressCallback); // Optional
const response = await deepseek.sendMessageWithTools(message);
```

The API is 100% backward compatible!

## Environment Variables

### Required
- `API_KEY` or `AZURE_API_KEY` - API authentication
- `ENDPOINT` or `AZURE_ENDPOINT_URL` - API endpoint
- `MODEL` or `AZURE_MODEL` - Model name
- `API_VERSION` or `AZURE_OPENAI_API_VERSION` - API version

### Optional
- `APPROVAL_MODE` - Set to `yolo`, `auto-edit`, or `default`
- `DEBUG` - Set to `true` or `1` for debug output
- `VERBOSE` - Set to `true` or `1` for verbose logging
- `UNIPATH_NON_INTERACTIVE` - Set to `true` for non-interactive mode

## Performance Improvements

### Before Refactoring
- Single 1700+ line file
- Hardcoded tool implementations
- Mixed concerns (parsing, execution, formatting)
- Difficult to test and maintain
- No retry logic
- Basic error messages

### After Refactoring
- Modular architecture (8 focused modules)
- Dynamic tool discovery
- Separation of concerns
- Easy to test individual components
- Automatic retry with backoff
- Detailed error recovery
- Performance monitoring
- Rich debug output

## Testing

### Unit Tests
Each module can be tested independently:
```typescript
import { DeepSeekMessageParser } from './DeepSeekMessageParser.js';

const parser = new DeepSeekMessageParser();
const toolCalls = parser.parseToolCalls(response);
```

### Integration Tests
Test the complete flow:
```typescript
const client = new DeepSeekClient(config);
const stream = client.sendMessageStream("create test.txt");
for await (const chunk of stream) {
  console.log(chunk);
}
```

## Best Practices

1. **Always use the tool registry** - Don't hardcode tools
2. **Enable debug mode during development** - `DEBUG=true`
3. **Use progress callbacks for long operations**
4. **Handle approval flows properly**
5. **Test with different approval modes**
6. **Monitor performance with debug logger**
7. **Never limit tokens** - Let the model use what it needs

## Future Enhancements

1. **Streaming tool execution** - Execute tools in parallel when possible
2. **Better caching** - Cache tool descriptions and schemas
3. **Metrics collection** - Collect usage statistics
4. **Plugin system** - Allow custom formatters and parsers
5. **WebSocket support** - For real-time streaming

## Conclusion

The refactored DeepSeek integration provides:
- **Better maintainability** through modular design
- **Improved reliability** with retry logic and error recovery
- **Enhanced user experience** with Claude Code-style formatting
- **Full flexibility** with dynamic tool discovery
- **Production readiness** with comprehensive logging and debugging

All while maintaining 100% backward compatibility!