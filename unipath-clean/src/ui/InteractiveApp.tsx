/**
 * Interactive App - Full-featured UNIPATH CLI with Trio Pattern
 * Features beautiful UI, animations, slash commands, and real-time orchestration
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { LoadingIndicator } from './components/LoadingIndicator.js';
import { OrchestratorTrio } from '../core/orchestrator-trio.js';
import { Config } from '../config/Config.js';
import { useSlashCommands } from './hooks/useSlashCommands.js';

interface InteractiveAppProps {
  config: Config;
}

interface HistoryItem {
  id: number;
  type: 'user' | 'assistant' | 'info' | 'error' | 'help' | 'quit';
  content: string;
  timestamp: Date;
}

const Colors = {
  AccentBlue: '#3B82F6',
  AccentGreen: '#10B981',
  AccentYellow: '#F59E0B',
  AccentRed: '#EF4444',
  AccentPurple: '#8B5CF6',
  Gray: '#6B7280',
  Foreground: '#FFFFFF',
};

export const InteractiveApp: React.FC<InteractiveAppProps> = ({ config }) => {
  const [orchestrator] = useState(() => new OrchestratorTrio(config));
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPhrase, setCurrentPhrase] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [shouldExit, setShouldExit] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout>();
  const nextId = useRef(1);
  const { stdout } = useStdout();

  // Loading phrases for variety
  const loadingPhrases = [
    'Orchestrating the Trio...',
    'Planner analyzing your request...',
    'Executor preparing tools...',
    'Trio components communicating...',
    'Processing with AI intelligence...',
    'Coordinating task execution...',
    'Advanced tools at work...',
    'Planner creating execution plan...',
    'Executor mapping parameters...',
    'Orchestrator mediating...',
  ];

  // Utility functions
  const addHistoryItem = useCallback((item: Omit<HistoryItem, 'id'>) => {
    const newItem: HistoryItem = {
      ...item,
      id: nextId.current++,
    };
    setHistory(prev => [...prev, newItem]);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    console.clear();
  }, []);

  const refreshStatic = useCallback(() => {
    // In a full implementation, this would refresh the static display
    console.clear();
  }, []);

  // Slash commands integration
  const {
    processSlashCommand,
    isSlashCommand,
    getCommandSuggestions,
    sessionStats,
  } = useSlashCommands({
    addItem: addHistoryItem,
    clearItems: clearHistory,
    refreshStatic,
    orchestrator,
    config,
  });

  // Initialize with welcome message
  useEffect(() => {
    addHistoryItem({
      type: 'info',
      content: `🎭 UNIPATH CLI with Orchestration Trio
  • Planner: Analyzes and plans tasks
  • Executor: Executes tasks with tools  
  • Orchestrator: Coordinates and mediates

Type your request or use /help for commands`,
      timestamp: new Date(),
    });
  }, [addHistoryItem]);

  // Timer for loading animation
  useEffect(() => {
    if (isProcessing) {
      const startTime = Date.now();
      const phraseIndex = Math.floor(Math.random() * loadingPhrases.length);
      setCurrentPhrase(loadingPhrases[phraseIndex]);
      
      intervalRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else {
      setElapsedTime(0);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  }, [isProcessing, loadingPhrases]);

  // Handle orchestration events
  useEffect(() => {
    const handleOrchestrationStart = () => {
      setIsProcessing(true);
    };

    const handleOrchestrationComplete = ({ response }: any) => {
      setIsProcessing(false);
      addHistoryItem({
        type: 'assistant',
        content: response,
        timestamp: new Date(),
      });
    };

    const handleOrchestrationError = (error: any) => {
      setIsProcessing(false);
      addHistoryItem({
        type: 'error',
        content: `❌ Error: ${error.message || error}`,
        timestamp: new Date(),
      });
    };

    orchestrator.on('orchestration-start', handleOrchestrationStart);
    orchestrator.on('orchestration-complete', handleOrchestrationComplete);
    orchestrator.on('orchestration-error', handleOrchestrationError);

    return () => {
      orchestrator.off('orchestration-start', handleOrchestrationStart);
      orchestrator.off('orchestration-complete', handleOrchestrationComplete);
      orchestrator.off('orchestration-error', handleOrchestrationError);
    };
  }, [orchestrator, addHistoryItem]);

  // Handle user input
  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isProcessing) return;

    const userInput = input.trim();
    setInput('');

    // Add user message to history
    addHistoryItem({
      type: 'user',
      content: userInput,
      timestamp: new Date(),
    });

    try {
      // Check if it's a slash command
      if (isSlashCommand(userInput)) {
        const result = await processSlashCommand(userInput);
        if (result?.shouldExit) {
          setShouldExit(true);
          setTimeout(() => process.exit(0), 2000);
          return;
        }
        return;
      }

      // Execute with orchestrator
      setIsProcessing(true);
      await orchestrator.execute(userInput);
    } catch (error) {
      setIsProcessing(false);
      addHistoryItem({
        type: 'error',
        content: `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
      });
    }
  }, [input, isProcessing, addHistoryItem, isSlashCommand, processSlashCommand, orchestrator]);

  // Input handling
  useInput((input, key) => {
    if (key.return) {
      handleSubmit();
    } else if (key.ctrl && input === 'c') {
      if (isProcessing) {
        setIsProcessing(false);
        addHistoryItem({
          type: 'info',
          content: '⏹️  Operation cancelled',
          timestamp: new Date(),
        });
      } else {
        setShouldExit(true);
        setTimeout(() => process.exit(0), 1000);
      }
    } else if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
    } else if (input && !key.meta && !key.ctrl && !key.escape) {
      setInput(prev => prev + input);
    }
  });

  if (shouldExit) {
    return (
      <Box flexDirection="column">
        <Text color={Colors.AccentGreen}>👋 Goodbye!</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%">
      {/* Header */}
      <Box marginBottom={1}>
        <Text color={Colors.AccentPurple} bold>🎭 UNIPATH CLI</Text>
        <Text color={Colors.Gray}> with Orchestration Trio</Text>
      </Box>

      {/* History */}
      <Box flexDirection="column" marginBottom={1}>
        {history.map((item) => (
          <Box key={item.id} marginBottom={1}>
            <Box>
              {item.type === 'user' && (
                <>
                  <Text color={Colors.AccentBlue} bold>❯ </Text>
                  <Text>{item.content}</Text>
                </>
              )}
              {item.type === 'assistant' && (
                <>
                  <Text color={Colors.AccentGreen} bold>🎭 </Text>
                  <Text>{item.content}</Text>
                </>
              )}
              {item.type === 'info' && (
                <>
                  <Text color={Colors.AccentBlue} bold>ℹ️  </Text>
                  <Text>{item.content}</Text>
                </>
              )}
              {item.type === 'error' && (
                <>
                  <Text color={Colors.AccentRed} bold>❌ </Text>
                  <Text color={Colors.AccentRed}>{item.content}</Text>
                </>
              )}
              {item.type === 'help' && (
                <Text color={Colors.Foreground}>{item.content}</Text>
              )}
              {item.type === 'quit' && (
                <Text color={Colors.AccentGreen}>{item.content}</Text>
              )}
            </Box>
          </Box>
        ))}
      </Box>

      {/* Loading Indicator */}
      <LoadingIndicator
        isActive={isProcessing}
        currentLoadingPhrase={currentPhrase}
        elapsedTime={elapsedTime}
      />

      {/* Input Prompt */}
      <Box>
        <Text color={Colors.AccentBlue} bold>❯ </Text>
        <Text>{input}</Text>
        <Text color={Colors.Gray}>█</Text>
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text color={Colors.Gray}>
          {isProcessing 
            ? 'Press Ctrl+C to cancel' 
            : `Ready • ${sessionStats.promptCount} prompts • Type /help for commands`}
        </Text>
      </Box>
    </Box>
  );
};