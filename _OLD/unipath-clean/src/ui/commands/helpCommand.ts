/**
 * Help Command - Shows available slash commands and usage
 */

import { SlashCommand, SlashCommandResult, MessageType } from './types.js';

export const helpCommand: SlashCommand = {
  name: 'help',
  altNames: ['?'],
  description: 'Show available commands and usage',
  action: async (context): Promise<SlashCommandResult> => {
    const helpMessage = `
🎭 UNIPATH CLI with Orchestration Trio - Help

Available Commands:
  /help, /?           - Show this help message
  /quit, /exit        - Exit the CLI
  /clear              - Clear the screen and history
  /tools              - List all available tools
  /status             - Show system status
  /about              - About UNIPATH CLI

Usage:
  • Type your natural language requests to interact with the Trio
  • Use @ to reference files: @path/to/file
  • Press Ctrl+C twice to exit
  • Press Esc to cancel current operation

Trio Components:
  🎯 Planner    - Analyzes tasks and creates execution plans
  ⚡ Executor   - Executes tasks using advanced tools
  🎭 Orchestrator - Coordinates and mediates between components

Examples:
  "create a README file with project description"
  "search for TODO comments in src/ directory"
  "run tests and fix any failures"
`;

    context.ui.addItem({
      type: MessageType.HELP,
      content: helpMessage.trim(),
      timestamp: new Date(),
    });

    return {
      type: 'help',
    };
  },
};