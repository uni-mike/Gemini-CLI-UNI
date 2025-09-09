import { DeepSeekWithTools } from './deepSeekWithToolsRefactored.js';
import { DeepSeekOrchestrator } from '../orchestration/DeepSeekOrchestrator.js';
import { OrchestrationUIBridge } from '../ui/orchestration/OrchestrationUIBridge.js';
import type { Config } from '../config/config.js';

export class DeepSeekWithOrchestration extends DeepSeekWithTools {
  private orchestrator?: DeepSeekOrchestrator;
  private useOrchestration: boolean = true; // Enable orchestration trio
  private uiBridge?: OrchestrationUIBridge; // Direct UI bridge integration

  constructor(config: Config) {
    super(config);
    this.orchestrator = new DeepSeekOrchestrator(this);
    
    // Initialize UI bridge if in React Ink mode
    if (process.env['APPROVAL_MODE'] === 'yolo') {
      this.uiBridge = new OrchestrationUIBridge();
      // Export the bridge globally so App.tsx can connect to it
      (global as any).__orchestrationUIBridge = this.uiBridge;
    }
    
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
          console.log('🔍 About to call executeWithOrchestrationTrio...');
          const orchestrationResults = await this.executeWithOrchestrationTrio(userMessage);
          console.log('✅ Orchestration trio completed!');
          
          // Check if React Ink UI is active (APPROVAL_MODE=yolo typically indicates React Ink UI mode)
          const isReactInkMode = process.env['APPROVAL_MODE'] === 'yolo';
          console.log('🔍 CHECKING REACT INK MODE:', {
            APPROVAL_MODE: process.env['APPROVAL_MODE'],
            isReactInkMode
          });
          
          if (isReactInkMode) {
            // In React Ink mode, don't yield the formatted text output
            // The UI components will display the orchestration progress
            // Just yield a simple completion message
            yield "\n✅ Orchestration completed - see operations above\n";
          } else {
            // In non-React Ink mode, yield the full formatted output
            let fullOutput = "\n🎭 Complex task detected - using orchestration trio...\n";
            fullOutput += "━".repeat(60) + "\n\n";
            fullOutput += orchestrationResults;
            yield fullOutput;
          }
          
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
    console.log('🚀 ABOUT TO START ORCHESTRATION PHASES WITH UI EVENTS!');
    
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
    console.log('🎯 TESTING NOTIFYUI METHOD DIRECTLY!');
    this.notifyUI("🎯 TESTING REACT INK UI EVENTS!");

    // Check if React Ink UI is active
    const isReactInkMode = process.env['APPROVAL_MODE'] === 'yolo';
    let output = "";

    // Phase 1: Planning - EMIT ORCHESTRATION EVENT FOR REACT INK UI  
    this.notifyUI("📋 Planning tasks...");
    if (!isReactInkMode) {
      output += "📋 Planning tasks...\n";
    }
    console.log('🔍 About to call orchestrator.planner.createPlan...');
    const plan = await orchestrator.planner.createPlan(userMessage);
    console.log('✅ Planner.createPlan completed, plan:', plan);
    this.notifyUI(`✅ Created execution plan with ${plan.tasks.length} tasks`);
    
    if (!isReactInkMode) {
      output += `\n✅ Created execution plan with ${plan.tasks.length} tasks:\n`;
      for (const task of plan.tasks) {
        output += `  • ${task.description}\n`;
      }
    }
    
    // Phase 2: Execution
    this.notifyUI("🔧 Executing tasks...");
    if (!isReactInkMode) {
      output += "\n🔧 Executing tasks...\n";
    }
    const results = [];
    
    for (const task of plan.tasks) {
      this.notifyUI(`⏳ ${task.description}`);
      if (!isReactInkMode) {
        output += `\n⏳ ${task.description}\n`;
      }
      
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
        this.notifyUI(`✅ Completed: ${task.description}`);
        
        if (!isReactInkMode) {
          output += `✅ Completed: ${task.description}\n`;
          // Show result if it's a string and reasonable length
          if (typeof result === 'string' && result.length < 200) {
            output += `   → ${result}\n`;
          } else if (result && typeof result === 'object' && result.summary) {
            output += `   → ${result.summary}\n`;
          }
        }
        
      } catch (error) {
        this.notifyUI(`❌ Failed: ${task.description} - ${error}`);
        if (!isReactInkMode) {
          output += `❌ Failed: ${task.description} - ${error}\n`;
        }
        results.push({ taskId: task.id, error: String(error) });
      }
    }
    
    // Phase 3: Summary
    const successCount = results.filter(r => !r.error).length;
    const failCount = results.filter(r => r.error).length;
    
    // Always notify UI about summary
    this.notifyUI(`📊 Execution Summary: ✅ ${successCount} successful${failCount > 0 ? `, ❌ ${failCount} failed` : ''}`);
    
    if (!isReactInkMode) {
      output += `\n📊 Execution Summary:\n`;
      output += `   ✅ Successful: ${successCount}\n`;
      if (failCount > 0) {
        output += `   ❌ Failed: ${failCount}\n`;
      }
      output += "\n🎯 Orchestration trio execution complete!\n";
    }
    
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
   * ALWAYS USE ORCHESTRATION - NO HEURISTICS EVER
   */
  private async detectOrchestrationNeeded(message: string): Promise<boolean> {
    console.log(`🤖 PURE AI MODE: Always using orchestration trio (NO HEURISTICS EVER)`);
    return true; // ALWAYS USE AI-DRIVEN ORCHESTRATION - ZERO HEURISTICS
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

  /**
   * Notify the UI bridge of orchestration progress
   */
  private notifyUI(message: string): void {
    // Direct UI bridge integration - no more console patching!
    if (this.uiBridge) {
      this.uiBridge.handleProgressMessage(message);
    } else {
      // Fallback for non-React Ink mode
      console.log('🔥 NOTIFYUI CALLED WITH:', message);
      const orchestrationEvent = {
        type: 'orchestration-progress',
        message: message,
        timestamp: Date.now()
      };
      
      console.log(`🎭ORCHESTRATION_EVENT:${JSON.stringify(orchestrationEvent)}`);
      console.log('🔥 NOTIFYUI FINISHED');
    }
  }
}