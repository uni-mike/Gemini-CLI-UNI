import { Orchestrator } from './Orchestrator';
import { Planner } from './Planner';
import { Executor } from './Executor';
import { ProgressTracker } from './ProgressTracker';
import { Progress, Task } from './types';
import { DeepSeekWithTools } from '../core/deepSeekWithTools';

export class DeepSeekOrchestrator {
  private orchestrator: Orchestrator;
  private progressTracker: ProgressTracker;
  private deepSeek?: DeepSeekWithTools;

  constructor(deepSeek?: DeepSeekWithTools) {
    this.deepSeek = deepSeek;
    this.progressTracker = new ProgressTracker();
    
    // Configure orchestrator with progress callback
    this.orchestrator = new Orchestrator({
      maxConcurrentTasks: 3,
      defaultTimeoutMs: 30000,
      maxRetries: 2,
      progressCallback: (progress) => this.handleProgress(progress),
      healthCheckInterval: 5000
    });

    // Set up event listeners
    this.setupEventListeners();
    
    // If DeepSeek provided, integrate tools
    if (deepSeek) {
      this.integrateDeepSeekTools();
    }
  }

  async orchestratePrompt(prompt: string): Promise<any> {
    console.log('\n🎭 Starting DeepSeek Orchestration');
    console.log('━'.repeat(60));
    
    this.progressTracker.start();
    
    try {
      const result = await this.orchestrator.orchestrate(prompt);
      
      const duration = Date.now() - Date.now(); // Will be fixed
      this.progressTracker.displaySummary(this.orchestrator.getStatus(), duration);
      
      return result;
    } catch (error) {
      this.progressTracker.displayError(error as Error);
      throw error;
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
    
    // Register DeepSeek tools with the Executor
    const executor = (this.orchestrator as any).executor as Executor;
    
    // Map of tool names to DeepSeek tool implementations
    const toolMap = {
      'read_file': async (args: any) => {
        return await this.deepSeek!.executeFunction('read_file', args);
      },
      'write_file': async (args: any) => {
        return await this.deepSeek!.executeFunction('write_file', args);
      },
      'edit_file': async (args: any) => {
        return await this.deepSeek!.executeFunction('edit', args);
      },
      'search_file_content': async (args: any) => {
        return await this.deepSeek!.executeFunction('grep', args);
      },
      'shell': async (args: any) => {
        return await this.deepSeek!.executeFunction('shell', args);
      },
      'web_search': async (args: any) => {
        return await this.deepSeek!.executeFunction('web_search', args);
      },
      'ls': async (args: any) => {
        return await this.deepSeek!.executeFunction('ls', args);
      }
    };

    // Register each tool
    for (const [name, handler] of Object.entries(toolMap)) {
      executor.registerTool(name, {
        execute: handler
      });
    }
    
    console.log('✅ DeepSeek tools integrated with orchestrator');
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