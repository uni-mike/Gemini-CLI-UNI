#!/bin/bash

echo "🚀 FlexiCLI Battle Testing Suite"
echo "================================"
echo ""
echo "This will test:"
echo "  • Token overflow handling"
echo "  • Rapid task execution" 
echo "  • Large memory chunks"
echo "  • Concurrent operations"
echo "  • Agent crash recovery"
echo "  • Database corruption"
echo "  • Network failures"
echo "  • Memory leaks"
echo "  • Performance benchmarks"
echo "  • Integration flows"
echo "  • Load handling"
echo "  • Session recovery"
echo ""
echo "Press Enter to start or Ctrl+C to cancel..."
read

# Build if needed
echo "📦 Building TypeScript..."
npx tsc

# Run with garbage collection exposed for memory tests
echo "🔥 Starting battle tests..."
node --expose-gc dist/test/battle-test.js