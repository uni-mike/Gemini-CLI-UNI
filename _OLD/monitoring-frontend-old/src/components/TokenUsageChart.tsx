import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Bar,
  BarChart,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Box, Grid, Typography, LinearProgress, Chip } from '@mui/material';
import { useMetrics } from '../contexts/MetricsContext';

const COLORS = {
  ephemeral: '#8884d8',
  retrieved: '#82ca9d',
  knowledge: '#ffc658',
  query: '#ff8042',
  buffer: '#8dd1e1',
  reasoning: '#d084d0',
  code: '#82d982',
  explanation: '#ffb347',
};

const TokenUsageChart: React.FC = () => {
  const { metrics } = useMetrics();
  const tokenUsage = metrics.currentTokenUsage;

  if (!tokenUsage) {
    return <Box>No token data available</Box>;
  }

  const inputData = [
    { name: 'Ephemeral', value: tokenUsage.input.ephemeral, color: COLORS.ephemeral },
    { name: 'Retrieved', value: tokenUsage.input.retrieved, color: COLORS.retrieved },
    { name: 'Knowledge', value: tokenUsage.input.knowledge, color: COLORS.knowledge },
    { name: 'Query', value: tokenUsage.input.query, color: COLORS.query },
    { name: 'Buffer', value: tokenUsage.input.buffer, color: COLORS.buffer },
  ];

  const outputData = [
    { name: 'Reasoning', value: tokenUsage.output.reasoning, color: COLORS.reasoning },
    { name: 'Code', value: tokenUsage.output.code, color: COLORS.code },
    { name: 'Explanation', value: tokenUsage.output.explanation, color: COLORS.explanation },
    { name: 'Buffer', value: tokenUsage.output.buffer, color: COLORS.buffer },
  ];

  const inputPercentage = (tokenUsage.input.total / tokenUsage.input.limit) * 100;
  const outputPercentage = (tokenUsage.output.total / tokenUsage.output.limit) * 100;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            Input Tokens
          </Typography>
          <Chip 
            label={`${tokenUsage.input.total} / ${tokenUsage.input.limit}`}
            color={inputPercentage > 80 ? 'error' : 'primary'}
            size="small"
          />
        </Box>
        <LinearProgress
          variant="determinate"
          value={inputPercentage}
          color={inputPercentage > 80 ? 'error' : inputPercentage > 60 ? 'warning' : 'primary'}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            Output Tokens
          </Typography>
          <Chip
            label={`${tokenUsage.output.total} / ${tokenUsage.output.limit}`}
            color={outputPercentage > 80 ? 'error' : 'primary'}
            size="small"
          />
        </Box>
        <LinearProgress
          variant="determinate"
          value={outputPercentage}
          color={outputPercentage > 80 ? 'error' : outputPercentage > 60 ? 'warning' : 'primary'}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>

      <Grid container spacing={2} sx={{ flex: 1 }}>
        <Grid item xs={6}>
          <Typography variant="caption" align="center" display="block" gutterBottom>
            Input Distribution
          </Typography>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={inputData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {inputData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="caption" align="center" display="block" gutterBottom>
            Output Distribution
          </Typography>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={outputData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {outputData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Grid>
      </Grid>

      <Typography variant="caption" align="center" sx={{ mt: 2 }}>
        Mode: <strong>{tokenUsage.mode}</strong>
      </Typography>
    </Box>
  );
};

export default TokenUsageChart;