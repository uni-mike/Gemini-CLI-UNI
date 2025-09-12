import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { DeepSeekOrchestrator, OrchestrationStep } from '../core/deepseek.js';

interface DeepSeekUIProps {
  orchestrator: DeepSeekOrchestrator;
}

export const DeepSeekUI: React.FC<DeepSeekUIProps> = ({ orchestrator }) => {
  const [steps, setSteps] = useState<OrchestrationStep[]>([]);
  const [active, setActive] = useState(false);
  
  useEffect(() => {
    const handleStart = () => setActive(true);
    const handleComplete = () => setActive(false);
    const handleStepUpdate = () => {
      setSteps([...orchestrator.getSteps()]);
    };
    
    orchestrator.on('start', handleStart);
    orchestrator.on('complete', handleComplete);
    orchestrator.on('step', handleStepUpdate);
    orchestrator.on('step-update', handleStepUpdate);
    
    return () => {
      orchestrator.off('start', handleStart);
      orchestrator.off('complete', handleComplete);
      orchestrator.off('step', handleStepUpdate);
      orchestrator.off('step-update', handleStepUpdate);
    };
  }, [orchestrator]);
  
  if (!active && steps.length === 0) return null;
  
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1} marginY={1}>
      <Text bold color="magenta">🎭 DeepSeek R1 Orchestration</Text>
      
      {steps.map((step, index) => (
        <Box key={`${step.type}-${index}`} marginLeft={2} marginTop={index === 0 ? 1 : 0}>
          {step.status === 'running' && (
            <>
              <Text color="yellow"><Spinner /></Text>
              <Text color="yellow"> {step.content}</Text>
            </>
          )}
          {step.status === 'completed' && (
            <Text color="green">✅ {step.content}</Text>
          )}
          {step.status === 'pending' && (
            <Text color="gray">⏳ {step.content}</Text>
          )}
        </Box>
      ))}
      
      {!active && steps.length > 0 && (
        <Box marginTop={1}>
          <Text color="cyan" bold>✨ Orchestration complete!</Text>
        </Box>
      )}
    </Box>
  );
};