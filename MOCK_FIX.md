# Mock Data Fix Tracking Document

## Overview
This document tracks all instances of mock/fake/hardcoded data in the FlexiCLI monitoring system and provides a roadmap for fixing them to use real data from the agent.

## Status Summary
- ✅ Fixed
- ⚠️ Partially Fixed  
- ❌ Not Fixed
- 🔄 In Progress

## Mock Data Issues

### Frontend (React Dashboard)

#### 1. Pipeline Component - HARDCODED METRICS ⚠️
**Location:** `src/monitoring/react-dashboard/src/components/Pipeline.tsx`
**Status:** ⚠️ Partially Fixed (set to zeros, not using real data)
**Issues:**
- ~~Hardcoded "234K tokens/min" for DeepSeek LLM~~ → Fixed to "0 tokens/min"
- ~~Hardcoded "1,247 req/min" for Orchestrator~~ → Fixed to "0 req/min"
- ~~Hardcoded "89 plans/min" for Planner~~ → Fixed to "0 plans/min"
- ~~Hardcoded "873 tasks/min" for Executor~~ → Fixed to "0 tasks/min"
- ~~Hardcoded "345 results/min" for Monitoring~~ → Fixed to "0 results/min"
- ~~Other hardcoded metrics for memory components~~ → Fixed to zeros
- ❌ Not using real API data from `/api/pipeline` endpoint
- ❌ Entire pipeline layout is hardcoded, ignoring API response

**Fix Required:** 
- Refactor Pipeline component to use actual API data
- Map API nodes to visual components dynamically

#### 2. Sessions Component ✅
**Location:** `src/monitoring/react-dashboard/src/components/Sessions.tsx`
**Status:** ✅ Fixed
**Issues Fixed:**
- ~~Math.random() for token values~~ → Changed to 0
- ~~Math.random() for chunk values~~ → Changed to 0

### Backend (API Server)

#### 3. MetricsCollector - TOKEN USAGE ✅
**Location:** `src/monitoring/backend/MetricsCollector.ts`
**Status:** ✅ Fixed
**Issues Fixed:**
- ~~Hardcoded token total of 12,500~~ → Changed to 0
- ~~Fake token usage calculations~~ → Changed to 0

#### 4. MetricsCollector - TOOLS REGISTRY ❌
**Location:** `src/monitoring/backend/MetricsCollector.ts:471-507`
**Status:** ❌ Not Fixed
**Issues:**
- Only returns 3 hardcoded tools (Bash, Read, Write) in `getDefaultTools()`
- Should return all 13 tools from agent's tool registry:
  - bash.ts
  - edit.ts
  - file.ts
  - git.ts
  - glob.ts
  - grep.ts
  - ls.ts
  - memory.ts
  - read-file.ts
  - rip-grep.ts
  - smart-edit.ts
  - web.ts
  - write-file.ts

**Fix Required:**
- Import globalRegistry from tools/registry.ts
- Use globalRegistry.getTools() to get actual tools
- Map tool objects to monitoring format

#### 5. MetricsCollector - MEMORY LAYERS ⚠️
**Location:** `src/monitoring/backend/MetricsCollector.ts:194-216`
**Status:** ⚠️ Partially Fixed
**Issues:**
- Hardcoded layer names: "Code Index", "Git Context", "Knowledge Base", "Conversation", "Project Context"
- These should come from actual memory system

#### 6. Session IDs ⚠️
**Location:** `src/monitoring/backend/MetricsCollector.ts:78`
**Status:** ⚠️ Partially Fixed
**Issues:**
- Sessions use `session-${Date.now()}` format
- Should integrate with actual agent sessions

#### 7. Uptime Calculation ✅
**Location:** `src/monitoring/backend/MetricsCollector.ts:182`
**Status:** ✅ Fixed
**Issues Fixed:**
- ~~Was returning milliseconds instead of seconds~~ → Fixed with Math.floor(ms/1000)

## Integration Issues

### 1. Tool Registry Integration ❌
**Problem:** Monitoring backend doesn't import or use the agent's tool registry
**Solution:** 
```typescript
// In MetricsCollector.ts
import { globalRegistry } from '../../tools/registry.js';

private getDefaultTools() {
  const registeredTools = globalRegistry.getTools();
  return {
    tools: registeredTools.map(tool => ({
      id: tool.name.toLowerCase(),
      name: tool.name,
      category: tool.category || this.getToolCategory(tool.name),
      executions: 0,
      successes: 0,
      failures: 0,
      avgDuration: 0,
      lastUsed: null,
      status: 'inactive'
    })),
    recentExecutions: [],
    activeTools: []
  };
}
```

### 2. Agent Communication ❌
**Problem:** Monitoring runs independently, not receiving real-time events from agent
**Solution:** Need to establish event bridge between agent and monitoring

### 3. Database Integration ⚠️
**Problem:** Some data comes from database, but not all
**Current State:**
- ✅ Chunks count from database
- ✅ Git commits from actual git history
- ❌ Sessions not from database
- ❌ Tool executions not persisted

## Action Plan

### Phase 1: Fix Tool Registry (Priority: HIGH)
1. Import globalRegistry in MetricsCollector
2. Load all 13 tools from registry
3. Display all tools in UI with real status

### Phase 2: Fix Pipeline Component (Priority: HIGH)
1. Refactor Pipeline.tsx to use API data
2. Remove all hardcoded nodes
3. Create dynamic layout based on API response

### Phase 3: Establish Agent Bridge (Priority: MEDIUM)
1. Create event emitter in agent for tool executions
2. Connect monitoring to agent events
3. Update metrics in real-time

### Phase 4: Database Integration (Priority: LOW)
1. Persist tool executions to database
2. Load historical data on startup
3. Show real session data from database

## Testing Checklist

- [ ] All 13 tools appear in Tools tab
- [ ] Pipeline shows real component status
- [ ] Token usage shows actual values (0 if none)
- [ ] Sessions show real session data
- [ ] Memory layers reflect actual system state
- [ ] Tool executions update in real-time
- [ ] No Math.random() or hardcoded values remain

## Files to Modify

1. **Backend:**
   - `/src/monitoring/backend/MetricsCollector.ts` - Fix getDefaultTools()
   - `/src/monitoring/backend/monitoring-bridge.ts` - Enhance agent integration

2. **Frontend:**
   - `/src/monitoring/react-dashboard/src/components/Pipeline.tsx` - Use API data
   - `/src/monitoring/react-dashboard/src/components/Tools.tsx` - Display all tools

3. **Agent:**
   - `/src/tools/registry.ts` - Expose tool list to monitoring
   - `/src/tools/auto-discovery.ts` - Emit events when tools are loaded

## Notes

- The monitoring system was designed to be standalone but needs better integration with the agent
- Current architecture allows monitoring to run without agent, but shows fake data
- Need to balance standalone capability with real-time accuracy