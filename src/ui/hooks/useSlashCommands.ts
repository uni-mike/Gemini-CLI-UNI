/**
 * Slash Command Processor Hook for UNIPATH CLI Trio
 */

import { useState, useCallback, useMemo } from 'react';
import { SlashCommand, SlashCommandContext, SlashCommandResult } from '../commands/types.js';
import { helpCommand } from '../commands/helpCommand.js';
import { quitCommand } from '../commands/quitCommand.js';
import { clearCommand } from '../commands/clearCommand.js';
import { statusCommand } from '../commands/statusCommand.js';

interface UseSlashCommandsProps {
  addItem: (message: any) => void;
  clearItems: () => void;
  refreshStatic: () => void;
  orchestrator: any;
  config: any;
}

export const useSlashCommands = ({
  addItem,
  clearItems,
  refreshStatic,
  orchestrator,
  config,
}: UseSlashCommandsProps) => {
  const [sessionStartTime] = useState(new Date());
  const [sessionStats, setSessionStats] = useState({
    promptCount: 0,
    tokensUsed: 0,
  });

  // Built-in commands
  const commands = useMemo<SlashCommand[]>(() => [
    helpCommand,
    quitCommand,
    clearCommand,
    statusCommand,
  ], []);

  // Create command context
  const createContext = useCallback((): SlashCommandContext => ({
    ui: {
      addItem,
      clearItems,
      refreshStatic,
    },
    orchestrator,
    session: {
      startTime: sessionStartTime,
      stats: sessionStats,
    },
    config: {
      ...config,
      toolCount: 13, // Our total tool count
    },
  }), [addItem, clearItems, refreshStatic, orchestrator, sessionStartTime, sessionStats, config]);

  // Process slash command
  const processSlashCommand = useCallback(async (input: string): Promise<SlashCommandResult | null> => {
    const trimmedInput = input.trim();
    
    // Check if it's a slash command
    if (!trimmedInput.startsWith('/')) {
      return null;
    }

    // Parse command and arguments
    const parts = trimmedInput.slice(1).split(' ');
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Find matching command
    const command = commands.find(cmd => 
      cmd.name === commandName || (cmd.altNames && cmd.altNames.includes(commandName))
    );

    if (!command) {
      addItem({
        type: 'error',
        content: `❌ Unknown command: /${commandName}. Type /help for available commands.`,
        timestamp: new Date(),
      });
      return {
        type: 'error',
      };
    }

    // Execute command
    try {
      const context = createContext();
      const result = await command.action(context, args);
      
      // Update session stats
      setSessionStats(prev => ({
        ...prev,
        promptCount: prev.promptCount + 1,
      }));

      return result || { type: 'info' };
    } catch (error) {
      addItem({
        type: 'error',
        content: `❌ Error executing /${commandName}: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
      });
      return {
        type: 'error',
      };
    }
  }, [commands, createContext, addItem]);

  // Check if input is a slash command
  const isSlashCommand = useCallback((input: string): boolean => {
    return input.trim().startsWith('/');
  }, []);

  // Get command suggestions for autocomplete
  const getCommandSuggestions = useCallback((partial: string): string[] => {
    if (!partial.startsWith('/')) return [];
    
    const query = partial.slice(1).toLowerCase();
    return commands
      .filter(cmd => cmd.name.startsWith(query))
      .map(cmd => `/${cmd.name}`);
  }, [commands]);

  return {
    commands,
    processSlashCommand,
    isSlashCommand,
    getCommandSuggestions,
    sessionStats,
  };
};