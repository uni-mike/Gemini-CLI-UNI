/**
 * Recovery Strategies for the Trio
 * Intelligent error recovery and task adaptation
 */

export interface RecoveryStrategy {
  name: string;
  condition: (error: string) => boolean;
  apply: (task: any, context: any) => any;
  description: string;
}

export class RecoveryManager {
  private strategies: RecoveryStrategy[] = [];
  
  constructor() {
    this.registerDefaultStrategies();
  }
  
  private registerDefaultStrategies() {
    // File not found - create it first
    this.register({
      name: 'file_not_found',
      condition: (error) => error.includes('ENOENT') || error.includes('no such file'),
      apply: (task, context) => {
        const fileName = this.extractFileName(task?.description || '');
        return {
          action: 'create_missing',
          newTask: {
            description: `Create missing file: ${fileName}`,
            type: 'tool',
            tools: ['file'],
            priority: 0  // High priority
          }
        };
      },
      description: 'Create missing file before reading'
    });
    
    // Permission denied - try alternative approach
    this.register({
      name: 'permission_denied',
      condition: (error) => error.includes('EACCES') || error.includes('permission'),
      apply: (task, context) => ({
        action: 'use_alternative',
        newTask: {
          description: `Use alternative approach for: ${task.description}`,
          type: 'tool',
          tools: ['bash'],
          command: `sudo ${task.command || 'ls'}`
        }
      }),
      description: 'Use elevated permissions'
    });
    
    // Command not found - install or use alternative
    this.register({
      name: 'command_not_found',
      condition: (error) => error.includes('command not found') || error.includes('not found'),
      apply: (task, context) => {
        const command = this.extractCommand(task.error || task.description);
        const alternatives = this.getAlternatives(command);
        
        return {
          action: 'use_alternative',
          alternatives,
          newTask: {
            description: `Use alternative for ${command}`,
            type: 'tool',
            tools: ['bash'],
            command: alternatives[0] || 'echo "No alternative found"'
          }
        };
      },
      description: 'Find alternative command'
    });
    
    // Timeout - break into smaller chunks
    this.register({
      name: 'timeout',
      condition: (error) => error.includes('timeout') || error.includes('timed out'),
      apply: (task, context) => {
        const subtasks = this.breakIntoSubtasks(task);
        return {
          action: 'decompose',
          subtasks,
          description: 'Break into smaller tasks'
        };
      },
      description: 'Decompose into smaller tasks'
    });
    
    // Network error - retry with backoff
    this.register({
      name: 'network_error',
      condition: (error) => error.includes('ECONNREFUSED') || error.includes('network'),
      apply: (task, context) => ({
        action: 'retry_with_backoff',
        retryCount: context.retryCount || 0,
        delay: Math.min(1000 * Math.pow(2, context.retryCount || 0), 10000),
        maxRetries: 3
      }),
      description: 'Retry with exponential backoff'
    });
    
    // Syntax error - fix and retry
    this.register({
      name: 'syntax_error',
      condition: (error) => error.includes('SyntaxError') || error.includes('syntax'),
      apply: (task, context) => ({
        action: 'fix_syntax',
        analysis: this.analyzeSyntaxError(task.error || ''),
        suggestion: 'Check quotes, brackets, and semicolons'
      }),
      description: 'Fix syntax errors'
    });
  }
  
  register(strategy: RecoveryStrategy) {
    this.strategies.push(strategy);
  }
  
  findStrategy(error: string): RecoveryStrategy | null {
    for (const strategy of this.strategies) {
      if (strategy.condition(error)) {
        return strategy;
      }
    }
    return null;
  }
  
  async applyRecovery(
    error: string, 
    task: any, 
    context: any
  ): Promise<any> {
    const strategy = this.findStrategy(error);
    
    if (!strategy) {
      return {
        action: 'retry_default',
        description: 'Retry with adjusted parameters',
        adjustments: {
          timeout: (context.timeout || 5000) * 2,
          retryCount: (context.retryCount || 0) + 1
        }
      };
    }
    
    console.log(`  🔧 Applying recovery strategy: ${strategy.name}`);
    const recovery = strategy.apply(task, context);
    
    return {
      ...recovery,
      strategyUsed: strategy.name,
      originalError: error
    };
  }
  
  private extractFileName(description: string): string {
    if (!description) return 'unknown.txt';
    const match = description.match(/(\S+\.\w+)/);
    return match ? match[1] : 'unknown.txt';
  }
  
  private extractCommand(error: string): string {
    const match = error.match(/command not found: (\w+)/) ||
                  error.match(/(\w+): command not found/);
    return match ? match[1] : '';
  }
  
  private getAlternatives(command: string): string[] {
    const alternatives: Record<string, string[]> = {
      'node': ['nodejs', 'npm run'],
      'python': ['python3', 'python2'],
      'pip': ['pip3', 'pip2'],
      'vim': ['vi', 'nano', 'emacs'],
      'yarn': ['npm', 'pnpm'],
      'ts-node': ['npx tsx', 'node --loader ts-node/esm'],
      'tsc': ['npx tsc', 'npm run build']
    };
    
    return alternatives[command] || [];
  }
  
  private breakIntoSubtasks(task: any): any[] {
    // Simple heuristic: split by "and", "then", etc.
    const description = task.description;
    const parts = description.split(/\s+(?:and|then|after|next)\s+/i);
    
    return parts.map((part: string, index: number) => ({
      ...task,
      id: `${task.id}_sub_${index}`,
      description: part.trim(),
      priority: task.priority + index
    }));
  }
  
  private analyzeSyntaxError(error: string): any {
    return {
      hasUnclosedQuote: error.includes('unterminated'),
      hasMissingBracket: error.includes('bracket') || error.includes(')'),
      hasMissingSemicolon: error.includes('semicolon'),
      line: this.extractLineNumber(error)
    };
  }
  
  private extractLineNumber(error: string): number | null {
    const match = error.match(/line (\d+)/i);
    return match ? parseInt(match[1]) : null;
  }
  
  getRecoveryStats(): any {
    return {
      totalStrategies: this.strategies.length,
      strategies: this.strategies.map(s => ({
        name: s.name,
        description: s.description
      }))
    };
  }
}