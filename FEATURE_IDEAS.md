# FlexiCLI Feature Ideas & TODOs

## Mini-Agent Architecture (TODO)

**Concept**: When complex actions need to be performed on multiple destinations or require specialized focus, FlexiCLI can ad-hoc create its own mini "agents" with:
- **Specific prompts** tailored to the subtask
- **Specific tasks** scoped to particular operations
- **Specific focused context data** relevant only to that subtask

**Benefits**:
- More effective work through specialized focus
- Better resource allocation per subtask
- Reduced context pollution in main agent

**Requirements**:
- ✅ Mini-agents must be **ephemeral** (temporary, destroyed after task completion)
- ✅ All states/results must be **passed back to main FlexiCLI** for:
  - Tracking
  - Logging
  - History maintenance
  - Session persistence
- ✅ No persistent state in mini-agents
- ✅ Main FlexiCLI remains the single source of truth

**Implementation Considerations**:
- Mini-agents spawn from main orchestrator
- Inherit memory context but with focused scope
- Report back to main agent's memory system
- Use same tool registry but with restricted access if needed
- Maintain parent-child relationship for audit trails

**Status**: Concept phase - needs architecture design