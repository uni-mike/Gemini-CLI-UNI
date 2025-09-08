# TODO List

## packages/cli/src/config/config.ts
- Line 340: Consider if App.tsx should get memory via a server call or if Config should refresh itself.
- Line 412: This is a bit of a hack. The contextFileName should ideally be passed

## packages/cli/src/config/extension.ts
- Line 335: Download the archive instead to avoid unnecessary .git info.
## packages/cli/src/ui/commands/initCommand.ts
- Line 78: Document key commands for building/running/testing

## packages/cli/src/ui/commands/types.ts
- Line 28: Ensure config is never null
- Line 183: Remove args parameter

## packages/cli/src/ui/hooks/slashCommandProcessor.ts
- Line 283: Improve two-pass architecture

## packages/cli/src/utils/package.ts
- Line 32: Bubble up errors

## packages/core/src/config/config.d.ts
- Line 274: Placeholder implementation

## packages/core/src/config/config.ts
- Line 665: Placeholder implementation

## packages/core/src/core/deepSeekWithTools.ts
- Line 617: Use search tools for patterns/TODOs

## packages/core/src/core/prompts.ts
- Line 355: Refactor remaining files
- Line 356: Update tests

## packages/core/src/core/subagent.d.ts
- Line 98: Support 'auto' routing
- Line 115: Add max_tokens budgeting

## packages/core/src/core/subagent.ts
- Line 121: Support 'auto' routing
- Line 139: Add max_tokens budgeting

## packages/core/src/ide/ide-client.ts
- Line 500: Use CLI version
- Line 534: Use CLI version

## packages/core/src/tools/edit.ts
- Line 293: Handle race condition

## packages/core/src/tools/read-many-files.ts
- Line 98: Make configurable via CLI

## packages/core/src/tools/smart-edit.ts
- Line 552: Handle race condition

## packages/core/src/utils/bfsFileSearch.ts
- Line 12: Integrate robust logger

## packages/core/src/utils/ignorePatterns.ts
- Line 167: Implement getCustomExcludes
- Line 202: Implement getCustomExcludes

## packages/core/src/utils/memoryDiscovery.ts
- Line 20: Integrate robust logger