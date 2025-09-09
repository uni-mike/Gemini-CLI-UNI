#!/bin/bash

echo "=== Test 1: Simple arithmetic (should NOT use orchestration) ==="
APPROVAL_MODE=yolo ./start-deepseek.sh --prompt "What is 5 + 5?" --non-interactive 2>&1 | grep -E "(Extracted|Result:|10)" | head -5

echo -e "\n=== Test 2: Simple file creation (should NOT use orchestration) ==="
APPROVAL_MODE=yolo ./start-deepseek.sh --prompt "create test1.txt with Hello" --non-interactive 2>&1 | grep -E "(Extracted|Result:|Created|write_file)" | head -5

echo -e "\n=== Test 3: Multi-step with THEN (SHOULD use orchestration) ==="
APPROVAL_MODE=yolo ./start-deepseek.sh --prompt "create test2.txt then add more content" --non-interactive 2>&1 | grep -E "(Extracted|Result:|orchestration|Multi-step)" | head -5

echo -e "\n=== Test 4: Research and create (SHOULD use orchestration) ==="
APPROVAL_MODE=yolo ./start-deepseek.sh --prompt "research Bitcoin price then create btc.md" --non-interactive 2>&1 | grep -E "(Extracted|Result:|orchestration|Research)" | head -5

echo -e "\n=== Test 5: Simple web search (should NOT use orchestration) ==="
APPROVAL_MODE=yolo ./start-deepseek.sh --prompt "What is the weather in NYC?" --non-interactive 2>&1 | grep -E "(Extracted|Result:|web_search|weather)" | head -5
