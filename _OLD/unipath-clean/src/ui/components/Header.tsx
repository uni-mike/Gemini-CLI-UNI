/**
 * Header component with ASCII art and gradient colors
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../Colors.js';
import { shortAsciiLogo, longAsciiLogo, tinyAsciiLogo } from './AsciiArt.js';

interface HeaderProps {
  version?: string;
  model?: string;
  approvalMode?: string;
}

const getTerminalWidth = () => {
  return process.stdout.columns || 120;
};

const getAsciiArtWidth = (art: string): number => {
  const lines = art.trim().split('\n');
  return Math.max(...lines.map(line => line.length));
};

export const Header: React.FC<HeaderProps> = ({ 
  version = "1.0.0", 
  model = "DeepSeek-R1",
  approvalMode = "yolo"
}) => {
  const terminalWidth = getTerminalWidth();
  let displayTitle;
  
  const widthOfLongLogo = getAsciiArtWidth(longAsciiLogo);
  const widthOfShortLogo = getAsciiArtWidth(shortAsciiLogo);

  if (terminalWidth >= widthOfLongLogo) {
    displayTitle = longAsciiLogo;
  } else if (terminalWidth >= widthOfShortLogo) {
    displayTitle = shortAsciiLogo;
  } else {
    displayTitle = tinyAsciiLogo;
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* ASCII Art Header */}
      <Box>
        <Text color={Colors.AccentBlue}>{displayTitle}</Text>
      </Box>
      
      {/* Info Bar */}
      <Box borderStyle="round" borderColor={Colors.AccentCyan} paddingX={2} marginTop={1}>
        <Text bold color={Colors.AccentCyan}>🚀 Flexi-CLI</Text>
        <Text color={Colors.Comment}> • </Text>
        <Text color={Colors.AccentYellow}>{model}</Text>
        <Text color={Colors.Comment}> • </Text>
        <Text color={Colors.AccentGreen}>{approvalMode}</Text>
        {version && (
          <>
            <Text color={Colors.Comment}> • </Text>
            <Text color={Colors.Comment}>v{version}</Text>
          </>
        )}
      </Box>
    </Box>
  );
};