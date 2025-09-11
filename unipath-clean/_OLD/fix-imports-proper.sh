#!/bin/bash

echo "🔧 Properly fixing ESM import paths..."

# First, restore the files by removing incorrect .js.js extensions
find src -name "*.ts" -o -name "*.tsx" | while read file; do
    if grep -q "\.js\.js'" "$file"; then
        echo "Removing double extensions from: $file"
        sed -i '' "s/\.js\.js'/.js'/g" "$file"
    fi
done

# Now properly fix the import paths
find src -name "*.ts" -o -name "*.tsx" | while read file; do
    echo "Processing: $file"
    # Fix relative imports that don't already have .js extension
    sed -i '' "s/from '\(\.\.\/[^']*\)'/from '\\1.js'/g" "$file"
    sed -i '' "s/from '\(\.\/[^']*\)'/from '\\1.js'/g" "$file"
    # Fix any double .js.js that may have been created
    sed -i '' "s/\.js\.js'/.js'/g" "$file"
done

echo "✅ Fixed import paths. Compiling..."
npx tsc