/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';

export interface Operation {
  id: string;
  type: 'bash' | 'update' | 'read' | 'write' | 'approval' | 'build' | 'test';
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  details?: string;
  content?: string[];
  filePath?: string;
  lineNumber?: number;
  additions?: number;
  deletions?: number;
  timestamp?: Date;
}

interface OperationDisplayProps {
  operation: Operation;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const getOperationIcon = (type: Operation['type']): string => {
  switch (type) {
    case 'bash': return '⏺';
    case 'update': return '⏺';
    case 'read': return '⏺';
    case 'write': return '⏺';
    case 'approval': return '🔐';
    case 'build': return '🔧';
    case 'test': return '🧪';
    default: return '⏺';
  }
};

const getStatusColor = (status: Operation['status']) => {
  switch (status) {
    case 'pending': return Colors.Comment;
    case 'running': return Colors.AccentYellow;
    case 'completed': return Colors.AccentGreen;
    case 'failed': return Colors.AccentRed;
    default: return Colors.Foreground;
  }
};

const getStatusIndicator = (status: Operation['status']): string => {
  switch (status) {
    case 'pending': return '⏳';
    case 'running': return '🔄';
    case 'completed': return '✅';
    case 'failed': return '❌';
    default: return '';
  }
};

export const OperationDisplay: React.FC<OperationDisplayProps> = ({ 
  operation, 
  isExpanded = false, 
  onToggleExpand 
}) => {
  const icon = getOperationIcon(operation.type);
  const statusColor = getStatusColor(operation.status);
  const statusIndicator = getStatusIndicator(operation.status);
  
  const hasExpandableContent = operation.content && operation.content.length > 0;
  const previewLines = hasExpandableContent ? Math.min(3, operation.content!.length) : 0;
  const hiddenLines = hasExpandableContent ? Math.max(0, operation.content!.length - previewLines) : 0;

  return (
    <Box flexDirection="column">
      {/* Main Operation Header */}
      <Box>
        <Text color={statusColor}>{icon} </Text>
        <Text color={Colors.AccentBlue} bold>
          {operation.type === 'bash' && 'Bash'}
          {operation.type === 'update' && 'Update'}
          {operation.type === 'read' && 'Read'}
          {operation.type === 'write' && 'Write'}
          {operation.type === 'approval' && 'Approval'}
          {operation.type === 'build' && 'Build'}
          {operation.type === 'test' && 'Test'}
        </Text>
        <Text color={Colors.Comment}>({operation.title})</Text>
        {operation.status !== 'pending' && (
          <Text> {statusIndicator}</Text>
        )}
      </Box>

      {/* Operation Details */}
      <Box marginLeft={2}>
        <Text color={Colors.Comment}>⎿  </Text>
        <Box flexDirection="column">
          {/* Summary Line */}
          {operation.details && (
            <Text color={Colors.Foreground}>{operation.details}</Text>
          )}
          
          {/* File Path for Update Operations */}
          {operation.filePath && operation.type === 'update' && (
            <Box>
              <Text color={Colors.Foreground}>Updated </Text>
              <Text color={Colors.AccentCyan}>{operation.filePath}</Text>
              {operation.additions && (
                <Text color={Colors.AccentGreen}> with {operation.additions} addition{operation.additions > 1 ? 's' : ''}</Text>
              )}
            </Box>
          )}

          {/* Content Preview */}
          {hasExpandableContent && (
            <Box flexDirection="column" marginTop={1}>
              {/* Show preview lines */}
              {operation.content!.slice(0, isExpanded ? undefined : previewLines).map((line, index) => {
                const lineNum = (operation.lineNumber || 1) + index;
                const isAddition = line.startsWith('+');
                const isContext = !line.startsWith('+') && !line.startsWith('-');
                
                return (
                  <Box key={index}>
                    <Text color={Colors.Comment}>{String(lineNum).padStart(7, ' ')}  </Text>
                    <Text 
                      color={
                        isAddition ? Colors.AccentGreen : 
                        isContext ? Colors.Foreground : Colors.AccentRed
                      }
                    >
                      {line}
                    </Text>
                  </Box>
                );
              })}
              
              {/* Expand/Collapse Indicator */}
              {!isExpanded && hiddenLines > 0 && (
                <Box>
                  <Text color={Colors.Comment}>     … +{hiddenLines} lines </Text>
                  <Text 
                    color={Colors.AccentBlue} 
                    dimColor 
                    italic
                  >
                    (ctrl+r to expand)
                  </Text>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default OperationDisplay;