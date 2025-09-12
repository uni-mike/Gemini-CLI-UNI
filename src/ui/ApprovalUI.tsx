import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

interface ApprovalUIProps {
  toolName: string;
  args: any;
  onApprove: () => void;
  onReject: () => void;
}

export const ApprovalUI: React.FC<ApprovalUIProps> = ({ 
  toolName, 
  args, 
  onApprove, 
  onReject 
}) => {
  const [selection, setSelection] = useState<'approve' | 'reject'>('approve');
  
  useInput((input, key) => {
    if (key.leftArrow || key.rightArrow) {
      setSelection(prev => prev === 'approve' ? 'reject' : 'approve');
    } else if (key.return) {
      if (selection === 'approve') {
        onApprove();
      } else {
        onReject();
      }
    } else if (input === 'y' || input === 'Y') {
      onApprove();
    } else if (input === 'n' || input === 'N') {
      onReject();
    }
  });
  
  return (
    <Box flexDirection="column" borderStyle="double" borderColor="yellow" paddingX={1} marginY={1}>
      <Text bold color="yellow">⚠️  Tool Approval Required</Text>
      
      <Box marginTop={1}>
        <Text>Tool: </Text>
        <Text bold color="cyan">{toolName}</Text>
      </Box>
      
      <Box flexDirection="column" marginTop={1}>
        <Text>Parameters:</Text>
        <Box marginLeft={2}>
          <Text color="gray">{JSON.stringify(args, null, 2)}</Text>
        </Box>
      </Box>
      
      <Box marginTop={1} gap={2}>
        <Box>
          <Text 
            bold={selection === 'approve'}
            color={selection === 'approve' ? 'green' : 'gray'}
          >
            [Y] Approve
          </Text>
        </Box>
        <Box>
          <Text 
            bold={selection === 'reject'}
            color={selection === 'reject' ? 'red' : 'gray'}
          >
            [N] Reject
          </Text>
        </Box>
      </Box>
      
      <Box marginTop={1}>
        <Text dimColor>Use arrow keys to select, Enter to confirm, or press Y/N</Text>
      </Box>
    </Box>
  );
};