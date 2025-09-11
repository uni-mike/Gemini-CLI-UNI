# TODO: FlexiCLI Memory & Token Management

## Token Budgets
- direct:  max_tokens=1000,  reasoning<=200
- concise: max_tokens=6000,  reasoning<=5000
- deep:    max_tokens=15000, reasoning<=12000

## Assumptions
- [x] Using gpt-tokenizer for token counting (fallback to char/4 approximation)
- [x] Default to concise mode when not specified
- [x] Prisma SQLite for persistence (file:./.flexicli/flexicli.db)
- [x] LRU cache TTL set to 15 minutes for ephemeral data
- [x] Session considered crashed if older than 1 hour
- [x] Git history limited to 200 commits by default
- [x] Embedding cache uses SHA256 hashing for deduplication
- [x] Project ID generated from SHA256 of project root path

## Memory Layers
- Ephemeral (session): LRU cache, ~5k tokens, checkpointed to .flexicli/sessions
- Persistent (project): SQLite + embeddings, ≤40k retrieval
- Knowledge: SQLite summary ≤2k tokens
- Execution: logs tied to files/commits
- Git Context: commit msg+diff embedded per file/hunk

## Embeddings (.env)
- EMBEDDING_API_KEY (Azure OpenAI)
- EMBEDDING_API_ENDPOINT (Azure endpoint)
- EMBEDDING_API_DEPLOYMENT (text-embedding-3-large)
- EMBEDDING_API_MODEL_NAME (text-embedding-3-large)
- EMBEDDING_API_API_VERSION (2024-02-01)

## Session Strategy
- session_id (UUID v4), mode, budgets, last retrieval fingerprints
- snapshot every N=3 ops and on successful patch
- max 20 snapshots (FIFO cleanup)
- auto-restore latest on startup if previous crashed
- sessions older than 7 days auto-cleaned

## Retrieval Heuristics
- K=12 initial, expand up to K=30 if within budget
- dedupe by path+hash+linespan
- recency boost: exp(-age/7) * 0.2
- proximity boost: 0.3 for focus files
- min similarity threshold: 0.7

## Chunking Strategy
- Code: 300-800 tokens, 100 token overlap
- Docs: 400-800 tokens, 50 token overlap
- Diffs: max 500 tokens per file, 3 context lines

## Project Isolation
- Detection: Git root preferred, fallback to CWD
- Structure: .flexicli/{db, cache, sessions, logs, checkpoints}
- Absolute isolation: no cross-project data access
- Cache cleanup: files older than 7 days
- Log rotation: max 10 files or 50MB total

## Open Issues
- [ ] AST-based code chunking with @babel/parser integration
- [ ] Tree-sitter integration for non-JS languages
- [ ] Commit hash tagging & file-chunk linkage optimization
- [ ] Multi-file diff application reliability testing
- [ ] DB vacuum & index performance tuning
- [ ] Snapshot compression for large ephemeral states
- [ ] Streaming token counting for real-time budget tracking
- [ ] Fallback to keyword search when embeddings API fails
- [ ] Progressive retrieval expansion based on query complexity
- [ ] Knowledge layer importance scoring refinement

## Implementation Status
- [x] Token budget constants and manager
- [x] Project isolation manager
- [x] Embeddings manager with Azure OpenAI
- [x] Ephemeral memory layer with LRU cache
- [x] Persistent retrieval layer with vector search
- [x] Git context layer with commit parsing
- [x] Session management with crash recovery
- [x] Memory manager orchestration
- [x] Basic monitoring system (autonomous)
- [x] **CRITICAL: Fix monitoring event wiring** ✅ DONE
- [x] Remove mock data from management interface ✅ DONE
- [ ] Integration with existing orchestrator
- [ ] Testing and validation
- [ ] Performance optimization

## CRITICAL MONITORING FIXES (Priority 1)

### Issue: Monitoring shows no real data
**Root Cause:** Event wiring between orchestrator/tools and monitoring is broken

### Fix Plan (Wire One by One):
1. [x] **Fix Tool Execution Events** ✅ DONE
   - [x] Verify orchestrator emits 'tool-execute' and 'tool-result' events
   - [x] Add debug logging to track event flow
   - [x] Ensure monitoring-bridge captures tool events correctly
   - [x] Persist ExecutionLog entries to database
   - [x] Test: Run CLI with tools, verify logs in DB

2. [x] **Fix Token Tracking** ✅ DONE
   - [x] Wire DeepSeek token usage to orchestrator
   - [x] Capture token-usage events in monitoring bridge
   - [x] Update session records with actual token counts
   - [x] Add updateSessionTokens method to metrics collector
   - Note: DeepSeek API doesn't always return usage data for simple queries

3. [x] **Fix Active Tasks Counter** ✅ DONE
   - [x] Sessions now properly tracked in database
   - [x] Active status reflects running CLI processes
   - [x] Counter updates based on session status
   - [x] Test: Sessions API shows active/completed status

4. [x] **Fix Session Status Updates** ✅ DONE
   - [x] Added cleanup() call before process.exit in CLI
   - [x] Sessions marked 'completed' when CLI exits
   - [x] endSession() called in MemoryManager cleanup
   - [x] Test: Sessions properly close on exit

5. [ ] **Add Real-Time Updates**
   - [ ] Emit WebSocket events for tool executions
   - [ ] Push token updates in real-time
   - [ ] Stream execution logs to UI
   - [ ] Test: Watch UI update live during CLI run

### Testing Protocol:
```bash
# Test each fix individually:
1. Run: DEBUG=true ./start-clean.sh --prompt "create test.txt with 'hello'" --non-interactive
2. Check: curl http://localhost:4000/api/logs (should show tool execution)
3. Check: curl http://localhost:4000/api/sessions (should show tokens > 0)
4. Check: UI at http://localhost:4000 (should show real data)
```

## Next Actions (Priority 2)
1. Integrate MemoryManager into existing Orchestrator
2. Update DeepSeekClient to respect token budgets
3. Add chunking system for existing tools
4. Implement knowledge extraction from user interactions
5. Add execution feedback tracking
6. Create migration path for existing memory.ts users
7. Add comprehensive error handling and fallbacks
8. Performance benchmarking with large codebases
9. Add telemetry for token usage tracking
10. Create admin CLI for memory management