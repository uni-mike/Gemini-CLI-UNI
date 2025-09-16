/**
 * Quit Command - Exit the CLI with session summary
 */

import { SlashCommand, SlashCommandResult, MessageType } from './types.js';

const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

export const quitCommand: SlashCommand = {
  name: 'quit',
  altNames: ['exit'],
  description: 'Exit the CLI',
  action: async (context): Promise<SlashCommandResult> => {
    const now = Date.now();
    const wallDuration = now - context.session.startTime.getTime();
    
    const quitMessage = `
👋 Thanks for using UNIPATH CLI with Orchestration Trio!

Session Summary:
  • Duration: ${formatDuration(wallDuration)}
  • Prompts processed: ${context.session.stats.promptCount}
  • Tokens used: ${context.session.stats.tokensUsed.toLocaleString()}

🎭 The Trio worked together to help you:
  🎯 Planner analyzed your requests
  ⚡ Executor used ${context.config?.toolCount || 13} available tools  
  🎭 Orchestrator coordinated the workflow

Goodbye! 🚀
`;

    context.ui.addItem({
      type: MessageType.QUIT,
      content: quitMessage.trim(),
      timestamp: new Date(),
    });

    return {
      type: 'quit',
      shouldExit: true,
      messages: [{
        type: MessageType.USER,
        content: '/quit',
        timestamp: new Date(),
      }],
    };
  },
};