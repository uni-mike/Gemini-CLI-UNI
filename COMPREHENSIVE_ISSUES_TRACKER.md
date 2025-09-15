# FlexiCLI - Comprehensive Issues Tracker

## 📋 Issue Categories

### 🔴 Critical Issues (System Breaking)
### 🟡 Important Issues (Feature Impacting)
### 🔵 Minor Issues (Quality of Life)
### 🟢 Enhancements (Nice to Have)

---

## 🔴 Critical Issues

### ✅ Issue C-001: Database Connection Failures
**Status**: RESOLVED
**Impact**: System cannot start without database
**Solution**: Implemented SharedDatabaseManager singleton pattern
**Files Modified**: `src/memory/shared-database.ts`

### ✅ Issue C-002: Agent Lock Race Conditions
**Status**: RESOLVED
**Impact**: Multiple agents could corrupt database
**Solution**: Per-project PID-based locking with `.flexicli/agent.lock`
**Files Modified**: `src/memory/agent-lock.ts`

### ✅ Issue C-003: Token Tracking Broken
**Status**: FALSE ALARM - Working correctly
**Impact**: Would break usage monitoring
**Evidence**: Database shows proper token counts (2788, 2679, 2457)

---

## 🟡 Important Issues

### ✅ Issue I-001: Duplicate README Files
**Status**: RESOLVED
**Impact**: Documentation confusion
**Solution**: Removed `docs/README.md`, kept root README only

### ✅ Issue I-002: Mermaid Chart Syntax Error
**Status**: RESOLVED
**Impact**: Broken documentation visualization
**Solution**: Removed parentheses from edge labels, improved color scheme

### ⚠️ Issue I-003: Empty Cache Table
**Status**: BY DESIGN - Not a bug
**Impact**: No embeddings cached for simple tasks
**Explanation**: Embeddings are demand-driven, only generated when retrieval layers are queried

### ✅ Issue I-004: Obsolete Directory References
**Status**: RESOLVED
**Impact**: ENOENT errors for `.flexicli/cache` directory
**Solution**: Deprecated filesystem cache, moved to database-only

### ✅ Issue I-005: Embedding Generation Architecture Clarified
**Status**: RESOLVED - Working as Designed
**Impact**: Cache table remains empty for simple tasks
**Root Cause Analysis**:
- RetrievalLayer IS being called (memory-manager.ts:259)
- Embeddings ARE generated for queries (retrieval.ts:138)
- BUT: No chunks exist in database to retrieve (Chunks table = 0 records)
- Cache persistence only happens every 5 minutes or on shutdown
**Architecture Findings**:
- Embeddings are demand-driven, not proactive
- Cache table only stores embeddings when RetrievalLayer processes chunks
- Without chunks to index, only query embeddings are generated (cached in-memory)
**Solution**: This is expected behavior. To populate cache:
1. Need to store code chunks via `retrieval.storeChunk()`
2. Wait for 5-minute persist interval or shutdown gracefully
3. For testing, can force persistence via `(cacheManager as any).persistCache()`

### ❌ Issue I-006: No API Documentation
**Status**: NOT STARTED
**Impact**: Users don't know available endpoints
**Next Steps**: Create comprehensive API docs

---

## 🔵 Minor Issues

### ✅ Issue I-007: Misplaced Database Directory (prisma/.flexicli)
**Status**: RESOLVED
**Impact**: Creates .flexicli in wrong location when run from subdirectories
**Root Cause**: FilePersistenceManager used `process.cwd()` instead of git root
**Solution**: Fixed FilePersistenceManager to find git root (src/persistence/FilePersistenceManager.ts:78-91)

### ❌ Issue M-001: Background Processes Not Cleaning Up
**Status**: PARTIAL FIX
**Impact**: Resource consumption over time
**Solution**: Manual cleanup implemented, need automatic cleanup

### ❌ Issue M-002: Log Rotation Not Automatic
**Status**: NOT STARTED
**Impact**: Log files grow indefinitely
**Next Steps**: Implement automatic log rotation

### ❌ Issue M-003: No Performance Metrics Dashboard
**Status**: NOT STARTED
**Impact**: Can't monitor system performance
**Next Steps**: Create metrics collection and visualization

### ❌ Issue M-004: Missing Unit Tests
**Status**: NOT STARTED
**Impact**: Can't verify individual component behavior
**Coverage**: 0% - No test files exist

### ❌ Issue M-005: No CI/CD Pipeline
**Status**: NOT STARTED
**Impact**: Manual testing and deployment
**Next Steps**: Set up GitHub Actions

---

## 🟢 Enhancements

### ❌ Issue E-001: Add Multi-Language Support
**Status**: NOT STARTED
**Impact**: English only
**Languages Needed**: Spanish, Chinese, Japanese

### ❌ Issue E-002: Add Web UI Dashboard
**Status**: NOT STARTED
**Impact**: CLI only interface
**Tech Stack**: React + Material-UI suggested

### ❌ Issue E-003: Add Voice Input Support
**Status**: NOT STARTED
**Impact**: Text only input
**Integration**: Whisper API suggested

### ❌ Issue E-004: Add Export Formats
**Status**: NOT STARTED
**Impact**: Can't export conversation history
**Formats**: PDF, Markdown, JSON

### ❌ Issue E-005: Add Theme Customization
**Status**: NOT STARTED
**Impact**: Fixed color scheme
**Options**: Light/Dark/Custom themes

---

## 📊 Issue Statistics

| Category | Total | Resolved | In Progress | Not Started |
|----------|-------|----------|-------------|-------------|
| Critical | 3     | 3        | 0           | 0           |
| Important| 7     | 6        | 0           | 1           |
| Minor    | 5     | 0        | 1           | 4           |
| Enhancement | 5  | 0        | 0           | 5           |
| **TOTAL**| **20**| **9**    | **1**       | **10**      |

**Completion Rate**: 45% (9/20)

---

## 🎯 Priority Queue

1. **Issue I-006**: Create API documentation
2. **Issue M-004**: Add unit tests
3. **Issue M-001**: Implement automatic cleanup for background processes
4. **Issue M-002**: Implement log rotation
5. **Issue M-003**: Add performance metrics dashboard

---

## 📝 Notes

- Cache table being empty is EXPECTED for simple tasks (demand-driven architecture)
- Embeddings only persist after 5-minute interval or graceful shutdown
- Token tracking is WORKING correctly (false alarm)
- All critical issues have been resolved ✅
- Misplaced database directory fixed (git root detection)
- 10 issues remain unaddressed (50%)
- Focus should shift to documentation and testing

Last Updated: 2025-09-15