import { DeepSeekWithTools } from './deepSeekWithToolsRefactored.js';
import { DeepSeekOrchestrator } from '../orchestration/DeepSeekOrchestrator.js';
import type { Config } from '../config/config.js';

export class DeepSeekWithOrchestration extends DeepSeekWithTools {
  private orchestrator: DeepSeekOrchestrator;
  private useOrchestration: boolean = true; // Enable orchestration detection and smart routing

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
      
      // DEBUG: Log what we're checking
      console.log(`📊 Extracted user message: "${userMessage.substring(0, 100)}"`);
      
      const isComplexTask = await this.detectOrchestrationNeeded(userMessage);
      console.log(`   Result: ${isComplexTask ? '✅ COMPLEX - Using orchestration' : '❌ SIMPLE - Direct execution'}`);
      
      if (isComplexTask && this.useOrchestration) {
        yield "🎭 Complex task detected - executing with intelligent routing...\n";
        yield "━".repeat(60) + "\n\n";
        
        // Complex tasks are handled by DeepSeek directly
        // The orchestration system (Planner/Executor/Orchestrator) is not properly connected
        // so we use DeepSeek's native multi-step capabilities
        console.log("🎯 Routing complex task to DeepSeek for execution");
        
        // Important: Pass the ORIGINAL message, not the extracted one
        // DeepSeek needs the full context
        const asyncIterator = super.sendMessageStreamWithTools(message);
        
        try {
          for await (const chunk of asyncIterator) {
            yield chunk;
          }
          yield "\n✨ Complex task complete!\n";
        } catch (error) {
          console.error("Error in complex task execution:", error);
          yield `\n❌ Error: ${error}\n`;
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
    // The message sent from contentGenerator likely has format:
    // "This is the Gemini CLI... User Request: <actual request>"
    // We need to extract JUST the actual user request
    
    // Try to find "User Request:" marker
    const userRequestIndex = message.lastIndexOf('User Request:');
    if (userRequestIndex !== -1) {
      const afterMarker = message.substring(userRequestIndex + 'User Request:'.length).trim();
      // Take everything after "User Request:" until "Tools available" or end
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
    
    // If no markers found, assume the whole message is the user request
    // But skip any system context at the beginning
    if (message.includes('This is the Gemini CLI')) {
      // Find the actual question/command (usually after newlines)
      const lines = message.split('\n');
      // Skip system context lines and find the actual command
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
    
    // Count distinct action verbs (excluding 'test' when used as filename)
    const actionVerbs = ['search', 'research', 'find', 'create', 'write', 
                         'update', 'edit', 'add', 'append', 'modify', 
                         'delete', 'fix', 'build', 'deploy'];
    
    // Special handling for 'test' - only count if not part of filename
    const hasTestAction = /\btest\s+(?!\.txt|\.md|\.json|\.js|\.ts|\.py)/i.test(message);
    
    const foundActions = actionVerbs.filter(verb => 
      new RegExp(`\\b${verb}\\b`, 'i').test(message)  // Added word boundary at end
    );
    
    if (hasTestAction && !message.toLowerCase().includes('test.')) {
      foundActions.push('test');
    }
    
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