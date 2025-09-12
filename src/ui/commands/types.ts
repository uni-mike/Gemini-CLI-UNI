/**
 * Types for slash commands in UNIPATH CLI Trio
 */

export interface SlashCommandContext {
  ui: {
    addItem: (message: any) => void;
    clearItems: () => void;
    refreshStatic: () => void;
  };
  orchestrator: any;
  session: {
    startTime: Date;
    stats: {
      promptCount: number;
      tokensUsed: number;
    };
  };
  config: any;
}

export interface SlashCommandResult {
  type: 'quit' | 'clear' | 'help' | 'info' | 'error';
  messages?: any[];
  shouldExit?: boolean;
}

export interface SlashCommand {
  name: string;
  altNames?: string[];
  description: string;
  action: (context: SlashCommandContext, args?: string[]) => Promise<SlashCommandResult | void> | SlashCommandResult | void;
}

export enum MessageType {
  INFO = 'info',
  ERROR = 'error',
  HELP = 'help',
  QUIT = 'quit',
  USER = 'user',
  ASSISTANT = 'assistant',
}