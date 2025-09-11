import type { Task } from '../../types.js';
import { TaskStatus } from '../../types.js';
import { v4 as uuidv4 } from 'uuid';

export class MemoryEfficientDecomposer {
  private readonly MAX_TASKS_IN_MEMORY = 100;
  private readonly BATCH_SIZE = 50;

  /**
   * Memory-efficient decomposition for massive prompts (500+ tasks)
   */
  async decomposeEfficiently(prompt: string, complexity: string): Promise<Task[]> {
    if (complexity !== 'complex') {
      return this.simpleDecomposition(prompt);
    }

    const estimatedTasks = this.estimateTaskCount(prompt);
    
    if (estimatedTasks > this.MAX_TASKS_IN_MEMORY) {
      console.log(`🧠 Massive prompt detected (${estimatedTasks} estimated tasks), using streaming decomposition...`);
      return this.streamingDecomposition(prompt);
    }

    return this.batchDecomposition(prompt);
  }

  private estimateTaskCount(prompt: string): number {
    // Quick estimation without full parsing
    const numbered = (prompt.match(/\d+\./g) || []).length;
    const bullets = (prompt.match(/[-*•]/g) || []).length;
    const operations = (prompt.match(/\b(search|read|write|create|edit|run|test|analyze|check|find)\b/gi) || []).length;
    
    return Math.max(numbered, bullets, Math.floor(operations / 2));
  }

  private simpleDecomposition(prompt: string): Task[] {
    return [{
      id: uuidv4(),
      description: prompt.substring(0, 200),
      dependencies: [],
      status: TaskStatus.PENDING,
      retryCount: 0,
      maxRetries: 2,
      timeoutMs: 30000,
      toolCalls: []
    }];
  }

  private async streamingDecomposition(prompt: string): Promise<Task[]> {
    const tasks: Task[] = [];
    const chunks = this.chunkPrompt(prompt, this.BATCH_SIZE);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`📝 Processing chunk ${i + 1}/${chunks.length}...`);
      
      const batchTasks = this.processBatch(chunk, i * this.BATCH_SIZE);
      tasks.push(...batchTasks);
      
      // Memory management: Force garbage collection periodically
      if (i % 5 === 0 && global.gc) {
        global.gc();
      }
      
      // Yield control to prevent blocking
      await new Promise(resolve => setImmediate(resolve));
    }
    
    return this.optimizeTaskMemory(tasks);
  }

  private chunkPrompt(prompt: string, chunkSize: number): string[] {
    const lines = prompt.split('\n').filter(line => line.trim());
    const chunks: string[] = [];
    
    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunk = lines.slice(i, i + chunkSize).join('\n');
      chunks.push(chunk);
    }
    
    return chunks;
  }

  private processBatch(chunk: string, baseIndex: number): Task[] {
    const tasks: Task[] = [];
    const patterns = this.getPatterns();
    
    const lines = chunk.split('\n').filter(line => line.trim());
    
    lines.forEach((line, index) => {
      const matchedPattern = this.findMatchingPattern(line, patterns);
      
      if (matchedPattern) {
        const task: Task = {
          id: uuidv4(),
          description: this.cleanDescription(line),
          dependencies: [],
          status: TaskStatus.PENDING,
          retryCount: 0,
          maxRetries: 2,
          timeoutMs: matchedPattern.timeout,
          toolCalls: []
        };
        
        tasks.push(task);
      }
    });
    
    return tasks;
  }

  private batchDecomposition(prompt: string): Task[] {
    const lines = prompt.split('\n').filter(line => line.trim());
    const tasks: Task[] = [];
    const patterns = this.getPatterns();
    
    // Process in smaller batches to manage memory
    for (let i = 0; i < lines.length; i += this.BATCH_SIZE) {
      const batch = lines.slice(i, i + this.BATCH_SIZE);
      
      batch.forEach(line => {
        const matchedPattern = this.findMatchingPattern(line, patterns);
        
        if (matchedPattern) {
          tasks.push({
            id: uuidv4(),
            description: this.cleanDescription(line),
            dependencies: [],
            status: TaskStatus.PENDING,
            retryCount: 0,
            maxRetries: 2,
            timeoutMs: matchedPattern.timeout,
            toolCalls: []
          });
        }
      });
    }
    
    return tasks;
  }

  private getPatterns() {
    return [
      { regex: /search\s+for\s+["']([^"']+)["']/i, timeout: 15000 },
      { regex: /read\s+(?:file\s+)?(\S+)/i, timeout: 5000 },
      { regex: /write\s+(?:to\s+)?(?:file\s+)?(\S+)/i, timeout: 5000 },
      { regex: /create\s+(?:file\s+)?(\S+)/i, timeout: 10000 },
      { regex: /edit\s+(\S+)/i, timeout: 10000 },
      { regex: /run\s+(.+)/i, timeout: 20000 },
      { regex: /test\s+(.+)/i, timeout: 30000 },
      { regex: /analyze\s+(.+)/i, timeout: 20000 },
      { regex: /check\s+(.+)/i, timeout: 10000 },
      { regex: /find\s+(.+)/i, timeout: 15000 }
    ];
  }

  private findMatchingPattern(line: string, patterns: any[]) {
    for (const pattern of patterns) {
      if (pattern.regex.test(line)) {
        return pattern;
      }
    }
    return { timeout: 30000 }; // Default
  }

  private cleanDescription(line: string): string {
    // Remove numbering, bullets, and excessive whitespace
    return line
      .replace(/^\d+\.?\s*/, '')
      .replace(/^[-*•]\s*/, '')
      .trim()
      .substring(0, 200); // Limit length to save memory
  }

  private optimizeTaskMemory(tasks: Task[]): Task[] {
    // Remove duplicate tasks to save memory
    const seen = new Set<string>();
    const optimized: Task[] = [];
    
    for (const task of tasks) {
      const key = task.description.substring(0, 50);
      if (!seen.has(key)) {
        seen.add(key);
        optimized.push(task);
      }
    }
    
    console.log(`🔧 Optimized ${tasks.length} tasks down to ${optimized.length} (removed duplicates)`);
    return optimized;
  }
}