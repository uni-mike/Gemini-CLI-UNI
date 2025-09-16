#!/bin/bash

echo "Testing UNIPATH CLI IDE Integration with PyCharm"
echo "================================================"
echo ""

# Check if the MCP server is running
echo "1. Checking if MCP server is running on port 62325..."
if curl -s http://localhost:62325/health | grep -q "mcp.*true"; then
    echo "✅ MCP server is running and supports MCP protocol"
else
    echo "❌ MCP server not running or doesn't support MCP"
fi

echo ""
echo "2. Checking for IDE config file..."
# Get PyCharm process ID
PYCHARM_PID=$(ps aux | grep -i "pycharm" | grep -v grep | head -1 | awk '{print $2}')
if [ -n "$PYCHARM_PID" ]; then
    echo "   PyCharm PID: $PYCHARM_PID"
    CONFIG_FILE="/tmp/gemini-ide-server-${PYCHARM_PID}.json"
    if [ -f "$CONFIG_FILE" ]; then
        echo "✅ Config file exists: $CONFIG_FILE"
        cat "$CONFIG_FILE"
    else
        echo "⚠️  Config file not found at: $CONFIG_FILE"
    fi
else
    echo "❌ PyCharm not running"
fi

echo ""
echo "3. Testing UNIPATH CLI connection..."
export PYCHARM_HOSTED=1
export JETBRAINS_IDE=1
export UNIPATH_CLI_IDE_SERVER_PORT=62325

# Test with a simple prompt
echo "test" | npm run start -- --prompt "Say 'IDE connection successful' if you can connect to the IDE" 2>&1 | grep -E "(IDE|connection|successful|Failed to connect)"

echo ""
echo "Test complete!"