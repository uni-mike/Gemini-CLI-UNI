import React from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  Memory,
  Storage,
  Code,
  Description,
  GitHub,
  AccessTime,
  CheckCircle,
  Error,
  Warning,
} from '@mui/icons-material';
import { useMetrics } from '../contexts/MetricsContext';

const layerIcons: { [key: string]: React.ReactElement } = {
  ephemeral: <AccessTime />,
  retrieval: <Storage />,
  knowledge: <Memory />,
  execution: <Code />,
  git: <GitHub />,
};

const MemoryLayers: React.FC = () => {
  const { metrics } = useMetrics();
  const layers = metrics.memoryLayers || new Map();
  const layersArray = Array.from(layers instanceof Map ? layers.values() : []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      case 'idle':
      default:
        return <Warning color="warning" />;
    }
  };

  const getLayerColor = (type: string) => {
    const colors: { [key: string]: any } = {
      ephemeral: 'primary',
      retrieval: 'secondary',
      knowledge: 'info',
      execution: 'warning',
      git: 'success',
    };
    return colors[type] || 'default';
  };

  return (
    <Grid container spacing={3}>
      {layersArray.map((layer: any) => (
        <Grid item xs={12} md={6} lg={4} key={layer.name}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              {layerIcons[layer.type] || <Memory />}
              <Typography variant="h6" sx={{ ml: 1, flex: 1 }}>
                {layer.name}
              </Typography>
              {getStatusIcon(layer.status)}
            </Box>

            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Token Usage</Typography>
                <Typography variant="body2">
                  {layer.tokensUsed} / {layer.tokenLimit}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(layer.tokensUsed / layer.tokenLimit) * 100}
                color={getLayerColor(layer.type) as any}
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>

            <List dense>
              <ListItem>
                <ListItemText
                  primary="Items"
                  secondary={layer.itemCount || 0}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Last Accessed"
                  secondary={
                    layer.lastAccessed
                      ? new Date(layer.lastAccessed).toLocaleTimeString()
                      : 'Never'
                  }
                />
              </ListItem>
              {layer.details && (
                <ListItem>
                  <ListItemText
                    primary="Details"
                    secondary={JSON.stringify(layer.details, null, 2)}
                  />
                </ListItem>
              )}
            </List>

            <Divider sx={{ my: 1 }} />

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label={layer.type}
                size="small"
                color={getLayerColor(layer.type) as any}
              />
              <Chip
                label={layer.status}
                size="small"
                variant="outlined"
              />
            </Box>
          </Paper>
        </Grid>
      ))}

      {layersArray.length === 0 && (
        <Grid item xs={12}>
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No memory layer data available
            </Typography>
          </Paper>
        </Grid>
      )}
    </Grid>
  );
};

export default MemoryLayers;