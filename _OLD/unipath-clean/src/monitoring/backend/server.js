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
import { ProjectManager } from '../memory/project-manager.js';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export class MonitoringServer {
    app;
    server;
    io;
    prisma;
    collector;
    projectManager;
    port;
    // Getter for port
    getPort() {
        return this.port;
    }
    constructor(port = 4000) {
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
    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, '../frontend/build')));
    }
    /**
     * Setup API routes
     */
    setupRoutes() {
        // Health check
        this.app.get('/api/health', (req, res) => {
            res.json({
                status: 'ok',
                uptime: process.uptime(),
                timestamp: new Date()
            });
        });
        // Get all metrics
        this.app.get('/api/metrics', (req, res) => {
            res.json(this.collector.getAllMetrics());
        });
        // Get recent events
        this.app.get('/api/events', (req, res) => {
            const limit = parseInt(req.query.limit) || 100;
            res.json(this.collector.getRecentEvents(limit));
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
            }
            catch (error) {
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
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // Get chunks for project
        this.app.get('/api/chunks', async (req, res) => {
            try {
                const projectId = req.query.projectId;
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
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // Get knowledge entries
        this.app.get('/api/knowledge', async (req, res) => {
            try {
                const projectId = req.query.projectId;
                const knowledge = await this.prisma.knowledge.findMany({
                    where: projectId ? { projectId } : {},
                    orderBy: { importance: 'desc' }
                });
                res.json(knowledge);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // Get git commits
        this.app.get('/api/commits', async (req, res) => {
            try {
                const projectId = req.query.projectId;
                const commits = await this.prisma.gitCommit.findMany({
                    where: projectId ? { projectId } : {},
                    orderBy: { date: 'desc' },
                    take: 50
                });
                res.json(commits);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // Get execution logs
        this.app.get('/api/logs', async (req, res) => {
            try {
                const projectId = req.query.projectId;
                const logs = await this.prisma.executionLog.findMany({
                    where: projectId ? { projectId } : {},
                    orderBy: { createdAt: 'desc' },
                    take: 100
                });
                res.json(logs);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // Get pipeline flow data
        this.app.get('/api/pipeline', (req, res) => {
            res.json({
                nodes: this.buildPipelineNodes(),
                edges: this.buildPipelineEdges()
            });
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
        // TODO: Fix catch-all route for Express v5
        // For now, comment out to avoid startup errors
        // this.app.get('/*', (req, res) => {
        //   res.sendFile(path.join(__dirname, '../../monitoring-ui/build/index.html'));
        // });
    }
    /**
     * Setup Socket.io handlers
     */
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('Client connected:', socket.id);
            // Send initial metrics
            socket.emit('metrics:initial', this.collector.getAllMetrics());
            // Handle metric requests
            socket.on('metrics:request', (type) => {
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
    setupMetricsForwarding() {
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
     * Build pipeline nodes for visualization
     */
    buildPipelineNodes() {
        return [
            {
                id: 'input',
                type: 'input',
                data: { label: 'User Query', status: 'idle' },
                position: { x: 100, y: 200 }
            },
            {
                id: 'orchestrator',
                type: 'process',
                data: { label: 'Orchestrator', status: 'idle' },
                position: { x: 300, y: 200 }
            },
            {
                id: 'planner',
                type: 'process',
                data: { label: 'Planner', status: 'idle' },
                position: { x: 500, y: 100 }
            },
            {
                id: 'memory',
                type: 'process',
                data: { label: 'Memory Manager', status: 'idle' },
                position: { x: 500, y: 200 }
            },
            {
                id: 'executor',
                type: 'process',
                data: { label: 'Executor', status: 'idle' },
                position: { x: 500, y: 300 }
            },
            {
                id: 'tools',
                type: 'process',
                data: { label: 'Tools', status: 'idle' },
                position: { x: 700, y: 300 }
            },
            {
                id: 'llm',
                type: 'process',
                data: { label: 'DeepSeek LLM', status: 'idle' },
                position: { x: 700, y: 100 }
            },
            {
                id: 'embeddings',
                type: 'process',
                data: { label: 'Embeddings API', status: 'idle' },
                position: { x: 700, y: 200 }
            },
            {
                id: 'output',
                type: 'output',
                data: { label: 'Response', status: 'idle' },
                position: { x: 900, y: 200 }
            }
        ];
    }
    /**
     * Build pipeline edges for visualization
     */
    buildPipelineEdges() {
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
    getCollector() {
        return this.collector;
    }
}
//# sourceMappingURL=server.js.map