/**
 * Autonomous Metrics Collector
 * Completely decoupled from main agent - uses file watching, log parsing, and DB polling
 */

import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { watch, FSWatcher } from 'chokidar';
import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
import * as readline from 'readline';
import { createReadStream } from 'fs';

export interface AutonomousConfig {
  projectRoot: string;
  pollInterval?: number;
  logPath?: string;
  dbPath?: string;
}

export class AutonomousCollector extends EventEmitter {
  private config: AutonomousConfig;
  private prisma: PrismaClient;
  private watchers: FSWatcher[] = [];
  private pollingIntervals: NodeJS.Timeout[] = [];
  private metrics: Map<string, any> = new Map();
  private lastProcessedPositions: Map<string, number> = new Map();
  private lastDbSync: Date = new Date();
  
  constructor(config: AutonomousConfig) {
    super();
    this.config = {
      pollInterval: 1000, // 1 second default
      logPath: '.flexicli/logs',
      dbPath: '.flexicli/flexicli.db',
      ...config
    };

    // Always use the main FlexiCLI database (not relative to projectRoot)
    const mainDbPath = process.env.DATABASE_URL ||
      'file:../.flexicli/flexicli.db';

    // Initialize Prisma with optimized SQLite settings
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: `${mainDbPath}?connection_limit=1`
        }
      },
      log: ['error', 'warn'], // Reduce logging overhead
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
  private watchLogs() {
    const logPath = join(this.config.projectRoot, this.config.logPath!);
    
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
  private async processLogFile(filePath: string, isUpdate = false) {
    const lastPosition = isUpdate ? (this.lastProcessedPositions.get(filePath) || 0) : 0;
    const stats = statSync(filePath);
    
    if (stats.size <= lastPosition) return;
    
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
  private parseLogLine(line: string) {
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
    } catch (error) {
      // Ignore parsing errors
    }
  }
  
  /**
   * Process extracted log data
   */
  private processLogData(data: any) {
    if (data.type === 'token_usage') {
      this.updateTokenMetrics(data);
    } else if (data.type === 'tool_execution') {
      this.updateToolMetrics(data);
    } else if (data.type === 'pipeline_stage') {
      this.updatePipelineMetrics(data);
    } else if (data.type === 'memory_update') {
      this.updateMemoryMetrics(data);
    }
    
    this.emit('logEvent', data);
  }
  
  /**
   * Process pattern matches from logs
   */
  private processPatternMatch(pattern: RegExp, match: RegExpMatchArray) {
    const timestamp = new Date();
    
    if (pattern.toString().includes('Token Usage')) {
      const [_, used, limit] = match;
      this.updateTokenMetrics({
        used: parseInt(used),
        limit: parseInt(limit),
        timestamp
      });
    } else if (pattern.toString().includes('Tool')) {
      const [_, toolName, status] = match;
      this.updateToolMetrics({
        tool: toolName,
        status,
        timestamp
      });
    } else if (pattern.toString().includes('Pipeline stage')) {
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
  private startDatabasePolling() {
    const interval = setInterval(async () => {
      try {
        await this.pollDatabase();
      } catch (error) {
        console.warn('Database polling error:', error);
      }
    }, this.config.pollInterval!);
    
    this.pollingIntervals.push(interval);
  }
  
  /**
   * Poll database for metrics
   */
  private async pollDatabase() {
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
        } catch (error) {
          // Ignore parsing errors
        }
      }
    }
    
    // Get chunk counts - wrap in try-catch for resilience
    let chunkCount = 0;
    let commitCount = 0;
    let knowledgeCount = 0;
    
    try {
      chunkCount = await this.prisma.chunk.count();
    } catch (e) {
      // Table might not exist yet
    }
    
    try {
      commitCount = await this.prisma.gitCommit.count();
    } catch (e) {
      // Table might not exist yet
    }
    
    try {
      knowledgeCount = await this.prisma.knowledge.count();
    } catch (e) {
      // Table might not exist yet
    }
    
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
  private watchFileSystem() {
    const paths = [
      '.flexicli/flexicli.db', // Only watch database - all persistence moved to DB
      '.flexicli/logs'         // Keep logs for debugging
    ].map(p => join(this.config.projectRoot, p));
    
    paths.forEach(path => {
      if (!existsSync(path)) return;
      
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
  private updateFileSystemMetrics() {
    const getDirectorySize = (dir: string): number => {
      if (!existsSync(dir)) return 0;
      const { size } = statSync(dir);
      return size;
    };
    
    const metrics = {
      dbSize: getDirectorySize(join(this.config.projectRoot, '.flexicli/flexicli.db')),
      logsSize: getDirectorySize(join(this.config.projectRoot, '.flexicli/logs')),
      // Removed cacheSize - cache now managed in database
      timestamp: new Date()
    };
    
    this.metrics.set('fileSystem', metrics);
    this.emit('fileSystemUpdate', metrics);
  }
  
  /**
   * Find all agent processes
   */
  private async findAgentProcesses(): Promise<Array<{pid: number, memory: any}>> {
    try {
      const { stdout } = await execAsync('ps aux | grep "node dist/cli.js" | grep -v grep');
      const lines = stdout.trim().split('\n').filter(line => line.length > 0);
      
      const processes = [];
      for (const line of lines) {
        const fields = line.trim().split(/\s+/);
        const pid = parseInt(fields[1]);
        if (pid) {
          const memory = await this.getProcessMemory(pid);
          if (memory) {
            processes.push({ pid, memory });
          }
        }
      }
      return processes;
    } catch (error) {
      // No agent processes found
    }
    return [];
  }

  /**
   * Find the primary agent process (most recent or highest memory)
   */
  private async findPrimaryAgentProcess(): Promise<number | null> {
    const processes = await this.findAgentProcesses();
    if (processes.length === 0) return null;
    
    // Return the one with highest memory usage as primary
    const primary = processes.reduce((max, current) => 
      current.memory.rss > max.memory.rss ? current : max
    );
    
    return primary.pid;
  }

  /**
   * Get available agent processes for UI selection
   */
  public async getAvailableAgents(): Promise<Array<{pid: number, projectName: string, memory: any, isPrimary: boolean}>> {
    const processes = await this.findAgentProcesses();
    const primaryPid = await this.findPrimaryAgentProcess();
    
    // Try to extract project name from process args or working directory
    const projectName = this.config.projectRoot.split('/').pop() || 'flexicli';
    return processes.map(proc => ({
      pid: proc.pid,
      projectName,
      memory: proc.memory,
      isPrimary: proc.pid === primaryPid
    }));
  }

  /**
   * Get memory usage for specific PID
   */
  private async getProcessMemory(pid: number): Promise<any> {
    try {
      const { stdout } = await execAsync(`ps -o pid,rss,vsz -p ${pid}`);
      const lines = stdout.trim().split('\n');
      if (lines.length > 1) {
        const fields = lines[1].trim().split(/\s+/);
        return {
          rss: parseInt(fields[1]) * 1024, // Convert KB to bytes
          vsz: parseInt(fields[2]) * 1024  // Convert KB to bytes
        };
      }
    } catch (error) {
      // Process not found
    }
    return null;
  }

  /**
   * Monitor process metrics
   */
  private monitorProcessMetrics() {
    const interval = setInterval(async () => {
      // Try to monitor primary agent process first
      const agentPid = await this.findPrimaryAgentProcess();
      const allProcesses = await this.findAgentProcesses();
      
      let metrics;
      if (agentPid) {
        const agentMemory = await this.getProcessMemory(agentPid);
        if (agentMemory) {
          metrics = {
            memory: {
              rss: agentMemory.rss,
              heapTotal: agentMemory.vsz, // Virtual size as approximate heap total
              heapUsed: agentMemory.rss,  // RSS as approximate heap used
              external: 0
            },
            cpu: { user: 0, system: 0 }, // TODO: Add CPU monitoring for external process
            uptime: 0, // TODO: Add uptime calculation for agent
            timestamp: new Date(),
            processType: 'agent',
            pid: agentPid,
            totalAgentProcesses: allProcesses.length,
            allAgentPids: allProcesses.map(p => p.pid)
          };
        }
      }
      
      // Fallback to monitoring server metrics if agent not found
      if (!metrics) {
        const usage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        metrics = {
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
          timestamp: new Date(),
          processType: 'monitoring-server',
          totalAgentProcesses: 0,
          allAgentPids: []
        };
      }
      
      this.metrics.set('process', metrics);
      this.emit('processMetrics', metrics);
    }, 5000); // Every 5 seconds
    
    this.pollingIntervals.push(interval);
  }
  
  /**
   * Intercept stdout/stderr
   */
  private interceptOutput() {
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
  private processConsoleOutput(type: string, args: any[]) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : arg
    ).join(' ');
    
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
  private updateTokenMetrics(data: any) {
    const current = this.metrics.get('tokenUsage') || {};
    this.metrics.set('tokenUsage', { ...current, ...data });
    this.emit('tokenUpdate', data);
  }
  
  private updateToolMetrics(data: any) {
    const tools = this.metrics.get('tools') || new Map();
    const toolStats = tools.get(data.tool) || { count: 0, success: 0, failed: 0 };
    
    if (data.status === 'completed') {
      toolStats.count++;
      toolStats.success++;
    } else if (data.status === 'failed') {
      toolStats.count++;
      toolStats.failed++;
    }
    
    tools.set(data.tool, toolStats);
    this.metrics.set('tools', tools);
    this.emit('toolUpdate', data);
  }
  
  private updatePipelineMetrics(data: any) {
    const pipeline = this.metrics.get('pipeline') || [];
    pipeline.push(data);
    if (pipeline.length > 100) pipeline.shift();
    this.metrics.set('pipeline', pipeline);
    this.emit('pipelineUpdate', data);
  }
  
  private updateMemoryMetrics(data: any) {
    const memory = this.metrics.get('memory') || {};
    memory[data.layer] = data;
    this.metrics.set('memory', memory);
    this.emit('memoryUpdate', data);
  }
  
  private updateSessionMetrics(session: any) {
    this.metrics.set('session', session);
    this.emit('sessionUpdate', session);
  }
  
  private processExecutionLog(log: any) {
    this.emit('executionLog', log);
  }
  
  /**
   * Get all metrics
   */
  getAllMetrics() {
    const result: any = {};
    for (const [key, value] of this.metrics.entries()) {
      if (value instanceof Map) {
        result[key] = Array.from(value.entries());
      } else {
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