/**
 * Monitoring Server
 * Express + Socket.io backend for real-time monitoring
 */
import { MetricsCollector } from './metrics-collector.js';
export declare class MonitoringServer {
    private app;
    private server;
    private io;
    private prisma;
    private collector;
    private projectManager;
    private port;
    getPort(): number;
    constructor(port?: number);
    /**
     * Setup Express middleware
     */
    private setupMiddleware;
    /**
     * Setup API routes
     */
    private setupRoutes;
    /**
     * Setup Socket.io handlers
     */
    private setupSocketHandlers;
    /**
     * Setup metrics forwarding to socket clients
     */
    private setupMetricsForwarding;
    /**
     * Build pipeline nodes for visualization
     */
    private buildPipelineNodes;
    /**
     * Build pipeline edges for visualization
     */
    private buildPipelineEdges;
    /**
     * Start the monitoring server
     */
    start(): void;
    /**
     * Stop the monitoring server
     */
    stop(): Promise<void>;
    /**
     * Get metrics collector instance
     */
    getCollector(): MetricsCollector;
}
//# sourceMappingURL=server.d.ts.map