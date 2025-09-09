import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, Static, useStdin, useInput } from 'ink';
import { Config } from '../config/Config.js';
import { Orchestrator } from '../core/orchestrator.js';
import { Header } from './components/Header.js';
import { OperationHistory, Operation } from './components/OperationHistory.js';
import { SessionSummary } from './components/SessionSummary.js';
import { StatusFooter } from './components/StatusFooter.js';
import { Colors } from './Colors.js';

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
  const [operations, setOperations] = useState<Operation[]>([]);
  const [processedOperations] = useState(new Set<string>());
  const [processedResults] = useState(new Set<string>());
  const [showExitSummary, setShowExitSummary] = useState(false);
  const [sessionStartTime] = useState(new Date());
  const [currentStatus, setCurrentStatus] = useState<'idle' | 'processing' | 'thinking' | 'tool-execution' | 'orchestrating' | 'planning' | 'executing'>('idle');
  
  // Check if raw mode is supported - disable in CI/non-TTY environments
  const [rawModeSupported] = useState(() => {
    try {
      // Disable in CI, non-TTY, or when explicitly disabled
      if (process.env.CI || !process.stdin.isTTY || process.env.DISABLE_RAW_MODE === 'true') {
        return false;
      }
      // Check if setRawMode function exists and works
      return typeof process.stdin.setRawMode === 'function';
    } catch (e) {
      return false;
    }
  });

  // Enable input handling only if raw mode is supported
  useInput((input, key) => {
    if (!rawModeSupported || isProcessing) return;
    
    if (key.return) {
      handleSubmit();
    } else if (key.escape) {
      handleExit();
    } else if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
    } else if (key.ctrl && input === 'c') {
      handleExit();
    } else if (key.ctrl && input === 'l') {
      setMessages([]);
      setOperations([]);
    } else {
      setInput(prev => prev + input);
    }
  }, { isActive: rawModeSupported }); // Enable when raw mode is supported
  
  // Keep app alive always
  useEffect(() => {
    const interval = setInterval(() => {
      // Just keep the app alive
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    // Subscribe to orchestrator events for message updates and operations
    const handleStart = ({ prompt }: any) => {
      setCurrentStatus('thinking');
      
      // Don't add status message to chat - it's shown in the status bar
      
      setOperations(prev => {
        // Remove any existing thinking operations first to avoid duplicates
        const filtered = prev.filter(op => op.type !== 'thinking');
        return [...filtered, {
          id: `thinking-${Date.now()}`,
          type: 'thinking',
          status: 'running',
          title: 'Thinking…',
          timestamp: new Date()
        }];
      });
    };

    const handleComplete = ({ response }: any) => {
      if (process.env.DEBUG === 'true') {
        console.log('🎯 handleComplete called with response:', response?.substring(0, 100) + (response?.length > 100 ? '...' : ''));
      }
      
      setCurrentStatus('idle');
      
      // Mark thinking as completed
      setOperations(prev => prev.map(op => 
        op.type === 'thinking' && op.status === 'running' 
          ? { ...op, status: 'completed' as const, details: 'Analysis complete' }
          : op
      ));
      
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: response,
        timestamp: new Date()
      }]);
      setIsProcessing(false);
    };
    
    const handleToolExecute = ({ name, args }: any) => {
      setCurrentStatus('tool-execution');
      
      // Create unique key for this operation to prevent duplicates
      const operationKey = `${name}-${JSON.stringify(args)}`;
      if (processedOperations.has(operationKey)) {
        return; // Skip duplicate
      }
      processedOperations.add(operationKey);
      
      // Create more descriptive operation title
      let operationTitle = '';
      if (name === 'web' && args.action === 'search') {
        operationTitle = `Search(pattern: "${args.query}", output_mode: "web")`;
      } else if (name === 'web' && args.action === 'fetch') {
        operationTitle = `WebFetch(${args.url})`;
      } else if (name === 'file' && args.action === 'write') {
        operationTitle = `Create(${args.path})`;
      } else if (name === 'file' && args.action === 'read') {
        operationTitle = `Read(${args.path})`;
      } else if (name === 'bash') {
        operationTitle = `Bash(${args.command?.substring(0, 40)}${args.command?.length > 40 ? '...' : ''})`;
      } else {
        // Fallback to generic format
        const argValues = Object.values(args).slice(0, 2).map((v: any) => 
          typeof v === 'string' && v.length > 15 ? v.substring(0, 15) + '...' : String(v)
        ).join(', ');
        operationTitle = `${name.charAt(0).toUpperCase() + name.slice(1)}(${argValues})`;
      }
      
      // Add operation message to chat history like Claude Code examples
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: `⏺ ${operationTitle}`,
        timestamp: new Date()
      }]);
      
      // Also track in operations for status
      const operationId = `tool-${name}-${Date.now()}`;
      setOperations(prev => [...prev, {
        id: operationId,
        type: name as any,
        status: 'running',
        title: operationTitle,
        timestamp: new Date()
      }]);
    };

    const handleToolResult = ({ name, result }: any) => {
      // Create unique key for this result to prevent duplicates
      const resultKey = `${name}-${JSON.stringify(result.output || result.error)}`;
      if (processedResults.has(resultKey)) {
        return; // Skip duplicate result
      }
      processedResults.add(resultKey);
      
      setOperations(prev => prev.map(op => 
        op.id.includes(`tool-${name}-`) && op.status === 'running'
          ? { 
              ...op, 
              status: 'completed' as const, 
              details: result.success ? `Completed successfully` : `Failed: ${result.error}`
            }
          : op
      ));
      
      // Add completion message to chat like Claude Code examples
      if (result.success) {
        let completionText = '';
        if (result.output && typeof result.output === 'string') {
          // Check if it's a file creation output with git-diff style
          if (result.output.startsWith('Created ') && result.output.includes(' +  ')) {
            // Show the git-diff style output directly
            completionText = `⎿  ${result.output}`;
          } else {
            const lines = result.output.split('\n').length;
            completionText = `⎿  ${lines > 1 ? `Found ${lines} lines` : result.output.substring(0, 60)}${result.output.length > 60 ? '...' : ''} (ctrl+r to expand)`;
          }
        } else {
          completionText = '⎿  Completed successfully';
        }
        
        setMessages(prev => [...prev, {
          type: 'assistant', 
          content: `  ${completionText}`,
          timestamp: new Date()
        }]);
      }
    };
    
    const handleError = (error: any) => {
      setOperations(prev => prev.map(op => 
        op.status === 'running' 
          ? { ...op, status: 'failed' as const, details: error.message }
          : op
      ));
      
      setMessages(prev => [...prev, {
        type: 'system',
        content: `Error: ${error.message}`,
        timestamp: new Date()
      }]);
      setIsProcessing(false);
    };
    
    orchestrator.on('orchestration-start', handleStart);
    orchestrator.on('orchestration-complete', handleComplete);
    orchestrator.on('orchestration-error', handleError);
    orchestrator.on('tool-execute', handleToolExecute);
    orchestrator.on('tool-result', handleToolResult);
    
    // Handle status updates - show in status bar, not as messages
    const handleStatus = (message: string) => {
      // Update the current status instead of adding as message
      if (message.includes('Orchestrator starting')) {
        setCurrentStatus('orchestrating');
      } else if (message.includes('Analyzing')) {
        setCurrentStatus('thinking');
      } else if (message.includes('Created plan')) {
        setCurrentStatus('planning');
      } else if (message.includes('Executing')) {
        setCurrentStatus('executing');
      }
    };
    
    orchestrator.on('status', handleStatus);
    
    return () => {
      orchestrator.off('orchestration-start', handleStart);
      orchestrator.off('orchestration-complete', handleComplete);
      orchestrator.off('orchestration-error', handleError);
      orchestrator.off('tool-execute', handleToolExecute);
      orchestrator.off('tool-result', handleToolResult);
      orchestrator.off('status', handleStatus);
    };
  }, [orchestrator]);
  
  const formatDuration = (startTime: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - startTime.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(diffSeconds / 60);
    const seconds = diffSeconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };
  
  const handleExit = () => {
    setShowExitSummary(true);
    // Show summary for 3 seconds then exit
    setTimeout(() => {
      exit();
    }, 3000);
  };
  
  const handleSubmit = async () => {
    if (input.trim() && !isProcessing) {
      const userInput = input.trim();
      setInput('');
      
      // Handle slash commands locally
      if (userInput.startsWith('/')) {
        const command = userInput.toLowerCase();
        
        // Add user message for display
        setMessages(prev => [...prev, {
          type: 'user',
          content: userInput,
          timestamp: new Date()
        }]);
        
        if (command === '/quit' || command === '/exit') {
          handleExit();
          return;
        } else if (command === '/clear') {
          setMessages([]);
          setOperations([]);
          return;
        } else if (command === '/help' || command === '/?') {
          setMessages(prev => [...prev, {
            type: 'system',
            content: '🎭 UNIPATH CLI - Help\n\nAvailable Commands:\n  /help, /?           - Show this help message\n  /quit, /exit        - Exit the CLI\n  /clear              - Clear the screen and history\n  /status             - Show system status',
            timestamp: new Date()
          }]);
          return;
        } else if (command === '/status') {
          setMessages(prev => [...prev, {
            type: 'system',
            content: `🔧 System Status:\n  Model: ${config.getModel()}\n  Approval Mode: ${config.getApprovalMode()}\n  Operations: ${operations.length}\n  Messages: ${messages.length}`,
            timestamp: new Date()
          }]);
          return;
        } else {
          setMessages(prev => [...prev, {
            type: 'system',
            content: `Unknown command: ${userInput}. Type /help for available commands.`,
            timestamp: new Date()
          }]);
          return;
        }
      }
      
      // Add user message for regular commands
      setMessages(prev => [...prev, {
        type: 'user',
        content: userInput,
        timestamp: new Date()
      }]);
      
      // Process with orchestrator
      setIsProcessing(true);
      setCurrentStatus('processing');
      await orchestrator.execute(userInput);
    }
  };
  
  if (showExitSummary) {
    return (
      <Box flexDirection="column" width="100%" height="100%" justifyContent="center" alignItems="flex-start" paddingLeft={2}>
        <SessionSummary 
          duration={formatDuration(sessionStartTime)}
          operationsCount={operations.length}
          messagesCount={messages.length}
          model={config.getModel()}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="90%">
      {/* Static Header - professional layout like original UNIPATH */}
      <Static items={[
        <Box flexDirection="column" key="header">
          <Header 
            model={config.getModel()}
            approvalMode={config.getApprovalMode()}
            version="1.0.0"
          />
          
          {/* Operation History - integrated into static header */}
          {operations.length > 0 && (
            <Box marginBottom={1}>
              <OperationHistory operations={operations} maxDisplay={5} />
            </Box>
          )}
        </Box>,
        
        /* Static message history - show all messages */
        ...messages.map((msg, i) => (
          <Box key={`msg-${i}`} marginBottom={1} paddingX={1}>
            {msg.type === 'user' && (
              <Text color={Colors.AccentCyan}>{'▶ '}{msg.content}</Text>
            )}
            {msg.type === 'assistant' && (
              <Text color={Colors.AccentGreen}>{'◀ '}{msg.content}</Text>
            )}
            {msg.type === 'system' && (
              <Text color={Colors.AccentYellow}>{'⚠ '}{msg.content}</Text>
            )}
          </Box>
        ))
      ]}>
        {(item) => item}
      </Static>
      
      {/* Main controls area - professional layout */}
      <Box flexDirection="column">
        {/* Input Area - professional rounded border */}
        <Box 
          borderStyle="round" 
          borderColor={rawModeSupported ? (isProcessing ? Colors.AccentYellow : Colors.AccentGreen) : Colors.AccentRed} 
          paddingX={1}
          marginY={1}
        >
          {rawModeSupported ? (
            <>
              <Text color={Colors.AccentGreen}>{'▶ '}</Text>
              <Text color={Colors.Foreground}>{input}</Text>
              <Text color={Colors.Comment}>│</Text>
            </>
          ) : (
            <Text color={Colors.AccentRed}>⚠ Interactive input not supported - use --prompt flag</Text>
          )}
        </Box>
        
        {/* Status Footer - always visible at bottom with help text */}
        <StatusFooter
          status={currentStatus}
          approvalMode={config.getApprovalMode()}
          helpText={rawModeSupported ? "ESC: exit • Ctrl+C: quit • Ctrl+L: clear" : 'Use: ./start-clean.sh --prompt "your command" --non-interactive'}
        />
      </Box>
    </Box>
  );
};