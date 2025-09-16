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
  - Users messages notifications to main UI of mini agents activities to show progress
- ✅ No persistent state in mini-agents
- ✅ Main FlexiCLI remains the single source of truth

**Implementation Considerations**:
- Mini-agents spawn from main orchestrator
- Inherit memory context but with focused scope
- Report back to main agent's memory system
- Use same tool registry but with restricted access if needed
- Maintain parent-child relationship for audit trails


--------------------------------------------------------------------------------------
⏺ Now let me update the normalization service using the specialized agent:

  normalization-service(Migrate normalization service sourceId to targetId)
  ⎿ Search(pattern: "storeArtifacts", path: "packages/shared", output_mode: "content")
     Found 22 lines (ctrl+o to expand)
     +48 more tool uses
--------------------------------------------------------------------------------------

**Status**: Concept phase - needs architecture design

The output of FlexiCLI when working with mini agents should look something like:



