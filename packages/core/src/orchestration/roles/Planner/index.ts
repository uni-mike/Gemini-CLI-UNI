import { Task, TaskPlan } from '../../types';
import { TaskAnalyzer } from './TaskAnalyzer';
import { TaskDecomposer } from './TaskDecomposer';
import { TaskOptimizer } from './TaskOptimizer';
import { v4 as uuidv4 } from 'uuid';

export class Planner {
  private analyzer: TaskAnalyzer;
  private decomposer: TaskDecomposer;
  private optimizer: TaskOptimizer;

  constructor() {
    this.analyzer = new TaskAnalyzer();
    this.decomposer = new TaskDecomposer();
    this.optimizer = new TaskOptimizer();
  }

  async createPlan(prompt: string): Promise<TaskPlan> {
    console.log('📝 Planner: Analyzing prompt for task decomposition');
    
    // Step 1: Analyze complexity
    const complexity = this.analyzer.analyzeComplexity(prompt);
    
    // Step 2: Decompose into tasks
    const tasks = this.decomposer.decompose(prompt, complexity);
    
    // Step 3: Identify dependencies
    this.analyzer.identifyDependencies(tasks);
    
    // Step 4: Optimize execution order
    const optimizedTasks = this.optimizer.optimizeTaskOrder(tasks);
    
    // Step 5: Calculate time estimates
    const totalTime = this.optimizer.estimateTotalTime(optimizedTasks);
    
    const plan: TaskPlan = {
      id: uuidv4(),
      originalPrompt: prompt,
      tasks: optimizedTasks,
      totalEstimatedTime: totalTime,
      complexity,
      parallelizable: this.optimizer.canParallelize(optimizedTasks)
    };

    console.log(`📋 Plan created: ${tasks.length} tasks, complexity: ${complexity}`);
    return plan;
  }
}