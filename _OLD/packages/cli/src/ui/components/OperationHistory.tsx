/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import { OperationDisplay, type Operation } from './OperationDisplay.js';

interface OperationHistoryProps {
  operations: Operation[];
  expandedOperations: Set<string>;
  onToggleExpand: (operationId: string) => void;
  maxVisible?: number;
}

export const OperationHistory: React.FC<OperationHistoryProps> = ({
  operations,
  expandedOperations,
  onToggleExpand,
  maxVisible = 10,
}) => {
  if (operations.length === 0) {
    return null;
  }

  // Show most recent operations first, but limit to maxVisible
  const visibleOperations = operations.slice(-maxVisible);
  const hiddenCount = operations.length - visibleOperations.length;

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color={Colors.AccentBlue} bold>Recent Operations</Text>
        {operations.length > maxVisible && (
          <Text color={Colors.Comment}> (showing {maxVisible} of {operations.length})</Text>
        )}
      </Box>

      {/* Hidden operations indicator */}
      {hiddenCount > 0 && (
        <Box marginBottom={1}>
          <Text color={Colors.Comment}>… {hiddenCount} earlier operations</Text>
        </Box>
      )}

      {/* Operations List */}
      <Box flexDirection="column">
        {visibleOperations.map((operation, index) => (
          <Box key={operation.id} marginBottom={index < visibleOperations.length - 1 ? 1 : 0}>
            <OperationDisplay
              operation={operation}
              isExpanded={expandedOperations.has(operation.id)}
              onToggleExpand={() => onToggleExpand(operation.id)}
            />
          </Box>
        ))}
      </Box>

      {/* Status Summary */}
      <Box marginTop={1}>
        <Text color={Colors.Comment}>
          {operations.filter(op => op.status === 'completed').length} completed, {' '}
          {operations.filter(op => op.status === 'running').length} running, {' '}
          {operations.filter(op => op.status === 'failed').length} failed
        </Text>
      </Box>
    </Box>
  );
};

export default OperationHistory;