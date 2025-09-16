#!/bin/bash

echo "Testing token tracking to database..."

# Run a simple test
DEBUG=true ENABLE_MONITORING=false APPROVAL_MODE=yolo npx tsx src/cli.tsx --prompt "create file test.txt with content 'test'" --non-interactive 2>&1 | tee test-token-output.log

# Look for token tracking in output
echo -e "\n=== Token Tracking Output ==="
grep -E "(Token usage|updateSessionTokens|Checking token|hasMemoryManager)" test-token-output.log || echo "No token tracking found in output"

# Check database
echo -e "\n=== Database Check ==="
sqlite3 .flexicli/flexicli.db "SELECT id, substr(id,1,8) as short_id, tokensUsed FROM Session ORDER BY startedAt DESC LIMIT 5;"

echo -e "\n=== Test Complete ==="