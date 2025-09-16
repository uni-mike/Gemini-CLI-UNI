import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Info,
  Warning,
  Error,
  CheckCircle,
  Memory,
  Code,
  Timeline,
  BugReport,
} from '@mui/icons-material';
import { useMetrics } from '../contexts/MetricsContext';
import dayjs from 'dayjs';

const EventLog: React.FC = () => {
  const { events } = useMetrics();

  const getEventIcon = (type: string) => {
    const icons: any = {
      pipeline: <Timeline />,
      memory: <Memory />,
      tool: <Code />,
      session: <CheckCircle />,
      error: <Error />,
      performance: <Info />,
    };
    return icons[type] || <Info />;
  };

  const getEventColor = (type: string): any => {
    const colors: any = {
      pipeline: 'primary',
      memory: 'secondary',
      tool: 'info',
      session: 'success',
      error: 'error',
      performance: 'warning',
    };
    return colors[type] || 'default';
  };

  const formatEventData = (data: any) => {
    if (typeof data === 'string') return data;
    if (data.message) return data.message;
    if (data.error) return `Error: ${data.error}`;
    return JSON.stringify(data, null, 2).substring(0, 100);
  };

  return (
    <Paper sx={{ p: 2, height: '80vh', overflow: 'auto' }}>
      <Typography variant="h6" gutterBottom>
        Event Log
      </Typography>
      
      <List>
        {events.map((event: any, index: number) => (
          <ListItem
            key={event.id || index}
            sx={{
              borderBottom: '1px solid',
              borderColor: 'divider',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <ListItemIcon>{getEventIcon(event.type)}</ListItemIcon>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body1">{event.action}</Typography>
                  <Chip
                    label={event.type}
                    size="small"
                    color={getEventColor(event.type)}
                  />
                  <Chip
                    label={event.component}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              }
              secondary={
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {dayjs(event.timestamp).format('HH:mm:ss.SSS')}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 0.5,
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                    }}
                  >
                    {formatEventData(event.data)}
                  </Typography>
                </Box>
              }
            />
          </ListItem>
        ))}
        
        {events.length === 0 && (
          <ListItem>
            <ListItemText
              primary="No events recorded"
              secondary="Events will appear here as the system processes requests"
            />
          </ListItem>
        )}
      </List>
    </Paper>
  );
};

export default EventLog;