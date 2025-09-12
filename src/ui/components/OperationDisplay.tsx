/**
 * OperationDisplay - Displays individual orchestration operations with beautiful formatting
 */

import React from 'react';
import { Box, Text } from 'ink';

export interface Operation {
  id: string;
  type: 'bash' | 'update' | 'read' | 'write' | 'approval' | 'build' | 'test' | 'tool';
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

const Colors = {
  AccentBlue: '#3B82F6',
  AccentGreen: '#10B981',
  AccentYellow: '#F59E0B',
  AccentRed: '#EF4444',
  AccentCyan: '#06B6D4',
  AccentPurple: '#8B5CF6',
  Foreground: '#FFFFFF',
  Comment: '#6B7280',
};

const getOperationIcon = (type: Operation['type']): string => {
  switch (type) {
    case 'bash': return '🔧';
    case 'update': return '📝';
    case 'read': return '📖';
    case 'write': return '✏️';
    case 'approval': return '🔐';
    case 'build': return '🏗️';
    case 'test': return '🧪';
    case 'tool': return '⚡';
    default: return '⚙️';
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

  const getTypeLabel = (type: Operation['type']): string => {
    switch (type) {
      case 'bash': return 'Shell';
      case 'update': return 'Update';
      case 'read': return 'Read';
      case 'write': return 'Write';
      case 'approval': return 'Approval';
      case 'build': return 'Build';
      case 'test': return 'Test';
      case 'tool': return 'Tool';
      default: return 'Operation';
    }
  };

  return (
    <Box flexDirection="column">
      {/* Main Operation Header */}
      <Box>
        <Text>{icon} </Text>
        <Text color={Colors.AccentBlue} bold>
          {getTypeLabel(operation.type)}
        </Text>
        <Text color={Colors.Foreground}> {operation.title}</Text>
        {operation.status !== 'pending' && (
          <Text> {statusIndicator}</Text>
        )}
      </Box>

      {/* Operation Details */}
      {operation.details && (
        <Box marginLeft={2}>
          <Text color={Colors.Comment}>└─ </Text>
          <Text color={statusColor}>{operation.details}</Text>
        </Box>
      )}

      {/* File Path for Update Operations */}
      {operation.filePath && operation.type === 'update' && (
        <Box marginLeft={2}>
          <Text color={Colors.Comment}>└─ </Text>
          <Text color={Colors.Foreground}>Updated </Text>
          <Text color={Colors.AccentCyan}>{operation.filePath}</Text>
          {operation.additions && (
            <Text color={Colors.AccentGreen}> (+{operation.additions})</Text>
          )}
        </Box>
      )}

      {/* Content Preview */}
      {hasExpandableContent && (
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          {operation.content!.slice(0, isExpanded ? undefined : previewLines).map((line, index) => {
            const lineNum = (operation.lineNumber || 1) + index;
            const isAddition = line.startsWith('+');
            const isContext = !line.startsWith('+') && !line.startsWith('-');
            
            return (
              <Box key={index}>
                <Text color={Colors.Comment}>{String(lineNum).padStart(4, ' ')} </Text>
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
              <Text color={Colors.Comment}>    … +{hiddenLines} more lines</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default OperationDisplay;