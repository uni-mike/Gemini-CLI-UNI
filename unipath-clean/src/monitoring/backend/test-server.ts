import express from 'express';
import cors from 'cors';

const app = express();
const port = 4000;

app.use(cors());
app.use(express.json());

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mock overview data
app.get('/api/overview', (req, res) => {
  res.json({
    tokenUsage: 12500,
    stats: {
      totalSessions: 5,
      totalChunks: 150,
      totalLogs: 45
    },
    systemHealth: {
      status: 'healthy',
      memoryUsage: { percentage: 75 },
      diskUsage: { dbSize: 2048000 }
    },
    uptime: 3600000
  });
});

// Mock agents data
app.get('/api/agents', (req, res) => {
  res.json([
    {
      pid: process.pid,
      projectName: 'UNIPATH FlexiCLI',
      memory: { rss: 50 * 1024 * 1024, vsz: 100 * 1024 * 1024 },
      isPrimary: true
    },
    {
      pid: process.pid + 1,
      projectName: 'Test Project Alpha',
      memory: { rss: 32 * 1024 * 1024, vsz: 80 * 1024 * 1024 },
      isPrimary: false
    }
  ]);
});

app.listen(port, () => {
  console.log(`🚀 Monitoring backend running on http://localhost:${port}`);
});