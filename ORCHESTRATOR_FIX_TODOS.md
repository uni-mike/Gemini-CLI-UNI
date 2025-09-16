# Orchestrator Logic Flow Fix - ZERO TOLERANCE TO ERRORS

## Critical Issues Found

### 1. INCORRECT TASK DETECTION (Line 698-702)
**Problem:** Code checks `response.tasks` even when we have a valid conversation response
**Impact:** Falls back to basic summary instead of returning full synthesized answer
**Fix:** Must properly detect response type and extract correct field

### 2. RESPONSE EXTRACTION FAILURES
**Problem:** Multiple places where response extraction can fail:
- Line 691: Checks for `response.description` (wrong field)
- Line 698-702: Incorrectly detects tasks when response exists
- Line 704-709: Searches multiple fields but may miss actual response
- Line 716-723: Falls back to hardcoded basic summary

### 3. DEFAULT FALLBACKS HIDING REAL DATA
**Problem:** Too many fallback defaults that hide when things fail:
- Line 716: "using basic summary" - hides real response
- Line 723: Hardcoded FlexiCLI description
- Line 728: Generic error message
- Line 732: Another generic fallback

## TODO List

### Phase 1: Fix Task Detection
- [ ] Fix line 698-702 to properly check response type
- [ ] Don't assume `response.tasks` means no synthesis
- [ ] Check for `response.type === 'conversation'` first

### Phase 2: Fix Response Extraction
- [ ] Line 691: Remove `response.description` check (wrong field)
- [ ] Prioritize `response.response` as primary field
- [ ] Log exact structure received from planner for debugging

### Phase 3: Remove Bad Defaults
- [ ] Remove hardcoded FlexiCLI descriptions
- [ ] Throw errors instead of returning generic messages
- [ ] Make failures visible, not hidden

### Phase 4: Testing
- [ ] Run test-query-response.ts
- [ ] Verify actual answer returned, not generic message
- [ ] Test with different query types

## Expected Flow

1. User asks: "what do u know about our work history?"
2. Orchestrator detects information query (✓ WORKING)
3. Retrieves data from memory/git (✓ WORKING)
4. Sends to planner for synthesis (✓ WORKING)
5. Planner returns: `{"type":"conversation","response":"Based on the retrieved information..."}` (✓ WORKING)
6. **FAILURE POINT**: Code incorrectly thinks this is tasks
7. **FAILURE POINT**: Falls back to basic summary instead of extracting response

## The Fix

```typescript
// CRITICAL FIX: Properly detect and extract conversation responses
if (response && typeof response === 'object') {
  // Check for conversation type FIRST
  if (response.type === 'conversation' && response.response) {
    return response.response; // This is the full synthesized answer!
  }

  // Only check for tasks if NOT a conversation
  if (response.type === 'task' && response.tasks && Array.isArray(response.tasks)) {
    console.error('⚠️ Planner returned tasks instead of synthesis');
    // Handle task case...
  }
}
```

## Testing Commands

```bash
# Test the specific query
DEBUG=true npx tsx tests/integration/test-query-response.ts

# Check logs for:
# 1. "Synthesizing response from retrieved information"
# 2. The actual planner response structure
# 3. NO "using basic summary" message
# 4. The FULL synthesized answer
```

## Success Criteria

✅ No "Files created/updated successfully" for questions
✅ No "using basic summary" in logs
✅ Full synthesized answer returned
✅ test-query-response.ts passes ALL checks
✅ ZERO tolerance - ALL issues fixed