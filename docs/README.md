# 📚 FlexiCLI Documentation

Welcome to the comprehensive documentation for FlexiCLI - an autonomous AI-driven CLI with advanced multi-agent capabilities.

## 📁 Documentation Structure

### 🏗️ [Architecture](./architecture/)
Core system design and technical implementation details.

- **[MINI_AGENT_ARCHITECTURE.md](./architecture/MINI_AGENT_ARCHITECTURE.md)** - Complete mini-agent system design with Mermaid diagrams
- **[mini-agent-architecture-summary.md](./architecture/mini-agent-architecture-summary.md)** - Quick overview of mini-agent implementation
- **[tracking_mini_agents.md](./architecture/tracking_mini_agents.md)** - Implementation tracking and progress
- **[COMPLETE_INTEGRATION_REPORT.md](./architecture/COMPLETE_INTEGRATION_REPORT.md)** - Full system integration analysis
- **[COMPREHENSIVE_ISSUES_TRACKER.md](./architecture/COMPREHENSIVE_ISSUES_TRACKER.md)** - Issue tracking and resolution log
- **[config-analysis-report.md](./architecture/config-analysis-report.md)** - Configuration system analysis
- **[config-analysis-summary.md](./architecture/config-analysis-summary.md)** - Configuration summary
- **[src-tools-analysis.md](./architecture/src-tools-analysis.md)** - Tools system architecture analysis
- **[src-tools-analysis-summary.md](./architecture/src-tools-analysis-summary.md)** - Tools system summary
- **[src-tools-typescript-summary.md](./architecture/src-tools-typescript-summary.md)** - TypeScript tools implementation

### ✨ [Features](./features/)
Feature specifications and capabilities.

- **[FEATURE_IDEAS.md](./features/FEATURE_IDEAS.md)** - Future feature roadmap and ideas
- **[MINI_AGENTS_SUMMARY.md](./features/MINI_AGENTS_SUMMARY.md)** - Mini-agent capabilities and features

### 🧪 [Test Results](./test-results/)
Comprehensive testing documentation and validation reports.

- **[MINI_AGENT_TEST_RESULTS.md](./test-results/MINI_AGENT_TEST_RESULTS.md)** - Latest mini-agent system test results (10 successful spawns)
- **[REAL_WORLD_TEST_RESULTS.md](./test-results/REAL_WORLD_TEST_RESULTS.md)** - Real-world validation with production scenarios
- **[MINI_AGENT_TEST_REPORT.md](./test-results/MINI_AGENT_TEST_REPORT.md)** - Detailed mini-agent testing report
- **[TEST_RESULTS_SUMMARY.md](./test-results/TEST_RESULTS_SUMMARY.md)** - Overall test results summary
- **[test-report-typescript-analysis.md](./test-results/test-report-typescript-analysis.md)** - TypeScript analysis test results

---

## 🚀 Quick Start

### Running FlexiCLI with Mini-Agents

Use the enhanced `start-clean-agent.sh` script with 8 comprehensive options:

```bash
./start-clean-agent.sh
```

**Options:**
1. Simple test (single command)
2. Complex test (multi-step task)
3. Interactive mode (full debugging) - supports mini-agents
4. Interactive mode (clean) - supports mini-agents
5. Custom prompt
6. **Mini-agent test** (specialized delegation)
7. **Advanced mini-agent workflow** (complex task delegation)
8. **Mini-agent validation** (test all agent types)

### Testing Mini-Agent System

Run the comprehensive test suite:

```bash
npx tsx tests/mini-agent/test-big-task-advanced.ts
```

---

## 🎯 Key Achievements

### Mini-Agent System
- ✅ **7 specialized agent types**: search, migration, analysis, refactor, test, documentation, general
- ✅ **Sophisticated task analysis** with complexity detection
- ✅ **Dependency-based execution** with parallel optimization
- ✅ **Context scoping** and memory isolation
- ✅ **Real API integration** with DeepSeek (35,000+ tokens processed)
- ✅ **10 successful mini-agent spawns** in production tests

### Core Architecture
- ✅ **Orchestrator-Planner-Executor trio** pattern
- ✅ **15 integrated tools** with dynamic discovery
- ✅ **Database persistence** with Prisma/SQLite
- ✅ **Git context awareness** with 23+ commits
- ✅ **Memory management** with chunking and embeddings
- ✅ **Session management** and recovery

### Production Readiness
- ✅ **100% test success rate** across all scenarios
- ✅ **Zero recursion issues** or memory leaks
- ✅ **Real-world validation** completed
- ✅ **Enhanced user experience** with comprehensive CLI options
- ✅ **Professional documentation** and test coverage

---

## 🔧 System Components

### Core Trio
- **Orchestrator** (`src/core/orchestrator.ts`) - Main coordination with `executeAsAgent` method
- **Planner** (`src/core/planner.ts`) - Task planning and strategy
- **Executor** (`src/core/executor.ts`) - Task execution with tools

### Mini-Agent System
- **AgentSpawner** (`src/mini-agent/core/agent-spawner.ts`) - Agent creation and management
- **Agent Types** (`src/mini-agent/core/types.ts`) - TypeScript interfaces and types
- **Agent Templates** - 7 pre-configured specialized agents

### Infrastructure
- **Memory Manager** (`src/memory/memory-manager.ts`) - Context and memory management
- **Tool Discovery** (`src/tools/auto-discovery.ts`) - Dynamic tool loading
- **Database** (`src/memory/shared-database.ts`) - Shared database management
- **Config** (`src/config/Config.ts`) - Configuration management

---

## 📊 Latest Test Results

### Mini-Agent Validation (2025-09-16)
- **10 agents spawned** successfully
- **5 agent types** tested (search, analysis, refactor, test, documentation)
- **~90 seconds** total execution for complex tasks
- **35,000+ tokens** processed
- **Zero failures** or timeout issues

See [MINI_AGENT_TEST_RESULTS.md](./test-results/MINI_AGENT_TEST_RESULTS.md) for complete details.

---

## 🗺️ Navigation

- [Back to Root README](../README.md)
- [Architecture Documentation](./architecture/)
- [Feature Documentation](./features/)
- [Test Results](./test-results/)
- [Test Suite](../tests/)

---

*Documentation last updated: 2025-09-16*
*FlexiCLI Version: Enhanced with Mini-Agent System*