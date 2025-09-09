import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { Colors } from '../Colors.js';

interface StatusFooterProps {
  status: 'idle' | 'processing' | 'thinking' | 'tool-execution';
  approvalMode: string;
  currentOperation?: string;
}

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'idle': return Colors.AccentGreen;
    case 'processing': return Colors.AccentYellow;
    case 'thinking': return Colors.AccentPurple;
    case 'tool-execution': return Colors.AccentBlue;
    default: return Colors.Foreground;
  }
};

const getStatusText = (status: string, currentOperation?: string): string => {
  switch (status) {
    case 'idle': return 'Ready';
    case 'processing': return 'Processing...';
    case 'thinking': return 'Thinking...';
    case 'tool-execution': return currentOperation ? `Running ${currentOperation}` : 'Running tools...';
    default: return 'Unknown';
  }
};

const getApprovalModeDisplay = (mode: string): string => {
  switch (mode) {
    case 'yolo': return '🚀 Auto-Accept';
    case 'manual': return '⚠️  Manual Approval';
    case 'autoEdit': return '✏️  Auto-Edit';
    default: return `🔧 ${mode}`;
  }
};

export const StatusFooter: React.FC<StatusFooterProps> = ({ 
  status, 
  approvalMode, 
  currentOperation 
}) => {
  const statusColor = getStatusColor(status);
  const statusText = getStatusText(status, currentOperation);
  const approvalDisplay = getApprovalModeDisplay(approvalMode);
  
  return (
    <Box 
      borderStyle="single" 
      borderColor={statusColor}
      paddingX={1}
      paddingY={0}
      justifyContent="space-between"
      width="100%"
    >
      {/* Left side: Status with spinner */}
      <Box flexDirection="row" alignItems="center">
        {status !== 'idle' && (
          <>
            <Spinner type="dots" />
            <Text color={statusColor}> </Text>
          </>
        )}
        {status === 'idle' && (
          <Text color={statusColor}>● </Text>
        )}
        <Text color={statusColor}>{statusText}</Text>
      </Box>
      
      {/* Right side: Approval mode */}
      <Box>
        <Text color={Colors.Comment}>{approvalDisplay}</Text>
      </Box>
    </Box>
  );
};