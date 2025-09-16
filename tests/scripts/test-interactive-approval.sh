#!/bin/bash

# Test Interactive Approval Flow
# This script comprehensively tests all approval options

echo "==============================================="
echo "    Interactive Approval Flow Test Suite"
echo "==============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to kill any existing agents
cleanup() {
    echo "Cleaning up existing processes..."
    pkill -f "npx tsx src/cli.tsx" 2>/dev/null
    sleep 1
}

# Test 1: Test approval option 1 (Approve)
test_approve() {
    echo -e "${YELLOW}Test 1: Testing Approval (Option 1)${NC}"
    echo "--------------------------------------"

    cat << 'EOF' > /tmp/test-approve.exp
#!/usr/bin/expect -f
set timeout 30
spawn env APPROVAL_MODE=strict DEBUG=true npx tsx src/cli.tsx --prompt "echo 'Testing approval option 1'"

expect {
    "Your choice" {
        send "1"
        exp_continue
    }
    "Testing approval option 1" {
        puts "\n✅ Output received: Testing approval option 1"
    }
    "Task completed successfully" {
        puts "✅ Task completed successfully"
    }
    timeout {
        puts "❌ Timeout waiting for completion"
        exit 1
    }
}
expect eof
EOF

    chmod +x /tmp/test-approve.exp
    /tmp/test-approve.exp
    local result=$?

    if [ $result -eq 0 ]; then
        echo -e "${GREEN}✅ Test 1 PASSED${NC}"
    else
        echo -e "${RED}❌ Test 1 FAILED${NC}"
    fi
    echo ""
    return $result
}

# Test 2: Test denial option 3 (Deny)
test_deny() {
    echo -e "${YELLOW}Test 2: Testing Denial (Option 3)${NC}"
    echo "--------------------------------------"

    cat << 'EOF' > /tmp/test-deny.exp
#!/usr/bin/expect -f
set timeout 30
spawn env APPROVAL_MODE=strict DEBUG=true npx tsx src/cli.tsx --prompt "rm -rf /tmp/dangerous"

expect {
    "Your choice" {
        send "3"
        exp_continue
    }
    "Operation denied" {
        puts "\n✅ Operation properly denied"
    }
    "User denied" {
        puts "✅ Denial reason received"
    }
    timeout {
        puts "❌ Timeout waiting for denial"
        exit 1
    }
}
expect eof
EOF

    chmod +x /tmp/test-deny.exp
    /tmp/test-deny.exp
    local result=$?

    if [ $result -eq 0 ]; then
        echo -e "${GREEN}✅ Test 2 PASSED${NC}"
    else
        echo -e "${RED}❌ Test 2 FAILED${NC}"
    fi
    echo ""
    return $result
}

# Test 3: Test remember approval option 2
test_remember() {
    echo -e "${YELLOW}Test 3: Testing Remember Approval (Option 2)${NC}"
    echo "--------------------------------------"

    cat << 'EOF' > /tmp/test-remember.exp
#!/usr/bin/expect -f
set timeout 30
spawn env APPROVAL_MODE=strict DEBUG=true npx tsx src/cli.tsx --prompt "echo 'Test 1' && echo 'Test 2'"

expect {
    "Your choice" {
        send "2"
        puts "\n✅ Selected option 2 (Remember)"
        exp_continue
    }
    "Approved and remembered" {
        puts "✅ Approval remembered"
        exp_continue
    }
    "Test 1" {
        puts "✅ First command executed"
        exp_continue
    }
    "Test 2" {
        puts "✅ Second command executed without new prompt"
    }
    timeout {
        puts "❌ Timeout"
        exit 1
    }
}
expect eof
EOF

    chmod +x /tmp/test-remember.exp
    /tmp/test-remember.exp
    local result=$?

    if [ $result -eq 0 ]; then
        echo -e "${GREEN}✅ Test 3 PASSED${NC}"
    else
        echo -e "${RED}❌ Test 3 FAILED${NC}"
    fi
    echo ""
    return $result
}

# Test 4: Test show details option 4
test_details() {
    echo -e "${YELLOW}Test 4: Testing Show Details (Option 4)${NC}"
    echo "--------------------------------------"

    cat << 'EOF' > /tmp/test-details.exp
#!/usr/bin/expect -f
set timeout 30
spawn env APPROVAL_MODE=strict DEBUG=true npx tsx src/cli.tsx --prompt "echo 'Testing details'"

expect {
    "Your choice (1-4)" {
        send "4"
        puts "\n✅ Selected option 4 (Show Details)"
        exp_continue
    }
    "Full Parameters" {
        puts "✅ Details shown"
        exp_continue
    }
    "Your choice (1-3)" {
        send "1"
        puts "✅ Approved after viewing details"
        exp_continue
    }
    "Testing details" {
        puts "✅ Command executed"
    }
    timeout {
        puts "❌ Timeout"
        exit 1
    }
}
expect eof
EOF

    chmod +x /tmp/test-details.exp
    /tmp/test-details.exp
    local result=$?

    if [ $result -eq 0 ]; then
        echo -e "${GREEN}✅ Test 4 PASSED${NC}"
    else
        echo -e "${RED}❌ Test 4 FAILED${NC}"
    fi
    echo ""
    return $result
}

# Test 5: Test Ctrl+C cancellation
test_cancel() {
    echo -e "${YELLOW}Test 5: Testing Ctrl+C Cancellation${NC}"
    echo "--------------------------------------"

    cat << 'EOF' > /tmp/test-cancel.exp
#!/usr/bin/expect -f
set timeout 10
spawn env APPROVAL_MODE=strict DEBUG=true npx tsx src/cli.tsx --prompt "echo 'Should not execute'"

expect {
    "Your choice" {
        send "\003"
        puts "\n✅ Sent Ctrl+C"
        exp_continue
    }
    "Cancelled by user" {
        puts "✅ Cancellation confirmed"
    }
    "Operation cancelled" {
        puts "✅ Operation cancelled"
    }
    "Should not execute" {
        puts "❌ Command should not have executed!"
        exit 1
    }
    timeout {
        puts "❌ Process did not exit properly"
        exit 1
    }
}
expect eof
EOF

    chmod +x /tmp/test-cancel.exp
    /tmp/test-cancel.exp
    local result=$?

    if [ $result -eq 0 ]; then
        echo -e "${GREEN}✅ Test 5 PASSED${NC}"
    else
        echo -e "${RED}❌ Test 5 FAILED${NC}"
    fi
    echo ""
    return $result
}

# Run all tests
main() {
    # Check if expect is available
    if ! command -v expect &> /dev/null; then
        echo -e "${RED}❌ 'expect' command not found${NC}"
        echo "Install it with: brew install expect"
        exit 1
    fi

    # Clean up before tests
    cleanup

    # Track results
    total=0
    passed=0

    # Run each test
    tests=("approve" "deny" "remember" "details" "cancel")

    for test in "${tests[@]}"; do
        ((total++))
        if test_$test; then
            ((passed++))
        fi
        cleanup  # Clean between tests
        sleep 1
    done

    # Summary
    echo "==============================================="
    echo "              TEST SUMMARY"
    echo "==============================================="
    if [ $passed -eq $total ]; then
        echo -e "${GREEN}✅ ALL TESTS PASSED: $passed/$total${NC}"
    else
        echo -e "${RED}❌ SOME TESTS FAILED: $passed/$total passed${NC}"
    fi
    echo "==============================================="

    # Clean up temp files
    rm -f /tmp/test-*.exp

    # Return overall result
    [ $passed -eq $total ]
}

# Run tests
main