/**
 * Monitoring Server (Simplified for Development)
 * Express backend for monitoring dashboard without complex dependencies
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';

export class MonitoringServer {
  private app: express.Application;
  private server: any;
  private io: SocketServer;
  private port: number;
  
  // Getter for port
  getPort(): number {
    return this.port;
  }
  
  constructor(port: number = 4000) {
    this.port = port;
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketServer(this.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }
  
  /**
   * Setup Express middleware
   */
  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }
  
  /**
   * Setup API routes
   */
  private setupRoutes() {
    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        uptime: process.uptime(),
        timestamp: new Date()
      });
    });
    
    // Overview endpoint - mock data for development
    this.app.get('/api/overview', async (req, res) => {
      try {
        const mockStats = {
          totalSessions: 5,
          totalChunks: 150,
          totalCommits: 12,
          totalLogs: 45,
          activeSession: 'session-123'
        };
        
        const mockSystemHealth = {
          status: 'healthy',
          memoryUsage: { percentage: 75 },
          diskUsage: { dbSize: 2048000 }
        };
        
        res.json({
          stats: mockStats,
          systemHealth: mockSystemHealth,
          tokenUsage: { total: 12500, used: 8300, remaining: 4200 },
          toolStats: [],
          retrievalStats: { hits: 45, misses: 3 },
          uptime: process.uptime() * 1000
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Memory layers endpoint
    this.app.get('/api/memory', async (req, res) => {
      try {
        res.json({
          layers: [
            { name: 'Code Index', status: 'active', chunks: 85 },
            { name: 'Git Context', status: 'active', commits: 12 },
            { name: 'Knowledge Base', status: 'active', entries: 34 },
            { name: 'Conversation', status: 'active', context: [] },
            { name: 'Project Context', status: 'active', metadata: {} }
          ],
          tokenBudget: { total: 12500, used: 8300, remaining: 4200 },
          retrievalStats: { hits: 45, misses: 3 }
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Tools endpoint
    this.app.get('/api/tools', async (req, res) => {
      try {
        res.json({
          stats: [],
          recentExecutions: [
            {
              id: 'exec-1',
              tool: 'Bash',
              success: true,
              duration: 250,
              timestamp: new Date()
            },
            {
              id: 'exec-2', 
              tool: 'Read',
              success: true,
              duration: 120,
              timestamp: new Date()
            }
          ],
          activeTools: ['Bash', 'Read', 'Write', 'Edit', 'Glob']
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get all metrics
    this.app.get('/api/metrics', (req, res) => {
      res.json({
        tokenUsage: { total: 12500, used: 8300, remaining: 4200 },
        systemHealth: { status: 'healthy', memoryUsage: { percentage: 75 } },
        toolStats: [],
        memoryLayers: []
      });
    });
    
    // Get recent events
    this.app.get('/api/events', (req, res) => {
      const limit = parseInt(req.query.limit as string) || 100;
      res.json([
        { id: 1, type: 'tool_execution', tool: 'Bash', timestamp: new Date() },
        { id: 2, type: 'memory_update', layer: 'Code Index', timestamp: new Date() }
      ]);
    });

    // Get available agent processes
    this.app.get('/api/agents', async (req, res) => {
      try {
        // Multiple agents for dropdown testing
        const agents = [
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
          },
          {
            pid: process.pid + 2,
            projectName: 'Demo Project Beta',
            memory: { rss: 45 * 1024 * 1024, vsz: 90 * 1024 * 1024 },
            isPrimary: false
          }
        ];
        res.json(agents);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get sessions
    this.app.get('/api/sessions', async (req, res) => {
      try {
        const sessions = [
          {
            id: 'session-1',
            startedAt: new Date(),
            status: 'active',
            project: { name: 'UNIPATH FlexiCLI' },
            snapshots: [{ id: 'snap-1', sequenceNumber: 1 }]
          },
          {
            id: 'session-2', 
            startedAt: new Date(Date.now() - 3600000),
            status: 'completed',
            project: { name: 'Test Project' },
            snapshots: [{ id: 'snap-2', sequenceNumber: 2 }]
          }
        ];
        res.json(sessions);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get pipeline flow data with mock metrics
    this.app.get('/api/pipeline', async (req, res) => {
      try {
        const componentCounts = {
          input: 5,
          orchestrator: 5,
          planner: 4,
          memory: 15,
          executor: 35,
          llm: 8,
          embeddings: 12,
          tools: 35,
          output: 5
        };
        
        res.json({
          nodes: this.buildPipelineNodes(componentCounts),
          edges: this.buildPipelineEdges(),
          stats: {
            totalExecutions: 45,
            activeComponents: 9,
            avgLatency: 275,
            lastActivity: new Date()
          }
        });
      } catch (error: any) {
        console.error('Pipeline API error:', error);
        res.json({
          nodes: this.buildPipelineNodes(),
          edges: this.buildPipelineEdges(),
          stats: {
            totalExecutions: 0,
            activeComponents: 0,
            avgLatency: 0,
            lastActivity: null
          }
        });
      }
    });
    
    // Clear metrics
    this.app.post('/api/metrics/clear', (req, res) => {
      res.json({ success: true });
    });
  }
  
  /**
   * Setup Socket.io handlers
   */
  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      // Send initial metrics
      socket.emit('metrics:initial', {
        tokenUsage: { total: 12500, used: 8300, remaining: 4200 },
        systemHealth: { status: 'healthy', memoryUsage: { percentage: 75 } }
      });
      
      // Handle metric requests
      socket.on('metrics:request', (type: string) => {
        socket.emit(`metrics:${type}`, {});
      });
      
      // Handle disconnect
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }
  
  /**
   * Build pipeline nodes for visualization with real counts
   */
  private buildPipelineNodes(counts: Record<string, number> = {}) {
    const getStatus = (count: number) => {
      if (count > 10) return 'active';
      if (count > 0) return 'processing';
      return 'idle';
    };
    
    return [
      {
        id: 'input',
        type: 'input',
        data: { 
          label: 'User Query', 
          status: getStatus(counts.input || 0),
          count: counts.input || 0
        },
        position: { x: 100, y: 200 }
      },
      {
        id: 'orchestrator',
        type: 'process',
        data: { 
          label: 'Orchestrator', 
          status: getStatus(counts.orchestrator || 0),
          count: counts.orchestrator || 0
        },
        position: { x: 300, y: 200 }
      },
      {
        id: 'planner',
        type: 'process',
        data: { 
          label: 'Planner', 
          status: getStatus(counts.planner || 0),
          count: counts.planner || 0
        },
        position: { x: 500, y: 100 }
      },
      {
        id: 'memory',
        type: 'process',
        data: { 
          label: 'Memory Manager', 
          status: getStatus(counts.memory || 0),
          count: counts.memory || 0
        },
        position: { x: 500, y: 200 }
      },
      {
        id: 'executor',
        type: 'process',
        data: { 
          label: 'Executor', 
          status: getStatus(counts.executor || 0),
          count: counts.executor || 0
        },
        position: { x: 500, y: 300 }
      },
      {
        id: 'tools',
        type: 'process',
        data: { 
          label: 'Tools', 
          status: getStatus(counts.tools || 0),
          count: counts.tools || 0
        },
        position: { x: 700, y: 300 }
      },
      {
        id: 'llm',
        type: 'process',
        data: { 
          label: 'DeepSeek LLM', 
          status: getStatus(counts.llm || 0),
          count: counts.llm || 0
        },
        position: { x: 700, y: 100 }
      },
      {
        id: 'embeddings',
        type: 'process',
        data: { 
          label: 'Embeddings API', 
          status: getStatus(counts.embeddings || 0),
          count: counts.embeddings || 0
        },
        position: { x: 700, y: 200 }
      },
      {
        id: 'output',
        type: 'output',
        data: { 
          label: 'Response', 
          status: getStatus(counts.output || 0),
          count: counts.output || 0
        },
        position: { x: 900, y: 200 }
      }
    ];
  }
  
  /**
   * Build pipeline edges for visualization
   */
  private buildPipelineEdges() {
    return [
      { id: 'e1', source: 'input', target: 'orchestrator', animated: true },
      { id: 'e2', source: 'orchestrator', target: 'planner' },
      { id: 'e3', source: 'orchestrator', target: 'memory' },
      { id: 'e4', source: 'orchestrator', target: 'executor' },
      { id: 'e5', source: 'planner', target: 'llm' },
      { id: 'e6', source: 'executor', target: 'tools' },
      { id: 'e7', source: 'memory', target: 'embeddings' },
      { id: 'e8', source: 'llm', target: 'output' },
      { id: 'e9', source: 'tools', target: 'output' },
      { id: 'e10', source: 'embeddings', target: 'memory', style: { strokeDasharray: 5 } }
    ];
  }
  
  /**
   * Start the monitoring server
   */
  start() {
    this.server.listen(this.port, () => {
      console.log(`🚀 Monitoring server running on http://localhost:${this.port}`);
    });
  }
  
  /**
   * Stop the monitoring server
   */
  async stop() {
    this.server.close();
  }
}

// Start server if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new MonitoringServer(4000);
  server.start();
}