import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../Colors.js';
import { ApprovalRequest, SensitivityLevel } from '../../approval/approval-manager.js';

interface ApprovalPromptProps {
  request: ApprovalRequest;
  onApprove: () => void;
  onDeny: () => void;
  onAlwaysAllow: () => void;
  onAlwaysDeny: () => void;
}

export const ApprovalPrompt: React.FC<ApprovalPromptProps> = ({
  request,
  onApprove,
  onDeny,
  onAlwaysAllow,
  onAlwaysDeny
}) => {
  const [selectedOption, setSelectedOption] = useState<number>(0);

  useInput((input, key) => {
    // Handle Ctrl+C to force exit
    if (key.ctrl && input === 'c') {
      console.log('\n❌ Operation cancelled by user');
      process.exit(1);
    }

    if (input === '1') {
      onApprove();
    } else if (input === '2') {
      onDeny();
    } else if (input === '3') {
      onAlwaysAllow();
    } else if (input === '4') {
      onAlwaysDeny();
    } else if (key.upArrow) {
      setSelectedOption(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedOption(prev => Math.min(3, prev + 1));
    } else if (key.return) {
      switch (selectedOption) {
        case 0: onApprove(); break;
        case 1: onDeny(); break;
        case 2: onAlwaysAllow(); break;
        case 3: onAlwaysDeny(); break;
      }
    }
  });

  const getSensitivityColor = (level: SensitivityLevel) => {
    switch (level) {
      case SensitivityLevel.HIGH:
        return Colors.AccentRed;
      case SensitivityLevel.MEDIUM:
        return Colors.AccentYellow;
      case SensitivityLevel.LOW:
        return Colors.AccentCyan;
      default:
        return Colors.Foreground;
    }
  };

  const getSensitivityLabel = (level: SensitivityLevel) => {
    switch (level) {
      case SensitivityLevel.HIGH:
        return '⚠️  HIGH RISK';
      case SensitivityLevel.MEDIUM:
        return '⚡ MEDIUM RISK';
      case SensitivityLevel.LOW:
        return 'ℹ️  LOW RISK';
      default:
        return 'NO RISK';
    }
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={Colors.AccentYellow} paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text color={Colors.AccentYellow} bold>⚠️  APPROVAL REQUIRED</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color={Colors.Foreground}>Tool: <Text color={Colors.AccentGreen}>{request.toolName}</Text></Text>
        <Text color={Colors.Foreground}>Operation: <Text color={Colors.AccentCyan}>{request.operation}</Text></Text>
        <Text color={Colors.Foreground}>Risk Level: <Text color={getSensitivityColor(request.sensitivityLevel)}>{getSensitivityLabel(request.sensitivityLevel)}</Text></Text>
      </Box>

      {request.description && (
        <Box marginBottom={1}>
          <Text color={Colors.Comment}>{request.description}</Text>
        </Box>
      )}

      {request.params && Object.keys(request.params).length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={Colors.Foreground} bold>Parameters:</Text>
          {Object.entries(request.params).map(([key, value]) => (
            <Text key={key} color={Colors.Comment}>  {key}: {JSON.stringify(value).substring(0, 60)}{JSON.stringify(value).length > 60 ? '...' : ''}</Text>
          ))}
        </Box>
      )}

      {request.risks && request.risks.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={Colors.AccentRed} bold>Potential Risks:</Text>
          {request.risks.map((risk, idx) => (
            <Text key={idx} color={Colors.AccentRed}>  • {risk}</Text>
          ))}
        </Box>
      )}

      <Box flexDirection="column" marginTop={1}>
        <Text color={Colors.Foreground} bold>Choose an option:</Text>
        <Box flexDirection="column">
          <Text color={selectedOption === 0 ? Colors.AccentGreen : Colors.Comment}>
            {selectedOption === 0 ? '▶ ' : '  '}[1] Approve this operation
          </Text>
          <Text color={selectedOption === 1 ? Colors.AccentRed : Colors.Comment}>
            {selectedOption === 1 ? '▶ ' : '  '}[2] Deny this operation
          </Text>
          <Text color={selectedOption === 2 ? Colors.AccentCyan : Colors.Comment}>
            {selectedOption === 2 ? '▶ ' : '  '}[3] Always allow this type
          </Text>
          <Text color={selectedOption === 3 ? Colors.AccentMagenta : Colors.Comment}>
            {selectedOption === 3 ? '▶ ' : '  '}[4] Always deny this type
          </Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color={Colors.Comment} italic>Press 1-4 or use arrow keys + Enter</Text>
      </Box>
    </Box>
  );
};