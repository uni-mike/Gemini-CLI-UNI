# FlexiCLI Monitoring Testing Instructions

## CRITICAL: Always Test in This Order

### 1. Backend Health Check
```bash
# Check if backend is running
curl -s http://localhost:4000/api/health | python3 -m json.tool

# Expected output:
# - status: "ok"
# - attachedToAgent: true/false
# - monitoringBridgeActive: true
```

### 2. API Data Verification
Test EACH API endpoint to ensure real data is returned:

```bash
# Overview API - Should show token usage, active tasks
curl -s http://localhost:4000/api/overview | python3 -m json.tool

# Memory API - Should show chunks for each layer
curl -s http://localhost:4000/api/memory | python3 -m json.tool

# Tools API - Should show tools with executions and details
curl -s http://localhost:4000/api/tools | python3 -m json.tool

# Sessions API - Should show sessions with proper status
curl -s http://localhost:4000/api/sessions | python3 -m json.tool

# Pipeline API - Should show nodes and edges
curl -s http://localhost:4000/api/pipeline | python3 -m json.tool
```

### 3. Frontend Accessibility
```bash
# Check if frontend is serving
curl -s http://localhost:3000 | grep -q "root" && echo "Frontend OK" || echo "Frontend FAIL"

# Check if React is loading
curl -s http://localhost:3000/src/App.tsx | head -5
```

### 4. User-Like Testing (MOST IMPORTANT)
Open http://localhost:3000 in browser and verify:

#### Overview Tab
- [ ] Token usage shows actual numbers (not 0)
- [ ] Active tasks count is correct
- [ ] System health shows real metrics
- [ ] Agent status shows connection state

#### Tools Tab
- [ ] Tools list shows all available tools
- [ ] Execution counts are visible
- [ ] Clicking a tool opens modal
- [ ] Modal shows recent executions with:
  - Actual command/query details
  - Real output/results
  - Proper timestamps
- [ ] Dark mode tooltips work on hover

#### Memory Tab
- [ ] Code Index shows chunk count
- [ ] Git Context shows commit count
- [ ] Knowledge Base shows entries
- [ ] Charts display properly

#### Sessions Tab
- [ ] Session IDs are readable (not truncated to "session-")
- [ ] Status shows "active/completed" not "crashed"
- [ ] Token counts are displayed
- [ ] Timestamps are correct

#### Pipeline Tab
- [ ] Flow diagram shows nodes
- [ ] Connections between nodes visible
- [ ] Statistics update with real data

### 5. Data Flow Testing
Run an agent command and verify data flows through:

```bash
# Run agent with monitoring
ENABLE_MONITORING=true APPROVAL_MODE=yolo npx tsx src/cli.tsx \
  --prompt "What is 2+2?" \
  --non-interactive

# Then check if new data appears in:
# 1. Database
sqlite3 .flexicli/flexicli.db "SELECT COUNT(*) FROM ExecutionLog;"

# 2. API
curl -s http://localhost:4000/api/tools | grep "executions"

# 3. UI (refresh browser and check)
```

## Common Issues and Fixes

### Issue: "No agents connected"
**Fix:** This is normal when no agent is running. Run an agent with ENABLE_MONITORING=true

### Issue: All zeros in UI
**Fix:**
1. Check database has data
2. Restart backend in dev mode: `npx tsx src/monitoring/backend/unified-server.ts`
3. Check API returns real data
4. Clear browser cache and reload

### Issue: [object Object] in execution details
**Fix:** Backend needs to properly serialize input/output data

### Issue: Session IDs truncated
**Fix:** Frontend Sessions.tsx component needs update

## Development Mode (Hot Reload)
Always run in dev mode for testing:

```bash
# Backend with hot reload
npx tsx src/monitoring/backend/unified-server.ts

# Frontend with hot reload
cd src/monitoring/react-dashboard && npm run dev
```

## Testing Checklist
- [ ] Backend running and healthy
- [ ] All 5 API endpoints return real data
- [ ] Frontend loads React app
- [ ] Overview tab shows real metrics
- [ ] Tools tab shows executions with details
- [ ] Memory tab shows chunk counts
- [ ] Sessions tab shows readable IDs
- [ ] Pipeline tab shows flow diagram
- [ ] Agent connection updates UI
- [ ] Data persists in database

## Red Flags (Must Fix Immediately)
1. API returns empty objects `{}`
2. UI shows `[object Object]` instead of text
3. All metrics show 0 when database has data
4. Session IDs show as "session-" only
5. Execution details are empty
6. Tooltips don't appear on hover
7. Charts don't render

## Golden Rule
**NEVER ASSUME IT WORKS - ALWAYS VERIFY AS A USER WOULD SEE IT**