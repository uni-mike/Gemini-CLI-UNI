/**
 * Planner - Analyzes prompts and creates execution plans
 * Part of the orchestration Trio: Planner -> Executor -> Orchestrator
 */

import { EventEmitter } from 'events';
import { DeepSeekClient } from '../llm/deepseek-client.js';
import { globalRegistry } from '../tools/registry.js';
import { Tool } from '../tools/base.js';

export interface Task {
  id: string;
  description: string;
  type: 'simple' | 'tool' | 'multi-step';
  tools?: string[];
  arguments?: Record<string, any>; // AI-provided arguments for each tool
  dependencies?: string[];
  priority: number;
}

export interface TaskPlan {
  id: string;
  originalPrompt: string;
  tasks: Task[];
  complexity: 'simple' | 'moderate' | 'complex';
  parallelizable: boolean;
}

export class Planner extends EventEmitter {
  private client: DeepSeekClient;
  
  constructor() {
    super();
    this.client = new DeepSeekClient();
  }

  async createPlan(prompt: string): Promise<TaskPlan> {
    this.emit('planning-start', { prompt });
    this.emit('status', '🤔 Analyzing request...');
    
    // Get available tools using the registry's new method
    const tools = globalRegistry.getTools();
    
    // Build detailed tool specifications DYNAMICALLY from tools!
    const toolSpecs = tools.map((tool: Tool) => {
      // Get parameter info dynamically from tool - all tools now have this method
      const paramInfo = tool.getParameterInfo();
      
      return `- ${tool.name}: ${tool.description}\n${paramInfo}`;
    }).filter(Boolean).join('\n');
    
    // Use LLM to create intelligent plan - DeepSeek R1 is smart enough to provide everything!
    const planPrompt = `You are an intelligent task planner using DeepSeek R1. Analyze this request and create a COMPLETE execution plan: "${prompt}"

Available tools with their EXACT parameter requirements:
${toolSpecs}

Provide a COMPLETE JSON plan with ACTUAL values, not placeholders:
{
  "complexity": "simple" | "moderate" | "complex",
  "tasks": [
    {
      "description": "Specific task description",
      "tools": ["actual_tool_name"],
      "type": "simple" | "tool" | "multi-step",
      "arguments": {
        "tool_name": {
          "actual_param": "actual_value"
        }
      }
    }
  ],
  "parallelizable": true | false
}

IMPORTANT: You are DeepSeek R1, a highly intelligent AI. Based on the user's request:
- Analyze what they want to achieve
- Select the appropriate tools from those available
- Generate COMPLETE arguments including full file contents when needed
- For scripts: Generate the ENTIRE working script based on the request
- For searches: Use specific, relevant queries
- For commands: Provide the exact command to execute

Examples of argument structure (but generate actual content based on request):
- file tool: {"action": "write", "path": "filename.ext", "content": "[COMPLETE FILE CONTENT]"}
- web tool: {"action": "search", "query": "[SPECIFIC SEARCH QUERY]"}
- bash tool: {"command": "[EXACT COMMAND TO RUN]"}

RULES:
- ALWAYS provide complete, actual values - NO placeholders like "value1" or "tool1"
- For file creation, provide COMPLETE file content based on the request
- For web searches, use specific, relevant search queries
- For bash commands, provide the exact command to run
- Multi-step tasks should be broken into separate tasks with proper dependencies
- Think step-by-step about what the user wants and provide ALL necessary details`;
    
    try {
      const response = await this.client.chat(
        [{ role: 'user', content: planPrompt }],
        [] // No tools for planning
      );
      
      // Parse LLM response
      const planData = this.parsePlanResponse(response);
      
      // Create tasks with IDs and preserve arguments from AI
      const tasks = planData.tasks.map((task: any, index: number) => ({
        id: `task_${Date.now()}_${index}`,
        description: task.description,
        type: task.type || 'simple',
        tools: task.tools || [],
        arguments: task.arguments || {}, // Preserve the AI-provided arguments!
        priority: index + 1
      }));
      
      // Identify dependencies
      this.identifyDependencies(tasks);
      
      const plan: TaskPlan = {
        id: `plan_${Date.now()}`,
        originalPrompt: prompt,
        tasks,
        complexity: planData.complexity || 'simple',
        parallelizable: planData.parallelizable || false
      };
      
      this.emit('status', `📋 Created plan with ${tasks.length} task${tasks.length !== 1 ? 's' : ''}`);
      this.emit('planning-complete', plan);
      return plan;
      
    } catch (error) {
      // Fallback to basic planning if LLM fails
      console.warn('LLM planning failed, using fallback:', error);
      return this.createBasicPlan(prompt);
    }
  }
  
  private parsePlanResponse(response: string): any {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/); 
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('Failed to parse plan JSON:', e);
    }
    
    // Return basic structure if parsing fails
    return {
      complexity: 'simple',
      tasks: [{ description: 'Process request', tools: [], type: 'simple' }],
      parallelizable: false
    };
  }
  
  private createBasicPlan(prompt: string): TaskPlan {
    // Fallback basic planning
    const complexity = this.analyzeComplexity(prompt);
    const tasks = this.decomposeTasks(prompt, complexity);
    this.identifyDependencies(tasks);
    
    return {
      id: `plan_${Date.now()}`,
      originalPrompt: prompt,
      tasks,
      complexity,
      parallelizable: this.canParallelize(tasks)
    };
  }

  private analyzeComplexity(prompt: string): 'simple' | 'moderate' | 'complex' {
    const wordCount = prompt.split(/\s+/).length;
    
    // Multi-step indicators
    const multiStepIndicators = [
      'then', 'after', 'next', 'finally', 'and then',
      'first', 'second', 'third', 'lastly'
    ];
    
    const hasMultipleSteps = multiStepIndicators.some(indicator => 
      prompt.toLowerCase().includes(indicator)
    );
    
    // Tool indicators
    const toolIndicators = [
      'create', 'write', 'read', 'execute', 'run',
      'search', 'fetch', 'modify', 'edit', 'check'
    ];
    
    const needsTools = toolIndicators.some(indicator => 
      prompt.toLowerCase().includes(indicator)
    );
    
    if (hasMultipleSteps || (needsTools && wordCount > 20)) {
      return 'complex';
    } else if (needsTools || wordCount > 15) {
      return 'moderate';
    }
    return 'simple';
  }

  private decomposeTasks(prompt: string, complexity: string): Task[] {
    const tasks: Task[] = [];
    
    // Simple response - no tools needed
    if (complexity === 'simple' && !this.needsTools(prompt)) {
      tasks.push({
        id: `task_${Date.now()}`,
        description: prompt,
        type: 'simple',
        priority: 1
      });
      return tasks;
    }
    
    // Extract individual operations from prompt
    const operations = this.extractOperations(prompt);
    
    operations.forEach((op, index) => {
      const tools = this.identifyRequiredTools(op);
      tasks.push({
        id: `task_${Date.now()}_${index}`,
        description: op,
        type: tools.length > 0 ? 'tool' : 'simple',
        tools,
        priority: index + 1
      });
    });
    
    // If no specific operations found, create single task
    if (tasks.length === 0) {
      const tools = this.identifyRequiredTools(prompt);
      tasks.push({
        id: `task_${Date.now()}`,
        description: prompt,
        type: tools.length > 0 ? 'tool' : 'simple',
        tools,
        priority: 1
      });
    }
    
    return tasks;
  }

  private extractOperations(prompt: string): string[] {
    const operations: string[] = [];
    
    // Split by common separators
    const separators = [
      ' then ',
      ' and then ',
      ', then ',
      '. Then ',
      ' after that ',
      ' next ',
      ' finally '
    ];
    
    let remaining = prompt;
    for (const sep of separators) {
      if (remaining.includes(sep)) {
        const parts = remaining.split(sep);
        if (parts.length > 1) {
          operations.push(parts[0]);
          remaining = parts.slice(1).join(sep);
        }
      }
    }
    
    // Add remaining part
    if (remaining && remaining.trim() !== prompt) {
      operations.push(remaining);
    }
    
    // If no splitting occurred, return original
    if (operations.length === 0) {
      return [prompt];
    }
    
    return operations;
  }

  private identifyRequiredTools(operation: string): string[] {
    // Basic tool identification based on keywords
    const tools: string[] = [];
    const op = operation.toLowerCase();
    
    // File operations
    if (op.includes('create') || op.includes('write') || op.includes('save')) {
      tools.push('file');
    }
    if (op.includes('read') || op.includes('open') || op.includes('load') || op.includes('list')) {
      tools.push('file');
    }
    
    // Shell operations
    if (op.includes('execute') || op.includes('run') || op.includes('command') || 
        op.includes('ls') || op.includes('npm') || op.includes('node')) {
      tools.push('bash');
    }
    
    // Edit operations
    if (op.includes('edit') || op.includes('modify') || op.includes('change') || 
        op.includes('update') || op.includes('replace')) {
      tools.push('edit');
    }
    
    // Search operations
    if (op.includes('search') || op.includes('find') || op.includes('grep')) {
      tools.push('grep');
    }
    
    // Web operations
    if (op.includes('web') || op.includes('internet') || op.includes('online') || 
        op.includes('fetch') || op.includes('download') || 
        op.includes('price') || op.includes('current') || op.includes('latest')) {
      tools.push('web');
    }
    
    // Git operations
    if (op.includes('git') || op.includes('commit') || op.includes('push') || 
        op.includes('pull') || op.includes('branch')) {
      tools.push('git');
    }
    
    return [...new Set(tools)]; // Remove duplicates
  }

  private needsTools(prompt: string): boolean {
    return this.identifyRequiredTools(prompt).length > 0;
  }

  private identifyDependencies(tasks: Task[]): void {
    // Simple dependency detection - tasks depend on previous tasks
    for (let i = 1; i < tasks.length; i++) {
      const currentTask = tasks[i];
      const previousTask = tasks[i - 1];
      
      // If current task mentions result/output/it, depends on previous
      if (currentTask.description.toLowerCase().includes('it') ||
          currentTask.description.toLowerCase().includes('result') ||
          currentTask.description.toLowerCase().includes('output')) {
        currentTask.dependencies = [previousTask.id];
      }
    }
  }

  private canParallelize(tasks: Task[]): boolean {
    // Can parallelize if no dependencies
    return tasks.every(task => !task.dependencies || task.dependencies.length === 0);
  }
}