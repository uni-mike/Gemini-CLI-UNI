import { DeepSeekWithTools } from './deepSeekWithTools';
import { DeepSeekOrchestrator } from '../orchestration/DeepSeekOrchestrator';
import { Config } from '../config/config';

export class DeepSeekWithOrchestration extends DeepSeekWithTools {
  private orchestrator: DeepSeekOrchestrator;
  private useOrchestration: boolean = true;

  constructor(config: Config, confirmationCallback?: any) {
    super(config, confirmationCallback);
    this.orchestrator = new DeepSeekOrchestrator(this);
  }

  /**
   * Override the main process method to use orchestration for complex tasks
   */
  async *processWithDeepSeek(
    message: string, 
    options?: any
  ): AsyncGenerator<string, void, unknown> {
    try {
      // Check if this is a complex task that needs orchestration
      const userMessage = this.extractUserMessage(message);
      const isComplexTask = await this.detectComplexTask(userMessage);
      
      if (isComplexTask && this.useOrchestration) {
        yield "🎭 Complex task detected - engaging intelligent orchestration...\n";
        yield "━".repeat(60) + "\n\n";
        
        // Use orchestrator for complex tasks
        const result = await this.orchestrator.orchestratePrompt(userMessage);
        
        // Format and yield the results
        if (result && result.length > 0) {
          yield "\n📊 Orchestration Results:\n";
          yield "─".repeat(50) + "\n";
          
          for (const taskResult of result) {
            if (taskResult.result) {
              yield `✅ ${taskResult.taskId}: Success\n`;
              if (typeof taskResult.result === 'string') {
                yield `   ${taskResult.result.substring(0, 100)}...\n`;
              }
            } else if (taskResult.error) {
              yield `❌ ${taskResult.taskId}: ${taskResult.error}\n`;
            }
          }
          
          yield "\n✨ Orchestration complete!\n";
        }
        
        return;
      }
      
      // Fall back to original implementation for simple tasks
      yield* super.processWithDeepSeek(message, options);
      
    } catch (error) {
      console.error('Orchestration error:', error);
      // Fall back to original implementation
      yield "⚠️ Orchestration failed, falling back to standard processing...\n";
      yield* super.processWithDeepSeek(message, options);
    }
  }

  /**
   * Extract user message from the full context
   */
  private extractUserMessage(message: string): string {
    // Extract just the user's actual message
    const userMatch = message.match(/User Request:\s*(.+?)(?:\n\nTools available:|$)/s);
    if (userMatch) {
      return userMatch[1].trim();
    }
    
    // Fallback: look for common markers
    const lines = message.split('\n');
    let inUserSection = false;
    let userMessage = '';
    
    for (const line of lines) {
      if (line.includes('User Request:') || line.includes('Task:')) {
        inUserSection = true;
        continue;
      }
      if (inUserSection && (line.includes('Tools available') || line.includes('---'))) {
        break;
      }
      if (inUserSection) {
        userMessage += line + '\n';
      }
    }
    
    return userMessage.trim() || message;
  }

  /**
   * Detect if a task is complex enough to need orchestration
   */
  private async detectComplexTask(message: string): Promise<boolean> {
    // Word count check
    const wordCount = message.split(/\s+/).length;
    if (wordCount < 30) {
      return false;
    }
    
    // Look for complexity indicators
    const complexityIndicators = [
      /\d+\.\s+/g,  // Numbered lists
      /step\s+\d+/gi,  // Step references
      /first.*then.*finally/si,  // Sequential operations
      /analyze.*implement.*test/si,  // Multiple phases
      /comprehensive|entire|all|every/gi,  // Broad scope
      /and then|after that|once.*complete/gi,  // Dependencies
    ];
    
    let complexityScore = 0;
    for (const indicator of complexityIndicators) {
      if (indicator.test(message)) {
        complexityScore++;
      }
    }
    
    // Count distinct operations
    const operations = [
      'search', 'find', 'read', 'write', 'create', 'edit', 'modify',
      'test', 'analyze', 'review', 'implement', 'deploy', 'install',
      'check', 'validate', 'fix', 'update', 'refactor'
    ];
    
    const foundOperations = operations.filter(op => 
      new RegExp(`\\b${op}\\b`, 'i').test(message)
    );
    
    if (foundOperations.length >= 4) {
      complexityScore += 2;
    }
    
    // Decide based on score
    return complexityScore >= 3;
  }

  /**
   * Control methods for orchestration
   */
  public pauseOrchestration(): void {
    this.orchestrator.pause();
  }

  public resumeOrchestration(): void {
    this.orchestrator.resume();
  }

  public abortOrchestration(): void {
    this.orchestrator.abort();
  }

  public getOrchestrationStatus(): any {
    return this.orchestrator.getStatus();
  }

  public setUseOrchestration(use: boolean): void {
    this.useOrchestration = use;
    console.log(`🎭 Orchestration ${use ? 'enabled' : 'disabled'}`);
  }
}