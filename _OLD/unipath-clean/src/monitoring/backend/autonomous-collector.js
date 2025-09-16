/**
 * Autonomous Metrics Collector
 * Completely decoupled from main agent - uses file watching, log parsing, and DB polling
 */
import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { watch } from 'chokidar';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';
import { createReadStream } from 'fs';
export class AutonomousCollector extends EventEmitter {
    config;
    prisma;
    watchers = [];
    pollingIntervals = [];
    metrics = new Map();
    lastProcessedPositions = new Map();
    lastDbSync = new Date();
    constructor(config) {
        super();
        this.config = {
            pollInterval: 1000, // 1 second default
            logPath: '.flexicli/logs',
            dbPath: '.flexicli/flexicli.db',
            ...config
        };
        // Initialize Prisma with readonly access
        this.prisma = new PrismaClient({
            datasources: {
                db: {
                    url: `file:${join(this.config.projectRoot, this.config.dbPath)}`
                }
            }
        });
    }
    /**
     * Start autonomous monitoring
     */
    async start() {
        console.log('🚀 Starting autonomous monitoring...');
        // 1. Watch log files for real-time events
        this.watchLogs();
        // 2. Poll database for state changes
        this.startDatabasePolling();
        // 3. Monitor file system for memory/cache changes
        this.watchFileSystem();
        // 4. Parse process metrics
        this.monitorProcessMetrics();
        // 5. Intercept stdout/stderr if possible
        this.interceptOutput();
        this.emit('started');
    }
    /**
     * Watch log files for agent events
     */
    watchLogs() {
        const logPath = join(this.config.projectRoot, this.config.logPath);
        if (!existsSync(logPath)) {
            console.warn('Log path does not exist:', logPath);
            return;
        }
        // Watch for new log files and changes
        const watcher = watch(`${logPath}/*.log`, {
            persistent: true,
            ignoreInitial: false,
        });
        watcher.on('add', (path) => this.processLogFile(path));
        watcher.on('change', (path) => this.processLogFile(path, true));
        this.watchers.push(watcher);
    }
    /**
     * Process log file for metrics
     */
    async processLogFile(filePath, isUpdate = false) {
        const lastPosition = isUpdate ? (this.lastProcessedPositions.get(filePath) || 0) : 0;
        const stats = statSync(filePath);
        if (stats.size <= lastPosition)
            return;
        const stream = createReadStream(filePath, {
            start: lastPosition,
            encoding: 'utf8'
        });
        const rl = readline.createInterface({
            input: stream,
            crlfDelay: Infinity
        });
        let position = lastPosition;
        rl.on('line', (line) => {
            position += Buffer.byteLength(line) + 1; // +1 for newline
            this.parseLogLine(line);
        });
        rl.on('close', () => {
            this.lastProcessedPositions.set(filePath, position);
        });
    }
    /**
     * Parse log line for metrics
     */
    parseLogLine(line) {
        try {
            // Try to parse as JSON first
            if (line.includes('{') && line.includes('}')) {
                const jsonMatch = line.match(/\{.*\}/);
                if (jsonMatch) {
                    const data = JSON.parse(jsonMatch[0]);
                    this.processLogData(data);
                }
            }
            // Parse common patterns
            const patterns = [
                // Token usage pattern
                /Token Usage.*?(\d+)\/(\d+)/,
                // Tool execution pattern
                /Tool \[(.*?)\] (started|completed|failed)/,
                // Pipeline stage pattern
                /Pipeline stage \[(.*?)\] (started|completed)/,
                // Error pattern
                /ERROR.*?:(.*)/,
                // Memory update pattern
                /Memory layer \[(.*?)\] updated: (\d+) tokens/,
            ];
            for (const pattern of patterns) {
                const match = line.match(pattern);
                if (match) {
                    this.processPatternMatch(pattern, match);
                }
            }
        }
        catch (error) {
            // Ignore parsing errors
        }
    }
    /**
     * Process extracted log data
     */
    processLogData(data) {
        if (data.type === 'token_usage') {
            this.updateTokenMetrics(data);
        }
        else if (data.type === 'tool_execution') {
            this.updateToolMetrics(data);
        }
        else if (data.type === 'pipeline_stage') {
            this.updatePipelineMetrics(data);
        }
        else if (data.type === 'memory_update') {
            this.updateMemoryMetrics(data);
        }
        this.emit('logEvent', data);
    }
    /**
     * Process pattern matches from logs
     */
    processPatternMatch(pattern, match) {
        const timestamp = new Date();
        if (pattern.toString().includes('Token Usage')) {
            const [_, used, limit] = match;
            this.updateTokenMetrics({
                used: parseInt(used),
                limit: parseInt(limit),
                timestamp
            });
        }
        else if (pattern.toString().includes('Tool')) {
            const [_, toolName, status] = match;
            this.updateToolMetrics({
                tool: toolName,
                status,
                timestamp
            });
        }
        else if (pattern.toString().includes('Pipeline stage')) {
            const [_, stage, status] = match;
            this.updatePipelineMetrics({
                stage,
                status,
                timestamp
            });
        }
    }
    /**
     * Poll database for changes
     */
    startDatabasePolling() {
        const interval = setInterval(async () => {
            try {
                await this.pollDatabase();
            }
            catch (error) {
                console.warn('Database polling error:', error);
            }
        }, this.config.pollInterval);
        this.pollingIntervals.push(interval);
    }
    /**
     * Poll database for metrics
     */
    async pollDatabase() {
        // Get latest session
        const session = await this.prisma.session.findFirst({
            where: {
                status: 'active'
            },
            orderBy: {
                startedAt: 'desc'
            },
            include: {
                snapshots: {
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 1
                }
            }
        });
        if (session) {
            this.updateSessionMetrics(session);
            // Parse snapshot for token usage
            if (session.snapshots[0]) {
                try {
                    const snapshot = JSON.parse(session.snapshots[0].tokenBudget);
                    this.updateTokenMetrics(snapshot);
                }
                catch (error) {
                    // Ignore parsing errors
                }
            }
        }
        // Get chunk counts
        const chunkCount = await this.prisma.chunk.count();
        const commitCount = await this.prisma.gitCommit.count();
        const knowledgeCount = await this.prisma.knowledge.count();
        this.metrics.set('databaseStats', {
            chunks: chunkCount,
            commits: commitCount,
            knowledge: knowledgeCount,
            timestamp: new Date()
        });
        // Get recent execution logs
        const logs = await this.prisma.executionLog.findMany({
            where: {
                createdAt: {
                    gt: this.lastDbSync
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 10
        });
        for (const log of logs) {
            this.processExecutionLog(log);
        }
        this.lastDbSync = new Date();
    }
    /**
     * Watch file system for changes
     */
    watchFileSystem() {
        const paths = [
            '.flexicli/cache',
            '.flexicli/sessions',
            '.flexicli/flexicli.db'
        ].map(p => join(this.config.projectRoot, p));
        paths.forEach(path => {
            if (!existsSync(path))
                return;
            const watcher = watch(path, {
                persistent: true,
                ignoreInitial: true,
                depth: 0
            });
            watcher.on('add', () => this.updateFileSystemMetrics());
            watcher.on('change', () => this.updateFileSystemMetrics());
            watcher.on('unlink', () => this.updateFileSystemMetrics());
            this.watchers.push(watcher);
        });
    }
    /**
     * Update file system metrics
     */
    updateFileSystemMetrics() {
        const getDirectorySize = (dir) => {
            if (!existsSync(dir))
                return 0;
            const { size } = statSync(dir);
            return size;
        };
        const metrics = {
            cacheSize: getDirectorySize(join(this.config.projectRoot, '.flexicli/cache')),
            dbSize: getDirectorySize(join(this.config.projectRoot, '.flexicli/flexicli.db')),
            logsSize: getDirectorySize(join(this.config.projectRoot, '.flexicli/logs')),
            timestamp: new Date()
        };
        this.metrics.set('fileSystem', metrics);
        this.emit('fileSystemUpdate', metrics);
    }
    /**
     * Monitor process metrics
     */
    monitorProcessMetrics() {
        const interval = setInterval(() => {
            const usage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            const metrics = {
                memory: {
                    rss: usage.rss,
                    heapTotal: usage.heapTotal,
                    heapUsed: usage.heapUsed,
                    external: usage.external
                },
                cpu: {
                    user: cpuUsage.user,
                    system: cpuUsage.system
                },
                uptime: process.uptime(),
                timestamp: new Date()
            };
            this.metrics.set('process', metrics);
            this.emit('processMetrics', metrics);
        }, 5000); // Every 5 seconds
        this.pollingIntervals.push(interval);
    }
    /**
     * Intercept stdout/stderr
     */
    interceptOutput() {
        // Create a proxy for console methods
        const originalLog = console.log;
        const originalError = console.error;
        console.log = (...args) => {
            this.processConsoleOutput('log', args);
            originalLog.apply(console, args);
        };
        console.error = (...args) => {
            this.processConsoleOutput('error', args);
            originalError.apply(console, args);
        };
    }
    /**
     * Process console output
     */
    processConsoleOutput(type, args) {
        const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
        // Look for metrics patterns
        if (message.includes('Token') || message.includes('token')) {
            this.emit('consoleMetric', { type: 'token', message });
        }
        if (message.includes('Tool') || message.includes('tool')) {
            this.emit('consoleMetric', { type: 'tool', message });
        }
        if (message.includes('Pipeline') || message.includes('pipeline')) {
            this.emit('consoleMetric', { type: 'pipeline', message });
        }
    }
    /**
     * Update specific metric types
     */
    updateTokenMetrics(data) {
        const current = this.metrics.get('tokenUsage') || {};
        this.metrics.set('tokenUsage', { ...current, ...data });
        this.emit('tokenUpdate', data);
    }
    updateToolMetrics(data) {
        const tools = this.metrics.get('tools') || new Map();
        const toolStats = tools.get(data.tool) || { count: 0, success: 0, failed: 0 };
        if (data.status === 'completed') {
            toolStats.count++;
            toolStats.success++;
        }
        else if (data.status === 'failed') {
            toolStats.count++;
            toolStats.failed++;
        }
        tools.set(data.tool, toolStats);
        this.metrics.set('tools', tools);
        this.emit('toolUpdate', data);
    }
    updatePipelineMetrics(data) {
        const pipeline = this.metrics.get('pipeline') || [];
        pipeline.push(data);
        if (pipeline.length > 100)
            pipeline.shift();
        this.metrics.set('pipeline', pipeline);
        this.emit('pipelineUpdate', data);
    }
    updateMemoryMetrics(data) {
        const memory = this.metrics.get('memory') || {};
        memory[data.layer] = data;
        this.metrics.set('memory', memory);
        this.emit('memoryUpdate', data);
    }
    updateSessionMetrics(session) {
        this.metrics.set('session', session);
        this.emit('sessionUpdate', session);
    }
    processExecutionLog(log) {
        this.emit('executionLog', log);
    }
    /**
     * Get all metrics
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
     * Stop monitoring
     */
    async stop() {
        // Close watchers
        for (const watcher of this.watchers) {
            await watcher.close();
        }
        // Clear intervals
        for (const interval of this.pollingIntervals) {
            clearInterval(interval);
        }
        // Disconnect database
        await this.prisma.$disconnect();
        this.emit('stopped');
    }
}
//# sourceMappingURL=autonomous-collector.js.map