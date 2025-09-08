import { Task } from '../../types';

export class TaskOptimizer {
  /**
   * Optimizes task execution order using topological sort
   */
  optimizeTaskOrder(tasks: Task[]): Task[] {
    const sorted: Task[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      if (visiting.has(taskId)) {
        console.warn('⚠️ Circular dependency detected');
        return;
      }
      
      visiting.add(taskId);
      const task = tasks.find(t => t.id === taskId);
      
      if (task) {
        for (const dep of task.dependencies) {
          visit(dep);
        }
        visited.add(taskId);
        visiting.delete(taskId);
        sorted.push(task);
      }
    };
    
    for (const task of tasks) {
      visit(task.id);
    }
    
    return sorted;
  }

  /**
   * Estimates total execution time considering parallelization
   */
  estimateTotalTime(tasks: Task[]): number {
    const taskTimes = new Map<string, number>();
    
    for (const task of tasks) {
      let startTime = 0;
      
      // Find the latest completion time of dependencies
      for (const dep of task.dependencies) {
        const depTime = taskTimes.get(dep) || 0;
        startTime = Math.max(startTime, depTime);
      }
      
      taskTimes.set(task.id, startTime + task.timeoutMs);
    }
    
    return Math.max(...Array.from(taskTimes.values()), 0);
  }

  /**
   * Checks if tasks can be parallelized
   */
  canParallelize(tasks: Task[]): boolean {
    const independentTasks = tasks.filter(t => t.dependencies.length === 0);
    return independentTasks.length > 1;
  }

  /**
   * Groups tasks that can run in parallel
   */
  getParallelGroups(tasks: Task[]): Task[][] {
    const groups: Task[][] = [];
    const completed = new Set<string>();
    const remaining = [...tasks];
    
    while (remaining.length > 0) {
      const group = remaining.filter(task => 
        task.dependencies.every(dep => completed.has(dep))
      );
      
      if (group.length === 0) {
        console.warn('⚠️ Unable to schedule remaining tasks - possible circular dependency');
        break;
      }
      
      groups.push(group);
      group.forEach(task => {
        completed.add(task.id);
        const index = remaining.indexOf(task);
        if (index > -1) remaining.splice(index, 1);
      });
    }
    
    return groups;
  }
}