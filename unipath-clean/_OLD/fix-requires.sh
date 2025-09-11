#!/bin/bash

# Fix require() in project-manager.ts
sed -i '' "1s/^/import * as crypto from 'crypto';\n/" src/memory/project-manager.ts
sed -i '' "s/import { existsSync, mkdirSync, readFileSync, writeFileSync }/import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync, rmSync }/" src/memory/project-manager.ts
sed -i '' "s/const crypto = require('crypto');//g" src/memory/project-manager.ts
sed -i '' "s/const fs = require('fs');//g" src/memory/project-manager.ts
sed -i '' "s/fs\.readdirSync/readdirSync/g" src/memory/project-manager.ts
sed -i '' "s/fs\.statSync/statSync/g" src/memory/project-manager.ts
sed -i '' "s/fs\.unlinkSync/unlinkSync/g" src/memory/project-manager.ts
sed -i '' "s/fs\.rmSync/rmSync/g" src/memory/project-manager.ts

# Fix git-context.ts for undefined trim
sed -i '' "s/commit\.message\.trim()/commit\.message\?\.\trim() || ''/g" src/memory/layers/git-context.ts

echo "Fixed all require() and undefined issues"