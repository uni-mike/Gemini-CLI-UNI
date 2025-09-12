/**
 * LoadingIndicator - Beautiful loading animation for UNIPATH CLI
 * Features witty phrases, elapsed time, and animated spinners
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

export interface LoadingIndicatorProps {
  currentLoadingPhrase?: string;
  elapsedTime?: number;
  thought?: string;
  isActive: boolean;
}

const Colors = {
  AccentPurple: '#8B5CF6',
  Gray: '#6B7280',
  AccentBlue: '#3B82F6',
  AccentGreen: '#10B981',
};

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  currentLoadingPhrase,
  elapsedTime = 0,
  thought,
  isActive,
}) => {
  if (!isActive) {
    return null;
  }

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const primaryText = thought || currentLoadingPhrase || 'Working on your request...';
  const cancelAndTimerContent = `(esc to cancel, ${formatDuration(elapsedTime)})`;

  return (
    <Box paddingLeft={0} flexDirection="column">
      <Box width="100%" flexDirection="row" alignItems="center">
        <Box marginRight={1}>
          <Spinner type="dots" />
        </Box>
        <Text color={Colors.AccentPurple}>{primaryText}</Text>
        <Text color={Colors.Gray}> {cancelAndTimerContent}</Text>
      </Box>
    </Box>
  );
};