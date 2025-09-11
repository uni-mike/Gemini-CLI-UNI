/**
 * Monitoring Server
 * Express + Socket.io backend for real-time monitoring
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { MetricsCollector } from './metrics-collector.js';
import { ProjectManager } from '../../memory/project-manager.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class MonitoringServer {
  private app: express.Application;
  private server: any;
  private io: SocketServer;
  private prisma: PrismaClient;
  private collector: MetricsCollector;
  private projectManager: ProjectManager;
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
    
    // Initialize components
    this.projectManager = new ProjectManager();
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${this.projectManager.getDbPath()}`
        }
      }
    });
    
    this.collector = new MetricsCollector(this.prisma);
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
    this.setupMetricsForwarding();
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
    
    // Overview endpoint - aggregated stats
    this.app.get('/api/overview', async (req, res) => {
      try {
        const [sessions, chunks, commits, logs] = await Promise.all([
          this.prisma.session.count(),
          this.prisma.chunk.count(),
          this.prisma.gitCommit.count(),
          this.prisma.executionLog.count()
        ]);
        
        const activeSession = await this.prisma.session.findFirst({
          where: { status: 'active' },
          orderBy: { startedAt: 'desc' }
        });
        
        const metrics = this.collector.getAllMetrics();
        
        res.json({
          stats: {
            totalSessions: sessions,
            totalChunks: chunks,
            totalCommits: commits,
            totalLogs: logs,
            activeSession: activeSession?.id || null
          },
          systemHealth: metrics.systemHealth || {},
          tokenUsage: metrics.currentTokenUsage || {},
          toolStats: metrics.toolStats || new Map(),
          retrievalStats: metrics.retrievalStats || {},
          uptime: process.uptime()
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Memory layers endpoint
    this.app.get('/api/memory', async (req, res) => {
      try {
        const metrics = this.collector.getAllMetrics();
        const memoryLayers = metrics.memoryLayers || [];
        
        const [chunks, commits, knowledge] = await Promise.all([
          this.prisma.chunk.count(),
          this.prisma.gitCommit.count(),
          this.prisma.knowledge.count()
        ]);
        
        res.json({
          layers: [
            { name: 'Code Index', status: 'active', chunks: chunks },
            { name: 'Git Context', status: 'active', commits: commits },
            { name: 'Knowledge Base', status: 'active', entries: knowledge },
            { name: 'Conversation', status: 'active', context: memoryLayers },
            { name: 'Project Context', status: 'active', metadata: this.projectManager.getMetadata() }
          ],
          tokenBudget: metrics.currentTokenUsage || {},
          retrievalStats: metrics.retrievalStats || {}
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Tools endpoint
    this.app.get('/api/tools', async (req, res) => {
      try {
        const metrics = this.collector.getAllMetrics();
        const toolStats = metrics.toolStats || [];
        
        const recentExecutions = await this.prisma.executionLog.findMany({
          where: { type: 'TOOL_EXECUTION' },
          orderBy: { createdAt: 'desc' },
          take: 20
        });
        
        res.json({
          stats: toolStats,
          recentExecutions: recentExecutions.map(log => ({
            id: log.id,
            tool: log.tool,
            success: log.success,
            duration: log.duration,
            timestamp: log.createdAt
          })),
          activeTools: this.collector.getActiveTools()
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get all metrics
    this.app.get('/api/metrics', (req, res) => {
      res.json(this.collector.getAllMetrics());
    });
    
    // Get recent events
    this.app.get('/api/events', (req, res) => {
      const limit = parseInt(req.query.limit as string) || 100;
      res.json(this.collector.getRecentEvents(limit));
    });

    // Get available agent processes
    this.app.get('/api/agents', async (req, res) => {
      try {
        // Mock multiple agents for dropdown testing
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
        const sessions = await this.prisma.session.findMany({
          orderBy: { startedAt: 'desc' },
          take: 20,
          include: {
            project: true,
            snapshots: {
              select: { id: true, sequenceNumber: true }
            }
          }
        });
        res.json(sessions);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get session details
    this.app.get('/api/sessions/:id', async (req, res) => {
      try {
        const session = await this.prisma.session.findUnique({
          where: { id: req.params.id },
          include: {
            project: true,
            snapshots: true
          }
        });
        res.json(session);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get chunks for project
    this.app.get('/api/chunks', async (req, res) => {
      try {
        const projectId = req.query.projectId as string;
        const chunks = await this.prisma.chunk.findMany({
          where: projectId ? { projectId } : {},
          select: {
            id: true,
            path: true,
            chunkType: true,
            tokenCount: true,
            language: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: { updatedAt: 'desc' },
          take: 100
        });
        res.json(chunks);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get knowledge entries
    this.app.get('/api/knowledge', async (req, res) => {
      try {
        const projectId = req.query.projectId as string;
        const knowledge = await this.prisma.knowledge.findMany({
          where: projectId ? { projectId } : {},
          orderBy: { importance: 'desc' }
        });
        res.json(knowledge);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get git commits
    this.app.get('/api/commits', async (req, res) => {
      try {
        const projectId = req.query.projectId as string;
        const commits = await this.prisma.gitCommit.findMany({
          where: projectId ? { projectId } : {},
          orderBy: { date: 'desc' },
          take: 50
        });
        res.json(commits);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get execution logs
    this.app.get('/api/logs', async (req, res) => {
      try {
        const projectId = req.query.projectId as string;
        const logs = await this.prisma.executionLog.findMany({
          where: projectId ? { projectId } : {},
          orderBy: { createdAt: 'desc' },
          take: 100
        });
        res.json(logs);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get pipeline flow data with real metrics
    this.app.get('/api/pipeline', async (req, res) => {
      try {
        // Get real execution counts from database
        const [sessions, logs, chunks] = await Promise.all([
          this.prisma.session.count(),
          this.prisma.executionLog.groupBy({
            by: ['tool'],
            _count: true
          }),
          this.prisma.chunk.count()
        ]);
        
        // Count executions by component - estimate from sessions and actual tool usage
        const totalToolUsage = logs.reduce((sum, l) => sum + l._count, 0);
        const componentCounts: Record<string, number> = {
          input: sessions,
          orchestrator: sessions,
          // Estimate pipeline component usage based on sessions and tool patterns
          planner: Math.max(sessions * 0.9, logs.filter(l => l.tool && ['plan', 'planner'].some(p => l.tool.toLowerCase().includes(p))).reduce((sum, l) => sum + l._count, 0)), // Most sessions use planner
          memory: Math.max(chunks * 2, Math.floor(sessions * 0.3)), // Memory operations per session
          executor: Math.max(totalToolUsage * 0.8, logs.filter(l => l.tool && ['execute', 'executor'].some(p => l.tool.toLowerCase().includes(p))).reduce((sum, l) => sum + l._count, 0)), // Most tool calls go through executor
          llm: Math.max(Math.floor(sessions * 1.5), logs.filter(l => l.tool && ['deepseek', 'llm', 'ai'].some(p => l.tool.toLowerCase().includes(p))).reduce((sum, l) => sum + l._count, 0)), // Multiple LLM calls per session
          embeddings: Math.max(Math.floor(chunks * 0.5), logs.filter(l => l.tool && ['embed', 'vector'].some(p => l.tool.toLowerCase().includes(p))).reduce((sum, l) => sum + l._count, 0)), // Embeddings for memory
          tools: totalToolUsage,
          output: sessions
        };
        
        // Get last activity time
        const lastLog = await this.prisma.executionLog.findFirst({
          orderBy: { createdAt: 'desc' }
        });
        
        // Calculate average latency from recent logs
        const recentLogs = await this.prisma.executionLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 20
        });
        
        const avgLatency = recentLogs.length > 0
          ? recentLogs.reduce((sum, log) => sum + (log.duration || 0), 0) / recentLogs.length
          : 0;
        
        res.json({
          nodes: this.buildPipelineNodes(componentCounts),
          edges: this.buildPipelineEdges(),
          stats: {
            totalExecutions: logs.reduce((sum, l) => sum + l._count, 0),
            activeComponents: Object.values(componentCounts).filter(c => c > 0).length,
            avgLatency: Math.round(avgLatency),
            lastActivity: lastLog?.createdAt || null
          }
        });
      } catch (error: any) {
        console.error('Pipeline API error:', error);
        // Return default visualization on error
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
    
    // Get tools information
    this.app.get('/api/tools', (req, res) => {
      res.json(this.collector.getActiveTools());
    });
    
    // Clear metrics
    this.app.post('/api/metrics/clear', (req, res) => {
      this.collector.clearMetrics();
      res.json({ success: true });
    });
    
    // API-only server - removed HTML serving
  }
  
  /**
   * Setup Socket.io handlers
   */
  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      // Send initial metrics
      socket.emit('metrics:initial', this.collector.getAllMetrics());
      
      // Handle metric requests
      socket.on('metrics:request', (type: string) => {
        const metrics = this.collector.getAllMetrics();
        socket.emit(`metrics:${type}`, metrics[type]);
      });
      
      // Handle disconnect
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }
  
  /**
   * Setup metrics forwarding to socket clients
   */
  private setupMetricsForwarding() {
    // Forward all collector events to socket clients
    const events = [
      'tokenUpdate',
      'memoryLayerUpdate',
      'sessionUpdate',
      'pipelineStageStart',
      'pipelineStageComplete',
      'toolStart',
      'toolComplete',
      'retrievalComplete',
      'gitMetricsUpdate',
      'healthUpdate',
      'databaseMetrics',
      'event'
    ];
    
    events.forEach(event => {
      this.collector.on(event, (data) => {
        this.io.emit(`metrics:${event}`, data);
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
    await this.prisma.$disconnect();
    this.server.close();
  }
  
  /**
   * Get metrics collector instance
   */
  getCollector(): MetricsCollector {
    return this.collector;
  }
}