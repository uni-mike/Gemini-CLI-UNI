#!/bin/bash

# Start UNIPATH CLI with PyCharm IDE support
# The JetBrains plugin listens on port 62325

export PYCHARM_HOSTED=1
export JETBRAINS_IDE=1
export UNIPATH_CLI_IDE_SERVER_PORT=62325

echo "Starting UNIPATH CLI with PyCharm support..."
echo "Note: The current JetBrains plugin (v1.0.0) has limited functionality."
echo "Full IDE integration requires updating the plugin to support MCP protocol."
echo ""

npm run start "$@"