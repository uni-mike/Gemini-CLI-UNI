# Dependency Audit Report

## Core Dependencies
- Node.js: >=20.0.0
- TypeScript: 5.0+
- React: Used extensively in UI components

## Key Packages
- **Production**:
  - @lvce-editor/ripgrep (v2.3.0): Fast file search
  - openai (v5.19.1): AI API client
  - simple-git (v3.28.0): Git operations

- **Development**:
  - vitest (v3.2.4): Testing framework
  - eslint (v9.34.0): Code linting
  - prettier (v3.6.2): Code formatting

## Security Notes
- All dependencies are up-to-date
- No known vulnerabilities in package-lock.json

## Recommendations
- Monitor for updates to `node-pty` optional dependencies
- Consider replacing `lodash` with native methods where possible