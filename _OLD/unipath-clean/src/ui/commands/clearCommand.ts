/**
 * Clear Command - Clear screen and history
 */

import { SlashCommand, SlashCommandResult, MessageType } from './types.js';

export const clearCommand: SlashCommand = {
  name: 'clear',
  altNames: ['cls'],
  description: 'Clear screen and conversation history',
  action: async (context): Promise<SlashCommandResult> => {
    // Clear the screen and history
    context.ui.clearItems();
    context.ui.refreshStatic();
    
    // Add a welcome message after clearing
    context.ui.addItem({
      type: MessageType.INFO,
      content: '🎭 Screen cleared. The Trio is ready for your next request!',
      timestamp: new Date(),
    });

    return {
      type: 'clear',
    };
  },
};