import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Box, Typography, Chip } from '@mui/material';
import { useMetrics } from '../contexts/MetricsContext';

const RetrievalMetrics: React.FC = () => {
  const { metrics } = useMetrics();
  const retrievals = metrics.retrievals || [];
  const stats = metrics.retrievalStats || {};

  const data = retrievals.slice(-20).map((r: any, index: number) => ({
    index,
    chunks: r.chunksRetrieved,
    similarity: r.avgSimilarity * 100,
    duration: r.duration,
  }));

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Chip 
          label={`Queries: ${stats.totalQueries || 0}`} 
          size="small" 
          variant="outlined" 
        />
        <Chip 
          label={`Avg Chunks: ${(stats.avgChunks || 0).toFixed(1)}`} 
          size="small" 
          variant="outlined" 
        />
        <Chip 
          label={`Avg Similarity: ${((stats.avgSimilarity || 0) * 100).toFixed(1)}%`} 
          size="small" 
          variant="outlined" 
        />
        <Chip 
          label={`Avg Duration: ${(stats.avgDuration || 0).toFixed(0)}ms`} 
          size="small" 
          variant="outlined" 
        />
      </Box>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="index" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="chunks"
            stroke="#8884d8"
            name="Chunks"
          />
          <Line
            type="monotone"
            dataKey="similarity"
            stroke="#82ca9d"
            name="Similarity %"
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default RetrievalMetrics;