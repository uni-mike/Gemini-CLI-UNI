import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Box, Typography } from '@mui/material';
import { useMetrics } from '../contexts/MetricsContext';

const ToolStats: React.FC = () => {
  const { metrics } = useMetrics();
  const toolStats = metrics.toolStats;

  if (!toolStats || !(toolStats instanceof Map || Array.isArray(toolStats))) {
    return <Box>No tool statistics available</Box>;
  }

  const data = Array.from(
    toolStats instanceof Map ? toolStats.entries() : toolStats
  ).map(([name, stats]: [string, any]) => ({
    name,
    count: stats.count,
    success: stats.successCount,
    failed: stats.count - stats.successCount,
    avgDuration: Math.round(stats.avgDuration),
  }));

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="name" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
            }}
          />
          <Legend />
          <Bar dataKey="success" stackId="a" fill="#66bb6a" />
          <Bar dataKey="failed" stackId="a" fill="#f44336" />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default ToolStats;