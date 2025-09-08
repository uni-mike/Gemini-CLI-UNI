# Dependency Audit Report

## Core Dependencies
- @lvce-editor/ripgrep: Used for fast file searching
- dotenv: Environment variable management
- openai: Official OpenAI client library
- simple-git: Git command abstraction
- strip-ansi: Remove ANSI escape codes

## Development Dependencies
- @types/*: Type definitions
- vitest: Testing framework
- eslint: Code linting
- prettier: Code formatting
- esbuild: JavaScript bundler

## Optional Dependencies
- node-pty: Terminal emulation (platform-specific)

## Recommendations
- Review optional node-pty usage
- Update all dependencies to latest versions
- Consider replacing simple-git with isomorphic-git for pure JS