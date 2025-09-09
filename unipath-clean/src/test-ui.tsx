#!/usr/bin/env node
import React from 'react';
import { render, Box, Text } from 'ink';

const TestApp = () => {
  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">🚀 UNIPATH Clean UI Test</Text>
      </Box>
      <Box paddingX={1} marginY={1}>
        <Text color="green">✅ React Ink is working!</Text>
      </Box>
      <Box paddingX={1}>
        <Text color="yellow">Press Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
};

// Only render if we're in a TTY
if (process.stdin.isTTY) {
  const app = render(<TestApp />);
  
  setTimeout(() => {
    console.log('\nUI test completed successfully!');
    app.unmount();
    process.exit(0);
  }, 2000);
} else {
  console.log('Not in TTY mode - UI cannot be displayed');
  console.log('But React Ink is properly installed and configured!');
  process.exit(0);
}