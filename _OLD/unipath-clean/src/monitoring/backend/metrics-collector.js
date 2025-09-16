/**
 * Metrics Collector
 * Collects and aggregates metrics from all system components
 */
import { EventEmitter } from 'events';
import { statSync, readdirSync } from 'fs';
import { join } from 'path';
export class MetricsCollector extends EventEmitter {
    prisma;
    metrics = new Map();
    events = [];
    maxEvents = 1000;
    startTime;
    pipelineStages = new Map();
    activeTools = new Map();
    constructor(prisma) {
        super();
        this.prisma = prisma;
        this.startTime = new Date();
        this.startCollectionLoop();
    }
    /**
     * Start periodic metrics collection
     */
    startCollectionLoop() {
        // Collect system metrics every 5 seconds
        setInterval(() => {
            this.collectSystemHealth();
        }, 5000);
        // Collect database metrics every 30 seconds
        setInterval(() => {
            this.collectDatabaseMetrics();
        }, 30000);
    }
    /**
     * Record token usage
     */
    recordTokenUsage(metrics) {
        this.metrics.set('currentTokenUsage', metrics);
        // Track historical
        const history = this.metrics.get('tokenHistory') || [];
        history.push({
            timestamp: new Date(),
            ...metrics
        });
        // Keep last 100 points
        if (history.length > 100) {
            history.shift();
        }
        this.metrics.set('tokenHistory', history);
        this.emit('tokenUpdate', metrics);
        this.recordEvent('memory', 'token_usage', metrics);
    }
    /**
     * Update memory layer status
     */
    updateMemoryLayer(layer) {
        const layers = this.metrics.get('memoryLayers') || new Map();
        layers.set(layer.name, layer);
        this.metrics.set('memoryLayers', layers);
        this.emit('memoryLayerUpdate', layer);
        this.recordEvent('memory', 'layer_update', layer);
    }
    /**
     * Track session metrics
     */
    async updateSessionMetrics(sessionId) {
        try {
            const session = await this.prisma.session.findUnique({
                where: { id: sessionId },
                include: {
                    snapshots: true,
                    project: true
                }
            });
            if (!session)
                return;
            const metrics = {
                sessionId: session.id,
                projectId: session.projectId,
                projectName: session.project.name,
                mode: session.mode,
                status: session.status,
                startedAt: session.startedAt,
                endedAt: session.endedAt || undefined,
                turnCount: session.turnCount,
                totalTokensUsed: session.tokensUsed,
                snapshotCount: session.snapshots.length,
                tasksCompleted: 0, // TODO: Track from executor
                toolsUsed: [] // TODO: Track from executor
            };
            this.metrics.set('currentSession', metrics);
            this.emit('sessionUpdate', metrics);
            this.recordEvent('session', 'update', metrics);
        }
        catch (error) {
            console.warn('Failed to update session metrics:', error);
        }
    }
    /**
     * Track pipeline stage
     */
    startPipelineStage(stage) {
        const pipelineStage = {
            ...stage,
            status: 'processing',
            startTime: new Date()
        };
        this.pipelineStages.set(stage.id, pipelineStage);
        this.emit('pipelineStageStart', pipelineStage);
        this.recordEvent('pipeline', 'stage_start', pipelineStage);
    }
    /**
     * Complete pipeline stage
     */
    completePipelineStage(stageId, output, error) {
        const stage = this.pipelineStages.get(stageId);
        if (!stage)
            return;
        stage.endTime = new Date();
        stage.duration = stage.endTime.getTime() - stage.startTime.getTime();
        stage.status = error ? 'error' : 'completed';
        stage.output = output;
        stage.error = error;
        this.emit('pipelineStageComplete', stage);
        this.recordEvent('pipeline', 'stage_complete', stage);
    }
    /**
     * Track tool execution
     */
    startToolExecution(tool) {
        const execution = {
            ...tool,
            timestamp: new Date(),
            duration: 0
        };
        this.activeTools.set(tool.id, execution);
        this.emit('toolStart', execution);
        this.recordEvent('tool', 'start', execution);
    }
    /**
     * Complete tool execution
     */
    completeToolExecution(toolId, output, error) {
        const tool = this.activeTools.get(toolId);
        if (!tool)
            return;
        tool.duration = Date.now() - tool.timestamp.getTime();
        tool.success = !error;
        tool.output = output;
        tool.error = error;
        this.activeTools.delete(toolId);
        // Track tool usage stats
        const toolStats = this.metrics.get('toolStats') || new Map();
        const stats = toolStats.get(tool.toolName) || {
            count: 0,
            successCount: 0,
            totalDuration: 0,
            avgDuration: 0
        };
        stats.count++;
        if (tool.success)
            stats.successCount++;
        stats.totalDuration += tool.duration;
        stats.avgDuration = stats.totalDuration / stats.count;
        toolStats.set(tool.toolName, stats);
        this.metrics.set('toolStats', toolStats);
        this.emit('toolComplete', tool);
        this.recordEvent('tool', 'complete', tool);
    }
    /**
     * Track retrieval metrics
     */
    recordRetrieval(metrics) {
        const retrievals = this.metrics.get('retrievals') || [];
        retrievals.push(metrics);
        // Keep last 50
        if (retrievals.length > 50) {
            retrievals.shift();
        }
        this.metrics.set('retrievals', retrievals);
        // Update aggregates
        const stats = this.metrics.get('retrievalStats') || {};
        stats.totalQueries = (stats.totalQueries || 0) + 1;
        stats.avgChunks = ((stats.avgChunks || 0) * (stats.totalQueries - 1) + metrics.chunksRetrieved) / stats.totalQueries;
        stats.avgSimilarity = ((stats.avgSimilarity || 0) * (stats.totalQueries - 1) + metrics.avgSimilarity) / stats.totalQueries;
        stats.avgDuration = ((stats.avgDuration || 0) * (stats.totalQueries - 1) + metrics.duration) / stats.totalQueries;
        this.metrics.set('retrievalStats', stats);
        this.emit('retrievalComplete', metrics);
        this.recordEvent('memory', 'retrieval', metrics);
    }
    /**
     * Update git context metrics
     */
    async updateGitMetrics() {
        try {
            const projectId = this.metrics.get('projectId');
            if (!projectId)
                return;
            const commits = await this.prisma.gitCommit.count({
                where: { projectId }
            });
            const lastCommit = await this.prisma.gitCommit.findFirst({
                where: { projectId },
                orderBy: { createdAt: 'desc' }
            });
            const metrics = {
                commitsIndexed: commits,
                lastIndexed: lastCommit?.createdAt || new Date(),
                totalDiffSize: 0, // TODO: Calculate
                embeddingsGenerated: commits,
                queryCount: 0 // TODO: Track
            };
            this.metrics.set('gitMetrics', metrics);
            this.emit('gitMetricsUpdate', metrics);
        }
        catch (error) {
            console.warn('Failed to update git metrics:', error);
        }
    }
    /**
     * Collect system health metrics
     */
    async collectSystemHealth() {
        try {
            const health = {
                status: 'healthy',
                uptime: Date.now() - this.startTime.getTime(),
                memoryUsage: this.getMemoryUsage(),
                diskUsage: await this.getDiskUsage(),
                apiHealth: await this.checkAPIHealth(),
                errors: this.getRecentErrors()
            };
            // Determine overall status
            if (health.errors.filter(e => e.severity === 'high').length > 0) {
                health.status = 'error';
            }
            else if (health.memoryUsage.percentage > 80 || health.errors.length > 10) {
                health.status = 'degraded';
            }
            this.metrics.set('systemHealth', health);
            this.emit('healthUpdate', health);
        }
        catch (error) {
            console.warn('Failed to collect system health:', error);
        }
    }
    /**
     * Get memory usage
     */
    getMemoryUsage() {
        const used = process.memoryUsage();
        const total = require('os').totalmem();
        return {
            used: used.heapUsed,
            total: used.heapTotal,
            percentage: (used.heapUsed / used.heapTotal) * 100
        };
    }
    /**
     * Get disk usage
     */
    async getDiskUsage() {
        try {
            const flexicliDir = '.flexicli';
            const getDirectorySize = (dir) => {
                try {
                    const files = readdirSync(dir);
                    return files.reduce((total, file) => {
                        const path = join(dir, file);
                        const stats = statSync(path);
                        return total + (stats.isDirectory() ? getDirectorySize(path) : stats.size);
                    }, 0);
                }
                catch {
                    return 0;
                }
            };
            return {
                dbSize: statSync(join(flexicliDir, 'flexicli.db')).size || 0,
                cacheSize: getDirectorySize(join(flexicliDir, 'cache')),
                logsSize: getDirectorySize(join(flexicliDir, 'logs'))
            };
        }
        catch {
            return { dbSize: 0, cacheSize: 0, logsSize: 0 };
        }
    }
    /**
     * Check API health
     */
    async checkAPIHealth() {
        // TODO: Implement actual health checks
        return {
            deepseek: 'online',
            embeddings: 'online',
            lastCheck: new Date()
        };
    }
    /**
     * Get recent errors
     */
    getRecentErrors() {
        return this.events
            .filter(e => e.type === 'error')
            .slice(-20)
            .map(e => ({
            timestamp: e.timestamp,
            component: e.component,
            message: e.data.message || 'Unknown error',
            severity: e.data.severity || 'low'
        }));
    }
    /**
     * Collect database metrics
     */
    async collectDatabaseMetrics() {
        try {
            const tables = ['Chunk', 'GitCommit', 'Knowledge', 'Session', 'SessionSnapshot'];
            const counts = {};
            for (const table of tables) {
                counts[table] = await this.prisma[table.toLowerCase()].count();
            }
            this.metrics.set('databaseCounts', counts);
            this.emit('databaseMetrics', counts);
        }
        catch (error) {
            console.warn('Failed to collect database metrics:', error);
        }
    }
    /**
     * Record monitoring event
     */
    recordEvent(type, action, data) {
        const event = {
            id: `${Date.now()}-${Math.random()}`,
            type,
            timestamp: new Date(),
            component: this.getCallerComponent(),
            action,
            data
        };
        this.events.push(event);
        // Trim old events
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }
        this.emit('event', event);
    }
    /**
     * Get caller component from stack trace
     */
    getCallerComponent() {
        // Simple heuristic based on current context
        return 'system';
    }
    /**
     * Get all current metrics
     */
    getAllMetrics() {
        const result = {};
        for (const [key, value] of this.metrics.entries()) {
            if (value instanceof Map) {
                result[key] = Array.from(value.entries());
            }
            else {
                result[key] = value;
            }
        }
        return result;
    }
    /**
     * Get recent events
     */
    getRecentEvents(limit = 100) {
        return this.events.slice(-limit);
    }
    /**
     * Get active tools
     */
    getActiveTools() {
        return Array.from(this.activeTools.values());
    }
    /**
     * Clear metrics
     */
    clearMetrics() {
        this.metrics.clear();
        this.events = [];
    }
}
//# sourceMappingURL=metrics-collector.js.map