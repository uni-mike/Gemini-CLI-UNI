import React from 'react';
import { Box, Text } from 'ink';

interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
  width?: number;
  showPercentage?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  label,
  width = 30,
  showPercentage = true
}) => {
  const percentage = Math.min(100, Math.round((current / total) * 100));
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  
  return (
    <Box flexDirection="column">
      {label && (
        <Box marginBottom={1}>
          <Text color="cyan">{label}</Text>
        </Box>
      )}
      <Box>
        <Text color="green">{'█'.repeat(filled)}</Text>
        <Text color="gray">{'░'.repeat(empty)}</Text>
        {showPercentage && (
          <Text color="yellow"> {percentage}%</Text>
        )}
      </Box>
      <Box>
        <Text dimColor>
          {current} / {total} completed
        </Text>
      </Box>
    </Box>
  );
};

interface TaskProgressProps {
  tasks: Array<{
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
  }>;
}

export const TaskProgress: React.FC<TaskProgressProps> = ({ tasks }) => {
  const completed = tasks.filter(t => t.status === 'completed').length;
  const total = tasks.length;
  
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="blue" paddingX={1} marginY={1}>
      <Text bold color="blue">📊 Task Progress</Text>
      
      <Box marginTop={1}>
        <ProgressBar 
          current={completed} 
          total={total}
          width={20}
        />
      </Box>
      
      <Box flexDirection="column" marginTop={1}>
        {tasks.map((task, i) => (
          <Box key={i}>
            {task.status === 'completed' && <Text color="green">✓ </Text>}
            {task.status === 'running' && <Text color="yellow">▶ </Text>}
            {task.status === 'pending' && <Text color="gray">○ </Text>}
            {task.status === 'failed' && <Text color="red">✗ </Text>}
            <Text color={
              task.status === 'completed' ? 'green' :
              task.status === 'running' ? 'yellow' :
              task.status === 'failed' ? 'red' : 'gray'
            }>
              {task.name}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};