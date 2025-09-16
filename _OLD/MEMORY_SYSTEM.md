# FlexiCLI Memory Management System

## Overview

FlexiCLI now includes a **robust context memory management system** with **strict token budgeting** and **safe persistence**. The system is designed to handle complex, continuous coding projects with minimal hallucinations and predictable costs/performance.

## Key Features

### 🎯 Strict Token Budgeting
- **Hard limits enforced**: 128K input, 32K output
- **Three operating modes**:
  - `direct`: 1000 tokens max, minimal reasoning
  - `concise`: 6000 tokens max, balanced approach
  - `deep`: 15000 tokens max, comprehensive analysis
- **Smart allocation** across memory layers
- **Real-time tracking** and overflow prevention

### 🗄️ Per-Project Isolation
- **Absolute isolation**: Each project has its own `.flexicli/` directory
- **No cross-contamination**: Data never leaks between projects
- **Automatic detection**: Uses Git root or current directory
- **Clean structure**:
  ```
  .flexicli/
  ├── flexicli.db        # SQLite database
  ├── meta.json          # Project metadata
  ├── cache/             # Transient caches
  ├── sessions/          # Session snapshots
  ├── logs/              # Execution logs
  └── checkpoints/       # Manual checkpoints
  ```

### 🧠 Five Memory Layers

1. **Ephemeral Memory** (5K tokens)
   - Recent conversation turns
   - Working context and diffs
   - LRU cache with 15-minute TTL
   - Session-scoped, persisted for recovery

2. **Persistent Retrieval** (40K tokens)
   - Chunked code, docs, and diffs
   - Vector similarity search with Azure OpenAI embeddings
   - Smart ranking with recency and proximity boosts
   - SQLite-backed with float32 embeddings

3. **Knowledge Layer** (2K tokens)
   - Project preferences and conventions
   - Architecture notes
   - Importance-scored entries
   - Persistent across sessions

4. **Execution Feedback**
   - Compiler/test/log outputs
   - Tied to files and commits
   - Auto-expiring old entries
   - Helps avoid repeating errors

5. **Git Context**
   - Parsed commit history (last 200 commits)
   - Embedded commit messages
   - Diff summaries per file
   - Semantic search across history

### 🔄 Session Management & Recovery
- **Automatic crash recovery**: Restores from latest snapshot
- **Checkpoint every 3 operations**: Minimal data loss
- **Session lifecycle tracking**: Active, completed, or crashed
- **FIFO cleanup**: Keeps last 20 snapshots
- **Zero-question recovery**: Conservative defaults recorded

### 🔍 Smart Retrieval
- **Cosine similarity search** with embeddings
- **Progressive expansion**: Start with K=12, expand to K=30
- **Multi-factor ranking**:
  - Semantic similarity (0.7 threshold)
  - Recency boost (exponential decay over 7 days)
  - Proximity boost (0.3 for focus files)
- **Token-aware trimming**: Fits within budget

### 🔐 Azure Integration
- **Azure AI Foundry**: DeepSeek-R1-0528 inference
- **Azure OpenAI Embeddings**: text-embedding-3-large
- **Environment configuration**: All secrets in `.env`
- **Fallback strategies**: Keyword search when API fails

## Usage

### Basic Integration

```typescript
import { MemoryManager } from './memory/memory-manager.js';

// Initialize in your orchestrator
const memory = new MemoryManager('concise');
await memory.initialize();

// Build prompt with context
const prompt = await memory.buildPrompt(userQuery, {
  focusFiles: ['src/tools/bash.ts'],
  includeExplanation: true
});

// Get formatted messages for LLM
const messages = memory.formatMessages(prompt);

// Track responses
memory.addAssistantResponse(response);

// Store learned knowledge
await memory.storeKnowledge('lint_command', 'npm run lint', 'convention');

// Save important checkpoints
await memory.saveSnapshot('completed feature X');

// Clean up
await memory.cleanup();
```

### Configuration

Update your `.env` file:

```env
# DeepSeek Configuration (existing)
API_KEY=your_api_key
ENDPOINT=https://your-endpoint.ai.azure.com/models
API_VERSION=2024-05-01-preview
MODEL=DeepSeek-R1-0528

# Embeddings Configuration (new)
EMBEDDING_API_KEY=your_embedding_key
EMBEDDING_API_ENDPOINT=https://your-endpoint.openai.azure.com/
EMBEDDING_API_MODEL_NAME=text-embedding-3-large
EMBEDDING_API_DEPLOYMENT=text-embedding-3-large
EMBEDDING_API_API_VERSION=2024-02-01
```

### Operating Modes

Choose the appropriate mode based on task complexity:

```typescript
// Quick responses, minimal reasoning
memory.setMode('direct');

// Balanced approach (default)
memory.setMode('concise');

// Complex analysis and refactoring
memory.setMode('deep');
```

## Architecture

### Token Flow
```
Input Budget (128K total):
├── Query (2K)
├── Ephemeral Context (5K)
├── Knowledge Summary (2K)
├── Retrieved Chunks (40K)
└── Safety Buffer (10K)
    
Output Budget (32K total):
├── Reasoning (5K) - hidden by default
├── Code Generation (12K)
├── Explanation (1K) - optional
└── Safety Buffer (2K)
```

### Chunking Strategy
- **Code**: AST-aware, 300-800 tokens, 100 token overlap
- **Documentation**: Heading-based, 400-800 tokens
- **Diffs**: Per-file, max 500 tokens, preserves context

### Retrieval Pipeline
1. Generate query embedding
2. Search similar chunks (cosine similarity)
3. Apply ranking boosts (recency, proximity)
4. Filter by threshold (0.7 default)
5. Deduplicate by path+hash+linespan
6. Trim to fit token budget
7. Format for prompt injection

## Performance Considerations

- **Embedding cache**: SHA256-based deduplication
- **Batch operations**: Reduces API calls
- **Progressive loading**: Expands retrieval as needed
- **Smart trimming**: Preserves most relevant content
- **Background tasks**: Git parsing, cleanup
- **SQLite optimizations**: WAL mode, auto-vacuum

## Troubleshooting

### Common Issues

1. **Token overflow**
   - Check TODO.md for recorded trade-offs
   - Reduce retrieval K value
   - Switch to more restrictive mode

2. **Embedding API failures**
   - System falls back to keyword search
   - Check API credentials in .env
   - Monitor rate limits

3. **Session recovery issues**
   - Check .flexicli/sessions/ for snapshots
   - Review TODO.md for recovery notes
   - Manual recovery: delete .flexicli/flexicli.db

4. **Cross-project contamination**
   - Never happens (absolute isolation)
   - Each project has unique ID (SHA256 of path)
   - Check .flexicli/meta.json for project info

## Maintenance

### Regular Tasks
- **Automatic**: Cache cleanup (7 days), log rotation (10 files/50MB)
- **Manual**: Database vacuum, checkpoint creation
- **Monitoring**: Token usage via `memory.getTokenReport()`

### Database Management
```bash
# View database size
du -h .flexicli/flexicli.db

# Clean old sessions manually
sqlite3 .flexicli/flexicli.db "DELETE FROM Session WHERE startedAt < date('now', '-30 days')"

# Optimize database
sqlite3 .flexicli/flexicli.db "VACUUM"
```

## Future Enhancements

See `TODO.md` for planned improvements:
- AST-based chunking optimization
- Multi-language support via tree-sitter
- Streaming token counting
- Progressive retrieval strategies
- Knowledge importance refinement
- Telemetry and analytics

## Migration from Old System

If you're using the old `memory.ts`:
1. The new system is backward compatible for basic operations
2. Old memory files (.unipath-memory.json) remain untouched
3. New system uses .flexicli/ directory exclusively
4. Run both in parallel during transition

## Support

For issues or questions:
- Check TODO.md for assumptions and decisions
- Review .flexicli/logs/ for execution history
- Enable DEBUG=true for verbose output
- File issues with .flexicli/meta.json contents