import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { Colors } from '../Colors.js';

interface SessionSummaryProps {
  duration: string;
  operationsCount: number;
  messagesCount: number;
  model: string;
}

export const SessionSummary: React.FC<SessionSummaryProps> = ({ 
  duration, 
  operationsCount, 
  messagesCount,
  model 
}) => {
  return (
    <Box
      borderStyle="round"
      borderColor={Colors.AccentGreen}
      flexDirection="column"
      paddingY={1}
      paddingX={2}
      marginY={1}
    >
      <Gradient colors={['#00ff88', '#00ccdd', '#0099ff']}>
        <Text bold>🎭 Agent powering down. Goodbye!</Text>
      </Gradient>
      <Box height={1} />
      
      <Box flexDirection="column">
        <Text color={Colors.AccentCyan}>Session Summary</Text>
        <Box height={1} />
        <Box>
          <Box width={18}>
            <Text color={Colors.AccentBlue}>Duration:</Text>
          </Box>
          <Text>{duration}</Text>
        </Box>
        <Box>
          <Box width={18}>
            <Text color={Colors.AccentBlue}>Operations:</Text>
          </Box>
          <Text color={Colors.AccentGreen}>{operationsCount}</Text>
        </Box>
        <Box>
          <Box width={18}>
            <Text color={Colors.AccentBlue}>Messages:</Text>
          </Box>
          <Text color={Colors.AccentGreen}>{messagesCount}</Text>
        </Box>
        <Box>
          <Box width={18}>
            <Text color={Colors.AccentBlue}>Model:</Text>
          </Box>
          <Text color={Colors.AccentYellow}>{model}</Text>
        </Box>
      </Box>
      
      <Box marginTop={1}>
        <Text color={Colors.Comment}>Thank you for using Flexi-CLI! 🚀</Text>
      </Box>
    </Box>
  );
};