#!/bin/bash

echo "=== Testing Monitoring Recent Executions Fix ==="
echo

# Check if monitoring is running
echo "1. Checking monitoring server..."
curl -s http://localhost:4000/api/health | python3 -c "import json, sys; data=json.load(sys.stdin); print('   Server status:', data.get('status', 'not running'))"
echo

# Check tools API
echo "2. Checking tools API data..."
TOOLS_RESPONSE=$(curl -s http://localhost:4000/api/tools)
echo "$TOOLS_RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
tools = data.get('tools', [])
recent = data.get('recentExecutions', [])
print(f'   Tools with executions: {len([t for t in tools if t[\"executions\"] > 0])}')
print(f'   Recent executions count: {len(recent)}')
if recent:
    print('   Sample recent execution:')
    exec = recent[0]
    print(f'     - Tool: {exec.get(\"tool\")}')
    print(f'     - Success: {exec.get(\"success\")}')
    print(f'     - Duration: {exec.get(\"duration\")}ms')
    print(f'     - Timestamp: {exec.get(\"timestamp\")}')
"
echo

# Check database for executions
echo "3. Checking database ExecutionLog table..."
sqlite3 .flexicli/flexicli.db "SELECT tool, COUNT(*) as count FROM ExecutionLog GROUP BY tool;" 2>/dev/null | column -t -s '|'
echo

echo "=== Test Complete ==="
echo "The recent executions should now be visible in the Tools modal when clicking on a tool."