import type { Task } from '../../types.js';
import { TaskStatus } from '../../types.js';
import { v4 as uuidv4 } from 'uuid';

export class TaskDecomposer {
  /**
   * Decomposes a prompt into individual tasks
   */
  decompose(prompt: string, complexity: 'simple' | 'moderate' | 'complex'): Task[] {
    if (complexity === 'simple') {
      return this.createSimpleTask(prompt);
    }
    
    return this.heuristicDecomposition(prompt);
  }

  private createSimpleTask(prompt: string): Task[] {
    return [{
      id: uuidv4(),
      description: prompt,
      dependencies: [],
      status: TaskStatus.PENDING,
      retryCount: 0,
      maxRetries: 2,
      timeoutMs: 30000,
      toolCalls: []
    }];
  }

  private heuristicDecomposition(prompt: string): Task[] {
    const tasks: Task[] = [];
    
    const patterns = [
      { regex: /search\s+for\s+["']([^"']+)["']/gi, template: 'Search for "$1"', timeout: 15000 },
      { regex: /read\s+(?:the\s+)?file\s+(\S+)/gi, template: 'Read file $1', timeout: 5000 },
      { regex: /write\s+(?:to\s+)?(?:the\s+)?file\s+(\S+)/gi, template: 'Write to file $1', timeout: 5000 },
      { regex: /create\s+(?:a\s+)?(?:new\s+)?file\s+(?:called\s+)?(\S+)/gi, template: 'Create file $1', timeout: 10000 },
      { regex: /edit\s+(?:the\s+)?(\S+)/gi, template: 'Edit $1', timeout: 10000 },
      { regex: /test\s+(\w+)/gi, template: 'Test $1', timeout: 30000 },
      { regex: /deploy\s+(?:to\s+)?(\w+)/gi, template: 'Deploy to $1', timeout: 60000 },
      { regex: /install\s+(\S+)/gi, template: 'Install $1', timeout: 30000 },
      { regex: /run\s+[`"]([^`"]+)[`"]/gi, template: 'Run command: $1', timeout: 20000 },
      { regex: /analyze\s+(\w+)/gi, template: 'Analyze $1', timeout: 20000 },
      { regex: /fix\s+(?:the\s+)?(\w+)/gi, template: 'Fix $1', timeout: 30000 },
      { regex: /check\s+(\w+)/gi, template: 'Check $1', timeout: 10000 },
      { regex: /find\s+(?:all\s+)?(\w+)/gi, template: 'Find $1', timeout: 15000 }
    ];

    // Extract tasks based on patterns
    for (const pattern of patterns) {
      let match;
      pattern.regex.lastIndex = 0; // Reset regex
      while ((match = pattern.regex.exec(prompt)) !== null) {
        const description = pattern.template.replace('$1', match[1]);
        
        // Avoid duplicates
        if (!tasks.some(t => t.description === description)) {
          tasks.push({
            id: uuidv4(),
            description,
            dependencies: [],
            status: TaskStatus.PENDING,
            retryCount: 0,
            maxRetries: 2,
            timeoutMs: pattern.timeout,
            toolCalls: []
          });
        }
      }
    }

    // If no patterns matched, create a single task
    if (tasks.length === 0) {
      tasks.push({
        id: uuidv4(),
        description: prompt.substring(0, 100),
        dependencies: [],
        status: TaskStatus.PENDING,
        retryCount: 0,
        maxRetries: 2,
        timeoutMs: 30000,
        toolCalls: []
      });
    }

    return tasks;
  }
}