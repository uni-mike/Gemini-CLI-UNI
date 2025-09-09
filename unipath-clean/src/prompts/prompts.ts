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
    return `Analyze this request: "${request}"

If this is a casual conversation, greeting, or simple question (like "hello", "how are you", "thanks", etc.), respond with:
{
  "type": "conversation",
  "response": "Your natural response here"
}

If this is a development/coding task, break it into multiple specific tasks:
{
  "type": "tasks",
  "tasks": [
    {
      "description": "Create package.json with dependencies",
      "type": "file",
      "tools": ["file"],
      "filename": "package.json",
      "content": "{\n  \"name\": \"project\",\n  \"version\": \"1.0.0\",\n  \"dependencies\": {}\n}"
    },
    {
      "description": "Install npm packages", 
      "type": "command",
      "tools": ["bash"],
      "command": "npm install"
    }
  ]
}

IMPORTANT: For file tasks, include the complete file content. For command tasks, include the exact command.
Each task should be atomic - create ONE file OR run ONE command. Break development requests into 5-10 tasks.`;
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