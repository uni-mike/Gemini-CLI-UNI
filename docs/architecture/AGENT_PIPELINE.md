# Agent Pipeline Architecture Documentation

## Overview
The FlexiCLI agent implements a sophisticated trio-based pipeline architecture for processing user requests. The system consists of three core components (Orchestrator, Planner, Executor) that work together with supporting services.

## Core Pipeline Components

### 1. Orchestrator (`src/core/orchestrator.ts`)
**Role:** Main coordinator and communication hub
**Responsibilities:**
- Receives user input
- Coordinates between Planner and Executor
- Manages conversation flow
- Handles slash commands
- Emits monitoring events

**Events Emitted:**
- `orchestration-start` - When processing begins
- `planning-start` - When planning phase starts  
- `planning-complete` - When plan is ready
- `task-start` - When execution begins
- `task-complete` - When task succeeds
- `task-error` - When task fails
- `tool-execute` - When tool is invoked
- `tool-result` - When tool returns
- `status` - Status updates
- `trio-message` - Inter-component messages
- `orchestration-complete` - Final response
- `orchestration-error` - Fatal errors
- `token-usage` - Token consumption data

### 2. Planner (`src/core/planner.ts`)  
**Role:** Strategy and task decomposition
**Responsibilities:**
- Analyzes user requests
- Creates execution plans
- Breaks down complex tasks
- Determines tool selection
- Manages dependencies

### 3. Executor (`src/core/executor.ts`)
**Role:** Task execution and tool invocation
**Responsibilities:**
- Executes planned tasks
- Invokes tools from registry
- Handles tool results
- Manages execution context
- Reports execution status

## Supporting Components

### 4. DeepSeek LLM (`src/llm/deepseek-client.ts`)
**Role:** AI reasoning engine
**Integration:**
- Connected to Orchestrator
- Provides reasoning capabilities
- Generates responses
- Tool call decisions

### 5. Tool Registry (`src/tools/registry.ts`)
**Role:** Tool management system
**Available Tools (14):**
1. `bash.ts` - Shell command execution
2. `edit.ts` - File editing
3. `file.ts` - File operations
4. `git.ts` - Git operations
5. `glob.ts` - File pattern matching
6. `grep.ts` - Text search
7. `ls.ts` - Directory listing
8. `memory_retrieval.ts` - Memory operations
9. `read-file.ts` - File reading
10. `rip-grep.ts` - Advanced search
11. `smart-edit.ts` - Intelligent editing
12. `web.ts` - Web operations
13. `write-file.ts` - File writing
14. `tree.ts` - Directory tree visualization

### 6. Memory Manager
**Role:** Context and state management
**Components:**
- Ephemeral memory (5K tokens)
- Retrieval memory (40K tokens)
- Git context
- Embeddings
- Project context

### 7. Monitoring System (`src/monitoring/backend/`)
**Role:** Real-time observability
**Integration Points:**
- `MonitoringSystem.attachToAgent(orchestrator, memoryManager)`
- Listens to orchestrator events
- Collects metrics
- Provides API endpoints

## Data Flow

### Request Processing Pipeline:
```
User Input
    ↓
Orchestrator (receives & coordinates)
    ↓
Planner (analyzes & decomposes)
    ↓
Orchestrator (validates plan)
    ↓
Executor (runs tasks)
    ↓
Tool Registry (invokes tools)
    ↓
Executor (collects results)
    ↓
Orchestrator (assembles response)
    ↓
User Output
```

### Event Flow:
```
Orchestrator Events → Monitoring System → MetricsCollector → API Endpoints → Frontend
```

## Monitoring Integration Points

### Current Integration (Production-Ready):
- ✅ Orchestrator emits comprehensive events
- ✅ MonitoringSystem fully integrated with agent
- ✅ All major events captured and tracked
- ✅ Real-time WebSocket updates to dashboard
- ✅ Tool execution metrics tracked
- ✅ Memory layer monitoring operational
- ✅ Token usage tracked across all layers
- ✅ Session management with crash recovery
- ✅ Semantic memory with chunk storage

### Recently Completed Integration:
1. **Tool Registry Events** ✅
   - All 14 tools registered and tracked
   - Tool execution metrics linked to monitoring
   - Real-time tool usage statistics

2. **Pipeline Metrics** ✅
   - Task decomposition and planning tracked
   - Orchestrator→Planner→Executor flow monitored
   - Success/failure rates measured

3. **Memory Manager Events** ✅
   - Memory layer usage reported in real-time
   - Context building and retrieval tracked
   - Token budget allocation monitored

## System Performance Metrics

### 1. Tool Registry Performance ✅
- All 14 tools properly registered and tracked
- Real-time execution metrics collected
- Tool usage patterns monitored
- Success/failure rates tracked per tool

### 2. Event Collection System ✅
- Comprehensive event pipeline operational
- Orchestrator events fully captured
- Planning and execution metrics tracked
- Memory layer activities monitored

### 3. API Performance ✅
- Real-time metrics available via REST API
- WebSocket streaming for live updates
- Pipeline metrics accessible at `/api/pipeline/metrics`
- Tool registry data exposed for monitoring dashboard

## Production Validation

### System Testing Completed ✅
1. ✅ Monitoring system fully operational
2. ✅ Agent tested with comprehensive commands:
   - File operations (read, write, edit, tree)
   - Shell commands (ls, pwd, echo, bash)
   - Search operations (grep, glob, ripgrep)
   - Git operations (status, log, diff)
   - Memory operations (retrieval, storage)
   - Web operations (search, fetch)
3. ✅ All metrics validated in production dashboard

### Validation Checklist Completed ✅:
- ✅ All 14 tools appear in Tools tab
- ✅ Pipeline shows real request flow
- ✅ Edge labels show actual counts
- ✅ Memory usage reflects real data
- ✅ Sessions track actual agent runs
- ✅ Token usage shows real consumption
- ✅ Tool executions update live
- ✅ Semantic memory operational with chunk storage
- ✅ Vector similarity search working
- ✅ Database persistence with crash recovery

## Production Status

**System Health: 100% Operational** 🎉
- All core components working flawlessly
- Monitoring system providing real-time insights
- Tool registry fully integrated
- Memory pipeline operational with semantic search
- Agent lock system preventing race conditions
- Database persistence with SQLite + Prisma

---

*Last Updated: September 2025*
*Version: 2.0.0 - Production Ready with Full Pipeline Integration*

**Status**: All systems operational with comprehensive monitoring and semantic memory capabilities.