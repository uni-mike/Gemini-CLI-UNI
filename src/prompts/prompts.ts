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
    // Build detailed tool list with parameter schemas
    let toolSection = '';
    if (availableTools && availableTools.length > 0) {
      const toolDetails = availableTools.map(t => {
        const params = t.parameterSchema || [];
        const paramList = params.map(p =>
          `    - ${p.name} (${p.type}${p.required ? ', required' : ', optional'}): ${p.description || 'No description'}`
        ).join('\n');

        return `- ${t.name}: ${t.description}\n${paramList.length > 0 ? paramList : '    No parameters'}`;
      }).join('\n\n');

      toolSection = `\nAvailable tools with parameter schemas:\n${toolDetails}\n`;
    }

    return `REQUEST: "${request}"
${toolSection}
CRITICAL: You must decompose complex tasks into ATOMIC steps. Each task must be completable independently.

ANALYZE FIRST:
1. Is this a simple question? → {"type":"conversation","response":"[answer]"}
2. Is this a design/documentation request? → Create design documents with JSON structure below
3. Is this an implementation task? → Break into atomic steps below

For ALL tasks (design OR implementation), output JSON in this format:
{"type":"tasks","plan":[
  {"id":"step1","description":"ONE atomic action","tool":"write_file","file_path":"[exact path]","content":"[file content]","success_criteria":"[what constitutes success]"},
  {"id":"step2","description":"ONE atomic action","tool":"bash","command":"[single command]","success_criteria":"[what output to expect]"},
  {"id":"step3","description":"ONE atomic action","tool":"web","action":"search","query":"[specific search]","success_criteria":"[what constitutes success]"}
]}

CRITICAL TOOL USAGE RULES:
- Use "write_file" tool for creating files (NOT "file")
- Use exact parameter names from tool schemas
- For write_file: use "file_path" and "content" parameters
- For bash: use "command" parameter
- Always provide exact file paths including directories
- Always specify exact content for files when known

FILE EXISTENCE VALIDATION (CRITICAL):
- NEVER assume files exist from memory/context
- ALWAYS use "ls" or "glob" to check files exist BEFORE reading them
- Use "glob" with patterns like "*.txt" to find files by extension
- Use "ls" with specific paths to verify directory contents
- Only use "read_file" AFTER confirming file exists via ls/glob
- Example sequence: ls → confirm file exists → read_file

BASH COMMAND RULES (CRITICAL):
- For local scripts, use "./script.sh" NOT "which script.sh" or "command -v script.sh"
- Never use "which" or "command -v" to find local files - these are for system commands only
- To check if a local file exists, use "ls -la filename" or "test -f filename"
- To run a local script: "./scriptname.sh" or "bash scriptname.sh"
- Always use relative paths (./) or absolute paths for local files

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
✓ File existence verified with ls/glob BEFORE read_file
✓ No assumption about existing files/directories from memory
✓ Recovery actions for likely failures

CRITICAL OUTPUT REQUIREMENTS:
- Return ONLY valid JSON, no explanations or markdown or Mermaid diagrams
- No code blocks with backticks
- No text before or after JSON
- Ensure all quotes are properly escaped
- Must be parseable by JSON.parse()
- If including diagrams in file content, escape them properly as strings within JSON
- Example: {\"type\":\"tasks\",\"plan\":[{\"id\":\"doc1\",\"tool\":\"write_file\",\"file_path\":\"design.md\",\"content\":\"# Design\\n\\n\`\`\`mermaid\\ngraph TD...\"}]}

Output valid JSON only:`;
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

Options: bash, edit, file, git, glob, grep, ls, memory-retrieval, read_file, rip-grep, smart-edit, tree, web, write_file
Answer with one word:`;
  }

  // EMERGENCY DECOMPOSITION METHOD REMOVED!
  // DO NOT ADD emergencyDecomposition() OR ANY HARDCODED TASK DECOMPOSITION!
  //
  // All task decomposition must go through AI models (DeepSeek, etc.).
  // If AI fails, the orchestrator should retry with different prompts or models,
  // never fall back to hardcoded rule-based decomposition.
  //
  // This ensures all content and task planning remains AI-driven and adaptive.
}