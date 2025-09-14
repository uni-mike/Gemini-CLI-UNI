import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export enum SensitivityLevel {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

interface ApprovalUIProps {
  toolName: string;
  operation: string;
  args: any;
  sensitivityLevel: SensitivityLevel;
  description: string;
  risks?: string[];
  onApprove: () => void;
  onApproveAndRemember: () => void;
  onReject: () => void;
  onShowDetails: () => void;
}

export const ApprovalUI: React.FC<ApprovalUIProps> = ({
  toolName,
  operation,
  args,
  sensitivityLevel,
  description,
  risks,
  onApprove,
  onApproveAndRemember,
  onReject,
  onShowDetails
}) => {
  const [selection, setSelection] = useState<1 | 2 | 3 | 4>(1);
  const [showingDetails, setShowingDetails] = useState(false);
  const [executed, setExecuted] = useState(false);

  useInput((input, key) => {
    // Prevent multiple executions
    if (executed) return;

    if (showingDetails) {
      // Any key exits detail view
      setShowingDetails(false);
      return;
    }

    if (key.upArrow) {
      setSelection(prev => prev > 1 ? (prev - 1) as (1 | 2 | 3 | 4) : 4);
    } else if (key.downArrow) {
      setSelection(prev => prev < 4 ? (prev + 1) as (1 | 2 | 3 | 4) : 1);
    } else if (key.return) {
      setExecuted(true);
      switch (selection) {
        case 1:
          onApprove();
          break;
        case 2:
          onApproveAndRemember();
          break;
        case 3:
          onReject();
          break;
        case 4:
          setExecuted(false); // Allow going back after viewing details
          setShowingDetails(true);
          onShowDetails();
          break;
      }
    } else if (input >= '1' && input <= '4') {
      const num = parseInt(input) as (1 | 2 | 3 | 4);
      setSelection(num);
      setExecuted(true);
      // Immediately execute the action when number key is pressed
      switch (num) {
        case 1:
          onApprove();
          break;
        case 2:
          onApproveAndRemember();
          break;
        case 3:
          onReject();
          break;
        case 4:
          setExecuted(false); // Allow going back after viewing details
          setShowingDetails(true);
          onShowDetails();
          break;
      }
    }
  });

  const getSensitivityIcon = (level: SensitivityLevel): string => {
    const icons = {
      [SensitivityLevel.NONE]: '🟢',
      [SensitivityLevel.LOW]: '🟡',
      [SensitivityLevel.MEDIUM]: '🟠',
      [SensitivityLevel.HIGH]: '🔴',
      [SensitivityLevel.CRITICAL]: '⚠️'
    };
    return icons[level];
  };

  const wrapText = (text: string, maxWidth: number = 55): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= maxWidth) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [''];
  };

  if (showingDetails) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1} marginY={1}>
        <Text bold color="magenta">📋 Full Parameters</Text>
        <Box marginTop={1}>
          <Text>{JSON.stringify(args, null, 2)}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press any key to go back...</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="cyan" paddingX={1} marginY={1}>
      <Text bold color="cyan">Choose Your Action</Text>

      <Box marginTop={1}>
        <Text bold={selection === 1} color={selection === 1 ? 'green' : 'gray'}>
          [1] ✅ Approve - Execute this operation now
        </Text>
      </Box>

      <Box>
        <Text bold={selection === 2} color={selection === 2 ? 'blue' : 'gray'}>
          [2] 🔒 Approve & Remember - Allow similar operations
        </Text>
      </Box>

      <Box>
        <Text bold={selection === 3} color={selection === 3 ? 'red' : 'gray'}>
          [3] ❌ Deny - Block this operation
        </Text>
      </Box>

      <Box>
        <Text bold={selection === 4} color={selection === 4 ? 'magenta' : 'gray'}>
          [4] 📋 Show Details - View full parameters
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Use ↑↓ arrows to select, Enter to confirm, or press 1-4</Text>
      </Box>
    </Box>
  );
};