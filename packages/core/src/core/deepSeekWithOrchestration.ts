import { DeepSeekWithTools } from './deepSeekWithToolsRefactored.js';
import { DeepSeekOrchestrator } from '../orchestration/DeepSeekOrchestrator.js';
import type { Config } from '../config/config.js';

export class DeepSeekWithOrchestration extends DeepSeekWithTools {
  private orchestrator?: DeepSeekOrchestrator;
  private useOrchestration: boolean = true; // Re-enable to test minimal orchestration

  constructor(config: Config) {
    super(config);
    // Re-enable orchestrator creation for testing
    this.orchestrator = new DeepSeekOrchestrator(this);
    console.log('🎭 DeepSeekWithOrchestration initialized (orchestrator enabled)');
  }

  /**
   * Override the main method that contentGenerator calls
   */
  override async *sendMessageStreamWithTools(message: string): AsyncGenerator<string> {
    console.log('🎯 DeepSeekWithOrchestration.sendMessageStreamWithTools called');
    yield* this.processWithOrchestration(message);
  }

  /**
   * Process method to use orchestration for complex tasks
   */
  private async *processWithOrchestration(
    message: string, 
    options?: any
  ): AsyncGenerator<string, void, unknown> {
    console.log('🚀 Starting processWithOrchestration');
    
    try {
      // Check if this is a complex task that needs orchestration
      const userMessage = this.extractUserMessageFromPrompt(message);
      
      // DEBUG: Log what we're checking
      console.log(`📊 Extracted user message: "${userMessage.substring(0, 100)}"`);
      
      const isComplexTask = await this.detectOrchestrationNeeded(userMessage);
      console.log(`   Result: ${isComplexTask ? '✅ COMPLEX' : '❌ SIMPLE'} - Orchestration ${this.useOrchestration ? 'ENABLED' : 'DISABLED'}`);
      
      if (isComplexTask && this.useOrchestration) {
        console.log('📊 Orchestration enabled, but falling back to DeepSeek native for now...');
        
        // Fall back to DeepSeek native execution for now
        yield "\n🎭 Complex task detected - using enhanced DeepSeek processing...\n";
        yield* super.sendMessageStreamWithTools(message);
        
        return;
        
        /* TODO: Debug the orchestration hanging issue
        console.log('📊 About to yield orchestration start messages...');
        yield "🎭 Complex task detected - using orchestration trio...\n";
        console.log('📊 Yielded first message, about to yield separator...');
        yield "━".repeat(60) + "\n\n";
        console.log('📊 Yielded separator, continuing...');
        
        // Use the orchestration trio for complex multi-step tasks
        console.log("🎯 Using orchestration trio for complex task");
        
        try {
          // Test basic orchestrator functionality first
          console.log('🎯 About to test basic orchestrator functionality...');
          
          // For now, just test if we can call the planner directly
          const planner = (this.orchestrator as any).orchestrator?.planner;
          if (planner) {
            console.log('🎯 Testing planner directly...');
            const plan = await planner.createPlan(userMessage);
            console.log('🎯 Plan created:', plan);
            
            yield `\n📋 Created plan with ${plan.tasks.length} tasks:\n`;
            for (const task of plan.tasks) {
              yield `  - ${task.description}\n`;
            }
          }
          
          yield "\n✅ Orchestration test complete!\n";
        } catch (error) {
        */
          console.error("Orchestration failed, falling back to direct execution:", error);
          
          // Fall back to direct DeepSeek execution if orchestration fails
          yield "\n⚠️ Orchestration failed, using direct execution...\n";
          const asyncIterator = super.sendMessageStreamWithTools(message);
          
          for await (const chunk of asyncIterator) {
            yield chunk;
          }
        }
        
        return;
      }
      
      // Fall back to parent implementation for simple tasks
      console.log("ℹ️ Processing with standard DeepSeek flow (simple task or orchestration disabled)");
      yield* super.sendMessageStreamWithTools(message);
      
    } catch (error) {
      console.error('Orchestration error:', error);
      // Fall back to original implementation
      yield "⚠️ Orchestration failed, falling back to standard processing...\n";
      yield* super.sendMessageStreamWithTools(message);
    }
    
    /* TODO: Re-enable when orchestration is working
    try {
      // Check if this is a complex task that needs orchestration
      const userMessage = this.extractUserMessageFromPrompt(message);
      
      // DEBUG: Log what we're checking
      console.log(`📊 Extracted user message: "${userMessage.substring(0, 100)}"`);
      
      const isComplexTask = await this.detectOrchestrationNeeded(userMessage);
      console.log(`   Result: ${isComplexTask ? '✅ COMPLEX' : '❌ SIMPLE'} - Orchestration ${this.useOrchestration ? 'ENABLED' : 'DISABLED'}`);
      
      console.log(`🔍 Checking condition: isComplexTask=${isComplexTask}, useOrchestration=${this.useOrchestration}`);
      
      if (isComplexTask && this.useOrchestration) {
        console.log('🎭 Entering COMPLEX + ORCHESTRATION ENABLED branch');
        yield "🎭 Complex task detected - using intelligent multi-step execution...\n";
        yield "━".repeat(60) + "\n\n";
        
        console.log("🎯 About to route complex task through DeepSeek's multi-step handler");
        console.log("Message length:", message.length);
        console.log("First 200 chars:", message.substring(0, 200));
        
        try {
          // Pass the ORIGINAL message with full context for best results
          const asyncIterator = super.sendMessageStreamWithTools(message);
          console.log("✅ Got async iterator, starting to consume...");
          
          let chunkCount = 0;
          for await (const chunk of asyncIterator) {
            chunkCount++;
            console.log(`Chunk ${chunkCount}: ${chunk.substring(0, 50)}...`);
            yield chunk;
          }
          console.log(`✅ Completed with ${chunkCount} chunks`);
        } catch (error) {
          console.error("Error in complex task execution:", error);
          yield `\n❌ Error: ${error}\n`;
        }
        
        return;
      }
      
      // Fall back to parent implementation for simple tasks
      console.log("ℹ️ Processing with standard DeepSeek flow (complex task with orchestration disabled OR simple task)");
      yield* super.sendMessageStreamWithTools(message);
      
    } catch (error) {
      console.error('Orchestration error:', error);
      // Fall back to original implementation
      yield "⚠️ Orchestration failed, falling back to standard processing...\n";
      yield* super.sendMessageStreamWithTools(message);
    }
    */
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