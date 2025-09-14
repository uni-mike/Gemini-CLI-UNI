/**
 * Centralized prompt management for UNIPATH CLI
 * Contains all LLM prompts used throughout the system
 */

export class PromptTemplates {
  /**
   * Task decomposition prompt - structured JSON with enhanced cleaning
   * Uses forced JSON response format with temperature 0 for consistency
   * Now includes available tools dynamically from registry
   */
  static taskDecomposition(request: string, availableTools?: any[]): string {
    // Build tool list dynamically if provided
    let toolSection = '';
    if (availableTools && availableTools.length > 0) {
      const toolList = availableTools.map(t => `- ${t.name}: ${t.description}`).join('\n');
      toolSection = `\nAvailable tools:\n${toolList}\n`;
    }

    return `REQUEST: "${request}"
${toolSection}
CRITICAL: You must decompose complex tasks into ATOMIC steps. Each task must be completable independently.

ANALYZE FIRST:
1. Is this a simple question? → {"type":"conversation","response":"[answer]"}
2. Is this a development task? → Break into atomic steps below

For development tasks, output:
{"type":"tasks","plan":[
  {"id":"step1","description":"ONE atomic action","tool":"web","action":"search","query":"[specific search]","success_criteria":"[what constitutes success]"},
  {"id":"step2","description":"ONE atomic action","tool":"bash","action":"run","command":"[single command]","success_criteria":"[what output to expect]"},
  {"id":"step3","description":"ONE atomic action","tool":"file","action":"write","filename":"[exact path]","success_criteria":"[file exists with expected content]"}
]}

ATOMIC TASK RULES (CRITICAL):
- Maximum 5-8 steps total
- Each step = ONE tool + ONE action
- No compound actions (e.g., "create and configure" = 2 steps)
- Each step must have clear success criteria
- Steps must be executable in sequence
- Include error recovery: "If step X fails, do Y"
- Web searches FIRST for any research needed
- Package.json creation BEFORE running npm commands
- Directory creation BEFORE file creation in subdirs

VALIDATION CHECKLIST:
✓ Each task uses exactly ONE tool
✓ Each task has clear success/failure criteria
✓ Prerequisites handled in earlier steps
✓ No assumption about existing files/directories
✓ Recovery actions for likely failures

Output pure JSON only.`;
  }

  /**
   * Simple file creation prompt
   */
  static createFile(description: string, filename: string): string {
    return `Create ${filename} for: ${description}
    
Return only the file content, no explanations:`;
  }

  /**
   * Task-to-tool mapping prompt
   */
  static identifyTools(taskDescription: string): string {
    return `What tool is needed for: "${taskDescription}"?

Options: file, bash, web, edit, git
Answer with one word:`;
  }

  /**
   * Emergency fallback for when JSON parsing fails completely
   */
  static emergencyDecomposition(request: string): string[] {
    // Basic rule-based decomposition as absolute fallback
    if (request.toLowerCase().includes('express') && request.toLowerCase().includes('api')) {
      return [
        'Create package.json with Express dependencies',
        'Create main server.js file',
        'Create authentication middleware',
        'Create user routes file',
        'Create environment configuration',
        'Install required npm packages'
      ];
    }
    
    if (request.toLowerCase().includes('create') && request.toLowerCase().includes('calculator')) {
      return [
        'Create package.json file',
        'Create calculator.js with math functions',
        'Create test file for calculator',
        'Create README documentation'
      ];
    }

    // Generic fallback
    return [
      `Analyze the request: ${request}`,
      `Create the main implementation`,
      `Test the implementation`,
      `Document the solution`
    ];
  }
}