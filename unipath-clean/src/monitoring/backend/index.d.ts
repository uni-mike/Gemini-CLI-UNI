/**
 * Monitoring System Entry Point
 * Can be used with or without agent integration
 */
import { Orchestrator } from '../core/orchestrator.js';
import { MemoryManager } from '../memory/memory-manager.js';
export interface MonitoringOptions {
    port?: number;
    enableRealtime?: boolean;
    projectRoot?: string;
}
export declare class MonitoringSystem {
    private server;
    private bridge;
    private projectManager;
    private prisma;
    constructor(options?: MonitoringOptions);
    /**
     * Start monitoring (works without agent)
     */
    start(): Promise<void>;
    /**
     * Optional: Attach to running agent for real-time data
     */
    attachToAgent(orchestrator?: Orchestrator, memoryManager?: MemoryManager): void;
    /**
     * Detach from agent (monitoring continues)
     */
    detachFromAgent(): void;
    /**
     * Get monitoring status
     */
    getStatus(): {
        server: string;
        health: {
            autonomousRunning: boolean;
            realtimeAttached: boolean;
            attachedModules: string[];
            dataAvailable: {
                database: boolean;
                logs: boolean;
                realtime: boolean;
            };
        };
        metrics: {
            realtime: any;
            autonomous: any;
            combined: any;
        };
    };
    /**
     * Stop monitoring completely
     */
    stop(): Promise<void>;
}
/**
 * Standalone monitoring launcher (no agent required)
 */
export declare function startStandaloneMonitoring(port?: number): Promise<MonitoringSystem>;
/**
 * Example: How to use with existing agent
 */
export declare function integrateWithAgent(orchestrator: Orchestrator, memoryManager: MemoryManager, options?: MonitoringOptions): MonitoringSystem;
//# sourceMappingURL=index.d.ts.map