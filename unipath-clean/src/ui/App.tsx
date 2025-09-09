import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { Config } from '../config/Config.js';
import { Orchestrator } from '../core/orchestrator.js';
import { OrchestrationUI } from './OrchestrationUI.js';

interface AppProps {
  config: Config;
  orchestrator: Orchestrator;
}

interface Message {
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export const App: React.FC<AppProps> = ({ config, orchestrator }) => {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  useInput((input, key) => {
    if (isProcessing) return; // Ignore input while processing
    
    if (key.return) {
      handleSubmit();
    } else if (key.escape) {
      exit();
    } else if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
    } else if (key.ctrl && input === 'c') {
      exit();
    } else if (key.ctrl && input === 'l') {
      // Clear screen
      setMessages([]);
    } else {
      setInput(prev => prev + input);
    }
  });
  
  useEffect(() => {
    // Subscribe to orchestrator events for message updates
    const handleComplete = ({ response }: any) => {
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: response,
        timestamp: new Date()
      }]);
      setIsProcessing(false);
    };
    
    const handleError = (error: any) => {
      setMessages(prev => [...prev, {
        type: 'system',
        content: `Error: ${error.message}`,
        timestamp: new Date()
      }]);
      setIsProcessing(false);
    };
    
    orchestrator.on('orchestration-complete', handleComplete);
    orchestrator.on('orchestration-error', handleError);
    
    return () => {
      orchestrator.off('orchestration-complete', handleComplete);
      orchestrator.off('orchestration-error', handleError);
    };
  }, [orchestrator]);
  
  const handleSubmit = async () => {
    if (input.trim() && !isProcessing) {
      const userInput = input.trim();
      setInput('');
      
      // Add user message
      setMessages(prev => [...prev, {
        type: 'user',
        content: userInput,
        timestamp: new Date()
      }]);
      
      // Process with orchestrator
      setIsProcessing(true);
      await orchestrator.execute(userInput);
    }
  };
  
  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">🚀 UNIPATH CLI</Text>
        <Text color="gray"> • </Text>
        <Text color="yellow">{config.getModel()}</Text>
        <Text color="gray"> • </Text>
        <Text color="green">{config.getApprovalMode()}</Text>
      </Box>
      
      {/* Messages Area */}
      <Box flexDirection="column" flexGrow={1} paddingX={1} overflow="hidden">
        {messages.slice(-10).map((msg, i) => (
          <Box key={i} marginY={0}>
            {msg.type === 'user' && (
              <Text color="cyan">{'▶ '}{msg.content}</Text>
            )}
            {msg.type === 'assistant' && (
              <Text color="green">{'◀ '}{msg.content}</Text>
            )}
            {msg.type === 'system' && (
              <Text color="yellow">{'⚠ '}{msg.content}</Text>
            )}
          </Box>
        ))}
      </Box>
      
      {/* Orchestration UI */}
      <OrchestrationUI orchestrator={orchestrator} />
      
      {/* Input Area */}
      <Box borderStyle="single" borderColor={isProcessing ? "yellow" : "green"} paddingX={1}>
        {isProcessing ? (
          <Text color="yellow">⏳ Processing...</Text>
        ) : (
          <>
            <Text color="green">{'▶ '}</Text>
            <Text>{input}</Text>
            <Text color="gray">│</Text>
          </>
        )}
      </Box>
      
      {/* Help Text */}
      <Box paddingX={1}>
        <Text dimColor>ESC: exit • Ctrl+C: quit • Ctrl+L: clear</Text>
      </Box>
    </Box>
  );
};