/**
 * Standalone Monitoring Server
 * Completely independent from agent - only reads database and logs
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class StandaloneMonitoringServer {
  private app: express.Application;
  private server: any;
  private io: SocketServer;
  private port: number;
  private prisma: PrismaClient;
  private dbPath: string;
  
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
    
    // Database path - always use project root .flexicli
    this.dbPath = path.join(__dirname, '../../../.flexicli/flexicli.db');
    
    // Initialize Prisma client
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${this.dbPath}`
        }
      }
    });
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
    this.startPolling();
  }
  
  /**
   * Setup Express middleware
   */
  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }
  
  /**
   * Start polling database for updates
   */
  private startPolling() {
    // Poll database every 2 seconds for updates
    setInterval(async () => {
      try {
        const stats = await this.getRealtimeStats();
        this.io.emit('metrics:update', stats);
      } catch (error) {
        // Ignore errors - database might not be ready
      }
    }, 2000);
  }
  
  /**
   * Get realtime statistics from database
   */
  private async getRealtimeStats() {
    try {
      // Get recent executions
      const recentExecutions = await this.prisma.executionLog.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' }
      });
      
      // Get active sessions
      const activeSessions = await this.prisma.session.findMany({
        where: { status: 'active' },
        take: 5,
        orderBy: { startedAt: 'desc' }
      });
      
      // Calculate statistics
      const totalExecutions = await this.prisma.executionLog.count();
      const successRate = recentExecutions.length > 0 
        ? (recentExecutions.filter(e => e.success).length / recentExecutions.length * 100)
        : 0;
      
      // Get memory usage from system
      const memStats = process.memoryUsage();
      
      return {
        executions: {
          total: totalExecutions,
          recent: recentExecutions.length,
          successRate: successRate.toFixed(1)
        },
        sessions: {
          active: activeSessions.length,
          total: await this.prisma.session.count()
        },
        system: {
          memory: {
            used: memStats.heapUsed,
            total: memStats.heapTotal,
            percentage: ((memStats.heapUsed / memStats.heapTotal) * 100).toFixed(1)
          },
          uptime: process.uptime()
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        error: 'Database not available',
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Setup API routes - all read from database/filesystem
   */
  private setupRoutes() {
    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        uptime: process.uptime(),
        timestamp: new Date(),
        mode: 'standalone',
        databasePath: this.dbPath,
        databaseExists: fs.existsSync(this.dbPath)
      });
    });
    
    // Receive events from agent (if running)
    this.app.post('/api/events', async (req, res) => {
      try {
        const event = req.body;
        
        // Process event based on type
        switch (event.type) {
          case 'tool_execution':
            // Save to database
            await this.prisma.executionLog.create({
              data: {
                type: 'TOOL_EXECUTION',
                tool: event.data.tool,
                input: JSON.stringify(event.data.input),
                output: JSON.stringify(event.data.output),
                success: event.data.success,
                duration: event.data.duration,
                sessionId: event.sessionId || 'default',
                createdAt: event.timestamp
              }
            });
            break;
            
          case 'task_start':
          case 'task_complete':
            // Save task events
            await this.prisma.executionLog.create({
              data: {
                type: event.type.toUpperCase().replace('_', '_'),
                tool: 'task',
                input: JSON.stringify(event.data),
                output: '',
                success: event.data.success || true,
                duration: 0,
                sessionId: event.sessionId || 'default',
                createdAt: event.timestamp
              }
            });
            break;
            
          case 'error':
            // Log errors
            console.error('Agent error:', event.data);
            break;
            
          case 'metrics':
            // Broadcast metrics to connected dashboards
            this.io.emit('metrics:agent', event.data);
            break;
            
          case 'state_change':
            // Broadcast state changes
            this.io.emit('agent:state', event.data);
            break;
        }
        
        // Broadcast event to connected dashboards
        this.io.emit('agent:event', event);
        
        res.json({ received: true });
      } catch (error: any) {
        console.error('Error processing agent event:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    // Overview - read from database
    this.app.get('/api/overview', async (req, res) => {
      try {
        const stats = await this.getRealtimeStats();
        res.json(stats);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get execution logs from database
    this.app.get('/api/executions', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 100;
        const executions = await this.prisma.executionLog.findMany({
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            session: true
          }
        });
        
        res.json(executions);
      } catch (error: any) {
        res.json([]);
      }
    });
    
    // Get sessions from database
    this.app.get('/api/sessions', async (req, res) => {
      try {
        const sessions = await this.prisma.session.findMany({
          take: 20,
          orderBy: { startedAt: 'desc' },
          include: {
            _count: {
              select: { 
                executionLogs: true 
              }
            }
          }
        });
        
        res.json(sessions);
      } catch (error: any) {
        res.json([]);
      }
    });
    
    // Get projects from database
    this.app.get('/api/projects', async (req, res) => {
      try {
        const projects = await this.prisma.project.findMany();
        res.json(projects);
      } catch (error: any) {
        res.json([]);
      }
    });
    
    // Get tool statistics from execution logs
    this.app.get('/api/tools', async (req, res) => {
      try {
        const executions = await this.prisma.executionLog.findMany({
          where: {
            type: 'TOOL_EXECUTION'
          },
          take: 1000,
          orderBy: { createdAt: 'desc' }
        });
        
        // Aggregate by tool
        const toolStats = new Map<string, any>();
        
        executions.forEach(exec => {
          if (!toolStats.has(exec.tool)) {
            toolStats.set(exec.tool, {
              name: exec.tool,
              executions: 0,
              successes: 0,
              failures: 0,
              totalDuration: 0
            });
          }
          
          const stats = toolStats.get(exec.tool);
          stats.executions++;
          if (exec.success) stats.successes++;
          else stats.failures++;
          stats.totalDuration += exec.duration;
        });
        
        const tools = Array.from(toolStats.values()).map(tool => ({
          ...tool,
          successRate: tool.executions > 0 ? (tool.successes / tool.executions * 100).toFixed(1) : 0,
          avgDuration: tool.executions > 0 ? Math.round(tool.totalDuration / tool.executions) : 0
        }));
        
        res.json({ tools });
      } catch (error: any) {
        res.json({ tools: [] });
      }
    });
    
    // Get memory/chunks from database
    this.app.get('/api/memory', async (req, res) => {
      try {
        const chunks = await this.prisma.chunk.count();
        const commits = await this.prisma.gitCommit.count();
        const knowledge = await this.prisma.knowledge.count();
        
        res.json({
          layers: [
            { name: 'Code Chunks', count: chunks, status: 'active' },
            { name: 'Git Commits', count: commits, status: 'active' },
            { name: 'Knowledge Base', count: knowledge, status: 'active' }
          ],
          total: chunks + commits + knowledge
        });
      } catch (error: any) {
        res.json({ layers: [], total: 0 });
      }
    });
    
    // Get running processes
    this.app.get('/api/agents', async (req, res) => {
      try {
        const agents = [];
        
        // Check for FlexiCLI processes
        try {
          const processes = execSync('ps aux | grep -E "(tsx.*cli|node.*cli)" | grep -v grep', 
            { encoding: 'utf8' });
          
          const lines = processes.trim().split('\n');
          for (const line of lines) {
            const parts = line.split(/\s+/);
            if (parts.length >= 11) {
              const pid = parseInt(parts[1]);
              const command = parts.slice(10).join(' ');
              
              agents.push({
                pid,
                name: 'FlexiCLI Agent',
                command: command.substring(0, 100),
                status: 'running'
              });
            }
          }
        } catch {
          // No processes found
        }
        
        res.json(agents);
      } catch (error: any) {
        res.json([]);
      }
    });
    
    // Pipeline visualization data
    this.app.get('/api/pipeline', async (req, res) => {
      try {
        const recentExecutions = await this.prisma.executionLog.findMany({
          take: 100,
          orderBy: { createdAt: 'desc' }
        });
        
        res.json({
          nodes: this.buildPipelineNodes(recentExecutions.length),
          edges: this.buildPipelineEdges(),
          stats: {
            totalExecutions: recentExecutions.length,
            lastActivity: recentExecutions[0]?.createdAt || null
          }
        });
      } catch (error: any) {
        res.json({
          nodes: this.buildPipelineNodes(0),
          edges: this.buildPipelineEdges(),
          stats: { totalExecutions: 0, lastActivity: null }
        });
      }
    });
  }
  
  /**
   * Setup Socket.io handlers
   */
  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Dashboard connected:', socket.id);
      
      // Send initial stats
      this.getRealtimeStats().then(stats => {
        socket.emit('metrics:initial', stats);
      });
      
      socket.on('disconnect', () => {
        console.log('Dashboard disconnected:', socket.id);
      });
    });
  }
  
  /**
   * Build pipeline nodes for visualization
   */
  private buildPipelineNodes(executionCount: number) {
    const active = executionCount > 0;
    
    return [
      { id: 'input', type: 'input', data: { label: 'User Query', status: active ? 'active' : 'idle' }, position: { x: 100, y: 200 } },
      { id: 'orchestrator', type: 'process', data: { label: 'Orchestrator', status: active ? 'processing' : 'idle' }, position: { x: 300, y: 200 } },
      { id: 'planner', type: 'process', data: { label: 'Planner', status: 'idle' }, position: { x: 500, y: 100 } },
      { id: 'memory', type: 'process', data: { label: 'Memory', status: active ? 'active' : 'idle' }, position: { x: 500, y: 200 } },
      { id: 'executor', type: 'process', data: { label: 'Executor', status: active ? 'active' : 'idle' }, position: { x: 500, y: 300 } },
      { id: 'tools', type: 'process', data: { label: 'Tools', status: active ? 'active' : 'idle' }, position: { x: 700, y: 300 } },
      { id: 'output', type: 'output', data: { label: 'Response', status: active ? 'active' : 'idle' }, position: { x: 900, y: 200 } }
    ];
  }
  
  /**
   * Build pipeline edges
   */
  private buildPipelineEdges() {
    return [
      { id: 'e1', source: 'input', target: 'orchestrator' },
      { id: 'e2', source: 'orchestrator', target: 'planner' },
      { id: 'e3', source: 'orchestrator', target: 'memory' },
      { id: 'e4', source: 'orchestrator', target: 'executor' },
      { id: 'e5', source: 'executor', target: 'tools' },
      { id: 'e6', source: 'tools', target: 'output' },
      { id: 'e7', source: 'memory', target: 'output' }
    ];
  }
  
  /**
   * Start the server
   */
  async start() {
    this.server.listen(this.port, () => {
      console.log(`
╔════════════════════════════════════════════════════════╗
║     FlexiCLI Monitoring - Standalone Service          ║
╠════════════════════════════════════════════════════════╣
║  API:      http://localhost:${this.port}                      ║
║  Mode:     Database Observer (No agent required)       ║
║  Database: ${this.dbPath.substring(this.dbPath.lastIndexOf('/') + 1)} ║
║  Status:   ${fs.existsSync(this.dbPath) ? '✅ Database found' : '⚠️  Database not found (will create)'}           ║
╚════════════════════════════════════════════════════════╝
      `);
    });
  }
  
  /**
   * Stop the server
   */
  async stop() {
    await this.prisma.$disconnect();
    this.server.close();
    console.log('🛑 Monitoring server stopped');
  }
}

// Start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new StandaloneMonitoringServer(4000);
  server.start();
  
  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });
}