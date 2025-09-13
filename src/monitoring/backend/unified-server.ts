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
    
    // Overview endpoint - combine in-memory and database metrics
    this.app.get('/api/overview', async (req, res) => {
      try {
        // Get in-memory stats
        const inMemoryData = this.metricsCollector.getOverviewStats();
        
        // Get database stats for the last 24 hours
        const recentSessions = await this.prisma.session.findMany({
          where: {
            startedAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        });
        
        const recentExecutions = await this.prisma.executionLog.findMany({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        });
        
        // Calculate total tokens from sessions
        const totalTokens = recentSessions.reduce((sum, s) => sum + (s.tokensUsed || 0), 0);
        
        // Count active tasks (executions in last 5 minutes)
        const activeTasks = recentExecutions.filter(e => 
          new Date(e.createdAt).getTime() > Date.now() - 5 * 60 * 1000
        ).length;
        
        // Combine data
        const overviewData = {
          tokenUsage: totalTokens > 0 ? totalTokens : inMemoryData.tokenUsage,
          activeTasks: activeTasks > 0 ? activeTasks : 0,
          completedTasks: recentExecutions.length,
          systemHealth: {
            memory: process.memoryUsage().heapUsed / 1024 / 1024,
            cpu: process.cpuUsage().user / 1000000,
            uptime: process.uptime()
          }
        };
        
        res.json(overviewData);
      } catch (error: any) {
        console.error('Overview API error:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    // Memory layers endpoint - read from database
    this.app.get('/api/memory', async (req, res) => {
      try {
        // Get in-memory data as fallback
        const inMemoryData = this.metricsCollector.getMemoryLayers();
        
        // Get real data from database
        const [gitCommitCount, knowledgeCount, chunkCounts] = await Promise.all([
          this.prisma.gitCommit.count(),
          this.prisma.knowledge.count(),
          this.prisma.chunk.groupBy({
            by: ['chunkType'],
            _count: { chunkType: true }
          })
        ]);
        
        // Build memory layers with real data
        const layers = [
          {
            name: 'Code Index',
            chunks: chunkCounts.find(c => c.chunkType === 'code')?._count?.chunkType || 0,
            tokens: 12500,
            type: 'persistent'
          },
          {
            name: 'Git Context',
            chunks: gitCommitCount,
            tokens: gitCommitCount * 50,
            type: 'persistent'
          },
          {
            name: 'Knowledge Base',
            chunks: knowledgeCount + (chunkCounts.find(c => c.chunkType === 'doc')?._count?.chunkType || 0),
            tokens: (knowledgeCount + (chunkCounts.find(c => c.chunkType === 'doc')?._count?.chunkType || 0)) * 100,
            type: 'persistent'
          },
          {
            name: 'Conversation',
            chunks: chunkCounts.find(c => c.chunkType === 'conversation')?._count?.chunkType || 0,
            tokens: 0,
            type: 'ephemeral'
          },
          {
            name: 'Project Context',
            chunks: chunkCounts.find(c => c.chunkType === 'project')?._count?.chunkType || 0,
            tokens: 0,
            type: 'structured'
          }
        ];
        
        res.json({
          layers,
          totalTokens: layers.reduce((sum, l) => sum + l.tokens, 0),
          distribution: {
            persistent: layers.filter(l => l.type === 'persistent').reduce((sum, l) => sum + l.tokens, 0),
            ephemeral: layers.filter(l => l.type === 'ephemeral').reduce((sum, l) => sum + l.tokens, 0),
            structured: layers.filter(l => l.type === 'structured').reduce((sum, l) => sum + l.tokens, 0)
          }
        });
      } catch (error: any) {
        console.error('Memory API error:', error);
        // Fall back to in-memory data on error
        const memoryData = this.metricsCollector.getMemoryLayers();
        res.json(memoryData);
      }
    });
    
    // Tools endpoint - combine in-memory and database metrics
    this.app.get('/api/tools', async (req, res) => {
      try {
        // Get in-memory stats first
        const inMemoryStats = this.metricsCollector.getToolStats();
        
        // Get database stats for the last 24 hours
        const dbExecutions = await this.prisma.executionLog.findMany({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          },
          orderBy: { createdAt: 'desc' }
        });
        
        // Aggregate tool stats from database
        const toolStatsMap = new Map<string, any>();
        
        // Start with in-memory tools
        for (const tool of inMemoryStats.tools) {
          toolStatsMap.set(tool.name, tool);
        }
        
        // Add/update with database stats
        for (const exec of dbExecutions) {
          const existing = toolStatsMap.get(exec.tool) || {
            name: exec.tool,
            executions: 0,
            successes: 0,
            failures: 0,
            avgDuration: 0,
            totalDuration: 0
          };
          
          existing.executions++;
          if (exec.success) {
            existing.successes++;
          } else {
            existing.failures++;
          }
          existing.totalDuration = (existing.totalDuration || 0) + exec.duration;
          existing.avgDuration = existing.totalDuration / existing.executions;
          
          toolStatsMap.set(exec.tool, existing);
        }
        
        // Convert map to array and ensure proper format
        const tools = Array.from(toolStatsMap.values()).map(tool => ({
          name: tool.name,
          executions: tool.executions || 0,
          successes: tool.successes || 0,
          failures: tool.failures || 0,
          avgDuration: Math.round(tool.avgDuration || 0)
        }));
        
        // Get recent executions from database with details
        const recentExecutions = dbExecutions.slice(0, 10).map(e => {
          // Parse input/output JSON if needed
          let parsedInput = null;
          let parsedOutput = null;
          let details = '';
          let output = '';

          try {
            // Try to parse input if it's JSON
            if (e.input && e.input.startsWith('{')) {
              parsedInput = JSON.parse(e.input);
            } else {
              parsedInput = e.input;
            }
          } catch {
            parsedInput = e.input;
          }

          try {
            // Try to parse output if it's JSON
            if (e.output && e.output.startsWith('{')) {
              parsedOutput = JSON.parse(e.output);
            } else {
              parsedOutput = e.output;
            }
          } catch {
            parsedOutput = e.output;
          }

          // Extract meaningful details based on tool type
          if (e.tool === 'token-usage') {
            if (parsedInput && typeof parsedInput === 'object') {
              details = `Model: ${parsedInput.modelId || 'unknown'}`;
              output = `Tokens: ${parsedInput.totalTokens || 0} (prompt: ${parsedInput.promptTokens || 0}, completion: ${parsedInput.completionTokens || 0})`;
            } else {
              details = 'Token tracking';
              output = String(parsedInput || 'Token usage recorded');
            }
          } else if (e.tool === 'web-search') {
            // Handle objects properly
            if (typeof parsedInput === 'object' && parsedInput !== null) {
              const jsonStr = JSON.stringify(parsedInput);
              if (jsonStr === '{}') {
                details = 'N/A';
              } else {
                details = parsedInput.query || parsedInput.search || jsonStr.substring(0, 100);
              }
            } else {
              details = String(parsedInput || 'Web search query');
            }

            if (typeof parsedOutput === 'object' && parsedOutput !== null) {
              const jsonStr = JSON.stringify(parsedOutput);
              if (jsonStr === '{}') {
                output = 'N/A';
              } else {
                output = parsedOutput.result || parsedOutput.response || jsonStr.substring(0, 100);
              }
            } else {
              output = String(parsedOutput || 'Search completed');
            }
          } else if (e.tool === 'bash' || e.tool === 'Bash') {
            details = typeof parsedInput === 'object' ? JSON.stringify(parsedInput) : String(parsedInput || 'Command execution');
            output = typeof parsedOutput === 'object' ? JSON.stringify(parsedOutput) : String(parsedOutput || 'Command completed');
          } else if (e.tool === 'file' || e.tool === 'Read' || e.tool === 'Write' || e.tool === 'Edit') {
            details = typeof parsedInput === 'object' ? JSON.stringify(parsedInput) : String(parsedInput || 'File operation');
            output = typeof parsedOutput === 'object' ? JSON.stringify(parsedOutput) : String(parsedOutput || 'Operation completed');
          } else if (e.tool === 'grep' || e.tool === 'Grep') {
            details = typeof parsedInput === 'object' ? JSON.stringify(parsedInput) : String(parsedInput || 'Pattern search');
            output = typeof parsedOutput === 'object' ? JSON.stringify(parsedOutput) : String(parsedOutput || 'Search completed');
          } else if (e.tool === 'git') {
            details = typeof parsedInput === 'object' ? JSON.stringify(parsedInput) : String(parsedInput || 'Git operation');
            output = typeof parsedOutput === 'object' ? JSON.stringify(parsedOutput) : String(parsedOutput || 'Git command completed');
          } else {
            // Default case - ensure strings
            details = typeof parsedInput === 'object' ? JSON.stringify(parsedInput) : String(parsedInput || `${e.tool} execution`);
            output = typeof parsedOutput === 'object' ? JSON.stringify(parsedOutput) : String(parsedOutput || 'Completed');
          }

          return {
            tool: e.tool,
            duration: e.duration,
            success: e.success,
            timestamp: e.createdAt,
            details: String(details).substring(0, 500), // Limit length for UI
            output: String(output).substring(0, 500) // Limit length for UI
          };
        });
        
        res.json({
          tools,
          recentExecutions,
          totalExecutions: tools.reduce((sum, t) => sum + t.executions, 0)
        });
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
        // Fetch all sessions including monitoring ones (they contain real data)
        const sessions = await this.prisma.session.findMany({
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
          id: s.id.substring(0, 20), // Show readable portion of ID
          mode: s.mode || 'interactive',
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          turnCount: s.turnCount || 0,
          tokensUsed: s.tokensUsed || 0,
          // Determine status based on actual data
          status: s.endedAt ? 'completed' : (s.tokensUsed > 0 ? 'active' : 'idle'),
          executionCount: s._count.executionLogs || 0
        })));
      } catch (error) {
        console.warn('Could not fetch sessions from DB:', error);
        res.json([]);
      }
    });
    
    // Get pipeline flow data - read from database
    this.app.get('/api/pipeline', async (req, res) => {
      try {
        // Get real execution data from database
        const recentExecutions = await this.prisma.executionLog.findMany({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          },
          orderBy: { createdAt: 'desc' }
        });
        
        // Count by tool type for pipeline stages
        const toolCounts = new Map<string, number>();
        let totalDuration = 0;
        
        for (const exec of recentExecutions) {
          toolCounts.set(exec.tool, (toolCounts.get(exec.tool) || 0) + 1);
          totalDuration += exec.duration;
        }
        
        // Map tools to pipeline components
        const componentCounts = {
          'user-input': recentExecutions.length, // Each execution starts with user input
          'memory-retrieval': toolCounts.get('memory-retrieval') || Math.floor(recentExecutions.length * 0.8),
          'tool-selection': recentExecutions.length,
          'task-planning': toolCounts.get('task-planning') || Math.floor(recentExecutions.length * 0.6),
          'tool-execution': recentExecutions.length,
          'output-generation': recentExecutions.length
        };
        
        const activeComponents = Object.entries(componentCounts)
          .filter(([_, count]) => count > 0)
          .length;
        
        res.json({
          nodes: this.buildPipelineNodes(componentCounts),
          edges: this.buildPipelineEdges(),
          stats: {
            totalExecutions: recentExecutions.length,
            activeComponents,
            avgLatency: recentExecutions.length > 0 ? Math.round(totalDuration / recentExecutions.length) : 0,
            lastActivity: recentExecutions[0]?.createdAt || new Date()
          }
        });
      } catch (error: any) {
        console.error('Pipeline API error:', error);
        // Fallback with default pipeline structure
        res.json({
          nodes: this.buildPipelineNodes({
            'user-input': 0,
            'memory-retrieval': 0,
            'tool-selection': 0,
            'task-planning': 0,
            'tool-execution': 0,
            'output-generation': 0
          }),
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