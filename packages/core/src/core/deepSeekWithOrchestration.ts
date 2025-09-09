import { DeepSeekWithTools } from './deepSeekWithToolsRefactored.js';
import { DeepSeekOrchestrator } from '../orchestration/DeepSeekOrchestrator.js';
import type { Config } from '../config/config.js';

export class DeepSeekWithOrchestration extends DeepSeekWithTools {
  private orchestrator: DeepSeekOrchestrator;
  private useOrchestration: boolean = true;

  constructor(config: Config) {
    super(config);
    this.orchestrator = new DeepSeekOrchestrator(this);
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
      
      // DEBUG: Always log detection result
      console.log(`📊 Task complexity check for: "${userMessage.substring(0, 50)}..."`);
      console.log(`   Result: ${isComplexTask ? '✅ COMPLEX - Using orchestration' : '❌ SIMPLE - Direct execution'}`);
      
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
      
      // Fall back to parent implementation for simple tasks
      yield* super.sendMessageStreamWithTools(message);
      
    } catch (error) {
      console.error('Orchestration error:', error);
      // Fall back to original implementation
      yield "⚠️ Orchestration failed, falling back to standard processing...\n";
      yield* super.sendMessageStreamWithTools(message);
    }
  }

  /**
   * Extract user message from the full context
   */
  private extractUserMessageFromPrompt(message: string): string {
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
   * Focus on ACTUAL complexity, not word count!
   */
  private async detectOrchestrationNeeded(message: string): Promise<boolean> {
    const lowerMessage = message.toLowerCase();
    
    // ALWAYS use orchestration for multi-step operations
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
    
    // Multiple targets (e.g., "BTC and LTC", "multiple files")
    if (/\band\b.*\b(and|plus|also|as well)\b/.test(lowerMessage) ||
        /multiple|several|various|all/.test(lowerMessage)) {
      console.log(`🎯 Multiple targets detected`);
      return true;
    }
    
    // Commands that inherently require multiple steps
    const complexCommands = [
      'refactor', 'migrate', 'setup', 'configure', 'deploy',
      'analyze.*fix', 'debug.*repair', 'test.*fix'
    ];
    
    for (const cmd of complexCommands) {
      if (new RegExp(cmd, 'i').test(lowerMessage)) {
        console.log(`🎯 Complex command detected: ${cmd}`);
        return true;
      }
    }
    
    // Count distinct action verbs
    const actionVerbs = ['search', 'research', 'find', 'create', 'write', 
                         'update', 'edit', 'add', 'append', 'modify', 
                         'delete', 'fix', 'test', 'build', 'deploy'];
    
    const foundActions = actionVerbs.filter(verb => 
      new RegExp(`\\b${verb}`, 'i').test(message)
    );
    
    if (foundActions.length >= 2) {
      console.log(`🎯 Multiple actions: ${foundActions.join(', ')}`);
      return true;
    }
    
    // Default: simple single-action tasks don't need orchestration
    return false;
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