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
IMPORTANT: Return ONLY valid JSON. No explanations, no thinking, no markdown.

For conversations/questions, output:
{"type":"conversation","response":"[direct answer]"}

For coding/development tasks, output:
{"type":"tasks","tasks":[{"description":"[task]","type":"[web|file|command]","tools":["[tool-name]"],"action":"[search|write|run]","filename":"[file.ext]","content":"[complete code]"}]}

Rules:
- Split into 3-8 atomic tasks maximum
- Each task = ONE action only
- Include COMPLETE file content in "content" field
- Use exact tool names from available tools list
- Output pure JSON only`;
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