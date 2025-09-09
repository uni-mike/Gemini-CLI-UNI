import { Orchestrator } from './Orchestrator.js';
import { Executor } from './Executor.js';
import { ProgressTracker } from './ProgressTracker.js';
import type { Progress, Task } from './types.js';
import { DeepSeekWithTools } from '../core/deepSeekWithToolsRefactored.js';

export class DeepSeekOrchestrator {
  private orchestrator: Orchestrator;
  private progressTracker: ProgressTracker;
  private deepSeek?: DeepSeekWithTools;

  constructor(deepSeek?: DeepSeekWithTools) {
    this.deepSeek = deepSeek;
    this.progressTracker = new ProgressTracker();
    
    // Configure orchestrator with progress callback
    // Pass the DeepSeek client to the orchestrator for AI planning
    this.orchestrator = new Orchestrator({
      maxConcurrentTasks: 3,
      defaultTimeoutMs: 30000,
      maxRetries: 2,
      progressCallback: (progress) => this.handleProgress(progress),
      healthCheckInterval: 5000,
      // Pass a safe AI interface that won't cause recursion
      aiModel: this.createSafeAIInterface(deepSeek),
      isOrchestrationContext: true  // Flag to prevent recursive orchestration
    });

    // Set up event listeners
    this.setupEventListeners();
    
    // If DeepSeek provided, integrate tools
    if (deepSeek) {
      this.integrateDeepSeekTools();
    }
  }

  /**
   * Creates a safe AI interface that won't trigger recursive orchestration
   * This allows the Planner to use AI decomposition without causing loops
   */
  private createSafeAIInterface(deepSeek: any): any {
    if (!deepSeek) return undefined;
    
    // Use DeepSeek configuration from .env.deepseek or the instance config
    const config = deepSeek.config || {};
    
    // DeepSeek endpoint format: https://[resource].services.ai.azure.com/models
    const endpoint = config.endpoint || process.env['ENDPOINT'] || 'https://unipathai7556217047.services.ai.azure.com/models';
    const apiKey = config.apiKey || process.env['API_KEY'] || '9c5d0679299045e9bd3513baf6ae0e86';
    const model = config.model || process.env['MODEL'] || 'DeepSeek-R1-0528';
    const apiVersion = config.apiVersion || process.env['API_VERSION'] || '2024-05-01-preview';
    
    if (!endpoint || !apiKey) {
      console.warn('Missing DeepSeek configuration for AI decomposition');
      return undefined;  // Fall back to heuristics
    }
    
    // Create a lightweight AI interface that makes direct HTTP calls to DeepSeek
    return {
      sendMessageStream: async function* (prompt: string) {
        try {
          // DeepSeek API endpoint format
          const url = `${endpoint}/chat/completions?api-version=${apiVersion}`;
          
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'api-key': apiKey
            },
            body: JSON.stringify({
              model: model,
              messages: [
                {
                  role: 'system',
                  content: 'You are a task decomposition expert. Break down complex tasks into atomic, executable steps. Return ONLY a JSON array or numbered list.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              temperature: 0.3,  // Lower temperature for more consistent decomposition
              max_tokens: 500,   // Limit response size for decomposition
              stream: false      // Use non-streaming for simplicity
            })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.warn(`DeepSeek API error ${response.status}:`, errorText);
            throw new Error(`API call failed: ${response.status}`);
          }
          
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || '';
          
          // Yield the complete response
          yield content;
          
        } catch (error) {
          console.warn('Direct DeepSeek AI call failed, using heuristics:', error);
          throw error;  // Let Planner fall back to heuristics
        }
      }
    };
  }

  async *orchestratePrompt(prompt: string): AsyncGenerator<string> {
    console.log('\n🎭 Starting DeepSeek Orchestration');
    console.log('Prompt:', prompt);
    console.log('━'.repeat(60));
    
    this.progressTracker.start();
    const startTime = Date.now();
    
    try {
      // Yield initial status
      yield "📋 Planning tasks...\n";
      
      const result = await this.orchestrator.orchestrate(prompt);
      
      const duration = Date.now() - startTime;
      this.progressTracker.displaySummary(this.orchestrator.getStatus(), duration);
      
      // Format and yield the results
      if (Array.isArray(result)) {
        let hasResults = false;
        for (const taskResult of result) {
          if (taskResult && taskResult.result) {
            hasResults = true;
            yield `\n${taskResult.result}\n`;
          }
        }
        if (!hasResults) {
          yield "\n✅ All tasks completed successfully!\n";
        }
      } else if (result) {
        yield `\n${JSON.stringify(result, null, 2)}\n`;
      }
      
      yield "\n✨ Orchestration complete!\n";
    } catch (error) {
      console.error('Orchestration trio failed:', error);
      this.progressTracker.displayError(error as Error);
      
      // Fall back to DeepSeek direct execution only on failure
      yield `\n⚠️ Orchestration trio failed: ${error}\n`;
      yield "\n🔄 Falling back to DeepSeek direct execution...\n";
      
      if (this.deepSeek) {
        // Use DeepSeek's native multi-step handling as fallback
        yield* this.deepSeek.sendMessageStreamWithTools(prompt);
      } else {
        yield '❌ DeepSeek client not available\n';
      }
    } finally {
      this.progressTracker.stop();
    }
  }

  private setupEventListeners(): void {
    // Phase changes
    this.orchestrator.on('phase', ({ phase, message }) => {
      this.progressTracker.displayPhase(phase, message);
    });

    // Plan created
    this.orchestrator.on('plan', (plan) => {
      console.log(`\n📊 Complexity: ${plan.complexity}`);
      console.log(`⏱️  Estimated time: ${this.formatTime(plan.totalEstimatedTime)}`);
      console.log(`🔀 Parallelizable: ${plan.parallelizable ? 'Yes' : 'No'}`);
      this.progressTracker.displayPlan(plan.tasks);
    });

    // Task events
    this.orchestrator.on('taskStart', (task: Task) => {
      this.progressTracker.displayTaskUpdate(task, 'start');
    });

    this.orchestrator.on('taskComplete', (task: Task) => {
      this.progressTracker.displayTaskUpdate(task, 'complete');
    });

    this.orchestrator.on('taskRetry', (task: Task) => {
      this.progressTracker.displayTaskUpdate(task, 'retry');
    });

    this.orchestrator.on('taskFailed', (task: Task) => {
      this.progressTracker.displayTaskUpdate(task, 'fail');
    });

    // Health monitoring
    this.orchestrator.on('healthAlert', ({ status, tasks }) => {
      let message = `System is ${status}`;
      if (tasks && tasks.length > 0) {
        message += `. Stuck tasks: ${tasks.map((t: Task) => t.description).join(', ')}`;
      }
      this.progressTracker.displayHealthAlert(status, message);
    });

    // Task stuck detection
    this.orchestrator.on('taskStuck', (task: Task) => {
      console.warn(`\n⚠️  Task appears stuck: ${task.description}`);
      console.warn(`   Running for over ${task.timeoutMs}ms`);
      
      // Attempt recovery
      this.attemptRecovery(task);
    });

    // Tool completion (from Executor)
    this.orchestrator.on('toolComplete', ({ taskId, tool, result }) => {
      console.log(`    ✅ ${tool} completed`);
    });
  }

  private handleProgress(progress: Progress): void {
    // Update progress display
    this.progressTracker.displayProgress(progress);
    
    // Check for issues
    if (progress.healthStatus === 'stuck') {
      console.warn('\n⚠️  System appears stuck, attempting recovery...');
      this.attemptSystemRecovery();
    }
  }

  private integrateDeepSeekTools(): void {
    if (!this.deepSeek) return;
    
    // Get the Executor from orchestrator
    const executor = (this.orchestrator as any).executor as Executor;
    
    // Create a universal tool proxy that dynamically routes to DeepSeek
    const createToolProxy = (toolName: string) => {
      return {
        execute: async (args: any) => {
          try {
            // First, try direct execution methods
            if ((this.deepSeek as any).executeToolCall) {
              const result = await (this.deepSeek as any).executeToolCall({
                name: toolName,
                arguments: args
              });
              return typeof result === 'string' ? result : result.result || result;
            }
            
            // Try through tool executor
            const toolExecutor = (this.deepSeek as any).getToolExecutor?.();
            if (toolExecutor && toolExecutor.execute) {
              const result = await toolExecutor.execute({
                name: toolName,
                arguments: args
              });
              return result.success ? result.result : `Error: ${result.error}`;
            }
            
            // Try through registered tools
            if ((this.deepSeek as any).registeredTools && (this.deepSeek as any).registeredTools[toolName]) {
              const tool = (this.deepSeek as any).registeredTools[toolName];
              if (typeof tool.execute === 'function') {
                return await tool.execute(args);
              }
            }
            
            // Try through config's tool registry
            if ((this.deepSeek as any).config && (this.deepSeek as any).config.getToolRegistry) {
              const toolRegistry = (this.deepSeek as any).config.getToolRegistry();
              const tool = toolRegistry.getTool?.(toolName);
              if (tool && tool.execute) {
                return await tool.execute(args);
              }
            }
            
            return `Error: Tool ${toolName} not found or not executable`;
          } catch (error) {
            console.error(`Tool ${toolName} execution error:`, error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return `Error: ${errorMessage}`;
          }
        }
      };
    };
    
    // Register a catch-all proxy for ANY tool name
    // This allows the Executor to use ANY tool that DeepSeek has available
    const registeredTools = new Set<string>();
    
    // Override the registerTool method to track what gets registered
    const originalRegisterTool = executor.registerTool.bind(executor);
    executor.registerTool = (name: string, tool: any) => {
      registeredTools.add(name);
      return originalRegisterTool(name, tool);
    };
    
    // Create a proxy handler that intercepts all tool registry access
    const toolRegistryProxy = new Proxy({}, {
      get: (target, prop: string) => {
        // Return a tool proxy for any requested tool name
        if (prop === 'get') {
          return (toolName: string) => createToolProxy(toolName);
        }
        if (prop === 'has') {
          return (toolName: string) => true; // Claim we have all tools
        }
        if (prop === 'set') {
          return (toolName: string, tool: any) => {
            registeredTools.add(toolName);
            return true;
          };
        }
        return createToolProxy(prop as string);
      }
    });
    
    // Replace the executor's tool registry with our proxy
    (executor as any).toolRegistry = toolRegistryProxy;
    
    // Log what tools were discovered (for debugging)
    console.log('✅ DeepSeek tools integrated with dynamic proxy (all tools available on-demand)');
  }

  private attemptRecovery(task: Task): void {
    console.log(`\n🔧 Attempting recovery for task: ${task.description}`);
    
    // Option 1: Abort the stuck task
    const executor = (this.orchestrator as any).executor as Executor;
    executor.abortTask(task.id);
    
    // Option 2: Create a simpler version of the task
    // This would require modifying the task queue
    
    console.log('   Recovery initiated - task aborted');
  }

  private attemptSystemRecovery(): void {
    console.log('\n🚑 System Recovery Initiated');
    
    // Get current status
    const status = this.orchestrator.getStatus();
    
    // If too many tasks are stuck, abort all and restart
    if (status.inProgress > 5) {
      console.log('   Too many stuck tasks, aborting all...');
      this.orchestrator.abort();
      
      // Could restart with simpler approach
      console.log('   System reset complete');
    } else {
      // Just wait a bit longer
      console.log('   Waiting for tasks to complete...');
    }
  }

  private formatTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  // Public control methods
  
  public pause(): void {
    console.log('\n⏸️  Orchestration paused');
    this.orchestrator.pause();
  }

  public resume(): void {
    console.log('\n▶️  Orchestration resumed');
    this.orchestrator.resume();
  }

  public abort(): void {
    console.log('\n🛑 Orchestration aborted');
    this.orchestrator.abort();
    this.progressTracker.stop();
  }

  public getStatus(): Progress {
    return this.orchestrator.getStatus();
  }
}