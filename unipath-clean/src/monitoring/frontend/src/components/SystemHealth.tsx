import React from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  Memory as MemoryIcon,
  Storage,
  CloudQueue,
} from '@mui/icons-material';
import { useMetrics } from '../contexts/MetricsContext';

const SystemHealth: React.FC = () => {
  const { metrics } = useMetrics();
  const health = metrics.systemHealth;

  if (!health) {
    return <Box>Loading health data...</Box>;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'online':
        return <CheckCircle color="success" />;
      case 'degraded':
        return <Warning color="warning" />;
      case 'error':
      case 'offline':
        return <Error color="error" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string): any => {
    switch (status) {
      case 'healthy':
      case 'online':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'error':
      case 'offline':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        {getStatusIcon(health.status)}
        <Typography variant="h6" sx={{ ml: 1 }}>
          System {health.status}
        </Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" gutterBottom>
        Uptime: {formatUptime(health.uptime)}
      </Typography>

      <List dense sx={{ flex: 1 }}>
        <ListItem>
          <ListItemIcon>
            <MemoryIcon />
          </ListItemIcon>
          <ListItemText
            primary="Memory"
            secondary={
              <Box>
                <Typography variant="caption">
                  {formatBytes(health.memoryUsage.used)} / {formatBytes(health.memoryUsage.total)}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={health.memoryUsage.percentage}
                  color={
                    health.memoryUsage.percentage > 80
                      ? 'error'
                      : health.memoryUsage.percentage > 60
                      ? 'warning'
                      : 'primary'
                  }
                  sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
                />
              </Box>
            }
          />
        </ListItem>

        <ListItem>
          <ListItemIcon>
            <Storage />
          </ListItemIcon>
          <ListItemText
            primary="Disk Usage"
            secondary={
              <Box>
                <Typography variant="caption">
                  DB: {formatBytes(health.diskUsage.dbSize)}
                </Typography>
                <Typography variant="caption" display="block">
                  Cache: {formatBytes(health.diskUsage.cacheSize)}
                </Typography>
                <Typography variant="caption" display="block">
                  Logs: {formatBytes(health.diskUsage.logsSize)}
                </Typography>
              </Box>
            }
          />
        </ListItem>

        <ListItem>
          <ListItemIcon>
            <CloudQueue />
          </ListItemIcon>
          <ListItemText
            primary="API Status"
            secondary={
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Chip
                  label="DeepSeek"
                  size="small"
                  color={getStatusColor(health.apiHealth.deepseek)}
                  icon={getStatusIcon(health.apiHealth.deepseek) || undefined}
                />
                <Chip
                  label="Embeddings"
                  size="small"
                  color={getStatusColor(health.apiHealth.embeddings)}
                  icon={getStatusIcon(health.apiHealth.embeddings) || undefined}
                />
              </Box>
            }
          />
        </ListItem>
      </List>

      {health.errors.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="error">
            Recent Errors: {health.errors.length}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default SystemHealth;