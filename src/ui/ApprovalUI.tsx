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

  useInput((input, key) => {
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
          setShowingDetails(true);
          onShowDetails();
          break;
      }
    } else if (input >= '1' && input <= '4') {
      const num = parseInt(input) as (1 | 2 | 3 | 4);
      setSelection(num);
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
    <Box flexDirection="column">
      {/* Beautiful header */}
      <Box borderStyle="double" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">🔐 PERMISSION REQUEST REQUIRED</Text>
      </Box>
      <Box borderStyle="single" borderColor="cyan" paddingX={1}>
        <Text color="cyan">FlexiCLI needs approval for a sensitive operation</Text>
      </Box>

      {/* Operation details */}
      <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1} marginTop={1}>
        <Text bold color="blue">Operation Details</Text>
        <Box marginTop={1}>
          <Text bold>Tool: </Text>
          <Text bold color="magenta">{toolName}</Text>
        </Box>
        <Box>
          <Text bold>Action: </Text>
          <Text>{operation}</Text>
        </Box>
        <Box>
          <Text bold>Risk: </Text>
          <Text>{getSensitivityIcon(sensitivityLevel)} {sensitivityLevel.toUpperCase()}</Text>
        </Box>
      </Box>

      {/* Description */}
      <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1} marginTop={1}>
        <Text bold color="green">Description</Text>
        {wrapText(description, 55).map((line, i) => (
          <Box key={i} marginTop={i === 0 ? 1 : 0}>
            <Text>{line}</Text>
          </Box>
        ))}
      </Box>

      {/* Risks if any */}
      {risks && risks.length > 0 && (
        <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={1} marginTop={1}>
          <Text bold color="red">⚠️  Potential Risks</Text>
          {risks.map((risk, i) => (
            <Box key={i} marginTop={1}>
              <Text color="red">• {risk}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Parameters preview */}
      <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} marginTop={1}>
        <Text bold color="yellow">Parameters</Text>
        <Box marginTop={1}>
          <Text dimColor>{JSON.stringify(args, null, 2).split('\n').slice(0, 3).join('\n')}
            {JSON.stringify(args, null, 2).split('\n').length > 3 ? '\n... (truncated)' : ''}
          </Text>
        </Box>
      </Box>

      {/* 4 Options like Claude Code */}
      <Box flexDirection="column" borderStyle="double" borderColor="cyan" paddingX={1} marginTop={1}>
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
    </Box>
  );
};