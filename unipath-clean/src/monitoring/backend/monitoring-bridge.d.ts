/**
 * Monitoring Bridge
 * Subscribes to existing agent events and forwards to monitoring system
 * Can attach/detach without affecting agent operation
 */
import { Orchestrator } from '../core/orchestrator.js';
import { MemoryManager } from '../memory/memory-manager.js';
import { PrismaClient } from '@prisma/client';
export declare class MonitoringBridge {
    private collector;
    private autonomousCollector;
    private attachedModules;
    private listeners;
    constructor(prisma: PrismaClient, projectRoot: string);
    /**
     * Start monitoring (works with or without agent)
     */
    start(): Promise<void>;
    /**
     * Attach to a running orchestrator (optional - for real-time data)
     */
    attachToOrchestrator(orchestrator: Orchestrator): void;
    /**
     * Attach to memory manager (optional - for token tracking)
     */
    attachToMemoryManager(memoryManager: MemoryManager): void;
    /**
     * Detach from all modules (monitoring continues autonomously)
     */
    detach(): void;
    /**
     * Get all metrics (combines real-time and autonomous)
     */
    getAllMetrics(): {
        realtime: any;
        autonomous: any;
        combined: any;
    };
    /**
     * Check monitoring health
     */
    getHealth(): {
        autonomousRunning: boolean;
        realtimeAttached: boolean;
        attachedModules: string[];
        dataAvailable: {
            database: boolean;
            logs: boolean;
            realtime: boolean;
        };
    };
    /**
     * Stop monitoring
     */
    stop(): Promise<void>;
    private estimateTokens;
    private mergeMetrics;
}
//# sourceMappingURL=monitoring-bridge.d.ts.map