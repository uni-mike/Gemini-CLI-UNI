/**
 * Unified Monitoring Server
 * Combines all monitoring functionality with proper integration to agent monitoring bridge
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { exec, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MetricsCollector } from './MetricsCollector.js';
import { MonitoringBridge } from './monitoring-bridge.js';
import { PrismaClient } from '@prisma/client';
import { toolDiscovery } from '../../tools/auto-discovery.js';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class UnifiedMonitoringServer {
  private app: express.Application;
  private server: any;
  private io: SocketServer;
  private port: number;
  private metricsCollector: MetricsCollector;
  private monitoringBridge: MonitoringBridge | null = null;
  private prisma: PrismaClient;
  private isAttachedToAgent: boolean = false;
  
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
    
    // Initialize Prisma client
    this.prisma = new PrismaClient();
    
    // Use singleton MetricsCollector instance
    this.metricsCollector = MetricsCollector.getInstance();
    
    // Initialize monitoring bridge for agent integration
    // Use process.cwd() since we run from project root
    const projectRoot = process.cwd();
    this.monitoringBridge = new MonitoringBridge(this.prisma, projectRoot);
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
    this.setupRealtimeUpdates();
  }
  
  /**
   * Get port number
   */
  getPort(): number {
    return this.port;
  }
  
  /**
   * Setup Express middleware
   */
  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }
  
  /**
   * Setup real-time updates from MetricsCollector
   */
  private setupRealtimeUpdates() {
    // Poll for updates every second
    setInterval(() => {
      if (this.io.sockets.sockets.size > 0) {
        // Send updated metrics to all connected clients
        const overview = this.metricsCollector.getOverviewStats();
        const memory = this.metricsCollector.getMemoryLayers();
        const tools = this.metricsCollector.getToolStats();
        
        this.io.emit('metrics:update', {
          overview,
          memory,
          tools,
          timestamp: new Date()
        });
      }
    }, 1000);
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
        timestamp: new Date(),
        attachedToAgent: this.isAttachedToAgent,
        monitoringBridgeActive: this.monitoringBridge !== null
      });
    });
    
    // Overview endpoint - real metrics from singleton
    this.app.get('/api/overview', async (req, res) => {
      try {
        const overviewData = this.metricsCollector.getOverviewStats();
        res.json(overviewData);
      } catch (error: any) {
        console.error('Overview API error:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    // Memory layers endpoint - real metrics from singleton
    this.app.get('/api/memory', async (req, res) => {
      try {
        const memoryData = this.metricsCollector.getMemoryLayers();
        res.json(memoryData);
      } catch (error: any) {
        console.error('Memory API error:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    // Tools endpoint - real metrics from singleton
    this.app.get('/api/tools', async (req, res) => {
      try {
        const toolsData = this.metricsCollector.getToolStats();
        res.json(toolsData);
      } catch (error: any) {
        console.error('Tools API error:', error);
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
          memoryLayers: memory.layers,
          attachedToAgent: this.isAttachedToAgent
        });
      } catch (error: any) {
        console.error('Metrics API error:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get recent events from database
    this.app.get('/api/events', async (req, res) => {
      const limit = parseInt(req.query.limit as string) || 100;
      try {
        const events = await this.prisma.executionLog.findMany({
          take: limit,
          orderBy: { createdAt: 'desc' }
        });
        res.json(events.map(e => ({
          id: e.id,
          type: e.type,
          tool: e.tool,
          success: e.success,
          duration: e.duration,
          timestamp: e.createdAt
        })));
      } catch (error) {
        console.warn('Could not fetch events from DB:', error);
        res.json([]);
      }
    });

    // Get available agent processes
    this.app.get('/api/agents', async (req, res) => {
      try {
        const agents = [];
        
        try {
          // Look for UNIPATH CLI agents
          const processes = execSync('ps aux | grep -E "(start-clean|unipath.*cli|tsx.*cli)" | grep -v grep', { encoding: 'utf8' });
          const lines = processes.trim().split('\n');
          
          for (const line of lines) {
            const parts = line.split(/\s+/);
            if (parts.length >= 11) {
              const pid = parseInt(parts[1]);
              const memoryKB = parseInt(parts[5]);
              const command = parts.slice(10).join(' ');
              
              // Only include actual UNIPATH agents
              if (command.includes('start-clean') || command.includes('cli.tsx') || command.includes('cli.js')) {
                agents.push({
                  pid,
                  projectName: 'FlexiCLI Agent',
                  memory: { 
                    rss: memoryKB * 1024, 
                    vsz: memoryKB * 1024 * 2 
                  },
                  isPrimary: agents.length === 0,
                  command: command.substring(0, 50) + '...',
                  status: 'active',
                  attached: pid === process.pid ? this.isAttachedToAgent : false
                });
              }
            }
          }
        } catch (processError) {
          // Ignore if no processes found
        }
        
        // Don't add fake monitoring server - only real agents should be shown
        
        res.json(agents);
      } catch (error: any) {
        console.error('Agents API error:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get projects from database
    this.app.get('/api/projects', async (req, res) => {
      try {
        const projects = await this.prisma.project.findMany();
        
        // Get counts separately
        const projectsWithCounts = await Promise.all(projects.map(async (p) => {
          const chunks = await this.prisma.chunk.count({ where: { projectId: p.id }});
          const sessions = await this.prisma.session.count({ where: { projectId: p.id }});
          const executions = await this.prisma.executionLog.count({ where: { projectId: p.id }});
          
          return {
            ...p,
            _count: {
              chunks,
              sessions,
              executionLogs: executions
            }
          };
        }));
        
        res.json(projectsWithCounts.map(p => ({
          id: p.id,
          name: p.name,
          rootPath: p.rootPath,
          status: 'active',
          type: 'flexicli',
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          metrics: {
            chunks: p._count.chunks,
            sessions: p._count.sessions,
            executions: p._count.executionLogs
          }
        })));
      } catch (error) {
        console.warn('Could not fetch projects from DB:', error);
        res.json([]);
      }
    });

    // Get sessions from database
    this.app.get('/api/sessions', async (req, res) => {
      try {
        // Only fetch agent sessions, not monitoring sessions
        const sessions = await this.prisma.session.findMany({
          where: {
            mode: {
              not: 'monitoring'
            }
          },
          take: 10,
          orderBy: { startedAt: 'desc' }
        });
        
        // Get execution counts separately
        const sessionsWithCounts = await Promise.all(sessions.map(async (s) => {
          const executionCount = await this.prisma.executionLog.count({ 
            where: { sessionId: s.id }
          });
          
          return {
            ...s,
            _count: {
              executionLogs: executionCount
            }
          };
        }));
        
        res.json(sessionsWithCounts.map(s => ({
          id: s.id,
          mode: s.mode,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          turnCount: s.turnCount,
          tokensUsed: s.tokensUsed,
          status: s.status,
          executionCount: s._count.executionLogs
        })));
      } catch (error) {
        console.warn('Could not fetch sessions from DB:', error);
        res.json([]);
      }
    });
    
    // Get pipeline flow data
    this.app.get('/api/pipeline', async (req, res) => {
      try {
        const componentCounts = this.metricsCollector.getPipelineMetrics();
        const toolStats = this.metricsCollector.getToolStats();
        
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
    
    // Attach to agent endpoint (called by agent when it starts)
    this.app.post('/api/attach-agent', (req, res) => {
      const { orchestrator, memoryManager } = req.body;
      this.isAttachedToAgent = true;
      console.log('🔗 Agent attached to monitoring server');
      res.json({ success: true });
    });
    
    // Clear metrics
    this.app.post('/api/metrics/clear', async (req, res) => {
      // Clear in-memory metrics
      this.metricsCollector = MetricsCollector.getInstance();
      
      // Clear database execution logs for current session
      try {
        await this.prisma.executionLog.deleteMany({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        });
      } catch (error) {
        console.warn('Could not clear execution logs:', error);
      }
      
      res.json({ success: true });
    });
  }
  
  /**
   * Setup Socket.io handlers for real-time updates
   */
  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      // Send initial metrics
      const overview = this.metricsCollector.getOverviewStats();
      const memory = this.metricsCollector.getMemoryLayers();
      const tools = this.metricsCollector.getToolStats();
      
      socket.emit('metrics:initial', {
        overview,
        memory,
        tools,
        attachedToAgent: this.isAttachedToAgent
      });
      
      // Handle metric requests
      socket.on('metrics:request', (type: string) => {
        switch(type) {
          case 'overview':
            socket.emit('metrics:overview', this.metricsCollector.getOverviewStats());
            break;
          case 'memory':
            socket.emit('metrics:memory', this.metricsCollector.getMemoryLayers());
            break;
          case 'tools':
            socket.emit('metrics:tools', this.metricsCollector.getToolStats());
            break;
        }
      });
      
      // Handle disconnect
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }
  
  /**
   * Build pipeline nodes for visualization
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
   * Attach to an agent's orchestrator and memory manager
   */
  attachToAgent(orchestrator: any, memoryManager: any) {
    if (this.monitoringBridge) {
      this.monitoringBridge.attachToOrchestrator(orchestrator);
      this.monitoringBridge.attachToMemoryManager(memoryManager);
      this.isAttachedToAgent = true;
      console.log('✅ Monitoring server attached to agent');
    }
  }
  
  /**
   * Start the monitoring server
   */
  async start() {
    // Load all tools from the tools directory
    console.log('🔧 Loading tools from registry...');
    await toolDiscovery.discoverAndLoadTools();
    
    // Start monitoring bridge
    if (this.monitoringBridge) {
      await this.monitoringBridge.start();
    }
    
    this.server.listen(this.port, () => {
      console.log(`🚀 Unified Monitoring Server running on http://localhost:${this.port}`);
      console.log(`📊 MetricsCollector: Singleton instance active`);
      console.log(`🔗 MonitoringBridge: Ready for agent attachment`);
    });
  }
  
  /**
   * Stop the monitoring server
   */
  async stop() {
    if (this.monitoringBridge) {
      await this.monitoringBridge.stop();
    }
    
    await this.prisma.$disconnect();
    this.server.close();
    console.log('🛑 Unified Monitoring Server stopped');
  }
}

// Start server if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new UnifiedMonitoringServer(4000);
  server.start();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });
}