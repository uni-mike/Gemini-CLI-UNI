#!/bin/bash

echo "🔧 Fixing ESM import paths in TypeScript files..."

# Find all TypeScript files with relative imports and fix them
find src -name "*.ts" -o -name "*.tsx" | while read file; do
    if grep -q "from '\\./" "$file"; then
        echo "Fixing imports in: $file"
        # Replace relative imports without .js extension with .js extension
        sed -i '' "s/from '\\.\/\([^']*\)'/from '.\\/\\1.js'/g" "$file"
        sed -i '' "s/from '\\.\\.\\/\([^']*\)'/from '..\\/\\1.js'/g" "$file"
    fi
done

echo "✅ Import paths fixed! Recompiling..."
npx tsc

echo "🧪 Testing compilation..."
if [ -f "dist/cli-trio.js" ]; then
    echo "✅ Compilation successful!"
else
    echo "❌ Compilation failed!"
    exit 1
fi