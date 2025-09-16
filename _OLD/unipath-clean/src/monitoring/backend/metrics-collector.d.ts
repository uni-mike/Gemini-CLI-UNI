/**
 * Metrics Collector
 * Collects and aggregates metrics from all system components
 */
import { EventEmitter } from 'events';
import { TokenMetrics, MemoryLayerStatus, PipelineStage, ToolExecution, RetrievalMetrics, MonitoringEvent } from './types.js';
import { PrismaClient } from '@prisma/client';
export declare class MetricsCollector extends EventEmitter {
    private prisma;
    private metrics;
    private events;
    private maxEvents;
    private startTime;
    private pipelineStages;
    private activeTools;
    constructor(prisma: PrismaClient);
    /**
     * Start periodic metrics collection
     */
    private startCollectionLoop;
    /**
     * Record token usage
     */
    recordTokenUsage(metrics: TokenMetrics): void;
    /**
     * Update memory layer status
     */
    updateMemoryLayer(layer: MemoryLayerStatus): void;
    /**
     * Track session metrics
     */
    updateSessionMetrics(sessionId: string): Promise<void>;
    /**
     * Track pipeline stage
     */
    startPipelineStage(stage: Omit<PipelineStage, 'startTime' | 'status'>): void;
    /**
     * Complete pipeline stage
     */
    completePipelineStage(stageId: string, output?: any, error?: string): void;
    /**
     * Track tool execution
     */
    startToolExecution(tool: Omit<ToolExecution, 'timestamp' | 'duration'>): void;
    /**
     * Complete tool execution
     */
    completeToolExecution(toolId: string, output?: any, error?: string): void;
    /**
     * Track retrieval metrics
     */
    recordRetrieval(metrics: RetrievalMetrics): void;
    /**
     * Update git context metrics
     */
    updateGitMetrics(): Promise<void>;
    /**
     * Collect system health metrics
     */
    private collectSystemHealth;
    /**
     * Get memory usage
     */
    private getMemoryUsage;
    /**
     * Get disk usage
     */
    private getDiskUsage;
    /**
     * Check API health
     */
    private checkAPIHealth;
    /**
     * Get recent errors
     */
    private getRecentErrors;
    /**
     * Collect database metrics
     */
    private collectDatabaseMetrics;
    /**
     * Record monitoring event
     */
    recordEvent(type: MonitoringEvent['type'], action: string, data: any): void;
    /**
     * Get caller component from stack trace
     */
    private getCallerComponent;
    /**
     * Get all current metrics
     */
    getAllMetrics(): any;
    /**
     * Get recent events
     */
    getRecentEvents(limit?: number): MonitoringEvent[];
    /**
     * Get active tools
     */
    getActiveTools(): ToolExecution[];
    /**
     * Clear metrics
     */
    clearMetrics(): void;
}
//# sourceMappingURL=metrics-collector.d.ts.map