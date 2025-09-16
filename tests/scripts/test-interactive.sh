#!/bin/bash

# Test interactive approval flow
# This script uses expect to simulate user input

cat << 'EOF' > /tmp/test-interactive.exp
#!/usr/bin/expect -f

set timeout 30

# Start the CLI in strict mode
spawn env APPROVAL_MODE=strict DEBUG=true npx tsx src/cli.tsx --prompt "run echo hello"

# Wait for approval prompt
expect {
    "Your choice" {
        send "1"
    }
    timeout {
        puts "Timeout waiting for approval prompt"
        exit 1
    }
}

# Wait for completion
expect {
    "Task completed successfully" {
        puts "\n✅ Interactive approval test passed!"
    }
    "Error" {
        puts "\n❌ Task failed after approval"
        exit 1
    }
    timeout {
        puts "\n❌ Timeout after approval"
        exit 1
    }
}

expect eof
EOF

# Check if expect is available
if command -v expect &> /dev/null; then
    echo "Running interactive approval test with expect..."
    chmod +x /tmp/test-interactive.exp
    /tmp/test-interactive.exp
else
    echo "❌ 'expect' command not found. Install it with: brew install expect"
    echo ""
    echo "For manual testing in truly interactive mode:"
    echo "1. Open a new terminal"
    echo "2. Run: APPROVAL_MODE=strict npx tsx src/cli.tsx --prompt \"run echo hello\""
    echo "3. When prompted, press '1' to approve"
    echo ""
    echo "The approval prompt should appear and wait for your input."
fi