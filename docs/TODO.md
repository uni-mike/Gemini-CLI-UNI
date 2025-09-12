# FlexiCLI TODO List

## Current Architecture
- **Trio System**: Orchestrator, Executor, Planner
- **Memory Layers**: Multiple layers for different types of data
- **Monitoring**: Standalone service that observes agent activity

## ✅ Completed
- [x] Move code from unipath-clean to project root
- [x] Create unified monitoring server
- [x] Separate agent and monitoring code
- [x] Create MonitoringBridge for event-based integration
- [x] Set up development mode with tsx --watch
- [x] Create standalone scripts (start-agent.sh, start-monitoring.sh)

## 🔧 In Progress
- [ ] Clean up duplicate monitoring files
  - [ ] Remove duplicate MetricsCollector files (keep one)
  - [ ] Consolidate multiple server files (unified-server vs standalone)
  - [ ] Remove redundant collector implementations

## 📝 TODO

### High Priority
1. **Fix Agent-Monitoring Integration**
   - [ ] Update cli.tsx to optionally attach monitoring
   - [ ] Ensure orchestrator emits all necessary events
   - [ ] Verify MonitoringBridge receives events properly
   - [ ] Test data flow from agent to dashboard

2. **Memory System Implementation**
   - [ ] Implement all memory layers in agent:
     - [ ] Short-term memory (current session)
     - [ ] Long-term memory (persistent knowledge)
     - [ ] Episodic memory (past interactions)
     - [ ] Semantic memory (concepts and relationships)
   - [ ] Connect memory layers to monitoring dashboard
   - [ ] Persist memory to database

3. **Complete Trio Integration**
   - [ ] Ensure Planner emits proper events
   - [ ] Ensure Executor emits tool execution events
   - [ ] Orchestrator coordinates all components
   - [ ] All events flow to monitoring

### Medium Priority
4. **Dashboard Improvements**
   - [ ] Add project selector dropdown
   - [ ] Add agent selector (only show FlexiCLI agents)
   - [ ] Real-time pipeline visualization
   - [ ] Memory layer visualization
   - [ ] Tool execution history

5. **Testing**
   - [ ] Test agent independently
   - [ ] Test monitoring independently
   - [ ] Test integration between agent and monitoring
   - [ ] Verify data persistence to database
   - [ ] Test crash recovery (monitoring survives agent crash)

### Low Priority
6. **Documentation**
   - [ ] Document architecture
   - [ ] Document API endpoints
   - [ ] Document event system
   - [ ] Create user guide

## 🐛 Known Issues
- Multiple monitoring server processes running simultaneously
- Dashboard shows "Monitoring Offline" when data is missing
- Duplicate files in monitoring backend
- Agent doesn't attach to monitoring by default

## 📚 Architecture Notes

### Event Flow
```
Agent (Orchestrator/Planner/Executor)
  ↓ emits events
MonitoringBridge (subscribes to events)
  ↓ forwards to
MetricsCollector (processes metrics)
  ↓ stores in
Database (Prisma/SQLite)
  ↓ read by
Monitoring Server (REST API + WebSocket)
  ↓ consumed by
React Dashboard (UI)
```

### Key Components
- **Orchestrator**: Coordinates Planner and Executor
- **Planner**: Decomposes tasks into steps
- **Executor**: Executes tools and actions
- **MemoryManager**: Manages different memory layers
- **MonitoringBridge**: Connects agent to monitoring
- **MetricsCollector**: Processes and stores metrics
- **UnifiedServer**: Serves monitoring API and dashboard

### Start Commands
```bash
# Start monitoring (standalone)
./start-monitoring.sh

# Start agent (with optional monitoring)
ENABLE_MONITORING=true ./start-agent.sh

# Start everything
./start-flexicli.sh
```