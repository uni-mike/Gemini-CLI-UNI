# TODO Items in Codebase

## packages/cli/src/config/config.ts
- Line 340: Consider if App.tsx should get memory via a server call
- Line 412: ContextFileName should be passed differently

## packages/cli/src/config/extension.ts
- Line 335: Download archive instead of cloning to avoid .git info

## packages/cli/src/ui/commands/initCommand.ts
- Line 78: Document build/run commands from package.json

## packages/cli/src/ui/commands/types.ts
- Line 28: Ensure config is never null
- Line 183: Remove args parameter

## packages/cli/src/ui/hooks/slashCommandProcessor.ts
- Line 283: Refactor two-pass processing

## packages/cli/src/utils/package.ts
- Line 32: Bubble up errors

## packages/core/src/config/config.d.ts
- Line 274: Improve placeholder implementation

## packages/core/src/config/config.ts
- Line 665: Improve placeholder implementation

## packages/core/src/core/deepSeekWithTools.ts
- Line 618: Find patterns/TODOs/issues

## packages/core/src/core/prompts.ts
- Line 355: Refactor remaining files
- Line 356: Update tests for API changes

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
- Line 20: Integrate server-side logger