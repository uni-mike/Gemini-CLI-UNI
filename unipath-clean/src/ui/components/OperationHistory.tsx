/**
 * Operation History - Shows beautiful intermediate orchestration messages
 * Like "⏺ Update(file.ts)", "✻ Thinking...", "⎿ Updated with X additions"
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { Colors } from '../Colors.js';

export interface Operation {
  id: string;
  type: 'thinking' | 'file-update' | 'tool-execution' | 'bash' | 'search' | 'read' | 'write';
  status: 'running' | 'completed' | 'failed';
  title: string;
  details?: string;
  filePath?: string;
  additions?: number;
  deletions?: number;
  timestamp: Date;
}

interface OperationHistoryProps {
  operations: Operation[];
  maxDisplay?: number;
}

const getOperationIcon = (type: Operation['type'], status: Operation['status']): string => {
  if (status === 'running') {
    switch (type) {
      case 'thinking': return '✻';
      case 'file-update': return '⏺';
      case 'tool-execution': return '⏺';
      case 'bash': return '⏺';
      case 'search': return '⏺';
      case 'read': return '⏺';
      case 'write': return '⏺';
      default: return '⏺';
    }
  } else if (status === 'completed') {
    return '⎿';
  } else if (status === 'failed') {
    return '❌';
  }
  return '⏺';
};

const OperationSpinner: React.FC<{ type: Operation['type'] }> = ({ type }) => {
  if (type === 'thinking') {
    return <Spinner type="dots" />;
  }
  return <Spinner type="line" />;
};

const getOperationColor = (type: Operation['type'], status: Operation['status']): string => {
  if (status === 'running') {
    switch (type) {
      case 'thinking': return Colors.AccentYellow;
      case 'file-update': return Colors.AccentBlue;
      default: return Colors.AccentCyan;
    }
  } else if (status === 'completed') {
    return Colors.AccentGreen;
  } else if (status === 'failed') {
    return Colors.AccentRed;
  }
  return Colors.Foreground;
};

export const OperationHistory: React.FC<OperationHistoryProps> = ({ 
  operations, 
  maxDisplay = 10 
}) => {
  if (operations.length === 0) return null;

  const recentOperations = operations.slice(-maxDisplay);

  return (
    <Box flexDirection="column" marginY={1}>
      {recentOperations.map((operation) => {
        const icon = getOperationIcon(operation.type, operation.status);
        const color = getOperationColor(operation.type, operation.status);
        
        return (
          <Box key={operation.id} flexDirection="column" marginBottom={1}>
            {/* Main operation line with spinner */}
            <Box flexDirection="row" alignItems="center">
              <Text color={color}>{icon} </Text>
              {operation.status === 'running' && (
                <>
                  <OperationSpinner type={operation.type} />
                  <Text color={color}> {operation.title}</Text>
                </>
              )}
              {operation.status !== 'running' && (
                <Text color={color}>{operation.title}</Text>
              )}
            </Box>
            
            {/* Details line - properly indented */}
            {operation.details && operation.status === 'completed' && (
              <Box marginLeft={2} paddingLeft={1}>
                <Text color={Colors.AccentGreen}>⎿ {operation.details}</Text>
                {operation.filePath && (
                  <>
                    {operation.additions !== undefined && operation.deletions !== undefined && (
                      <Text color={Colors.Comment}>
                        {' '}with {operation.additions} additions and {operation.deletions} deletions
                      </Text>
                    )}
                  </>
                )}
              </Box>
            )}
            
            {/* Error details */}
            {operation.details && operation.status === 'failed' && (
              <Box marginLeft={2} paddingLeft={1}>
                <Text color={Colors.AccentRed}>⎿ {operation.details}</Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};