/**
 * AgentSpawner - Factory for creating mini-agents with specific configurations
 * Manages agent templates, resource allocation, and spawning logic
 */

import { EventEmitter } from 'events';
import { DeepSeekClient } from '../../llm/deepseek-client.js';
import { Config } from '../../config/Config.js';
import { ToolRegistry } from '../../tools/registry.js';
import { Orchestrator } from '../../core/orchestrator.js';
import {
  MiniAgentTask,
  MiniAgentInstance,
  SpawnerConfig,
  AgentTemplate,
  ExecutionPool,
  SecurityPolicy,
  ToolPermissions,
  ScopedMemoryContext
} from './types.js';

export class AgentSpawner extends EventEmitter {
  private config: Config;
  private client: DeepSeekClient;
  private toolRegistry: ToolRegistry;
  private spawnerConfig: SpawnerConfig;
  private activeAgents: Map<string, { orchestrator: Orchestrator, task: MiniAgentTask }> = new Map();
  private taskQueue: MiniAgentTask[] = [];
  private isProcessingQueue: boolean = false;

  constructor(
    config: Config,
    client: DeepSeekClient,
    toolRegistry: ToolRegistry
  ) {
    super();
    this.config = config;
    this.client = client;
    this.toolRegistry = toolRegistry;
    this.spawnerConfig = this.loadSpawnerConfig();

    this.startQueueProcessor();
  }

  private loadSpawnerConfig(): SpawnerConfig {
    return {
      templates: this.loadAgentTemplates(),
      defaultTimeout: parseInt(this.config.get('MINI_AGENT_DEFAULT_TIMEOUT', '600000')),
      defaultMaxIterations: parseInt(this.config.get('MINI_AGENT_MAX_ITERATIONS', '10')),
      securityPolicy: this.loadSecurityPolicy(),
      executionPool: this.loadExecutionPoolConfig()
    };
  }

  private loadAgentTemplates(): Record<string, AgentTemplate> {
    return {
      search: {
        type: 'search',
        promptTemplate: `You are a specialized search agent. Your task is to find specific information or patterns in the codebase.

        Focus on:
        - Accurate pattern matching
        - Comprehensive file searching
        - Context-aware results
        - Efficient search strategies

        Always report findings with file paths and line numbers.`,
        defaultTools: ['search', 'grep', 'read', 'glob'],
        defaultPermissions: {
          allowed: ['search', 'grep', 'read', 'glob'],
          restricted: ['write', 'edit', 'git', 'bash'],
          readOnly: true,
          networkAccess: false,
          fileSystemAccess: 'read',
          dangerousOperations: false,
          gitOperations: false,
          maxToolCalls: 50
        },
        maxTokens: 8000,
        specialization: 'Information retrieval and pattern matching'
      },

      migration: {
        type: 'migration',
        promptTemplate: `You are a specialized code migration agent. Your task is to safely migrate code patterns, APIs, or structures.

        Focus on:
        - Maintaining functionality during migration
        - Following migration best practices
        - Comprehensive testing of changes
        - Rollback strategies for failures

        Always validate changes and report potential risks.`,
        defaultTools: ['search', 'read', 'write', 'edit', 'grep', 'test'],
        defaultPermissions: {
          allowed: ['search', 'read', 'write', 'edit', 'grep', 'test'],
          restricted: ['git-push', 'rm', 'network'],
          readOnly: false,
          networkAccess: false,
          fileSystemAccess: 'write',
          dangerousOperations: false,
          gitOperations: false,
          maxToolCalls: 100
        },
        maxTokens: 12000,
        specialization: 'Code migration and refactoring',
        examples: [
          'Migrate from API v1 to v2',
          'Update deprecated function calls',
          'Refactor class structure'
        ]
      },

      analysis: {
        type: 'analysis',
        promptTemplate: `You are a specialized code analysis agent. Your task is to analyze code for specific patterns, issues, or metrics.

        Focus on:
        - Thorough code examination
        - Pattern recognition and classification
        - Security vulnerability detection
        - Performance bottleneck identification

        Provide detailed reports with actionable recommendations.`,
        defaultTools: ['search', 'grep', 'read', 'analyze'],
        defaultPermissions: {
          allowed: ['search', 'grep', 'read', 'analyze', 'glob'],
          restricted: ['write', 'edit', 'git', 'bash', 'network'],
          readOnly: true,
          networkAccess: false,
          fileSystemAccess: 'read',
          dangerousOperations: false,
          gitOperations: false,
          maxToolCalls: 75
        },
        maxTokens: 10000,
        specialization: 'Code analysis and quality assessment'
      },

      refactor: {
        type: 'refactor',
        promptTemplate: `You are a specialized refactoring agent. Your task is to improve code structure, readability, and maintainability.

        Focus on:
        - Clean code principles
        - Design pattern application
        - Code duplication elimination
        - Performance optimization

        Always preserve existing functionality while improving code quality.`,
        defaultTools: ['search', 'read', 'write', 'edit', 'test', 'grep'],
        defaultPermissions: {
          allowed: ['search', 'read', 'write', 'edit', 'test', 'grep'],
          restricted: ['git-push', 'rm', 'network', 'bash'],
          readOnly: false,
          networkAccess: false,
          fileSystemAccess: 'write',
          dangerousOperations: false,
          gitOperations: false,
          maxToolCalls: 80
        },
        maxTokens: 12000,
        specialization: 'Code refactoring and optimization'
      },

      test: {
        type: 'test',
        promptTemplate: `You are a specialized testing agent. Your task is to create, run, and validate tests for code functionality.

        Focus on:
        - Comprehensive test coverage
        - Edge case identification
        - Test automation setup
        - Quality assurance validation

        Ensure all tests are reliable and maintainable.`,
        defaultTools: ['search', 'read', 'write', 'test', 'bash', 'grep'],
        defaultPermissions: {
          allowed: ['search', 'read', 'write', 'test', 'bash', 'grep'],
          restricted: ['git-push', 'rm', 'network'],
          readOnly: false,
          networkAccess: false,
          fileSystemAccess: 'write',
          dangerousOperations: false,
          gitOperations: false,
          maxToolCalls: 60
        },
        maxTokens: 10000,
        specialization: 'Test creation and validation'
      },

      documentation: {
        type: 'documentation',
        promptTemplate: `You are a specialized documentation agent. Your task is to create, update, and maintain project documentation.

        Focus on:
        - Clear and comprehensive documentation
        - Up-to-date API references
        - User-friendly guides and examples
        - Documentation consistency

        Ensure documentation serves both developers and end users effectively.`,
        defaultTools: ['search', 'read', 'write', 'grep', 'glob'],
        defaultPermissions: {
          allowed: ['search', 'read', 'write', 'grep', 'glob'],
          restricted: ['git', 'bash', 'network', 'rm'],
          readOnly: false,
          networkAccess: false,
          fileSystemAccess: 'write',
          dangerousOperations: false,
          gitOperations: false,
          maxToolCalls: 40
        },
        maxTokens: 8000,
        specialization: 'Documentation creation and maintenance'
      },

      general: {
        type: 'general',
        promptTemplate: `You are a general-purpose mini-agent capable of handling various tasks that don't fit into specialized categories.

        You can adapt your approach based on the task requirements:
        - Code analysis and review
        - File manipulation and organization
        - Complex multi-step workflows
        - Custom problem solving
        - Integration tasks
        - Experimental features

        Always:
        - Analyze the task to understand requirements
        - Choose appropriate tools for the job
        - Execute systematically with clear progress updates
        - Validate results and report findings
        - Adapt your strategy if initial approach doesn't work

        Be flexible, thorough, and focused on delivering the requested outcome.`,
        defaultTools: ['search', 'read', 'write', 'edit', 'grep', 'glob', 'bash'],
        defaultPermissions: {
          allowed: ['search', 'read', 'write', 'edit', 'grep', 'glob', 'bash'],
          restricted: ['git-push', 'rm', 'format', 'delete', 'network'],
          readOnly: false,
          networkAccess: false,
          fileSystemAccess: 'write',
          dangerousOperations: false,
          gitOperations: true, // Allow basic git operations
          maxToolCalls: 100 // Higher limit for complex tasks
        },
        maxTokens: 12000, // Larger context for complex tasks
        specialization: 'Flexible task execution and problem solving'
      }
    };
  }

  private loadSecurityPolicy(): SecurityPolicy {
    const mode = this.config.get('MINI_AGENT_SECURITY_MODE', 'strict');

    const basePolicy: SecurityPolicy = {
      toolRestrictions: {
        dangerous: ['rm', 'git-push', 'bash-rm', 'format', 'delete'],
        readOnly: ['search', 'read', 'grep', 'glob', 'analyze'],
        writeAllowed: ['write', 'edit', 'create', 'test']
      },
      contextSandboxing: {
        isolateMemory: true,
        preventCrossAgent: true,
        encryptSensitive: mode === 'strict'
      },
      resourceLimits: {
        maxFileReads: mode === 'strict' ? 50 : 100,
        maxFileWrites: mode === 'strict' ? 20 : 50,
        maxToolCalls: mode === 'strict' ? 100 : 200,
        networkCallsAllowed: mode === 'development',
        maxExecutionTime: mode === 'strict' ? 600000 : 1200000 // 10-20 minutes
      }
    };

    return basePolicy;
  }

  private loadExecutionPoolConfig(): ExecutionPool {
    return {
      maxConcurrency: parseInt(this.config.get('MINI_AGENT_MAX_CONCURRENT', '10')),
      queueSize: parseInt(this.config.get('MINI_AGENT_QUEUE_SIZE', '100')),
      resourceThrottling: {
        maxTokensPerAgent: parseInt(this.config.get('MINI_AGENT_MAX_TOKENS', '15000')),
        maxTotalTokens: parseInt(this.config.get('MINI_AGENT_TOTAL_TOKENS', '100000')),
        timeoutMs: parseInt(this.config.get('MINI_AGENT_TIMEOUT', '600000')),
        maxMemoryMB: parseInt(this.config.get('MINI_AGENT_MAX_MEMORY', '100'))
      },
      batchStrategy: (this.config.get('MINI_AGENT_BATCH_STRATEGY', 'parallel') as any),
      retryPolicy: {
        maxRetries: parseInt(this.config.get('MINI_AGENT_MAX_RETRIES', '2')),
        backoffMs: parseInt(this.config.get('MINI_AGENT_RETRY_BACKOFF', '5000')),
        exponentialBackoff: this.config.get('MINI_AGENT_EXPONENTIAL_BACKOFF', 'true') === 'true'
      }
    };
  }

  public async spawnAgent(task: MiniAgentTask): Promise<string> {
    // Validate task
    this.validateTask(task);

    // Apply template and security policies
    const enhancedTask = await this.enhanceTaskWithTemplate(task);

    // Check resource availability
    if (this.activeAgents.size >= this.spawnerConfig.executionPool.maxConcurrency) {
      // Queue the task
      if (this.taskQueue.length >= this.spawnerConfig.executionPool.queueSize) {
        throw new Error('Task queue is full. Cannot spawn new agent.');
      }

      this.taskQueue.push(enhancedTask);
      this.emit('task-queued', { taskId: task.id, queuePosition: this.taskQueue.length });
      return task.id;
    }

    // Create and start mini-agent
    return this.createAndStartAgent(enhancedTask);
  }

  private validateTask(task: MiniAgentTask): void {
    if (!task.id || !task.type || !task.prompt || !task.parentId) {
      throw new Error('Invalid task: missing required fields');
    }

    if (!this.spawnerConfig.templates[task.type]) {
      throw new Error(`Unknown agent type: ${task.type}`);
    }

    // Validate context
    if (!task.context.maxTokens || task.context.maxTokens <= 0) {
      throw new Error('Invalid context: maxTokens must be positive');
    }

    // Validate permissions
    if (!task.tools.allowed || task.tools.allowed.length === 0) {
      throw new Error('Invalid permissions: must specify allowed tools');
    }
  }

  private async enhanceTaskWithTemplate(task: MiniAgentTask): Promise<MiniAgentTask> {
    const template = this.spawnerConfig.templates[task.type];

    // Apply template defaults
    const enhancedTask: MiniAgentTask = {
      ...task,
      maxIterations: task.maxIterations || this.spawnerConfig.defaultMaxIterations,
      timeoutMs: task.timeoutMs || this.spawnerConfig.defaultTimeout,
      priority: task.priority || 'normal',
      tools: this.mergePermissions(task.tools, template.defaultPermissions),
      context: this.enhanceContext(task.context, template.maxTokens),
      prompt: this.enhancePrompt(task.prompt, template.promptTemplate)
    };

    // Apply security policy
    enhancedTask.tools = this.applySecurityPolicy(enhancedTask.tools);

    return enhancedTask;
  }

  private mergePermissions(
    taskPermissions: ToolPermissions,
    templatePermissions: Partial<ToolPermissions>
  ): ToolPermissions {
    return {
      allowed: [...new Set([...taskPermissions.allowed, ...(templatePermissions.allowed || [])])],
      restricted: [...new Set([...taskPermissions.restricted, ...(templatePermissions.restricted || [])])],
      readOnly: taskPermissions.readOnly || templatePermissions.readOnly || false,
      networkAccess: taskPermissions.networkAccess && (templatePermissions.networkAccess ?? true),
      fileSystemAccess: taskPermissions.fileSystemAccess || templatePermissions.fileSystemAccess || 'read',
      dangerousOperations: taskPermissions.dangerousOperations && (templatePermissions.dangerousOperations ?? false),
      gitOperations: taskPermissions.gitOperations && (templatePermissions.gitOperations ?? false),
      maxToolCalls: Math.min(
        taskPermissions.maxToolCalls || 1000,
        templatePermissions.maxToolCalls || 1000
      )
    };
  }

  private enhanceContext(context: ScopedMemoryContext, templateMaxTokens: number): ScopedMemoryContext {
    return {
      ...context,
      maxTokens: Math.min(context.maxTokens, templateMaxTokens)
    };
  }

  private enhancePrompt(userPrompt: string, templatePrompt: string): string {
    return `${templatePrompt}\n\nSPECIFIC TASK:\n${userPrompt}`;
  }

  private applySecurityPolicy(permissions: ToolPermissions): ToolPermissions {
    const policy = this.spawnerConfig.securityPolicy;

    // Filter dangerous tools
    const safeDangerous = permissions.allowed.filter(tool =>
      !policy.toolRestrictions.dangerous.includes(tool)
    );

    // Apply resource limits
    return {
      ...permissions,
      allowed: safeDangerous,
      restricted: [...new Set([...permissions.restricted, ...policy.toolRestrictions.dangerous])],
      networkAccess: permissions.networkAccess && policy.resourceLimits.networkCallsAllowed,
      maxToolCalls: Math.min(permissions.maxToolCalls, policy.resourceLimits.maxToolCalls)
    };
  }

  private async createAndStartAgent(task: MiniAgentTask): Promise<string> {
    try {
      // Create main orchestrator for mini-agent use
      const orchestrator = new Orchestrator(this.config);

      // Set up event handlers for mini-agent monitoring
      this.setupAgentEventHandlers(orchestrator, task);

      // Track active agent
      this.activeAgents.set(task.id, { orchestrator, task });

      // Emit spawn event
      this.emit('agent-spawned', {
        agentId: task.id,
        parentId: task.parentId,
        type: task.type,
        timestamp: Date.now()
      });

      // Start execution asynchronously using new executeAsAgent method
      this.executeAgentAsync(orchestrator, task);

      return task.id;

    } catch (error: any) {
      this.emit('agent-spawn-failed', {
        taskId: task.id,
        error: error.message,
        timestamp: Date.now()
      });
      throw error;
    }
  }

  private setupAgentEventHandlers(orchestrator: Orchestrator, task: MiniAgentTask): void {
    // Forward mini-agent events
    orchestrator.on('mini-agent-start', (data) => {
      this.emit('agent-progress', {
        agentId: task.id,
        parentId: task.parentId,
        status: 'running',
        currentAction: 'Starting execution',
        toolsUsed: [],
        metadata: {
          startTime: Date.now(),
          lastUpdate: Date.now()
        }
      });
    });

    orchestrator.on('mini-agent-complete', (data) => {
      this.handleAgentCompletion(task.id, data);
    });

    orchestrator.on('mini-agent-error', (data) => {
      this.handleAgentError(task.id, data.error);
    });

  }

  private async executeAgentAsync(orchestrator: Orchestrator, task: MiniAgentTask): Promise<void> {
    try {
      const result = await orchestrator.executeAsAgent(task.prompt, {
        agentId: task.id,
        type: task.type,
        scopedMemory: task.context,
        permissions: task.tools,
        maxTokens: task.context.maxTokens,
        timeoutMs: task.timeoutMs
      });
      this.handleAgentCompletion(task.id, result);
    } catch (error: any) {
      this.handleAgentError(task.id, error);
    }
  }

  private handleAgentCompletion(agentId: string, result: any): void {
    const agentData = this.activeAgents.get(agentId);
    if (agentData) {
      this.activeAgents.delete(agentId);

      this.emit('agent-completed', {
        agentId,
        result,
        timestamp: Date.now()
      });

      // Process next task in queue
      this.processNextQueuedTask();
    }
  }

  private handleAgentError(agentId: string, error: any): void {
    const agentData = this.activeAgents.get(agentId);
    if (agentData) {
      this.activeAgents.delete(agentId);

      this.emit('agent-failed', {
        agentId,
        error: error.message || error,
        timestamp: Date.now()
      });

      // Process next task in queue
      this.processNextQueuedTask();
    }
  }

  private startQueueProcessor(): void {
    setInterval(() => {
      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    }, 1000); // Check queue every second
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.taskQueue.length === 0) {
      return;
    }

    if (this.activeAgents.size >= this.spawnerConfig.executionPool.maxConcurrency) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Get next task based on priority
      const nextTask = this.getNextPriorityTask();
      if (nextTask) {
        const index = this.taskQueue.indexOf(nextTask);
        this.taskQueue.splice(index, 1);

        await this.createAndStartAgent(nextTask);
      }
    } catch (error) {
      // Log error but continue processing
      console.error('Error processing queued task:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private getNextPriorityTask(): MiniAgentTask | null {
    if (this.taskQueue.length === 0) return null;

    // Sort by priority: high -> normal -> low
    const priorityOrder = { high: 3, normal: 2, low: 1 };

    return this.taskQueue.reduce((highest, current) => {
      const currentPriority = priorityOrder[current.priority || 'normal'];
      const highestPriority = priorityOrder[highest.priority || 'normal'];

      return currentPriority > highestPriority ? current : highest;
    });
  }

  private processNextQueuedTask(): void {
    // Trigger queue processing on next tick
    process.nextTick(() => this.processQueue());
  }

  // Public methods
  public getActiveAgents(): string[] {
    return Array.from(this.activeAgents.keys());
  }

  public getQueuedTasks(): MiniAgentTask[] {
    return [...this.taskQueue];
  }

  public getAgent(agentId: string): MiniOrchestrator | undefined {
    return this.activeAgents.get(agentId);
  }

  public async cancelAgent(agentId: string): Promise<boolean> {
    const agent = this.activeAgents.get(agentId);
    if (agent) {
      this.activeAgents.delete(agentId);
      agent.destroy();

      this.emit('agent-cancelled', { agentId, timestamp: Date.now() });
      return true;
    }
    return false;
  }

  public getStats() {
    return {
      activeAgents: this.activeAgents.size,
      queuedTasks: this.taskQueue.length,
      maxConcurrency: this.spawnerConfig.executionPool.maxConcurrency,
      queueCapacity: this.spawnerConfig.executionPool.queueSize
    };
  }
}