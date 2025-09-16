# UNIPATH Tool System Documentation

## Overview

The UNIPATH CLI uses a dynamic, extensible tool system that integrates seamlessly with the Planner-Executor-Orchestrator trio architecture. All tools follow a consistent pattern with parameter schemas that enable intelligent AI-powered task planning.

## CRITICAL RULES

### ⚠️ NEVER HARDCODE CONTENT

**ABSOLUTELY NO HARDCODING OF:**
- File contents
- Script implementations
- API responses
- Example data
- Command outputs

**WHY:** DeepSeek R1 is intelligent enough to generate ALL necessary content dynamically based on user requests. Hardcoding limits flexibility and wastes the AI's capabilities.

**CORRECT APPROACH:**
- Let DeepSeek R1 analyze the request
- Let it generate complete file contents
- Let it create appropriate scripts
- Let it determine proper commands
- Trust the AI to provide everything needed

## Architecture

### Core Components

1. **Tool Base Class** (`src/tools/base.ts`)
   - Abstract base class all tools extend
   - Defines parameter schemas for dynamic prompt building
   - Provides validation and parameter info methods

2. **Tool Registry** (`src/tools/registry.ts`)
   - Central registry for all available tools
   - Dynamic tool discovery and execution
   - Event-driven tool lifecycle management

3. **Integration with Trio Pattern**
   - **Planner**: Uses tool schemas to build intelligent prompts for DeepSeek R1
   - **Executor**: Executes tools with AI-provided or parsed arguments
   - **Orchestrator**: Coordinates tool execution through the trio flow

## Creating a New Tool

### Step 1: Define the Tool Class

```typescript
import { Tool, ToolParams, ToolResult, ParameterSchema } from './base.js';

export class MyTool extends Tool {
  name = 'mytool';
  description = 'Brief description of what the tool does';
  
  // Define parameter schema for dynamic AI prompts
  parameterSchema: ParameterSchema[] = [
    { 
      name: 'action', 
      type: 'string', 
      required: true, 
      enum: ['read', 'write'], 
      description: 'Operation to perform' 
    },
    { 
      name: 'path', 
      type: 'string', 
      required: true, 
      description: 'Path to operate on' 
    },
    { 
      name: 'data', 
      type: 'string', 
      required: false, 
      description: 'Optional data parameter' 
    }
  ];
  
  async execute(params: ToolParams): Promise<ToolResult> {
    // Implement tool logic
    try {
      // Tool implementation
      return { success: true, output: 'Result' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
  
  validate(params: ToolParams): boolean {
    // Optional: Custom validation logic
    return true;
  }
}
```

### Step 2: Register the Tool

In `src/tools/index.ts`:

```typescript
import { MyTool } from './mytool.js';
import { globalRegistry } from './registry.js';

// Register during initialization
globalRegistry.register(new MyTool());
```

### Step 3: Update Executor (if needed)

If your tool requires special argument parsing, add a case in `executor.ts`:

```typescript
case 'mytool':
  args.action = this.extractAction(description);
  args.path = this.extractPath(description);
  break;
```

## Built-in Tools

### File Tool
- **Name**: `file`
- **Description**: File operations (read, write, create files)
- **Parameters**:
  - `action`: "read" | "write" (required)
  - `path`: File path (required)
  - `content`: Content to write (required for write)

### Web Tool
- **Name**: `web`
- **Description**: Web search and content fetching
- **Parameters**:
  - `action`: "search" | "fetch" (required)
  - `query`: Search query (required for search)
  - `url`: URL to fetch (required for fetch)

### Bash Tool
- **Name**: `bash`
- **Description**: Execute shell commands in bash
- **Parameters**:
  - `command`: Shell command to execute (required)

### Edit Tool
- **Name**: `edit`
- **Description**: Edit existing files
- **Parameters**:
  - `path`: File path (required)
  - `oldText`: Text to replace (required)
  - `newText`: Replacement text (required)

### Grep Tool
- **Name**: `grep`
- **Description**: Search for patterns in files
- **Parameters**:
  - `pattern`: Search pattern (required)
  - `path`: Directory/file to search (optional, default: ".")

### Git Tool
- **Name**: `git`
- **Description**: Git operations
- **Parameters**:
  - `action`: Git command (required)
  - `message`: Commit message (optional)

## How It Works

### 1. Dynamic Prompt Building

The Planner dynamically builds tool specifications from the registry:

```typescript
const tool = globalRegistry.get(toolName);
const paramInfo = tool.getParameterInfo(); // Gets formatted parameter schema
```

This creates intelligent prompts for DeepSeek R1:

```
Available tools with their EXACT parameter requirements:
- file: File operations (read, write, create files)
  Parameters:
    Required: action: string (read|write) - Operation to perform, path: string - File path
    Optional: content: string - Content to write (required for write action)
```

### 2. AI-Powered Task Planning

DeepSeek R1 analyzes the request and provides complete task arguments:

```json
{
  "tasks": [{
    "description": "Create Python script to display Bitcoin price",
    "tools": ["file"],
    "arguments": {
      "file": {
        "action": "write",
        "path": "btc_price.py",
        "content": "#!/usr/bin/env python3\n# Complete script content..."
      }
    }
  }]
}
```

### 3. Tool Execution

The Executor uses AI-provided arguments or falls back to parsing:

```typescript
const args = task.arguments?.[toolName] || 
             this.parseToolArguments(toolName, task.description, context);
```

### 4. Error Recovery

Smart recovery strategies for common failures:
- File not found: Create parent directories
- Permission denied: Use alternative locations
- Network timeouts: Retry with backoff

## Best Practices

1. **Always Define Parameter Schemas**
   - Enables dynamic prompt building
   - Improves AI understanding of tool capabilities
   - Provides better validation

2. **Use Descriptive Names and Descriptions**
   - Tool names should be short and clear
   - Descriptions should explain what the tool does
   - Parameter descriptions should be specific

3. **Implement Proper Error Handling**
   - Return structured ToolResult objects
   - Include helpful error messages
   - Support recovery strategies where possible

4. **Follow the Event Pattern**
   - Emit events for tool lifecycle (start, complete, error)
   - Enable monitoring and debugging
   - Support UI updates

5. **Test with the Trio Pattern**
   - Ensure tools work with Planner's AI prompts
   - Verify Executor can parse arguments correctly
   - Test error recovery flows

## Testing a New Tool

1. **Unit Test the Tool**
```bash
npm test src/tools/mytool.test.ts
```

2. **Test with the CLI**
```bash
./start-clean.sh --prompt "use mytool to do something"
```

3. **Verify AI Integration**
- Check that Planner creates correct task arguments
- Ensure Executor properly executes the tool
- Confirm error recovery works as expected

## Troubleshooting

### Tool Not Found
- Ensure tool is registered in `src/tools/index.ts`
- Check tool name matches registration

### Invalid Parameters
- Verify parameter schema matches execute() expectations
- Check validation logic in validate() method

### AI Not Providing Arguments
- Ensure parameter schema is properly defined
- Check that tool description is clear
- Verify Planner prompt includes tool specifications

## Future Enhancements

1. **Tool Composition**
   - Tools that combine other tools
   - Pipeline support for complex operations

2. **Tool Discovery**
   - Automatic tool loading from plugins
   - Dynamic tool registration

3. **Enhanced Schemas**
   - JSON Schema support
   - Complex nested parameters
   - Custom validation rules

4. **Tool Marketplace**
   - Community tools repository
   - Tool versioning and updates
   - Dependency management