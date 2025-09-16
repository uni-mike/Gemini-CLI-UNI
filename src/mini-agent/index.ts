/**
 * Mini-Agent System - Main Entry Point
 * Exports all mini-agent components and provides a unified interface
 */

// Core components
// MiniOrchestrator removed - using main Orchestrator with executeAsAgent method
export { AgentSpawner } from './core/agent-spawner.js';
export { LifecycleManager } from './core/lifecycle-manager.js';
export * from './core/types.js';

// Memory management
export { ContextScoper } from './memory/context-scoper.js';

// Communication
export { EventBus } from './communication/event-bus.js';

// Security
export { PermissionManager } from './security/permission-manager.js';

// Integration
export { TrioCoordinator } from './integration/trio-coordinator.js';

// Main Mini-Agent System class
import { EventEmitter } from 'events';
import { Config } from '../config/Config.js';
import { DeepSeekClient } from '../llm/deepseek-client.js';
import { ToolRegistry } from '../tools/registry.js';
import { MemoryManager } from '../memory/memory-manager.js';
import { Orchestrator } from '../core/orchestrator.js';

import { AgentSpawner } from './core/agent-spawner.js';
import { LifecycleManager } from './core/lifecycle-manager.js';
import { EventBus } from './communication/event-bus.js';
import { PermissionManager } from './security/permission-manager.js';
import { ContextScoper } from './memory/context-scoper.js';
import { TrioCoordinator } from './integration/trio-coordinator.js';
import {
  MiniAgentTask,
  MiniAgentConfig,
  SecurityPolicy,
  ExecutionPool,
  SpawnerConfig
} from './core/types.js';

/**
 * Main Mini-Agent System
 * Orchestrates all mini-agent components and provides unified interface
 */
export class MiniAgentSystem extends EventEmitter {
  private config: Config;
  private client: DeepSeekClient;
  private toolRegistry: ToolRegistry;
  private memoryManager: MemoryManager;
  private mainOrchestrator: Orchestrator;

  // Mini-agent components
  private agentSpawner: AgentSpawner;
  private lifecycleManager: LifecycleManager;
  private eventBus: EventBus;
  private permissionManager: PermissionManager;
  private contextScoper: ContextScoper;
  private trioCoordinator: TrioCoordinator;

  private initialized: boolean = false;
  private systemConfig: MiniAgentConfig;

  constructor(
    config: Config,
    client: DeepSeekClient,
    toolRegistry: ToolRegistry,
    memoryManager: MemoryManager,
    mainOrchestrator: Orchestrator
  ) {
    super();

    this.config = config;
    this.client = client;
    this.toolRegistry = toolRegistry;
    this.memoryManager = memoryManager;
    this.mainOrchestrator = mainOrchestrator;

    this.systemConfig = this.loadSystemConfig();

    console.log('MiniAgentSystem: Initialized with config:', {
      enabled: this.systemConfig.enabled,
      maxConcurrentAgents: this.systemConfig.maxConcurrentAgents,
      securityMode: this.systemConfig.securityMode
    });
  }

  private loadSystemConfig(): MiniAgentConfig {
    return {
      enabled: this.config.get('MINI_AGENT_ENABLED', 'true') === 'true',
      maxConcurrentAgents: parseInt(this.config.get('MINI_AGENT_MAX_CONCURRENT', '10')),
      defaultTimeoutMs: parseInt(this.config.get('MINI_AGENT_DEFAULT_TIMEOUT', '600000')),
      enableHealthChecks: this.config.get('MINI_AGENT_HEALTH_CHECKS', 'true') === 'true',
      enableMetrics: this.config.get('MINI_AGENT_METRICS', 'true') === 'true',
      logLevel: (this.config.get('MINI_AGENT_LOG_LEVEL', 'info') as any),
      securityMode: (this.config.get('MINI_AGENT_SECURITY_MODE', 'strict') as any)
    };
  }

  /**
   * Initialize the mini-agent system
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('MiniAgentSystem: Already initialized');
      return;
    }

    if (!this.systemConfig.enabled) {
      console.log('MiniAgentSystem: System disabled, skipping initialization');
      return;
    }

    try {
      console.log('MiniAgentSystem: Starting initialization...');

      // Initialize core components
      await this.initializeComponents();

      // Set up integration
      await this.setupIntegration();

      // Set up event forwarding
      this.setupEventForwarding();

      this.initialized = true;

      this.emit('initialized', {
        timestamp: Date.now(),
        config: this.systemConfig
      });

      console.log('MiniAgentSystem: Initialization complete');

    } catch (error: any) {
      console.error('MiniAgentSystem: Initialization failed:', error);
      this.emit('initialization-failed', error);
      throw error;
    }
  }

  private async initializeComponents(): Promise<void> {
    // Initialize event bus first (others depend on it)
    this.eventBus = new EventBus(1000);

    // Initialize lifecycle manager
    this.lifecycleManager = new LifecycleManager(this.config);

    // Initialize security components
    const securityPolicy = this.createSecurityPolicy();
    this.permissionManager = new PermissionManager(this.config, securityPolicy);

    // Initialize memory scoping
    this.contextScoper = new ContextScoper(this.memoryManager);

    // Initialize agent spawner
    this.agentSpawner = new AgentSpawner(
      this.config,
      this.client,
      this.toolRegistry
    );

    console.log('MiniAgentSystem: Core components initialized');
  }

  private async setupIntegration(): Promise<void> {
    // Initialize trio coordinator for main orchestrator integration
    this.trioCoordinator = new TrioCoordinator(
      this.mainOrchestrator,
      this.agentSpawner,
      this.lifecycleManager,
      this.eventBus,
      this.permissionManager,
      this.memoryManager,
      this.config
    );

    // Connect components
    this.connectComponents();

    console.log('MiniAgentSystem: Integration setup complete');
  }

  private connectComponents(): void {
    // Connect spawner to lifecycle manager
    this.agentSpawner.on('agent-spawned', (event) => {
      const agent = this.agentSpawner.getAgent(event.agentId);
      if (agent) {
        this.lifecycleManager.registerAgent(agent);
      }
    });

    // Connect spawner to permission manager
    this.agentSpawner.on('agent-spawned', (event) => {
      const agent = this.agentSpawner.getAgent(event.agentId);
      if (agent) {
        const instance = agent.getInstance();
        this.permissionManager.registerAgent(instance.id, instance.permissions);
      }
    });

    // Connect lifecycle manager to permission manager cleanup
    this.lifecycleManager.on('agent-cleaned', (result) => {
      this.permissionManager.unregisterAgent(result.agentId);
    });

    // Forward all component events to event bus
    [this.agentSpawner, this.lifecycleManager, this.permissionManager, this.contextScoper].forEach(component => {
      component.on('*', (event) => {
        this.eventBus.emit(event);
      });
    });

    console.log('MiniAgentSystem: Component connections established');
  }

  private setupEventForwarding(): void {
    // Forward important events from event bus to main system
    this.eventBus.on('AGENT_SPAWNED', (event) => {
      this.emit('agent-spawned', event);
    });

    this.eventBus.on('AGENT_COMPLETED', (event) => {
      this.emit('agent-completed', event);
    });

    this.eventBus.on('AGENT_FAILED', (event) => {
      this.emit('agent-failed', event);
    });

    // Forward trio coordinator events
    this.trioCoordinator.on('task-completed', (event) => {
      this.emit('task-completed', event);
    });

    this.trioCoordinator.on('task-failed', (event) => {
      this.emit('task-failed', event);
    });

    console.log('MiniAgentSystem: Event forwarding setup complete');
  }

  private createSecurityPolicy(): SecurityPolicy {
    const mode = this.systemConfig.securityMode;

    const baseDangerous = ['rm', 'git-push', 'delete', 'format'];
    const baseReadOnly = ['search', 'read', 'grep', 'glob', 'analyze'];
    const baseWriteAllowed = ['write', 'edit', 'create', 'test'];

    return {
      toolRestrictions: {
        dangerous: mode === 'development' ? baseDangerous.slice(0, 2) : baseDangerous,
        readOnly: baseReadOnly,
        writeAllowed: baseWriteAllowed
      },
      contextSandboxing: {
        isolateMemory: true,
        preventCrossAgent: true,
        encryptSensitive: mode === 'strict'
      },
      resourceLimits: {
        maxFileReads: mode === 'strict' ? 50 : mode === 'permissive' ? 200 : 100,
        maxFileWrites: mode === 'strict' ? 20 : mode === 'permissive' ? 100 : 50,
        maxToolCalls: mode === 'strict' ? 100 : mode === 'permissive' ? 500 : 200,
        networkCallsAllowed: mode === 'development',
        maxExecutionTime: mode === 'strict' ? 600000 : 1200000 // 10-20 minutes
      }
    };
  }

  /**
   * Spawn a new mini-agent
   */
  public async spawnAgent(task: MiniAgentTask): Promise<string> {
    if (!this.initialized) {
      throw new Error('MiniAgentSystem not initialized');
    }

    if (!this.systemConfig.enabled) {
      throw new Error('MiniAgentSystem is disabled');
    }

    return this.agentSpawner.spawnAgent(task);
  }

  /**
   * Cancel a running mini-agent
   */
  public async cancelAgent(agentId: string): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    return this.agentSpawner.cancelAgent(agentId);
  }

  /**
   * Get system statistics
   */
  public getStats() {
    if (!this.initialized) {
      return { initialized: false };
    }

    return {
      initialized: true,
      config: this.systemConfig,
      spawner: this.agentSpawner.getStats(),
      lifecycle: this.lifecycleManager.getStats(),
      events: this.eventBus.getEventStats(),
      security: this.permissionManager.getSecurityStats(),
      trio: this.trioCoordinator.getStats()
    };
  }

  /**
   * Get active agents
   */
  public getActiveAgents(): string[] {
    if (!this.initialized) {
      return [];
    }

    return this.agentSpawner.getActiveAgents();
  }

  /**
   * Get agent details
   */
  public getAgent(agentId: string) {
    if (!this.initialized) {
      return null;
    }

    const agent = this.agentSpawner.getAgent(agentId);
    if (agent) {
      return {
        instance: agent.getInstance(),
        health: agent.getHealth(),
        lifecycle: this.lifecycleManager.getAgentLifecycle(agentId),
        permissions: this.permissionManager.getAgentPermissions(agentId)
      };
    }

    return null;
  }

  /**
   * Force cleanup of all agents
   */
  public async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    console.log('MiniAgentSystem: Starting cleanup...');

    try {
      // Cancel all active agents
      const activeAgents = this.getActiveAgents();
      await Promise.all(activeAgents.map(agentId => this.cancelAgent(agentId)));

      // Force cleanup lifecycle manager
      await this.lifecycleManager.forceCleanupAll();

      // Clear event bus history
      this.eventBus.clearHistory();

      this.emit('cleanup-complete', { timestamp: Date.now() });

      console.log('MiniAgentSystem: Cleanup complete');

    } catch (error) {
      console.error('MiniAgentSystem: Cleanup failed:', error);
      this.emit('cleanup-failed', error);
    }
  }

  /**
   * Shutdown the system
   */
  public async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    console.log('MiniAgentSystem: Shutting down...');

    try {
      // Cleanup first
      await this.cleanup();

      // Shutdown components
      await this.lifecycleManager.shutdown();

      // Clear all listeners
      this.removeAllListeners();
      this.eventBus.removeAllListeners();

      this.initialized = false;

      console.log('MiniAgentSystem: Shutdown complete');

    } catch (error) {
      console.error('MiniAgentSystem: Shutdown failed:', error);
      throw error;
    }
  }

  /**
   * Check if system is enabled and initialized
   */
  public isReady(): boolean {
    return this.initialized && this.systemConfig.enabled;
  }

  /**
   * Update system configuration
   */
  public updateConfig(newConfig: Partial<MiniAgentConfig>): void {
    this.systemConfig = { ...this.systemConfig, ...newConfig };

    if (this.trioCoordinator) {
      this.trioCoordinator.updateConfig({
        enabled: this.systemConfig.enabled,
        maxConcurrentMiniAgents: this.systemConfig.maxConcurrentAgents
      });
    }

    this.emit('config-updated', this.systemConfig);
    console.log('MiniAgentSystem: Configuration updated');
  }
}

// Convenience function to create and initialize the system
export async function createMiniAgentSystem(
  config: Config,
  client: DeepSeekClient,
  toolRegistry: ToolRegistry,
  memoryManager: MemoryManager,
  mainOrchestrator: Orchestrator
): Promise<MiniAgentSystem> {
  const system = new MiniAgentSystem(
    config,
    client,
    toolRegistry,
    memoryManager,
    mainOrchestrator
  );

  await system.initialize();
  return system;
}