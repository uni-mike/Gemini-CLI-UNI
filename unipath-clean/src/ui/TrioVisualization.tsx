/**
 * React Ink component to visualize Trio communication
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, Newline } from 'ink';
import { TrioMessage } from '../core/orchestrator-trio.js';

interface TrioVisualizationProps {
  messages: TrioMessage[];
  showDetails?: boolean;
}

const componentColors = {
  planner: 'blue',
  executor: 'green',
  orchestrator: 'magenta'
};

const messageIcons = {
  question: '❓',
  response: '✅',
  adjustment: '🔧',
  status: '📋',
  error: '❌'
};

export const TrioVisualization: React.FC<TrioVisualizationProps> = ({ 
  messages, 
  showDetails = false 
}) => {
  const [animatedMessages, setAnimatedMessages] = useState<TrioMessage[]>([]);
  
  useEffect(() => {
    // Animate messages appearing one by one
    const timer = setTimeout(() => {
      if (animatedMessages.length < messages.length) {
        setAnimatedMessages(messages.slice(0, animatedMessages.length + 1));
      }
    }, 200);
    
    return () => clearTimeout(timer);
  }, [messages, animatedMessages]);
  
  // Get last 10 messages for display
  const displayMessages = animatedMessages.slice(-10);
  
  // Calculate statistics
  const stats = {
    total: messages.length,
    questions: messages.filter(m => m.type === 'question').length,
    responses: messages.filter(m => m.type === 'response').length,
    errors: messages.filter(m => m.type === 'error').length
  };
  
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🎭 Orchestration Trio Communication
        </Text>
      </Box>
      
      {/* Component Status */}
      <Box marginBottom={1}>
        <Box marginRight={2}>
          <Text color="blue">📘 Planner</Text>
        </Box>
        <Box marginRight={2}>
          <Text color="green">📗 Executor</Text>
        </Box>
        <Box>
          <Text color="magenta">📕 Orchestrator</Text>
        </Box>
      </Box>
      
      {/* Message Flow */}
      <Box flexDirection="column" marginBottom={1}>
        <Text dimColor>━━━ Message Flow ━━━</Text>
        {displayMessages.map((msg, index) => (
          <Box key={index} marginTop={index > 0 ? 0 : 0}>
            <MessageLine message={msg} showDetails={showDetails} />
          </Box>
        ))}
      </Box>
      
      {/* Statistics */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" padding={1}>
        <Box flexDirection="column">
          <Text dimColor>Statistics:</Text>
          <Box>
            <Text color="yellow">Total: {stats.total} </Text>
            <Text color="blue">❓ {stats.questions} </Text>
            <Text color="green">✅ {stats.responses} </Text>
            {stats.errors > 0 && <Text color="red">❌ {stats.errors}</Text>}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

const MessageLine: React.FC<{ message: TrioMessage; showDetails: boolean }> = ({ 
  message, 
  showDetails 
}) => {
  const icon = messageIcons[message.type] || '📩';
  const fromColor = componentColors[message.from];
  const toColor = message.to === 'all' ? 'yellow' : componentColors[message.to as keyof typeof componentColors];
  const arrow = message.to === 'all' ? '📢' : '→';
  
  return (
    <Box>
      <Text>{icon} </Text>
      <Text color={fromColor}>{message.from}</Text>
      <Text> {arrow} </Text>
      <Text color={toColor}>{message.to}</Text>
      <Text dimColor>: </Text>
      <Text>
        {showDetails 
          ? message.content 
          : message.content.substring(0, 40) + (message.content.length > 40 ? '...' : '')}
      </Text>
      {message.requiresResponse && <Text color="yellow"> ⏳</Text>}
    </Box>
  );
};

// Component to show live Trio activity
export const TrioActivity: React.FC<{ orchestrator: any }> = ({ orchestrator }) => {
  const [messages, setMessages] = useState<TrioMessage[]>([]);
  const [plannerStatus, setPlannerStatus] = useState('idle');
  const [executorStatus, setExecutorStatus] = useState('idle');
  const [orchestratorStatus, setOrchestratorStatus] = useState('idle');
  
  useEffect(() => {
    const handleMessage = (msg: TrioMessage) => {
      setMessages(prev => [...prev, msg]);
      
      // Update component status based on message
      if (msg.from === 'planner') setPlannerStatus('active');
      if (msg.from === 'executor') setExecutorStatus('active');
      if (msg.from === 'orchestrator') setOrchestratorStatus('active');
      
      // Reset status after a delay
      setTimeout(() => {
        if (msg.from === 'planner') setPlannerStatus('idle');
        if (msg.from === 'executor') setExecutorStatus('idle');
        if (msg.from === 'orchestrator') setOrchestratorStatus('idle');
      }, 1000);
    };
    
    orchestrator.on('trio-message', handleMessage);
    
    return () => {
      orchestrator.off('trio-message', handleMessage);
    };
  }, [orchestrator]);
  
  return (
    <Box flexDirection="column">
      {/* Live Status Indicators */}
      <Box marginBottom={1}>
        <StatusIndicator name="Planner" status={plannerStatus} color="blue" />
        <StatusIndicator name="Executor" status={executorStatus} color="green" />
        <StatusIndicator name="Orchestrator" status={orchestratorStatus} color="magenta" />
      </Box>
      
      {/* Message Visualization */}
      <TrioVisualization messages={messages} />
    </Box>
  );
};

const StatusIndicator: React.FC<{ 
  name: string; 
  status: string; 
  color: string;
}> = ({ name, status, color }) => {
  const icon = status === 'active' ? '🟢' : '⚪';
  
  return (
    <Box marginRight={2}>
      <Text color={color}>
        {icon} {name}
      </Text>
    </Box>
  );
};