/**
 * Autonomous Metrics Collector
 * Completely decoupled from main agent - uses file watching, log parsing, and DB polling
 */
import { EventEmitter } from 'events';
export interface AutonomousConfig {
    projectRoot: string;
    pollInterval?: number;
    logPath?: string;
    dbPath?: string;
}
export declare class AutonomousCollector extends EventEmitter {
    private config;
    private prisma;
    private watchers;
    private pollingIntervals;
    private metrics;
    private lastProcessedPositions;
    private lastDbSync;
    constructor(config: AutonomousConfig);
    /**
     * Start autonomous monitoring
     */
    start(): Promise<void>;
    /**
     * Watch log files for agent events
     */
    private watchLogs;
    /**
     * Process log file for metrics
     */
    private processLogFile;
    /**
     * Parse log line for metrics
     */
    private parseLogLine;
    /**
     * Process extracted log data
     */
    private processLogData;
    /**
     * Process pattern matches from logs
     */
    private processPatternMatch;
    /**
     * Poll database for changes
     */
    private startDatabasePolling;
    /**
     * Poll database for metrics
     */
    private pollDatabase;
    /**
     * Watch file system for changes
     */
    private watchFileSystem;
    /**
     * Update file system metrics
     */
    private updateFileSystemMetrics;
    /**
     * Monitor process metrics
     */
    private monitorProcessMetrics;
    /**
     * Intercept stdout/stderr
     */
    private interceptOutput;
    /**
     * Process console output
     */
    private processConsoleOutput;
    /**
     * Update specific metric types
     */
    private updateTokenMetrics;
    private updateToolMetrics;
    private updatePipelineMetrics;
    private updateMemoryMetrics;
    private updateSessionMetrics;
    private processExecutionLog;
    /**
     * Get all metrics
     */
    getAllMetrics(): any;
    /**
     * Stop monitoring
     */
    stop(): Promise<void>;
}
//# sourceMappingURL=autonomous-collector.d.ts.map