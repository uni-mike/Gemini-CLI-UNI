/**
 * Monitoring Server (Simplified for Development)
 * Express backend for monitoring dashboard without complex dependencies
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { MetricsCollector } from './MetricsCollector';

export class MonitoringServer {
  private app: express.Application;
  private server: any;
  private io: SocketServer;
  private port: number;
  private metricsCollector: MetricsCollector;
  
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
    
    // Initialize metrics collector
    this.metricsCollector = MetricsCollector.getInstance();
    
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
    
    // Overview endpoint - real metrics
    this.app.get('/api/overview', async (req, res) => {
      try {
        const overviewData = this.metricsCollector.getOverviewStats();
        res.json(overviewData);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Memory layers endpoint - real metrics
    this.app.get('/api/memory', async (req, res) => {
      try {
        const memoryData = this.metricsCollector.getMemoryLayers();
        res.json(memoryData);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Tools endpoint - real metrics
    this.app.get('/api/tools', async (req, res) => {
      try {
        const toolsData = this.metricsCollector.getToolStats();
        res.json(toolsData);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get all metrics
    this.app.get('/api/metrics', (req, res) => {
      try {
        const overview = this.metricsCollector.getOverviewStats();
        const memory = this.metricsCollector.getMemoryLayers();
        const tools = this.metricsCollector.getToolStats();
        
        res.json({
          tokenUsage: overview.tokenUsage,
          systemHealth: overview.systemHealth,
          toolStats: tools.tools,
          memoryLayers: memory.layers
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
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
        // Detect running Node.js processes that might be UNIPATH agents
        const agents = [];
        
        try {
          // Look specifically for UNIPATH CLI agents only
          const processes = execSync('ps aux | grep -E "(start-clean|unipath.*cli)" | grep -v grep', { encoding: 'utf8' });
          const lines = processes.trim().split('\n');
          
          for (const line of lines) {
            const parts = line.split(/\s+/);
            if (parts.length >= 11) {
              const pid = parseInt(parts[1]);
              const memoryKB = parseInt(parts[5]);
              const command = parts.slice(10).join(' ');
              
              // Only include actual UNIPATH agents
              if (command.includes('start-clean') || command.includes('unipath') || command.includes('cli.tsx')) {
                agents.push({
                  pid,
                  projectName: 'UNIPATH Agent',
                  memory: { 
                    rss: memoryKB * 1024, 
                    vsz: memoryKB * 1024 * 2 
                  },
                  isPrimary: agents.length === 0, // First one is primary
                  command: command.substring(0, 50) + '...',
                  status: 'active'
                });
              }
            }
          }
        } catch (processError) {
          console.warn('Could not detect UNIPATH agents:', processError);
        }
        
        // Always include current monitoring process
        if (agents.length === 0 || !agents.find(a => a.pid === process.pid)) {
          agents.unshift({
            pid: process.pid,
            projectName: 'Monitoring Server',
            memory: { 
              rss: process.memoryUsage().rss, 
              vsz: process.memoryUsage().heapTotal 
            },
            isPrimary: true,
            command: 'monitoring-server'
          });
        }
        
        res.json(agents);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get projects (from .flexicli directory)
    this.app.get('/api/projects', async (req, res) => {
      try {
        const projects = [];
        const currentDir = process.cwd();
        
        // Check for .flexicli directory - always use root location like .claude  
        const flexicliPath = '/Users/mike.admon/UNIPATH_PROJECT/gemini-cli/.flexicli';
        
        if (fs.existsSync(flexicliPath)) {
          try {
            // Read meta.json to get project information
            const metaPath = path.join(flexicliPath, 'meta.json');
            if (fs.existsSync(metaPath)) {
              const metaContent = fs.readFileSync(metaPath, 'utf8');
              const meta = JSON.parse(metaContent);
              
              // Get database size for metrics
              const dbPath = path.join(flexicliPath, 'flexicli.db');
              let dbSize = 0;
              if (fs.existsSync(dbPath)) {
                dbSize = fs.statSync(dbPath).size;
              }
              
              // Check if there are any session files
              const sessionsPath = path.join(flexicliPath, 'sessions');
              let sessionCount = 0;
              if (fs.existsSync(sessionsPath)) {
                sessionCount = fs.readdirSync(sessionsPath).length;
              }
              
              projects.push({
                id: meta.projectId || 'current-project',
                name: meta.name || 'FlexiCLI Project',
                description: `FlexiCLI project: ${meta.name || 'Current project'}`,
                status: 'active',
                type: 'flexicli',
                rootPath: meta.rootPath,
                createdAt: meta.createdAt,
                updatedAt: meta.updatedAt,
                embeddingsModel: meta.embeddingsModel,
                metrics: {
                  dbSize: Math.round(dbSize / 1024), // Size in KB
                  sessionCount,
                  schemaVersion: meta.schemaVersion
                }
              });
            }
          } catch (parseError) {
            console.warn('Error reading .flexicli metadata:', parseError);
          }
        }
        
        // If no FlexiCLI project found, add a placeholder
        if (projects.length === 0) {
          projects.push({
            id: 'no-project',
            name: 'No FlexiCLI Project',
            description: 'No .flexicli directory found in current working directory',
            status: 'inactive',
            type: 'none',
            metrics: {
              dbSize: 0,
              sessionCount: 0,
              schemaVersion: 0
            }
          });
        }
        
        res.json(projects);
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
    
    // Get pipeline flow data with real metrics
    this.app.get('/api/pipeline', async (req, res) => {
      try {
        const componentCounts = this.metricsCollector.getPipelineMetrics();
        const toolStats = this.metricsCollector.getToolStats();
        
        // Count active components based on actual metrics
        const activeComponents = Object.entries(componentCounts)
          .filter(([_, count]) => count > 0)
          .length;
        
        res.json({
          nodes: this.buildPipelineNodes(componentCounts),
          edges: this.buildPipelineEdges(),
          stats: {
            totalExecutions: toolStats.tools.reduce((sum, t) => sum + t.executions, 0),
            activeComponents,
            avgLatency: toolStats.tools.reduce((sum, t) => sum + t.avgDuration, 0) / Math.max(1, toolStats.tools.length),
            lastActivity: toolStats.recentExecutions[0]?.timestamp || new Date()
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