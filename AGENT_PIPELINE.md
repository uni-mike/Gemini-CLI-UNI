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
**Available Tools (13):**
1. `bash.ts` - Shell command execution
2. `edit.ts` - File editing
3. `file.ts` - File operations
4. `git.ts` - Git operations
5. `glob.ts` - File pattern matching
6. `grep.ts` - Text search
7. `ls.ts` - Directory listing
8. `memory.ts` - Memory operations
9. `read-file.ts` - File reading
10. `rip-grep.ts` - Advanced search
11. `smart-edit.ts` - Intelligent editing
12. `web.ts` - Web operations
13. `write-file.ts` - File writing

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

### Current Integration (Partial):
- Orchestrator emits events
- MonitoringSystem attaches to agent
- Some events are captured

### Missing Integration:
1. **Tool Registry Events**
   - Tool registration not broadcast
   - Tool list not accessible to monitoring
   - Execution metrics not linked

2. **Pipeline Metrics**
   - Real task counts not tracked
   - Planner decisions not recorded
   - Executor throughput not measured

3. **Memory Manager Events**
   - Memory usage not reported
   - Context switches not tracked
   - Retrieval hits/misses not counted

## Required Fixes

### 1. Tool Registry Integration
```typescript
// In MetricsCollector.ts
import { globalRegistry } from '../../tools/registry.js';

private async loadToolsFromRegistry() {
  const tools = globalRegistry.getTools();
  return tools.map(tool => ({
    id: tool.name.toLowerCase(),
    name: tool.name,
    category: this.getToolCategory(tool.name),
    executions: 0,
    successes: 0,
    failures: 0,
    avgDuration: 0,
    lastUsed: null,
    status: 'inactive'
  }));
}
```

### 2. Event Metric Collection
```typescript
// In monitoring-bridge.ts
orchestrator.on('planning-complete', (plan) => {
  this.metricsCollector.recordPlannerActivity(plan);
});

orchestrator.on('task-complete', (result) => {
  this.metricsCollector.recordExecutorActivity(result);
});

orchestrator.on('tool-execute', (data) => {
  this.metricsCollector.startToolExecution(data);
});

orchestrator.on('tool-result', (data) => {
  this.metricsCollector.completeToolExecution(data);
});
```

### 3. Pipeline API Enhancement
```typescript
// In unified-server.ts
app.get('/api/pipeline/metrics', (req, res) => {
  const metrics = {
    orchestrator: {
      requests: this.metricsCollector.getOrchestratorRequests(),
      throughput: this.metricsCollector.getOrchestratorThroughput()
    },
    planner: {
      plans: this.metricsCollector.getPlannerPlans(),
      decompositions: this.metricsCollector.getPlannerDecompositions()
    },
    executor: {
      executions: this.metricsCollector.getExecutorExecutions(),
      successes: this.metricsCollector.getExecutorSuccesses(),
      failures: this.metricsCollector.getExecutorFailures()
    },
    tools: {
      invocations: this.metricsCollector.getToolInvocations(),
      registry: globalRegistry.list()
    }
  };
  res.json(metrics);
});
```

## Testing Requirements

### Generate Real Data:
1. Start monitoring system
2. Run agent with test commands:
   - File operations (read, write, edit)
   - Shell commands (ls, pwd, echo)
   - Search operations (grep, glob)
   - Git operations (status, log)
3. Verify metrics in dashboard

### Validation Checklist:
- [ ] All 13 tools appear in Tools tab
- [ ] Pipeline shows real request flow
- [ ] Edge labels show actual counts
- [ ] Memory usage reflects real data
- [ ] Sessions track actual agent runs
- [ ] Token usage shows real consumption
- [ ] Tool executions update live

## Implementation Priority

1. **HIGH:** Fix tool registry integration
2. **HIGH:** Remove hardcoded pipeline data
3. **MEDIUM:** Enhance event collection
4. **MEDIUM:** Add memory manager metrics
5. **LOW:** Historical data persistence

## Notes

- Agent already has good event emission
- Monitoring system has attachment mechanism
- Main issue is incomplete data flow
- Frontend expects real-time updates via WebSocket