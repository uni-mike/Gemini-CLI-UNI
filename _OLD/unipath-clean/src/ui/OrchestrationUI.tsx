import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { Orchestrator } from '../core/orchestrator.js';

interface OrchestrationUIProps {
  orchestrator: Orchestrator;
}

interface ToolExecution {
  name: string;
  args: any;
  status: 'pending' | 'running' | 'completed' | 'rejected';
  result?: any;
}

interface OrchestrationState {
  active: boolean;
  phase: 'idle' | 'thinking' | 'tools' | 'responding';
  prompt?: string;
  response?: string;
  tools: ToolExecution[];
  error?: string;
}

export const OrchestrationUI: React.FC<OrchestrationUIProps> = ({ orchestrator }) => {
  const [state, setState] = useState<OrchestrationState>({
    active: false,
    phase: 'idle',
    tools: []
  });
  
  useEffect(() => {
    const handleStart = ({ prompt }: any) => {
      setState({
        active: true,
        phase: 'thinking',
        prompt,
        tools: []
      });
    };
    
    const handleToolsStart = (toolCalls: any[]) => {
      setState(prev => ({
        ...prev,
        phase: 'tools',
        tools: toolCalls.map(call => ({
          name: call.function.name,
          args: JSON.parse(call.function.arguments),
          status: 'pending'
        }))
      }));
    };
    
    const handleToolExecute = ({ name }: any) => {
      setState(prev => ({
        ...prev,
        tools: prev.tools.map(t => 
          t.name === name ? { ...t, status: 'running' } : t
        )
      }));
    };
    
    const handleToolResult = ({ name, result }: any) => {
      setState(prev => ({
        ...prev,
        tools: prev.tools.map(t => 
          t.name === name ? { ...t, status: 'completed', result } : t
        )
      }));
    };
    
    const handleToolRejected = ({ name }: any) => {
      setState(prev => ({
        ...prev,
        tools: prev.tools.map(t => 
          t.name === name ? { ...t, status: 'rejected' } : t
        )
      }));
    };
    
    const handleComplete = ({ response }: any) => {
      setState(prev => ({
        ...prev,
        active: false,
        phase: 'idle',
        response
      }));
    };
    
    const handleError = (error: any) => {
      setState(prev => ({
        ...prev,
        active: false,
        phase: 'idle',
        error: error.message
      }));
    };
    
    orchestrator.on('orchestration-start', handleStart);
    orchestrator.on('tools-start', handleToolsStart);
    orchestrator.on('tool-execute', handleToolExecute);
    orchestrator.on('tool-result', handleToolResult);
    orchestrator.on('tool-rejected', handleToolRejected);
    orchestrator.on('orchestration-complete', handleComplete);
    orchestrator.on('orchestration-error', handleError);
    
    return () => {
      orchestrator.off('orchestration-start', handleStart);
      orchestrator.off('tools-start', handleToolsStart);
      orchestrator.off('tool-execute', handleToolExecute);
      orchestrator.off('tool-result', handleToolResult);
      orchestrator.off('tool-rejected', handleToolRejected);
      orchestrator.off('orchestration-complete', handleComplete);
      orchestrator.off('orchestration-error', handleError);
    };
  }, [orchestrator]);
  
  if (!state.active && !state.response && !state.error) return null;
  
  return (
    <Box flexDirection="column" marginY={1}>
      {/* Orchestration Header */}
      {state.active && (
        <Box borderStyle="round" borderColor="magenta" paddingX={1}>
          <Text bold color="magenta">
            🎭 Orchestration {state.phase === 'thinking' ? 'Planning' : 
                             state.phase === 'tools' ? 'Executing' : 
                             'Responding'}
          </Text>
        </Box>
      )}
      
      {/* Phase Display */}
      {state.phase === 'thinking' && (
        <Box marginLeft={2} marginTop={1}>
          <Text color="yellow">
            <Spinner /> Analyzing request...
          </Text>
        </Box>
      )}
      
      {/* Tools Execution */}
      {state.tools.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Box marginLeft={2}>
            <Text bold color="cyan">🔧 Tools:</Text>
          </Box>
          {state.tools.map((tool, index) => (
            <Box key={`${tool.name}-${index}`} marginLeft={4}>
              {tool.status === 'pending' && (
                <Text color="gray">⏳ {tool.name}</Text>
              )}
              {tool.status === 'running' && (
                <Text color="yellow">
                  <Spinner /> {tool.name}
                </Text>
              )}
              {tool.status === 'completed' && (
                <Text color="green">✅ {tool.name}</Text>
              )}
              {tool.status === 'rejected' && (
                <Text color="red">❌ {tool.name} (rejected)</Text>
              )}
            </Box>
          ))}
        </Box>
      )}
      
      {/* Response */}
      {state.response && (
        <Box marginTop={1} marginLeft={2}>
          <Text color="green">✨ {state.response}</Text>
        </Box>
      )}
      
      {/* Error */}
      {state.error && (
        <Box marginTop={1} marginLeft={2}>
          <Text color="red">❌ Error: {state.error}</Text>
        </Box>
      )}
    </Box>
  );
};