# FlexiCLI Tools Registry Analysis

## Available Tools and Their Parameter Schemas

### 1. bash
- **Name**: `bash`
- **Parameters**:
  - `command` (string, required): The shell command to execute
  - `timeout` (number, optional): Timeout in milliseconds
  - `cwd` (string, optional): Working directory

### 2. file
- **Name**: `file`
- **Parameters**:
  - `action` (string, required): 'read' or 'write'
  - `path` (string, required): File path
  - `content` (string, optional): Content for write action

### 3. write_file
- **Name**: `write_file`
- **Parameters**:
  - `file_path` (string, required): Path to file
  - `content` (string, required): Content to write
  - `create_backup` (boolean, optional): Create backup before overwriting
  - `append` (boolean, optional): Append instead of overwriting
  - `encoding` (string, optional): File encoding (default: utf8)

### 4. read_file
- **Name**: `read_file`
- **Parameters**:
  - `file_path` (string, required): Path to file to read
  - `encoding` (string, optional): File encoding (default: utf8)

### 5. edit
- **Name**: `edit`
- **Parameters**:
  - `file_path` (string, required): File to edit
  - `old_text` (string, required): Text to replace
  - `new_text` (string, required): Replacement text
  - `global` (boolean, optional): Replace all occurrences

### 6. grep
- **Name**: `grep`
- **Parameters**:
  - `pattern` (string, required): Search pattern (regex supported)
  - `path` (string, optional): File/directory to search (default: '.')
  - `flags` (string, optional): Grep flags

### 7. web
- **Name**: `web`
- **Parameters**:
  - `action` (string, required): 'search' or 'fetch'
  - `query` (string, required for search): Search query
  - `url` (string, required for fetch): URL to fetch
  - `max_results` (number, optional): Max search results

### 8. git
- **Name**: `git`
- **Parameters**:
  - `command` (string, required): Git command to execute
  - `args` (array, optional): Command arguments

### 9. ls
- **Name**: `ls`
- **Parameters**:
  - `path` (string, optional): Directory to list (default: '.')
  - `all` (boolean, optional): Show hidden files

### 10. memory
- **Name**: `memory`
- **Parameters**:
  - `action` (string, required): 'store', 'retrieve', 'search'
  - `key` (string): Key for store/retrieve
  - `value` (string): Value for store
  - `query` (string): Query for search

## Critical Issues Identified:

### 1. **Tool Name Inconsistencies**
- Planner uses `write_file` but executor sometimes falls back to `file`
- Tool registry has both `file` and `write_file` with overlapping functionality

### 2. **Parameter Schema Mapping Issues**
- Planner provides `filename` but `write_file` expects `file_path`
- Executor has manual mapping code that's brittle

### 3. **Missing Directory Creation**
- `write_file` tool doesn't auto-create parent directories
- Causes failures when creating nested file structures

### 4. **Argument Passing Problems**
- Planner's tool arguments not properly passed to executor
- Executor falls back to parsing mode instead of using provided args

### 5. **Tool Registry Not Exposed to Prompts**
- Planner prompts don't have complete tool schema information
- Results in incorrect tool selection and parameter specification