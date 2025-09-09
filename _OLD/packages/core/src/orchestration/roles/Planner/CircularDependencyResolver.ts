import type { Task } from '../../types.js';

export class CircularDependencyResolver {
  /**
   * Advanced circular dependency resolution using topological sorting with cycle breaking
   */
  resolveCircularDependencies(tasks: Task[]): Task[] {
    const graph = this.buildDependencyGraph(tasks);
    const cycles = this.detectCycles(graph);
    
    if (cycles.length > 0) {
      console.warn(`⚠️ Detected ${cycles.length} circular dependencies, resolving...`);
      return this.breakCycles(tasks, cycles);
    }
    
    return tasks;
  }

  private buildDependencyGraph(tasks: Task[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    tasks.forEach(task => {
      graph.set(task.id, task.dependencies);
    });
    
    return graph;
  }

  private detectCycles(graph: Map<string, string[]>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const currentPath: string[] = [];

    const dfs = (node: string): boolean => {
      if (recursionStack.has(node)) {
        // Found cycle - extract it from current path
        const cycleStart = currentPath.indexOf(node);
        if (cycleStart !== -1) {
          cycles.push([...currentPath.slice(cycleStart), node]);
        }
        return true;
      }

      if (visited.has(node)) {
        return false;
      }

      visited.add(node);
      recursionStack.add(node);
      currentPath.push(node);

      const dependencies = graph.get(node) || [];
      for (const dep of dependencies) {
        if (dfs(dep)) {
          return true;
        }
      }

      recursionStack.delete(node);
      currentPath.pop();
      return false;
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }

  private breakCycles(tasks: Task[], cycles: string[][]): Task[] {
    const tasksMap = new Map(tasks.map(t => [t.id, t]));
    
    // Strategy: Remove the "least critical" dependency from each cycle
    cycles.forEach(cycle => {
      const breakPoint = this.findOptimalBreakPoint(cycle, tasksMap);
      if (breakPoint) {
        const { taskId, dependencyToRemove } = breakPoint;
        const task = tasksMap.get(taskId);
        if (task) {
          task.dependencies = task.dependencies.filter(dep => dep !== dependencyToRemove);
          console.log(`🔧 Broke circular dependency: ${taskId} no longer depends on ${dependencyToRemove}`);
        }
      }
    });

    return tasks;
  }

  private findOptimalBreakPoint(cycle: string[], tasksMap: Map<string, Task>): { taskId: string, dependencyToRemove: string } | null {
    // Find the dependency that causes least impact when removed
    for (let i = 0; i < cycle.length - 1; i++) {
      const currentTask = cycle[i];
      const nextTask = cycle[i + 1];
      
      const task = tasksMap.get(currentTask);
      if (task && task.dependencies.includes(nextTask)) {
        // Prefer breaking dependencies on tasks with more alternatives
        const alternativeDeps = task.dependencies.filter(dep => dep !== nextTask);
        if (alternativeDeps.length > 0) {
          return { taskId: currentTask, dependencyToRemove: nextTask };
        }
      }
    }
    
    // Fallback: remove the first dependency in the cycle
    if (cycle.length >= 2) {
      return { taskId: cycle[0], dependencyToRemove: cycle[1] };
    }
    
    return null;
  }
}