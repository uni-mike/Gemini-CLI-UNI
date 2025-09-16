/**
 * Monitoring Bridge
 * Subscribes to existing agent events and forwards to monitoring system
 * Can attach/detach without affecting agent operation
 */
import { MetricsCollector } from './metrics-collector.js';
import { AutonomousCollector } from './autonomous-collector.js';
export class MonitoringBridge {
    collector;
    autonomousCollector;
    attachedModules = new Map();
    listeners = new Map();
    constructor(prisma, projectRoot) {
        // Integrated collector for real-time events
        this.collector = new MetricsCollector(prisma);
        // Autonomous collector continues working even if agent dies
        this.autonomousCollector = new AutonomousCollector({
            projectRoot,
            pollInterval: 2000
        });
    }
    /**
     * Start monitoring (works with or without agent)
     */
    async start() {
        // Always start autonomous monitoring (reads DB, logs, files)
        await this.autonomousCollector.start();
        console.log('📊 Autonomous monitoring started (will survive agent crashes)');
    }
    /**
     * Attach to a running orchestrator (optional - for real-time data)
     */
    attachToOrchestrator(orchestrator) {
        if (this.attachedModules.has('orchestrator')) {
            console.log('Already attached to orchestrator');
            return;
        }
        const listeners = [];
        // Subscribe to existing orchestrator events
        const onPlanningStart = (data) => {
            this.collector.startPipelineStage({
                id: `plan-${Date.now()}`,
                name: 'Planning',
                type: 'planner',
                input: data
            });
        };
        orchestrator.on('planning-start', onPlanningStart);
        listeners.push(() => orchestrator.off('planning-start', onPlanningStart));
        const onPlanningComplete = (plan) => {
            this.collector.completePipelineStage(`plan-${Date.now()}`, plan);
        };
        orchestrator.on('planning-complete', onPlanningComplete);
        listeners.push(() => orchestrator.off('planning-complete', onPlanningComplete));
        const onTaskStart = (data) => {
            this.collector.startToolExecution({
                id: `task-${Date.now()}`,
                toolName: data.task.tool || 'unknown',
                success: false,
                input: data.task
            });
        };
        orchestrator.on('task-start', onTaskStart);
        listeners.push(() => orchestrator.off('task-start', onTaskStart));
        const onTaskComplete = (result) => {
            this.collector.completeToolExecution(`task-${Date.now()}`, result);
        };
        orchestrator.on('task-complete', onTaskComplete);
        listeners.push(() => orchestrator.off('task-complete', onTaskComplete));
        const onOrchestrationError = (error) => {
            this.collector.recordEvent('error', 'orchestration_error', error);
        };
        orchestrator.on('orchestration-error', onOrchestrationError);
        listeners.push(() => orchestrator.off('orchestration-error', onOrchestrationError));
        this.attachedModules.set('orchestrator', orchestrator);
        this.listeners.set('orchestrator', listeners);
        console.log('✅ Monitoring attached to orchestrator (real-time events enabled)');
    }
    /**
     * Attach to memory manager (optional - for token tracking)
     */
    attachToMemoryManager(memoryManager) {
        if (this.attachedModules.has('memory')) {
            console.log('Already attached to memory manager');
            return;
        }
        const listeners = [];
        // Intercept buildPrompt to track token usage
        const originalBuildPrompt = memoryManager.buildPrompt.bind(memoryManager);
        memoryManager.buildPrompt = async (query, options) => {
            const result = await originalBuildPrompt(query, options);
            // Extract token metrics from the result
            const tokenMetrics = {
                input: {
                    ephemeral: this.estimateTokens(result.ephemeral),
                    retrieved: this.estimateTokens(result.retrieved),
                    knowledge: this.estimateTokens(result.knowledge),
                    query: this.estimateTokens(query),
                    buffer: 0,
                    total: 0,
                    limit: 128000
                },
                output: {
                    reasoning: 0,
                    code: 0,
                    explanation: 0,
                    buffer: 0,
                    total: 0,
                    limit: 6000
                },
                mode: 'concise'
            };
            tokenMetrics.input.total = Object.values(tokenMetrics.input)
                .filter(v => typeof v === 'number')
                .reduce((a, b) => a + b, 0);
            this.collector.recordTokenUsage(tokenMetrics);
            return result;
        };
        listeners.push(() => {
            memoryManager.buildPrompt = originalBuildPrompt;
        });
        this.attachedModules.set('memory', memoryManager);
        this.listeners.set('memory', listeners);
        console.log('✅ Monitoring attached to memory manager (token tracking enabled)');
    }
    /**
     * Detach from all modules (monitoring continues autonomously)
     */
    detach() {
        for (const [module, listeners] of this.listeners.entries()) {
            for (const cleanup of listeners) {
                cleanup();
            }
        }
        this.attachedModules.clear();
        this.listeners.clear();
        console.log('📊 Detached from agent (autonomous monitoring continues)');
    }
    /**
     * Get all metrics (combines real-time and autonomous)
     */
    getAllMetrics() {
        const realtime = this.collector.getAllMetrics();
        const autonomous = this.autonomousCollector.getAllMetrics();
        return {
            realtime,
            autonomous,
            combined: this.mergeMetrics(realtime, autonomous)
        };
    }
    /**
     * Check monitoring health
     */
    getHealth() {
        return {
            autonomousRunning: true, // Always true if started
            realtimeAttached: this.attachedModules.size > 0,
            attachedModules: Array.from(this.attachedModules.keys()),
            dataAvailable: {
                database: true, // Always accessible
                logs: true, // Always accessible
                realtime: this.attachedModules.size > 0
            }
        };
    }
    /**
     * Stop monitoring
     */
    async stop() {
        this.detach();
        await this.autonomousCollector.stop();
        console.log('🛑 Monitoring stopped');
    }
    estimateTokens(text) {
        if (!text)
            return 0;
        return Math.ceil(text.length / 4);
    }
    mergeMetrics(realtime, autonomous) {
        // Prefer real-time data when available, fill gaps with autonomous
        return {
            ...autonomous,
            ...realtime,
            source: {
                realtime: Object.keys(realtime),
                autonomous: Object.keys(autonomous)
            }
        };
    }
}
//# sourceMappingURL=monitoring-bridge.js.map