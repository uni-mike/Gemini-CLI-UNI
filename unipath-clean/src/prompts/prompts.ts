/**
 * Centralized prompt management for UNIPATH CLI
 * Contains all LLM prompts used throughout the system
 */

export class PromptTemplates {
  /**
   * Task decomposition prompt - structured JSON with enhanced cleaning
   * Uses forced JSON response format with temperature 0 for consistency
   */
  static taskDecomposition(request: string): string {
    return `Analyze this request and create a JSON execution plan: "${request}"

For casual conversation (greetings, thanks, simple questions), return:
{
  "type": "conversation",
  "response": "[your response]"
}

For development/coding tasks, return:
{
  "type": "tasks", 
  "tasks": [
    {
      "description": "[what this task does]",
      "type": "[web|file|command]",
      "tools": ["[tool-name]"],
      "action": "[search|write|run]",
      "query": "[search terms]", // for web tasks only
      "filename": "[file.ext]", // for file tasks only
      "content": "[complete file content]", // for file tasks only
      "command": "[exact command]" // for command tasks only
    }
  ]
}

Requirements:
- Break complex requests into 3-8 atomic tasks
- Use web search for current information (prices, latest docs, trends)
- Include complete file content for file creation tasks
- Each task does ONE thing: search web OR create file OR run command
- Response must be valid JSON only`;
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