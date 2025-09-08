import type { Task } from '../../types.js';

export class TaskAnalyzer {
  /**
   * Analyzes prompt complexity
   */
  analyzeComplexity(prompt: string): 'simple' | 'moderate' | 'complex' {
    const wordCount = prompt.split(/\s+/).length;
    const hasMultipleSteps = /\d+\.|step|first|then|next|finally/i.test(prompt);
    const hasTechnicalTerms = /api|database|deploy|test|implement|refactor/i.test(prompt);
    const hasFileOperations = /read|write|edit|create|delete|file/i.test(prompt);
    
    let complexityScore = 0;
    
    if (wordCount > 100) complexityScore += 2;
    else if (wordCount > 50) complexityScore += 1;
    
    if (hasMultipleSteps) complexityScore += 2;
    if (hasTechnicalTerms) complexityScore += 1;
    if (hasFileOperations) complexityScore += 1;
    
    if (complexityScore >= 4) return 'complex';
    if (complexityScore >= 2) return 'moderate';
    return 'simple';
  }

  /**
   * Estimates time for a task based on its description
   */
  estimateTaskTime(description: string): number {
    const timeMap: Record<string, number> = {
      search: 15000,
      read: 5000,
      write: 5000,
      create: 10000,
      test: 30000,
      deploy: 60000,
      install: 30000,
      run: 20000,
      analyze: 20000,
      fix: 30000,
      web: 10000,
      edit: 10000
    };

    const lowerDesc = description.toLowerCase();
    
    for (const [keyword, time] of Object.entries(timeMap)) {
      if (lowerDesc.includes(keyword)) {
        return time;
      }
    }
    
    return 30000; // Default 30 seconds
  }

  /**
   * Identifies dependencies between tasks
   */
  identifyDependencies(tasks: Task[]): void {
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      
      // Tests depend on implementation
      if (task.description.toLowerCase().includes('test')) {
        for (let j = 0; j < i; j++) {
          if (tasks[j].description.toLowerCase().includes('create') ||
              tasks[j].description.toLowerCase().includes('implement')) {
            task.dependencies.push(tasks[j].id);
          }
        }
      }
      
      // Deploy depends on tests
      if (task.description.toLowerCase().includes('deploy')) {
        for (let j = 0; j < i; j++) {
          if (tasks[j].description.toLowerCase().includes('test')) {
            task.dependencies.push(tasks[j].id);
          }
        }
      }
      
      // File writes depend on reads
      if (task.description.toLowerCase().includes('write') ||
          task.description.toLowerCase().includes('edit')) {
        for (let j = 0; j < i; j++) {
          if (tasks[j].description.toLowerCase().includes('read')) {
            const fileMatch = task.description.match(/(\S+\.\w+)/);
            const prevFileMatch = tasks[j].description.match(/(\S+\.\w+)/);
            if (fileMatch && prevFileMatch && fileMatch[1] === prevFileMatch[1]) {
              task.dependencies.push(tasks[j].id);
            }
          }
        }
      }
    }
  }
}