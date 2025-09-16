import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { Config } from '../config/Config.js';
import { Orchestrator } from '../core/orchestrator.js';

interface AppProps {
  config: Config;
  orchestrator: Orchestrator;
}

export const SimpleApp: React.FC<AppProps> = ({ config, orchestrator }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Keep the app alive with a simple timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="green" bold>
        🚀 Flexi-CLI • {config.getModel()} • {config.getApprovalMode()}
      </Text>
      
      <Box marginTop={1} borderStyle="round" borderColor="red" paddingX={1}>
        <Text color="red">⚠ Interactive input disabled - use --prompt flag</Text>
      </Box>
      
      <Box marginTop={1}>
        <Text color="yellow">
          Use: ./start-clean.sh --prompt "your command" --non-interactive
        </Text>
      </Box>
      
      <Box marginTop={1}>
        <Text color="gray">
          Running since: {currentTime.toLocaleTimeString()} • Ctrl+C to quit
        </Text>
      </Box>
    </Box>
  );
};