# FlexiCLI Monitoring System Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (UI)                         │
│  React + MUI Dashboard at http://localhost:4000         │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/WebSocket
┌────────────────────▼────────────────────────────────────┐
│              Monitoring Server (Backend)                 │
│  • Express API (port 4000)                              │
│  • Socket.io for real-time updates                      │
│  • Serves React build files                             │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│           Monitoring Bridge & Collectors                 │
│  • Autonomous Collector (polls DB/files)                │
│  • Metrics Collector (aggregates metrics)               │
│  • Optional: Attaches to live agent                     │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┬──────────────┐
        ▼                         ▼              ▼
┌──────────────┐       ┌──────────────┐  ┌──────────────┐
│   Database   │       │  Log Files   │  │ Agent Events │
│ .flexicli/   │       │ .flexicli/   │  │  (optional)  │
│ flexicli.db  │       │    logs/     │  │              │
└──────────────┘       └──────────────┘  └──────────────┘
```

## Starting Methods

### Method 1: Standalone Monitoring (Recommended)
```bash
# Start monitoring independently
./start-monitoring-standalone.sh

# Then optionally start agent separately
./start-clean.sh
```

### Method 2: Integrated with Agent
```bash
# Start agent with monitoring built-in
./start-agent-with-monitoring.sh --prompt "Your task here"
```

### Method 3: Manual Start
```bash
# Build first
npx tsc

# Start monitoring only
node -e "import('./dist/monitoring/index.js').then(m => m.startStandaloneMonitoring(4000))"

# Or start agent (monitoring auto-starts)
node dist/cli.js
```

## Accessing the Dashboard

1. Start monitoring using any method above
2. Open browser to: **http://localhost:4000**
3. You'll see 5 main tabs:

### Dashboard Tabs

#### 1. **Overview Tab**
- System health metrics
- Active sessions count
- Token usage gauges
- Recent events feed
- Memory layer status

#### 2. **Memory Tab**
- Token budget visualization
- Memory layer breakdown:
  - Ephemeral (LRU cache)
  - Retrieval (vector search)
  - Knowledge (learned facts)
  - Git context
- Chunk distribution chart
- Cache hit rates

#### 3. **Pipeline Tab**
- Visual flow diagram (ReactFlow)
- Shows data flow through:
  - User Input → Orchestrator
  - Orchestrator → Planner/Memory/Executor
  - Tools execution
  - LLM processing
  - Response generation
- Node colors indicate status:
  - Gray: Idle
  - Blue: Active
  - Green: Success
  - Red: Error

#### 4. **Sessions Tab**
- Active/past sessions list
- Session details:
  - Start/end times
  - Token usage
  - Snapshot count
  - Recovery status
- Click session for details

#### 5. **Events Tab**
- Real-time event stream
- Filterable by type:
  - Memory events
  - Pipeline events
  - System events
  - Error events
- Timestamp and component info

## How Agent Integration Works

### When Agent is Running:

1. **Orchestrator** (src/core/orchestrator.ts):
   ```typescript
   // Monitoring is enabled by default
   private monitoringEnabled: boolean = true;
   
   // Starts monitoring automatically on init
   if (this.monitoringEnabled) {
     this.startMonitoring();
   }
   ```

2. **Real-time Events Flow**:
   ```
   Agent Action → EventEmitter → Monitoring Bridge → WebSocket → UI
   ```

3. **Available Slash Commands** (in agent):
   - `/monitor on` - Enable monitoring
   - `/monitor off` - Disable monitoring  
   - `/monitor status` - Check monitoring status

### When Agent is NOT Running:

The monitoring still works! It uses **Autonomous Collector** to:

1. **Poll Database** (every 5 seconds):
   - Reads sessions, chunks, knowledge
   - Checks for new execution logs

2. **Watch Log Files** (continuous):
   - Monitors .flexicli/logs/
   - Parses new log entries

3. **Collect System Metrics**:
   - Memory usage
   - Disk usage
   - Process metrics

## Data Sources

### 1. **SQLite Database** (.flexicli/flexicli.db)
Tables monitored:
- `Session` - Agent sessions
- `Chunk` - Code/document chunks
- `Knowledge` - Learned facts
- `ExecutionLog` - Tool executions
- `GitCommit` - Git context

### 2. **Log Files** (.flexicli/logs/)
- `agent.log` - Main agent logs
- `memory.log` - Memory operations
- `tools.log` - Tool executions
- `errors.log` - Error tracking

### 3. **Live Events** (when agent running)
- Token usage updates
- Pipeline stage transitions
- Tool executions
- Memory operations
- Error events

## Testing the Integration

### Quick Test:
```bash
# Terminal 1: Start monitoring
./start-monitoring-standalone.sh

# Terminal 2: Run agent with task
./start-clean.sh --prompt "Create a hello.txt file"

# Check browser at http://localhost:4000
# You should see:
# - Session appear in Sessions tab
# - Events stream in Events tab
# - Pipeline nodes light up
# - Token usage update
```

### API Endpoints:
```bash
# Health check
curl http://localhost:4000/api/health

# Get metrics
curl http://localhost:4000/api/metrics

# Get events
curl http://localhost:4000/api/events?limit=10

# Get sessions
curl http://localhost:4000/api/sessions
```

## Troubleshooting

### Issue: "Table does not exist"
```bash
# Recreate database schema
npx prisma db push
```

### Issue: Port 4000 in use
```bash
# Kill existing process
lsof -i :4000
kill -9 <PID>
```

### Issue: No data showing
```bash
# Check database exists
ls -la .flexicli/
sqlite3 .flexicli/flexicli.db ".tables"
```

### Issue: UI not loading
```bash
# Rebuild UI (if needed)
cd monitoring-ui
npm install
npm run build
cd ..
```

## Architecture Benefits

1. **Autonomous Operation**:
   - Monitoring survives agent crashes
   - No dependency on agent being active
   - Reads from persistent sources

2. **Real-time + Historical**:
   - Live updates when agent running
   - Historical data always available
   - Session recovery tracking

3. **Loose Coupling**:
   - Agent works without monitoring
   - Monitoring works without agent
   - Can attach/detach dynamically

4. **Performance**:
   - Monitoring in separate process
   - Doesn't affect agent performance
   - Async event handling

## Development

### Adding New Metrics:
1. Update `MetricsCollector` in `src/monitoring/metrics-collector.ts`
2. Add API endpoint in `src/monitoring/server.ts`
3. Update UI component in `monitoring-ui/src/components/`

### Adding New Events:
1. Emit event from agent component
2. Handle in `MonitoringBridge`
3. Display in Events tab

### Custom Visualizations:
1. Add new tab in `Dashboard.tsx`
2. Use MUI components for consistency
3. Connect to WebSocket for real-time updates