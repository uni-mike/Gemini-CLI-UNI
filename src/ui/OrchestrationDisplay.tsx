import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

export const OrchestrationDisplay: React.FC = () => {
  const [tasks, setTasks] = useState([
    { id: 1, name: 'Planning tasks', status: 'running' },
    { id: 2, name: 'Executing operations', status: 'pending' },
    { id: 3, name: 'Summarizing results', status: 'pending' }
  ]);
  
  useEffect(() => {
    // Simulate task progression
    const timers: NodeJS.Timeout[] = [];
    
    timers.push(setTimeout(() => {
      setTasks(prev => prev.map(t => 
        t.id === 1 ? { ...t, status: 'completed' } : t
      ));
      setTasks(prev => prev.map(t => 
        t.id === 2 ? { ...t, status: 'running' } : t
      ));
    }, 1000));
    
    timers.push(setTimeout(() => {
      setTasks(prev => prev.map(t => 
        t.id === 2 ? { ...t, status: 'completed' } : t
      ));
      setTasks(prev => prev.map(t => 
        t.id === 3 ? { ...t, status: 'running' } : t
      ));
    }, 2000));
    
    timers.push(setTimeout(() => {
      setTasks(prev => prev.map(t => 
        t.id === 3 ? { ...t, status: 'completed' } : t
      ));
    }, 2500));
    
    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);
  
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1} marginY={1}>
      <Text bold color="magenta">🎭 Orchestration Active</Text>
      {tasks.map(task => (
        <Box key={task.id} marginLeft={2}>
          {task.status === 'running' && (
            <>
              <Text color="yellow"><Spinner /></Text>
              <Text color="yellow"> {task.name}</Text>
            </>
          )}
          {task.status === 'completed' && (
            <Text color="green">✅ {task.name}</Text>
          )}
          {task.status === 'pending' && (
            <Text color="gray">⏳ {task.name}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
};