import React, { useState } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  AppBar,
  Toolbar,
  Tabs,
  Tab,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Memory,
  Timeline,
  Storage,
  BugReport,
  Refresh,
  Circle,
} from '@mui/icons-material';
import { useSocket } from '../contexts/SocketContext';
import { useMetrics } from '../contexts/MetricsContext';
import PipelineFlow from './PipelineFlow';
import TokenUsageChart from './TokenUsageChart';
import MemoryLayers from './MemoryLayers';
import SessionHistory from './SessionHistory';
import EventLog from './EventLog';
import SystemHealth from './SystemHealth';
import ToolStats from './ToolStats';
import RetrievalMetrics from './RetrievalMetrics';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const Dashboard: React.FC = () => {
  const { connected } = useSocket();
  const { metrics, refreshMetrics } = useMetrics();
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" sx={{ bgcolor: 'background.paper' }}>
        <Toolbar>
          <DashboardIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            FlexiCLI Monitoring Dashboard
          </Typography>
          <Tooltip title={connected ? 'Connected' : 'Disconnected'}>
            <Circle color={connected ? 'success' : 'error'} sx={{ mr: 2 }} />
          </Tooltip>
          <Chip
            label={metrics.currentSession?.mode || 'No Session'}
            color="primary"
            sx={{ mr: 2 }}
          />
          <Tooltip title="Refresh">
            <IconButton color="inherit" onClick={refreshMetrics}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Toolbar>
        <Tabs value={tabValue} onChange={handleTabChange} centered>
          <Tab icon={<DashboardIcon />} label="Overview" />
          <Tab icon={<Memory />} label="Memory" />
          <Tab icon={<Timeline />} label="Pipeline" />
          <Tab icon={<Storage />} label="Sessions" />
          <Tab icon={<BugReport />} label="Events" />
        </Tabs>
      </AppBar>

      <Container maxWidth={false} sx={{ mt: 3, mb: 3 }}>
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 2, height: '400px' }}>
                <Typography variant="h6" gutterBottom>
                  Token Usage
                </Typography>
                <TokenUsageChart />
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, height: '400px' }}>
                <Typography variant="h6" gutterBottom>
                  System Health
                </Typography>
                <SystemHealth />
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: '400px' }}>
                <Typography variant="h6" gutterBottom>
                  Tool Statistics
                </Typography>
                <ToolStats />
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: '400px' }}>
                <Typography variant="h6" gutterBottom>
                  Retrieval Performance
                </Typography>
                <RetrievalMetrics />
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <MemoryLayers />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Paper sx={{ p: 2, height: '80vh' }}>
            <Typography variant="h6" gutterBottom>
              Pipeline Flow
            </Typography>
            <PipelineFlow />
          </Paper>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <SessionHistory />
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <EventLog />
        </TabPanel>
      </Container>
    </Box>
  );
};

export default Dashboard;