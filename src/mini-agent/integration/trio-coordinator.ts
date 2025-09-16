/**
 * TrioCoordinator - Integration bridge between main trio and mini-agents
 * Coordinates the Orchestrator-Planner-Executor trio with mini-agent system
 */

import { EventEmitter } from 'events';
import { Orchestrator } from '../../core/orchestrator.js';
import { Planner } from '../../core/planner.js';
import { Executor } from '../../core/executor.js';
import { AgentSpawner } from '../core/agent-spawner.js';
import { LifecycleManager } from '../core/lifecycle-manager.js';
import { EventBus } from '../communication/event-bus.js';
import { PermissionManager } from '../security/permission-manager.js';
import { MiniAgentTask, MiniAgentProgress, AggregatedState } from '../core/types.js';
import { Config } from '../../config/Config.js';
import { DeepSeekClient } from '../../llm/deepseek-client.js';
import { ToolRegistry } from '../../tools/registry.js';
import { MemoryManager } from '../../memory/memory-manager.js';

export interface TrioIntegrationConfig {
  enabled: boolean;
  complexityThreshold: number;      // When to use mini-agents vs main trio
  maxConcurrentMiniAgents: number;
  fallbackToMainTrio: boolean;      // Fall back to main trio if mini-agents fail
  aggregateResults: boolean;        // Whether to aggregate mini-agent results
  inheritMemoryContext: boolean;    // Whether mini-agents inherit main memory
}

export class TrioCoordinator extends EventEmitter {
  private mainOrchestrator: Orchestrator;
  private mainPlanner: Planner;
  private mainExecutor: Executor;
  private agentSpawner: AgentSpawner;
  private lifecycleManager: LifecycleManager;
  private eventBus: EventBus;
  private permissionManager: PermissionManager;
  private memoryManager: MemoryManager;
  private config: TrioIntegrationConfig;

  // State management
  private activeTasks: Map<string, TaskExecution> = new Map();
  private delegationHistory: DelegationRecord[] = [];

  constructor(
    mainOrchestrator: Orchestrator,
    agentSpawner: AgentSpawner,
    lifecycleManager: LifecycleManager,
    eventBus: EventBus,
    permissionManager: PermissionManager,
    memoryManager: MemoryManager,
    config: Config
  ) {
    super();

    this.mainOrchestrator = mainOrchestrator;
    this.agentSpawner = agentSpawner;
    this.lifecycleManager = lifecycleManager;
    this.eventBus = eventBus;
    this.permissionManager = permissionManager;
    this.memoryManager = memoryManager;

    // Extract main trio components
    this.mainPlanner = this.extractMainPlanner(mainOrchestrator);
    this.mainExecutor = this.extractMainExecutor(mainOrchestrator);

    this.config = this.loadTrioConfig(config);

    this.setupIntegration();
  }

  private loadTrioConfig(config: Config): TrioIntegrationConfig {
    return {
      enabled: config.get('MINI_AGENT_TRIO_INTEGRATION', 'true') === 'true',
      complexityThreshold: parseInt(config.get('MINI_AGENT_COMPLEXITY_THRESHOLD', '3')),
      maxConcurrentMiniAgents: parseInt(config.get('MINI_AGENT_MAX_CONCURRENT', '5')),
      fallbackToMainTrio: config.get('MINI_AGENT_FALLBACK_MAIN', 'true') === 'true',
      aggregateResults: config.get('MINI_AGENT_AGGREGATE_RESULTS', 'true') === 'true',
      inheritMemoryContext: config.get('MINI_AGENT_INHERIT_MEMORY', 'true') === 'true'
    };
  }

  private extractMainPlanner(orchestrator: Orchestrator): Planner {
    // Access the planner from the main orchestrator
    // This assumes the orchestrator exposes its planner
    return (orchestrator as any).planner || new Planner(
      (orchestrator as any).client,
      (orchestrator as any).config
    );
  }

  private extractMainExecutor(orchestrator: Orchestrator): Executor {
    // Access the executor from the main orchestrator
    return (orchestrator as any).executor || new Executor(
      (orchestrator as any).toolRegistry,
      (orchestrator as any).config
    );
  }

  private setupIntegration(): void {
    if (!this.config.enabled) {
      console.log('TrioCoordinator: Mini-agent integration disabled');
      return;
    }

    // Hook into main orchestrator's task processing
    this.interceptOrchestration();

    // Set up event handlers for mini-agent coordination
    this.setupEventHandlers();

    console.log('TrioCoordinator: Integration established');
  }

  private interceptOrchestration(): void {
    // Intercept the main orchestrator's execution flow
    const originalExecute = this.mainOrchestrator.execute?.bind(this.mainOrchestrator);

    if (originalExecute) {
      (this.mainOrchestrator as any).execute = async (userInput: string) => {
        return this.coordinatedProcessRequest(userInput, originalExecute);
      };
    }

    // Intercept planner for task complexity analysis
    this.interceptPlanner();

    console.log('TrioCoordinator: Orchestration interception active');
  }

  private interceptPlanner(): void {
    const originalCreatePlan = this.mainPlanner.createPlan?.bind(this.mainPlanner);

    if (originalCreatePlan) {
      (this.mainPlanner as any).createPlan = async (input: string) => {
        // First, generate the plan using the main planner
        const plan = await originalCreatePlan(input);

        // Analyze if the plan should be delegated to mini-agents
        const delegationDecision = await this.analyzePlanForDelegation(plan, input);

        if (delegationDecision.shouldDelegate) {
          // Convert plan to mini-agent tasks
          const miniAgentTasks = await this.convertPlanToMiniAgentTasks(
            plan,
            input,
            delegationDecision
          );

          // Return a coordination plan instead of the original plan
          return this.createCoordinationPlan(plan, miniAgentTasks);
        }

        return plan;
      };
    }
  }

  private async coordinatedProcessRequest(
    userInput: string,
    originalProcessor: (input: string) => Promise<any>
  ): Promise<any> {
    const taskId = this.generateTaskId();

    try {
      // Create task execution record
      const taskExecution: TaskExecution = {
        taskId,
        userInput,
        startTime: Date.now(),
        strategy: 'evaluating',
        miniAgentTasks: [],
        results: [],
        status: 'running'
      };

      this.activeTasks.set(taskId, taskExecution);

      // First pass: Let main planner analyze the request
      const plan = await this.mainPlanner.createPlan(userInput);

      // Determine execution strategy
      const strategy = await this.determineExecutionStrategy(userInput, plan);
      taskExecution.strategy = strategy;

      let result: any;

      switch (strategy) {
        case 'mini_agents_only':
          result = await this.executeMiniAgentsOnly(taskExecution, plan);
          break;

        case 'hybrid':
          result = await this.executeHybrid(taskExecution, plan);
          break;

        case 'main_trio_with_delegation':
          result = await this.executeMainTrioWithDelegation(taskExecution, plan, originalProcessor);
          break;

        case 'main_trio_only':
        default:
          // Call original execute method which returns ExecutionResult
          const execResult = await originalProcessor(userInput);
          result = execResult.response || execResult; // Extract response or use full result
          break;
      }

      // Finalize task execution
      taskExecution.endTime = Date.now();
      taskExecution.status = 'completed';
      taskExecution.finalResult = result;

      this.emit('task-completed', taskExecution);

      return result;

    } catch (error: any) {
      const taskExecution = this.activeTasks.get(taskId);
      if (taskExecution) {
        taskExecution.status = 'failed';
        taskExecution.error = error.message;
      }

      this.emit('task-failed', { taskId, error: error.message });

      // Fallback to main trio if configured
      if (this.config.fallbackToMainTrio) {
        console.warn('TrioCoordinator: Mini-agents failed, falling back to main trio');
        const fallbackResult = await originalProcessor(userInput);
        return fallbackResult.response || fallbackResult;
      }

      throw error;
    } finally {
      this.activeTasks.delete(taskId);
    }
  }

  private async analyzePlanForDelegation(
    plan: any,
    userInput: string
  ): Promise<DelegationDecision> {
    // Analyze plan complexity
    const complexity = this.calculatePlanComplexity(plan);

    // Check if plan has parallelizable components
    const parallelizability = this.analyzeParallelizability(plan);

    // Check resource requirements
    const resourceIntensive = this.isResourceIntensive(plan);

    // Check task types suitable for mini-agents
    const suitableForMiniAgents = this.checkMiniAgentSuitability(plan, userInput);

    return {
      shouldDelegate: complexity >= this.config.complexityThreshold ||
                     (parallelizability.score > 0.7 && suitableForMiniAgents.score > 0.6),
      complexity,
      parallelizability,
      resourceIntensive,
      suitability: suitableForMiniAgents,
      reason: this.generateDelegationReason(complexity, parallelizability, suitableForMiniAgents)
    };
  }

  private calculatePlanComplexity(plan: any): number {
    // Analyze plan structure to determine complexity
    let complexity = 0;

    // Count number of steps
    const steps = plan.steps || plan.actions || [];
    complexity += steps.length * 0.5;

    // Count tool usage
    const tools = new Set();
    steps.forEach((step: any) => {
      if (step.tool) tools.add(step.tool);
      if (step.tools) step.tools.forEach((tool: string) => tools.add(tool));
    });
    complexity += tools.size * 0.3;

    // Check for nested operations
    const hasNested = steps.some((step: any) => step.substeps || step.nested);
    if (hasNested) complexity += 1;

    // Check for file system operations
    const hasFileOps = steps.some((step: any) =>
      step.tool && ['read', 'write', 'edit', 'search'].includes(step.tool)
    );
    if (hasFileOps) complexity += 0.5;

    return Math.min(complexity, 10); // Cap at 10
  }

  private analyzeParallelizability(plan: any): ParallelizabilityAnalysis {
    const steps = plan.steps || plan.actions || [];

    // Find independent steps (no dependencies)
    const independentSteps: any[] = [];
    const dependentSteps: any[] = [];

    steps.forEach((step: any, index: number) => {
      const hasDependencies = steps.slice(0, index).some((prevStep: any) =>
        this.stepsDependOnEachOther(prevStep, step)
      );

      if (hasDependencies) {
        dependentSteps.push(step);
      } else {
        independentSteps.push(step);
      }
    });

    const parallelScore = independentSteps.length / Math.max(steps.length, 1);

    return {
      score: parallelScore,
      independentSteps: independentSteps.length,
      dependentSteps: dependentSteps.length,
      totalSteps: steps.length,
      canParallelize: parallelScore > 0.3
    };
  }

  private stepsDependOnEachOther(step1: any, step2: any): boolean {
    // Simple dependency analysis - could be enhanced

    // Check if step2 uses output from step1
    if (step1.output && step2.input && step1.output === step2.input) {
      return true;
    }

    // Check file dependencies
    if (step1.tool === 'write' && step2.tool === 'read' &&
        step1.file_path === step2.file_path) {
      return true;
    }

    return false;
  }

  private isResourceIntensive(plan: any): boolean {
    const intensiveTools = ['search', 'find', 'grep', 'analyze', 'test', 'compile'];
    const steps = plan.steps || plan.actions || [];

    return steps.some((step: any) =>
      intensiveTools.some(tool =>
        step.tool && step.tool.toLowerCase().includes(tool)
      )
    );
  }

  private checkMiniAgentSuitability(plan: any, userInput: string): SuitabilityAnalysis {
    let score = 0;
    const reasons: string[] = [];

    // Check for specific task types
    const taskTypePatterns = {
      search: /search|find|locate|look for/i,
      migration: /migrate|update|change|refactor|convert/i,
      analysis: /analyze|review|check|examine|audit/i,
      testing: /test|validate|verify|check/i,
      documentation: /document|readme|guide|doc/i
    };

    Object.entries(taskTypePatterns).forEach(([type, pattern]) => {
      if (pattern.test(userInput)) {
        score += 0.3;
        reasons.push(`Task involves ${type}`);
      }
    });

    // Check plan characteristics
    const steps = plan.steps || plan.actions || [];

    // Multiple file operations
    const fileOps = steps.filter((step: any) =>
      step.tool && ['read', 'write', 'edit', 'search'].includes(step.tool)
    ).length;

    if (fileOps >= 3) {
      score += 0.2;
      reasons.push('Multiple file operations detected');
    }

    // Repetitive operations
    const toolCount: Record<string, number> = {};
    steps.forEach((step: any) => {
      if (step.tool) {
        toolCount[step.tool] = (toolCount[step.tool] || 0) + 1;
      }
    });

    const hasRepetitive = Object.values(toolCount).some(count => count >= 3);
    if (hasRepetitive) {
      score += 0.2;
      reasons.push('Repetitive operations suitable for specialization');
    }

    return {
      score: Math.min(score, 1.0),
      reasons,
      suitable: score >= 0.6
    };
  }

  private generateDelegationReason(
    complexity: number,
    parallelizability: ParallelizabilityAnalysis,
    suitability: SuitabilityAnalysis
  ): string {
    const reasons: string[] = [];

    if (complexity >= this.config.complexityThreshold) {
      reasons.push(`high complexity (${complexity.toFixed(1)})`);
    }

    if (parallelizability.canParallelize) {
      reasons.push(`parallelizable (${parallelizability.independentSteps} independent steps)`);
    }

    if (suitability.suitable) {
      reasons.push('suitable task type for mini-agents');
    }

    return reasons.join(', ') || 'threshold conditions met';
  }

  private async convertPlanToMiniAgentTasks(
    plan: any,
    userInput: string,
    delegation: DelegationDecision
  ): Promise<MiniAgentTask[]> {
    const tasks: MiniAgentTask[] = [];
    const steps = plan.steps || plan.actions || [];

    // Group steps by parallelizability and task type
    const taskGroups = this.groupStepsIntoTasks(steps, delegation);

    for (const group of taskGroups) {
      const task = await this.createMiniAgentTask(group, userInput);
      tasks.push(task);
    }

    return tasks;
  }

  private groupStepsIntoTasks(steps: any[], delegation: DelegationDecision): StepGroup[] {
    const groups: StepGroup[] = [];
    let currentGroup: StepGroup = {
      type: 'general',
      steps: [],
      priority: 'normal'
    };

    steps.forEach((step, index) => {
      // Determine task type for this step
      const taskType = this.inferTaskType(step);

      // If task type changes or we have too many steps, start new group
      if (taskType !== currentGroup.type || currentGroup.steps.length >= 5) {
        if (currentGroup.steps.length > 0) {
          groups.push(currentGroup);
        }

        currentGroup = {
          type: taskType,
          steps: [step],
          priority: this.inferPriority(step)
        };
      } else {
        currentGroup.steps.push(step);
      }
    });

    if (currentGroup.steps.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  private inferTaskType(step: any): string {
    const tool = step.tool?.toLowerCase() || '';
    const description = (step.description || '').toLowerCase();

    if (tool.includes('search') || tool.includes('grep') || tool.includes('find')) {
      return 'search';
    }
    if (tool.includes('test') || description.includes('test')) {
      return 'test';
    }
    if (tool.includes('write') || tool.includes('edit') || description.includes('refactor')) {
      return 'refactor';
    }
    if (tool.includes('read') || tool.includes('analyze')) {
      return 'analysis';
    }

    return 'general';
  }

  private inferPriority(step: any): 'low' | 'normal' | 'high' {
    const description = (step.description || '').toLowerCase();

    if (description.includes('critical') || description.includes('urgent')) {
      return 'high';
    }
    if (description.includes('optional') || description.includes('nice-to-have')) {
      return 'low';
    }

    return 'normal';
  }

  private async createMiniAgentTask(group: StepGroup, userInput: string): Promise<MiniAgentTask> {
    const taskId = this.generateTaskId();

    // Build focused prompt for this task group
    const prompt = this.buildFocusedPrompt(group, userInput);

    // Determine required tools
    const tools = this.extractRequiredTools(group);

    // Create scoped context
    const context = await this.createScopedContext(group, userInput);

    return {
      id: taskId,
      type: group.type as any,
      prompt,
      context,
      tools,
      maxIterations: Math.min(group.steps.length * 2, 20),
      timeoutMs: 300000, // 5 minutes
      priority: group.priority,
      parentId: 'main-orchestrator',
      metadata: {
        stepGroup: group,
        originalUserInput: userInput
      }
    };
  }

  private buildFocusedPrompt(group: StepGroup, userInput: string): string {
    const stepDescriptions = group.steps.map((step, i) =>
      `${i + 1}. ${step.description || step.tool || 'Execute step'}`
    ).join('\n');

    return `Task: ${group.type.toUpperCase()} specialization

Original request: ${userInput}

Your focused responsibilities:
${stepDescriptions}

Focus only on these specific steps. Report progress and results back to the main orchestrator.`;
  }

  private extractRequiredTools(group: StepGroup): any {
    const allowedTools = new Set<string>();
    const restrictedTools = ['git-push', 'rm', 'delete'];

    group.steps.forEach(step => {
      if (step.tool) {
        allowedTools.add(step.tool);
      }
      if (step.tools) {
        step.tools.forEach((tool: string) => allowedTools.add(tool));
      }
    });

    // Add common tools based on task type
    const commonToolsByType: Record<string, string[]> = {
      search: ['grep', 'find', 'read'],
      analysis: ['read', 'grep', 'analyze'],
      refactor: ['read', 'write', 'edit'],
      test: ['read', 'write', 'test', 'bash']
    };

    const commonTools = commonToolsByType[group.type] || ['read'];
    commonTools.forEach(tool => allowedTools.add(tool));

    return {
      allowed: Array.from(allowedTools),
      restricted: restrictedTools,
      readOnly: group.type === 'search' || group.type === 'analysis',
      networkAccess: false,
      fileSystemAccess: group.type === 'search' || group.type === 'analysis' ? 'read' : 'write',
      dangerousOperations: false,
      gitOperations: false,
      maxToolCalls: group.steps.length * 10
    };
  }

  private async createScopedContext(group: StepGroup, userInput: string): Promise<any> {
    // Extract file patterns and search terms from steps
    const relevantFiles: string[] = [];
    const searchPatterns: string[] = [];

    group.steps.forEach(step => {
      if (step.file_path) relevantFiles.push(step.file_path);
      if (step.pattern) searchPatterns.push(step.pattern);
      if (step.search_term) searchPatterns.push(step.search_term);
    });

    return {
      relevantFiles: relevantFiles.length > 0 ? relevantFiles : ['**/*'],
      searchPatterns: searchPatterns.length > 0 ? searchPatterns : [userInput.split(' ').slice(0, 3).join(' ')],
      domainKnowledge: [group.type],
      excludedContext: ['test-files', 'documentation'],
      maxTokens: 8000,
      sessionId: this.generateTaskId(),
      parentContext: 'main-orchestrator'
    };
  }

  private createCoordinationPlan(originalPlan: any, miniAgentTasks: MiniAgentTask[]): any {
    return {
      ...originalPlan,
      coordinationType: 'mini-agents',
      miniAgentTasks,
      originalPlan,
      coordinationSteps: [
        'Spawn mini-agents for specialized tasks',
        'Monitor mini-agent execution',
        'Aggregate results from all mini-agents',
        'Provide final response to user'
      ]
    };
  }

  // Execution strategies
  private async executeMiniAgentsOnly(
    taskExecution: TaskExecution,
    plan: any
  ): Promise<any> {
    const miniAgentTasks = plan.miniAgentTasks || [];

    // Spawn all mini-agents
    const agentIds = await Promise.all(
      miniAgentTasks.map((task: MiniAgentTask) => this.agentSpawner.spawnAgent(task))
    );

    taskExecution.miniAgentTasks = agentIds;

    // Wait for all agents to complete
    const results = await this.waitForAgentCompletion(agentIds);

    // Aggregate results
    if (this.config.aggregateResults) {
      return this.aggregateResults(results);
    }

    return results;
  }

  private async executeHybrid(
    taskExecution: TaskExecution,
    plan: any
  ): Promise<any> {
    // Execute mini-agents for parallelizable parts
    const miniAgentResults = await this.executeMiniAgentsOnly(taskExecution, plan);

    // Use main trio for final coordination and synthesis
    const finalResult = await this.mainExecutor.executePlan(
      this.createSynthesisPlan(plan.originalPlan, miniAgentResults),
      [],
      await this.memoryManager.buildContext()
    );

    return {
      miniAgentResults,
      synthesis: finalResult,
      strategy: 'hybrid'
    };
  }

  private async executeMainTrioWithDelegation(
    taskExecution: TaskExecution,
    plan: any,
    originalProcessor: (input: string) => Promise<any>
  ): Promise<any> {
    // Use main trio but delegate specific subtasks to mini-agents
    const delegatedTasks = plan.miniAgentTasks?.slice(0, 2) || []; // Limit delegation

    if (delegatedTasks.length > 0) {
      // Spawn subset of mini-agents
      const agentIds = await Promise.all(
        delegatedTasks.map((task: MiniAgentTask) => this.agentSpawner.spawnAgent(task))
      );

      taskExecution.miniAgentTasks = agentIds;

      // Continue with main trio execution
      const mainExecResult = await originalProcessor(taskExecution.userInput);
      const mainResult = mainExecResult.response || mainExecResult;

      // Wait for delegated tasks
      const delegatedResults = await this.waitForAgentCompletion(agentIds);

      return {
        mainResult,
        delegatedResults,
        strategy: 'main_trio_with_delegation'
      };
    }

    const fallbackExecResult = await originalProcessor(taskExecution.userInput);
    return fallbackExecResult.response || fallbackExecResult;
  }

  private async determineExecutionStrategy(
    userInput: string,
    plan: any
  ): Promise<ExecutionStrategy> {
    const complexity = this.calculatePlanComplexity(plan);
    const parallelizability = this.analyzeParallelizability(plan);

    // High complexity + high parallelizability = mini-agents only
    if (complexity >= 7 && parallelizability.score > 0.8) {
      return 'mini_agents_only';
    }

    // Medium complexity + some parallelizability = hybrid
    if (complexity >= 4 && parallelizability.score > 0.5) {
      return 'hybrid';
    }

    // Low complexity but some delegation opportunities = main trio with delegation
    if (complexity >= 2 && parallelizability.score > 0.3) {
      return 'main_trio_with_delegation';
    }

    // Default to main trio only
    return 'main_trio_only';
  }

  private setupEventHandlers(): void {
    // Listen to mini-agent events
    this.eventBus.on('AGENT_COMPLETED', (event) => {
      this.handleMiniAgentCompletion(event);
    });

    this.eventBus.on('AGENT_FAILED', (event) => {
      this.handleMiniAgentFailure(event);
    });

    // Forward relevant events to main orchestrator
    this.eventBus.on('*', (event) => {
      this.emit('mini-agent-event', event);
    });
  }

  private handleMiniAgentCompletion(event: any): void {
    this.emit('mini-agent-completed', {
      agentId: event.agentId,
      result: event.result,
      timestamp: Date.now()
    });
  }

  private handleMiniAgentFailure(event: any): void {
    this.emit('mini-agent-failed', {
      agentId: event.agentId,
      error: event.error,
      timestamp: Date.now()
    });
  }

  private async waitForAgentCompletion(agentIds: string[]): Promise<any[]> {
    const results: any[] = [];
    const promises = agentIds.map(agentId => this.waitForSingleAgent(agentId));

    const completedResults = await Promise.allSettled(promises);

    completedResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          agentId: agentIds[index],
          error: result.reason,
          status: 'failed'
        });
      }
    });

    return results;
  }

  private waitForSingleAgent(agentId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Agent ${agentId} timeout`));
      }, 600000); // 10 minutes

      const completionHandler = (event: any) => {
        if (event.agentId === agentId) {
          clearTimeout(timeout);
          this.eventBus.off('AGENT_COMPLETED', completionHandler);
          this.eventBus.off('AGENT_FAILED', failureHandler);
          resolve(event.result);
        }
      };

      const failureHandler = (event: any) => {
        if (event.agentId === agentId) {
          clearTimeout(timeout);
          this.eventBus.off('AGENT_COMPLETED', completionHandler);
          this.eventBus.off('AGENT_FAILED', failureHandler);
          reject(new Error(event.error));
        }
      };

      this.eventBus.on('AGENT_COMPLETED', completionHandler);
      this.eventBus.on('AGENT_FAILED', failureHandler);
    });
  }

  private aggregateResults(results: any[]): AggregatedState {
    const successful = results.filter(r => !r.error);
    const failed = results.filter(r => r.error);

    return {
      totalAgents: results.length,
      activeAgents: 0,
      completedAgents: successful.length,
      failedAgents: failed.length,
      totalTokensUsed: successful.reduce((sum, r) => sum + (r.tokensUsed || 0), 0),
      totalExecutionTime: successful.reduce((sum, r) => sum + (r.executionTime || 0), 0),
      results: successful.reduce((acc, r) => ({ ...acc, [r.agentId]: r }), {}),
      errors: failed.map(f => f.error),
      summary: this.createResultSummary(successful, failed)
    };
  }

  private createResultSummary(successful: any[], failed: any[]): string {
    const summary = [`Completed ${successful.length} mini-agent tasks`];

    if (failed.length > 0) {
      summary.push(`${failed.length} tasks failed`);
    }

    const outputs = successful.map(r => r.output).filter(Boolean);
    if (outputs.length > 0) {
      summary.push('Results: ' + outputs.join('; '));
    }

    return summary.join('. ');
  }

  private createSynthesisPlan(originalPlan: any, miniAgentResults: any): any {
    return {
      ...originalPlan,
      coordinationType: 'synthesis',
      inputs: miniAgentResults,
      steps: [
        'Analyze mini-agent results',
        'Synthesize findings',
        'Generate final response'
      ]
    };
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getAvailableTools(): string[] {
    return ['read', 'write', 'edit', 'search', 'grep', 'test', 'bash'];
  }

  // Public methods
  public getStats() {
    return {
      activeTasks: this.activeTasks.size,
      delegationHistory: this.delegationHistory.length,
      config: this.config
    };
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public updateConfig(newConfig: Partial<TrioIntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config-updated', this.config);
  }
}

// Supporting interfaces
type ExecutionStrategy =
  | 'mini_agents_only'
  | 'hybrid'
  | 'main_trio_with_delegation'
  | 'main_trio_only';

interface TaskExecution {
  taskId: string;
  userInput: string;
  startTime: number;
  endTime?: number;
  strategy: ExecutionStrategy | 'evaluating';
  miniAgentTasks: string[];
  results: any[];
  status: 'running' | 'completed' | 'failed';
  error?: string;
  finalResult?: any;
}

interface DelegationDecision {
  shouldDelegate: boolean;
  complexity: number;
  parallelizability: ParallelizabilityAnalysis;
  resourceIntensive: boolean;
  suitability: SuitabilityAnalysis;
  reason: string;
}

interface ParallelizabilityAnalysis {
  score: number;
  independentSteps: number;
  dependentSteps: number;
  totalSteps: number;
  canParallelize: boolean;
}

interface SuitabilityAnalysis {
  score: number;
  reasons: string[];
  suitable: boolean;
}

interface StepGroup {
  type: string;
  steps: any[];
  priority: 'low' | 'normal' | 'high';
}

interface DelegationRecord {
  timestamp: number;
  taskId: string;
  strategy: ExecutionStrategy;
  complexity: number;
  success: boolean;
  miniAgentsUsed: number;
  executionTime: number;
}