import { DeepSeekWithTools } from './deepSeekWithToolsRefactored.js';
import { DeepSeekOrchestrator } from '../orchestration/DeepSeekOrchestrator.js';
import type { Config } from '../config/config.js';

export class DeepSeekWithOrchestration extends DeepSeekWithTools {
  private orchestrator?: DeepSeekOrchestrator;
  private useOrchestration: boolean = true; // Enable orchestration trio

  constructor(config: Config) {
    super(config);
    this.orchestrator = new DeepSeekOrchestrator(this);
    console.log('🎭 DeepSeekWithOrchestration initialized with orchestration trio');
  }

  /**
   * Override the main method that contentGenerator calls
   */
  override async *sendMessageStreamWithTools(message: string): AsyncGenerator<string> {
    yield* this.processWithOrchestration(message);
  }

  /**
   * Process method to use orchestration for complex tasks
   */
  private async *processWithOrchestration(
    message: string, 
    options?: any
  ): AsyncGenerator<string, void, unknown> {
    try {
      // Check if this is a complex task that needs orchestration
      const userMessage = this.extractUserMessageFromPrompt(message);
      const isComplexTask = await this.detectOrchestrationNeeded(userMessage);
      
      if (isComplexTask && this.useOrchestration) {
        // Use orchestration trio for complex multi-step tasks
        console.log('🔍 About to start orchestration trio...');
        
        try {
          // Build complete orchestration output
          let fullOutput = "\n🎭 Complex task detected - using orchestration trio...\n";
          fullOutput += "━".repeat(60) + "\n\n";
          
          console.log('🔍 About to call executeWithOrchestrationTrio...');
          const orchestrationResults = await this.executeWithOrchestrationTrio(userMessage);
          console.log('✅ Orchestration trio completed!');
          
          fullOutput += orchestrationResults;
          
          // Yield everything at once to avoid async generator issues
          yield fullOutput;
          
        } catch (error) {
          console.error("Orchestration trio failed:", error);
          let errorOutput = "\n🎭 Complex task detected - orchestration failed...\n";
          errorOutput += `\n⚠️ Orchestration error: ${error}\n`;
          errorOutput += "\n🔄 Falling back to DeepSeek native execution...\n\n";
          
          yield errorOutput;
          
          // Fallback to native DeepSeek execution
          yield* super.sendMessageStreamWithTools(message);
        }
        
        return;
      }
      
      // Fall back to parent implementation for simple tasks
      yield* super.sendMessageStreamWithTools(message);
      
    } catch (error) {
      console.error('Orchestration error:', error);
      yield "⚠️ Orchestration failed, using standard processing...\n";
      yield* super.sendMessageStreamWithTools(message);
    }
  }

  /**
   * Execute task using orchestration trio (non-generator approach)
   */
  private async executeWithOrchestrationTrio(userMessage: string): Promise<string> {
    console.log('🔍 executeWithOrchestrationTrio called with:', userMessage);
    
    if (!this.orchestrator) {
      throw new Error('Orchestrator not initialized');
    }
    console.log('✅ Orchestrator exists');

    // Get the orchestrator components
    console.log('🔍 Getting internal orchestrator...');
    const orchestrator = (this.orchestrator as any).orchestrator;
    if (!orchestrator) {
      throw new Error('Internal orchestrator not found');
    }
    console.log('✅ Internal orchestrator found:', Object.keys(orchestrator));

    let output = "";

    // Phase 1: Planning
    output += "📋 Planning tasks...\n";
    console.log('🔍 About to call orchestrator.planner.createPlan...');
    const plan = await orchestrator.planner.createPlan(userMessage);
    console.log('✅ Planner.createPlan completed, plan:', plan);
    output += `\n✅ Created execution plan with ${plan.tasks.length} tasks:\n`;
    
    for (const task of plan.tasks) {
      output += `  • ${task.description}\n`;
    }
    
    // Phase 2: Execution
    output += "\n🔧 Executing tasks...\n";
    const results = [];
    
    for (const task of plan.tasks) {
      output += `\n⏳ ${task.description}\n`;
      
      try {
        console.log(`🔍 About to execute task: ${task.description}`);
        
        // Collect results from dependent tasks for context
        const previousResults: any[] = task.dependencies.length > 0 
          ? results
              .filter(r => task.dependencies.includes(r.taskId))
              .map(r => r.result)
          : [];
        
        const result: any = await orchestrator.executor.execute(task, {
          taskId: task.id,
          attempt: 1,
          startTime: Date.now(),
          timeout: task.timeoutMs,
          previousResults // Pass previous results for AI orchestration
        });
        console.log(`✅ Task completed: ${task.description}, result:`, result);
        
        results.push({ taskId: task.id, result });
        output += `✅ Completed: ${task.description}\n`;
        
        // Show result if it's a string and reasonable length
        if (typeof result === 'string' && result.length < 200) {
          output += `   → ${result}\n`;
        } else if (result && typeof result === 'object' && result.summary) {
          output += `   → ${result.summary}\n`;
        }
        
      } catch (error) {
        output += `❌ Failed: ${task.description} - ${error}\n`;
        results.push({ taskId: task.id, error: String(error) });
      }
    }
    
    // Phase 3: Summary
    const successCount = results.filter(r => !r.error).length;
    const failCount = results.filter(r => r.error).length;
    
    output += `\n📊 Execution Summary:\n`;
    output += `   ✅ Successful: ${successCount}\n`;
    if (failCount > 0) {
      output += `   ❌ Failed: ${failCount}\n`;
    }
    output += "\n🎯 Orchestration trio execution complete!\n";
    
    return output;
  }

  /**
   * Extract user message from the full context
   */
  private extractUserMessageFromPrompt(message: string): string {
    // Try to find "User Request:" marker
    const userRequestIndex = message.lastIndexOf('User Request:');
    if (userRequestIndex !== -1) {
      const afterMarker = message.substring(userRequestIndex + 'User Request:'.length).trim();
      const toolsIndex = afterMarker.indexOf('Tools available');
      if (toolsIndex !== -1) {
        return afterMarker.substring(0, toolsIndex).trim();
      }
      return afterMarker;
    }
    
    // Try "Task:" marker
    const taskIndex = message.lastIndexOf('Task:');
    if (taskIndex !== -1) {
      const afterMarker = message.substring(taskIndex + 'Task:'.length).trim();
      const toolsIndex = afterMarker.indexOf('Tools available');
      if (toolsIndex !== -1) {
        return afterMarker.substring(0, toolsIndex).trim();
      }
      return afterMarker;
    }
    
    // If no markers found, try to extract from Gemini CLI context
    if (message.includes('This is the Gemini CLI')) {
      const lines = message.split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line && !line.includes('Gemini CLI') && !line.includes('context')) {
          return line;
        }
      }
    }
    
    return message;
  }

  /**
   * Detect if a task is complex enough to need orchestration
   */
  private async detectOrchestrationNeeded(message: string): Promise<boolean> {
    const lowerMessage = message.toLowerCase();
    
    // Multi-step operations
    if (/\bthen\b|\band\s+then\b|\bafter\s+that\b/.test(lowerMessage)) {
      console.log(`🎯 Multi-step detected: contains 'then/after'`);
      return true;
    }
    
    // Multiple file operations
    if (/create.*update|create.*add|write.*edit|write.*append/.test(lowerMessage)) {
      console.log(`🎯 Multiple file operations detected`);
      return true;
    }
    
    // Research/analysis followed by action
    if (/(research|search|find).*\b(create|write|update|save)/.test(lowerMessage) ||
        /(create|write).*\b(research|search|find)/.test(lowerMessage)) {
      console.log(`🎯 Research + action detected`);
      return true;
    }
    
    // Complex commands
    const complexCommands = ['refactor', 'migrate', 'setup', 'configure', 'deploy'];
    for (const cmd of complexCommands) {
      if (new RegExp(cmd, 'i').test(lowerMessage)) {
        console.log(`🎯 Complex command detected: ${cmd}`);
        return true;
      }
    }
    
    // Multiple distinct actions
    const actionVerbs = ['search', 'research', 'find', 'create', 'write', 'update', 'edit'];
    const foundActions = actionVerbs.filter(verb => 
      new RegExp(`\\b${verb}\\b`, 'i').test(message)
    );
    
    if (foundActions.length >= 2) {
      console.log(`🎯 Multiple actions: ${foundActions.join(', ')}`);
      return true;
    }
    
    return false;
  }

  /**
   * Control methods for orchestration
   */
  public pauseOrchestration(): void {
    if (this.orchestrator) {
      this.orchestrator.pause();
    }
  }

  public resumeOrchestration(): void {
    if (this.orchestrator) {
      this.orchestrator.resume();
    }
  }

  public abortOrchestration(): void {
    if (this.orchestrator) {
      this.orchestrator.abort();
    }
  }

  public getOrchestrationStatus(): any {
    return this.orchestrator?.getStatus();
  }

  public setUseOrchestration(use: boolean): void {
    this.useOrchestration = use;
    console.log(`🎭 Orchestration ${use ? 'enabled' : 'disabled'}`);
  }
}