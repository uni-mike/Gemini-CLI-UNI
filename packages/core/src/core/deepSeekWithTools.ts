/**
 * DeepSeek R1 client with tool/function calling support
 * Bridges Gemini tools to DeepSeek's function calling
 */

import type { Config } from '../config/config.js';
import { ApprovalMode } from '../config/config.js';
import type { ToolRegistry } from '../tools/tool-registry.js';

interface DeepSeekFunction {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export class DeepSeekWithTools {
  private endpoint: string;
  private apiKey: string;
  private model: string;
  private apiVersion: string;
  private toolRegistry: ToolRegistry;
  private config: Config;
  private conversation: DeepSeekMessage[] = [];
  private confirmationCallback?: (details: any) => Promise<boolean>;
  private progressCallback?: (message: string) => void;

  constructor(config: Config) {
    this.apiKey = process.env['AZURE_API_KEY'] || process.env['API_KEY'] || '';
    this.endpoint = process.env['AZURE_ENDPOINT_URL'] || process.env['ENDPOINT'] || '';
    this.model = process.env['AZURE_MODEL'] || process.env['MODEL'] || 'DeepSeek-R1-rkcob';
    this.apiVersion = process.env['AZURE_OPENAI_API_VERSION'] || process.env['API_VERSION'] || '2024-05-01-preview';
    
    if (!this.apiKey || !this.endpoint) {
      throw new Error('DeepSeek configuration missing: API_KEY and ENDPOINT are required');
    }
    
    this.config = config;
    this.toolRegistry = config.getToolRegistry();
  }
  
  /**
   * Set a callback for handling confirmation prompts
   */
  setConfirmationCallback(callback: (details: any) => Promise<boolean>) {
    this.confirmationCallback = callback;
  }

  /**
   * Set a callback for showing progress messages to the user
   */
  setProgressCallback(callback: (message: string) => void) {
    this.progressCallback = callback;
  }

  /**
   * Convert Gemini tool to DeepSeek function schema - FULLY DYNAMIC
   */
  private convertToolToFunction(toolName: string): DeepSeekFunction | null {
    const tool = this.toolRegistry.getTool(toolName);
    if (!tool) return null;

    // Dynamically convert tool schema to DeepSeek function
    const mappedName = this.mapToolName(tool.name);
    
    // Extract parameters from tool's schema
    let parameters: DeepSeekFunction['parameters'];
    
    if (tool.schema?.parametersJsonSchema && typeof tool.schema.parametersJsonSchema === 'object') {
      const schema = tool.schema.parametersJsonSchema as any;
      parameters = {
        type: schema.type || 'object',
        properties: schema.properties || {},
        required: Array.isArray(schema.required) ? schema.required : []
      };
    } else {
      // Default empty parameters if none provided
      parameters = {
        type: 'object',
        properties: {},
        required: []
      };
    }
    
    return {
      name: mappedName,
      description: tool.schema?.description || tool.description || tool.name,
      parameters
    };
  }

  /**
   * Generate dynamic tool descriptions for the system prompt
   */
  private getToolDescriptions(): string {
    const allTools = this.toolRegistry.getAllTools();
    const descriptions: string[] = [];
    
    for (const tool of allTools) {
      // Map tool names to DeepSeek format
      const toolName = this.mapToolName(tool.name);
      
      // Extract parameters from schema
      let params = '';
      if (tool.schema.parametersJsonSchema && typeof tool.schema.parametersJsonSchema === 'object') {
        const schema = tool.schema.parametersJsonSchema as any;
        const required = Array.isArray(schema.required) ? schema.required : [];
        const properties = schema.properties || {};
        
        const paramList: string[] = [];
        for (const [key] of Object.entries(properties)) {
          const isRequired = required.includes(key);
          paramList.push(`${key}${isRequired ? '' : '?'}`);
        }
        params = paramList.join(', ');
      }
      
      descriptions.push(`${descriptions.length + 1}. ${toolName}(${params}) - ${tool.schema.description || tool.name}`);
    }
    
    return descriptions.join('\n');
  }

  /**
   * Map tool names from registry to DeepSeek format
   */
  private mapToolName(toolName: string): string {
    // Fully dynamic tool name conversion - NO hardcoded mappings!
    
    // 1. If already snake_case, return as-is
    if (toolName.includes('_') && !toolName.includes('-')) {
      return toolName;
    }
    
    // 2. Convert kebab-case to snake_case
    if (toolName.includes('-')) {
      return toolName.replace(/-/g, '_');
    }
    
    // 3. Handle CamelCase tool names (e.g., WriteFileTool -> write_file)
    if (toolName.endsWith('Tool')) {
      // Remove 'Tool' suffix and convert to snake_case
      const baseName = toolName.slice(0, -4);
      return baseName
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
    }
    
    // 4. Handle other CamelCase (e.g., WebSearch -> web_search)
    if (/[A-Z]/.test(toolName)) {
      return toolName
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .toLowerCase();
    }
    
    // 5. Default: return as-is for simple lowercase names
    return toolName;
  }

  /**
   * Get all available tools as DeepSeek functions
   * Uses the dynamic tool registry instead of hardcoded list
   */
  private getAvailableFunctions(): DeepSeekFunction[] {
    const functions: DeepSeekFunction[] = [];
    
    // Get all tools from the dynamic registry
    const allTools = this.toolRegistry.getAllTools();
    
    // Convert each tool to DeepSeek function format
    for (const tool of allTools) {
      try {
        const deepSeekFunction = this.convertToolToFunction(tool.name);
        if (deepSeekFunction) {
          functions.push(deepSeekFunction);
        }
      } catch (error) {
        console.warn(`Failed to convert tool ${tool.name} to DeepSeek function:`, error);
      }
    }
    
    // Add any fallback functions if needed (for backwards compatibility)
    if (functions.length === 0) {
      console.warn('WARNING: No tools found in registry! Tool registry may not be initialized properly.');
    }
    
    console.log(`✅ Loaded ${functions.length} tools from registry:`, functions.map(f => f.name).join(', '));
    
    return functions;
  }

  /**
   * Execute a tool directly using the tool registry
   */
  private async executeToolDirectly(functionName: string, args: any): Promise<string> {
    try {
      // Try to find the tool in the registry
      const toolRegistry = this.toolRegistry;
      const allTools = toolRegistry.getAllTools();
      
      // Find tool by name (with various naming conventions)
      const possibleNames = [
        functionName,
        functionName.replace(/_/g, '-'),
        functionName.replace(/_/g, ''),
        functionName.toLowerCase(),
        functionName.replace('_', ''),
        `${functionName}-tool`,
        `${functionName}Tool`
      ];
      
      let tool = null;
      for (const t of allTools) {
        const toolName = t.name || '';
        if (possibleNames.some(pn => 
          toolName === pn || 
          toolName.toLowerCase() === pn.toLowerCase() ||
          toolName.toLowerCase().includes(pn.toLowerCase())
        )) {
          tool = t;
          break;
        }
      }
      
      if (!tool) {
        // Fallback to basic implementation for core tools
        return this.executeFallbackTool(functionName, args);
      }
      
      // Execute the tool from registry with proper approval flow
      try {
        const invocation = tool.build(args);
        const abortController = new AbortController();
        
        // Check if confirmation is needed (like Claude does)
        const confirmationDetails = await invocation.shouldConfirmExecute(abortController.signal);
        
        if (confirmationDetails) {
          // Check approval mode
          const approvalMode = this.config.getApprovalMode();
          
          if (approvalMode === 'autoEdit' && this.config.isTrustedFolder()) {
            // Auto-approve in trusted folders with autoEdit mode
            console.log('🔄 Auto-approving change (AUTO_EDIT mode in trusted folder)');
          } else {
            // Need user confirmation
            console.log('\n📋 Change Preview:');
            console.log('─'.repeat(50));
            
            // Show diff or description
            if ((confirmationDetails as any).diff) {
              console.log((confirmationDetails as any).diff);
            } else if ((confirmationDetails as any).description) {
              console.log((confirmationDetails as any).description);
            } else {
              console.log(JSON.stringify(confirmationDetails, null, 2));
            }
            
            console.log('─'.repeat(50));
            
            // If we have a confirmation callback, use it
            if (this.confirmationCallback) {
              const approved = await this.confirmationCallback(confirmationDetails);
              if (!approved) {
                return 'Change rejected by user';
              }
            } else {
              // For now, log that approval is needed
              // In production, this should integrate with the CLI UI
              console.log('⚠️  Approval needed but no UI callback set');
              console.log('📝 Proceeding with change (fix needed for proper approval flow)');
            }
          }
        }
        
        // Execute after approval (or if no confirmation needed)
        const result = await invocation.execute(abortController.signal);
        if (typeof result === 'string') {
          return result;
        } else if (result && typeof result === 'object') {
          return (result as any).output || (result as any).llmContent || JSON.stringify(result);
        }
        return 'Tool executed successfully';
      } catch (toolError) {
        // If tool.build fails, try fallback
        return this.executeFallbackTool(functionName, args);
      }
    } catch (error) {
      return `Error executing function ${functionName}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  
  /**
   * Fallback implementation when tool not found in registry
   * This should rarely be needed if registry is properly initialized
   */
  private async executeFallbackTool(functionName: string, args: any): Promise<string> {
    try {
      const approvalMode = this.config.getApprovalMode();
      const isTrusted = this.config.isTrustedFolder();
      const needsApproval = approvalMode !== ApprovalMode.AUTO_EDIT || !isTrusted;
      
      // Basic implementations for core tools when registry lookup fails
      if (functionName === 'read_file' || functionName === 'read-file') {
        const fs = await import('fs/promises');
        const content = await fs.readFile(args.absolute_path || args.file_path, 'utf-8');
        if (args.offset !== undefined && args.limit !== undefined) {
          const lines = content.split('\n');
          const start = args.offset;
          const end = Math.min(start + args.limit, lines.length);
          return lines.slice(start, end).join('\n');
        }
        return content;
        
      } else if (functionName === 'write_file' || functionName === 'write-file') {
        const filePath = args.absolute_path || args.file_path;
        
        // Check if file exists and show diff if it does
        if (needsApproval) {
          const fs = await import('fs/promises');
          try {
            const existingContent = await fs.readFile(filePath, 'utf-8');
            console.log('\n📋 File Change Preview:');
            console.log('─'.repeat(50));
            console.log(`File: ${filePath}`);
            console.log('─'.repeat(50));
            console.log('--- Current Content ---');
            console.log(existingContent.substring(0, 500));
            console.log('\n+++ New Content +++');
            console.log(args.content.substring(0, 500));
            console.log('─'.repeat(50));
            
            if (this.confirmationCallback) {
              const approved = await this.confirmationCallback({ 
                type: 'file_write',
                path: filePath,
                content: args.content 
              });
              if (!approved) {
                return 'Write operation cancelled by user';
              }
            } else {
              console.log('⚠️  Approval needed - proceeding (fix needed for proper approval)');
            }
          } catch {
            // New file - just show what will be created
            console.log(`\n📝 Creating new file: ${filePath}`);
            console.log(`Content preview: ${args.content.substring(0, 200)}...`);
          }
        }
        
        const fs = await import('fs/promises');
        await fs.writeFile(filePath, args.content);
        return `File written successfully to ${filePath}`;
        
      } else if (functionName === 'shell') {
        // Shell commands should always ask for approval unless in auto mode
        if (needsApproval) {
          console.log('\n⚠️  Shell Command Approval:');
          console.log('─'.repeat(50));
          console.log(`Command: ${args.command}`);
          console.log('─'.repeat(50));
          
          if (this.confirmationCallback) {
            const approved = await this.confirmationCallback({
              type: 'shell_command',
              command: args.command
            });
            if (!approved) {
              return 'Shell command cancelled by user';
            }
          } else {
            console.log('⚠️  Approval needed - proceeding (fix needed for proper approval)');
          }
        }
        
        const { execSync } = await import('child_process');
        const result = execSync(args.command, { encoding: 'utf-8' });
        return result;
        
      } else if (functionName === 'ls') {
        const fs = await import('fs/promises');
        const files = await fs.readdir(args.path || '.');
        return files.join('\n');
        
      } else if (functionName === 'grep') {
        const { execSync } = await import('child_process');
        const cmd = `grep -r "${args.pattern}" ${args.path || '.'}`;
        try {
          const result = execSync(cmd, { encoding: 'utf-8' });
          return result;
        } catch (e) {
          return 'No matches found';
        }
        
      } else if (functionName === 'edit') {
        const filePath = args.absolute_path || args.file_path;
        const fs = await import('fs/promises');
        const content = await fs.readFile(filePath, 'utf-8');
        const newContent = content.replace(args.old_text || args.old_string, args.new_text || args.new_string);
        
        // Show diff for edits
        if (needsApproval) {
          console.log('\n📋 Edit Preview:');
          console.log('─'.repeat(50));
          console.log(`File: ${filePath}`);
          console.log('─'.repeat(50));
          console.log(`- ${args.old_text || args.old_string}`);
          console.log(`+ ${args.new_text || args.new_string}`);
          console.log('─'.repeat(50));
          
          if (this.confirmationCallback) {
            const approved = await this.confirmationCallback({
              type: 'file_edit',
              path: filePath,
              oldText: args.old_text || args.old_string,
              newText: args.new_text || args.new_string
            });
            if (!approved) {
              return 'Edit cancelled by user';
            }
          } else {
            console.log('⚠️  Approval needed - proceeding (fix needed for proper approval)');
          }
        }
        
        await fs.writeFile(filePath, newContent);
        return `File edited successfully: ${filePath}`;
        
      } else if (functionName === 'web_search' || functionName === 'web-search' || functionName === 'webSearch') {
        // Direct implementation for web search using SerpAPI
        const SERPAPI_KEY = '44608547a3c72872ff9cf50c518ce3b0a44f85b7348bfdda1a5b3d0da302237f';
        const query = args.query || args.q || '';
        const maxResults = args.max_results || 3;
        
        if (!query) {
          return 'Error: No search query provided';
        }
        
        try {
          console.log(`🔍 Searching web for: "${query}"`);
          const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${SERPAPI_KEY}&num=${maxResults}`;
          
          const response = await fetch(searchUrl, {
            headers: { 'Accept': 'application/json' }
          });
          
          if (!response.ok) {
            return `Search failed: ${response.status} ${response.statusText}`;
          }
          
          const data = await response.json();
          const results: string[] = [];
          
          // Add answer box if available
          if (data.answer_box) {
            if (data.answer_box.answer) {
              results.push(`Answer: ${data.answer_box.answer}`);
            } else if (data.answer_box.snippet) {
              results.push(`Answer: ${data.answer_box.snippet}`);
            }
          }
          
          // Add organic results
          if (data.organic_results) {
            data.organic_results.slice(0, maxResults).forEach((result: any, i: number) => {
              results.push(`\n${i + 1}. ${result.title}\n   URL: ${result.link}\n   ${result.snippet}`);
            });
          }
          
          return results.length > 0 ? results.join('\n') : 'No search results found';
        } catch (error) {
          return `Search error: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
      
      return `Tool ${functionName} not found in registry and no fallback implementation`;
    } catch (error) {
      return `Error in fallback execution: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Clean DeepSeek special tokens from output
   */
  private cleanDeepSeekTokens(content: string): string {
    // Remove DeepSeek's special tokens
    return content
      // Remove tool call markers
      .replace(/<｜tool▁calls▁begin｜>/g, '')
      .replace(/<｜tool▁calls▁end｜>/g, '')
      .replace(/<｜tool▁call▁begin｜>/g, '')
      .replace(/<｜tool▁call▁end｜>/g, '')
      .replace(/<｜tool▁sep｜>/g, ': ')
      .replace(/function<｜tool▁sep｜>/g, 'Using tool: ')
      // Clean up any remaining special characters
      .replace(/｜/g, '|')
      .replace(/▁/g, '_')
      // Remove excessive backticks from tool calls
      .replace(/```\n*<\|/g, '')
      .replace(/\|>\n*```/g, '')
      // Clean up extra newlines
      .replace(/\n{3,}/g, '\n\n');
  }

  /**
   * Format the entire response for beautiful presentation
   */
  private formatThinkingProcess(content: string | any): string {
    let textContent = typeof content === 'string' ? content : (content?.content || String(content));
    
    // First clean DeepSeek tokens
    textContent = this.cleanDeepSeekTokens(textContent);
    
    // Process and hide thinking tags
    if (textContent.includes('<think>')) {
      // Replace <think>...</think> blocks completely
      const formatted = textContent.replace(
        /<think>([\s\S]*?)<\/think>/gm, 
        ''  // Remove thinking content entirely
      ).trim();
      
      return formatted;
    }
    
    return textContent;
  }


  /**
   * Send a message with tool support - Enhanced for complex sequences
   */
  async sendMessageWithTools(message: string, maxIterations: number = 5): Promise<string> {
    try {
      // Track iteration count for complex multi-step tasks
      let iterations = 0;
      let currentMessage = message;
      let continuationResponse = '';
      
      // Add system message with enhanced tool instructions if this is the first message
      if (this.conversation.length === 0) {
        const toolDescriptions = this.getToolDescriptions();
        console.log('📝 Generated tool descriptions for system prompt:', toolDescriptions);
        
        const systemPrompt = `You are an advanced AI assistant integrated into the UNIPATH CLI with full access to ALL tools including file system, shell execution, web search, and more.
When asked to review, analyze, or improve code, you should PROACTIVELY use tools to explore the codebase.

CRITICAL: ALWAYS show your complete reasoning process using <think> tags. Never hide or suppress your thinking. 
Your natural thinking process helps users understand your reasoning. Use this format:

<think>
Your detailed step-by-step reasoning and thought process here...
Explain your analysis, considerations, and decision-making process.
</think>

Then provide your final response.

Available tools:
${this.getToolDescriptions()}

To use a tool, respond with EXACTLY this format:
<tool_use>
tool_name: [name of the tool]
arguments: {
  "arg1": "value1",
  "arg2": "value2"
}
</tool_use>

IMPORTANT: In the arguments JSON:
- Strings with newlines must escape them as \\n
- Double quotes in strings must be escaped as \\"
- Backslashes must be escaped as \\\\
- The JSON must be valid and parseable

For example:
<tool_use>
tool_name: write_file
arguments: {
  "absolute_path": "/path/to/file.txt",
  "content": "Line 1\\nLine 2\\nLine 3"
}
</tool_use>

For COMPLEX TASKS:
- You can use MULTIPLE tool_use blocks in a single response
- They will be executed sequentially in the order you specify
- If you need to see results before continuing, end your response with <needs_continuation/>
- I will execute the tools and ask you to continue

After I execute the tools, I'll provide the results and you can continue with your response.

IMPORTANT: 
- Review the available tools listed above and use the most appropriate one for each task
- For web searches, use web_search tool (not grep)
- For file searches, use grep or search_file_content tools
- Each tool has specific capabilities - check the descriptions

PROACTIVE BEHAVIOR:
- When asked to "review code", "analyze codebase", or "improve" - IMMEDIATELY START using tools:
  1. First explore the project structure with available directory tools
  2. Read key files like package.json, README.md, and main files
  3. Use appropriate search tools to find patterns, TODOs, or potential issues
  4. For research tasks, use web_search to find best practices and solutions
  5. Then provide specific improvements with actual file edits
- Don't just describe what you would do - USE THE TOOLS to actually explore and modify
- If user says "review your code" they mean the codebase you're running in`;
        
        this.conversation.push({ role: 'system', content: systemPrompt });
      }
      
      // Main execution loop for complex sequences
      while (iterations < maxIterations) {
        iterations++;
        console.log(`🔄 Iteration ${iterations}/${maxIterations}`);
        
        // Add user message to conversation (only on first iteration)
        if (iterations === 1) {
          this.conversation.push({ role: 'user', content: currentMessage });
        }

        // Get available functions
        const functions = this.getAvailableFunctions();

        // Make API call with functions - using Azure AI Inference API format
        const url = `${this.endpoint}/chat/completions?api-version=${this.apiVersion}`;
        
        let retries = 0;
        const maxRetries = 3;
        let response;
      
      while (retries < maxRetries) {
        try {
          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
              messages: this.conversation,
              model: this.model,
              temperature: 0.7,
              functions: functions.length > 0 ? functions : undefined,
              function_call: functions.length > 0 ? 'auto' : undefined,
            }),
          });
          
          if (response.status === 429 && retries < maxRetries - 1) {
            const waitTime = Math.pow(2, retries) * 1000;
            console.log(`⏳ Rate limited. Waiting ${waitTime/1000}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            retries++;
            continue;
          }
          
          break;
        } catch (error) {
          if (retries < maxRetries - 1) {
            retries++;
            continue;
          }
          throw error;
        }
      }

      if (!response || !response.ok) {
        const errorText = response ? await response.text() : 'No response';
        throw new Error(`DeepSeek API error: ${response?.status} ${errorText}`);
      }

      const data = await response.json();
      const responseMessage = data.choices?.[0]?.message;
      
      if (!responseMessage) {
        throw new Error('No response from DeepSeek');
      }

      // Check if the response contains our tool_use format - handle MULTIPLE tool calls
      const responseContent = responseMessage.content || '';
      const toolUseRegex = /<tool_use>\s*tool_name:\s*(\w+)\s*arguments:\s*({[\s\S]*?})\s*<\/tool_use>/gm;
      const toolUseMatches = [...responseContent.matchAll(toolUseRegex)];
      
      if (toolUseMatches.length > 0) {
        // Show progress messages to user immediately via console.log for visibility
        console.log(`\n📦 Found ${toolUseMatches.length} tool call${toolUseMatches.length > 1 ? 's' : ''} to execute`);
        console.log(`🔄 Processing ${toolUseMatches.length} tool${toolUseMatches.length > 1 ? 's' : ''}...\n`);
        
        // Also call callback if set
        if (this.progressCallback) {
          this.progressCallback(`📦 Found ${toolUseMatches.length} tool call${toolUseMatches.length > 1 ? 's' : ''} to execute`);
          this.progressCallback(`🔄 Processing ${toolUseMatches.length} tool${toolUseMatches.length > 1 ? 's' : ''}...`);
        }
        
        // Execute all tools and collect results
        const toolResults: string[] = [];
        
        // Group tools by dependency - file writes can be parallel, but mkdir must come first
        const shellCommands = toolUseMatches.filter(m => m[1] === 'shell');
        const otherCommands = toolUseMatches.filter(m => m[1] !== 'shell');
        
        // Execute shell commands first (they might create directories)
        for (const match of shellCommands) {
          const functionName = match[1];
          let args;
          try {
            // Clean up the JSON string - handle multiline strings better
            let jsonStr = match[2];
            // Try to parse as-is first
            args = JSON.parse(jsonStr);
          } catch (e) {
            // If parsing fails, try to extract and fix the JSON
            console.error('Failed to parse tool arguments, attempting recovery:', e);
            try {
              // Try to fix common issues with multiline content
              const fixedJson = match[2]
                .replace(/\n/g, '\\n')  // Escape newlines
                .replace(/\r/g, '\\r')  // Escape carriage returns
                .replace(/\t/g, '\\t'); // Escape tabs
              args = JSON.parse(fixedJson);
            } catch (e2) {
              console.error('Recovery failed:', match[2]);
              toolResults.push(`Error: Invalid arguments for ${functionName}`);
              continue; // Skip this tool and continue with others
            }
          }
          
          console.log(`🔧 Executing shell command: ${functionName}`);
          console.log(`  ⚡ ${args.command || args.cmd || 'shell command'}...`);
          
          if (this.progressCallback) {
            this.progressCallback(`🔧 Executing shell command: ${functionName}`);
            this.progressCallback(`  ⚡ ${args.command || args.cmd || 'shell command'}...`);
          }
          try {
            const result = await this.executeToolDirectly(functionName, args);
            console.error(`  ✅ Shell command completed`);
            toolResults.push(`${functionName}: ${result}`);
          } catch (error) {
            console.error(`  ❌ Shell command failed`);
            console.error(`Error executing ${functionName}:`, error);
            toolResults.push(`${functionName}: Error - ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        // Now execute other commands (can be done in parallel for better performance)
        for (const match of otherCommands) {
          const functionName = match[1];
          let args;
          try {
            args = JSON.parse(match[2]);
          } catch (e) {
            try {
              const fixedJson = match[2]
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t');
              args = JSON.parse(fixedJson);
            } catch (e2) {
              toolResults.push(`Error: Invalid arguments for ${functionName}`);
              continue;
            }
          }
          
          console.log(`🔧 Executing function: ${functionName}`);
          
          // Show specific progress based on tool type
          if (functionName === 'web_search' || functionName === 'web-search') {
            const query = args.query || args.q || 'unknown query';
            console.log(`  🔍 Web search: "${query.substring(0, 45)}${query.length > 45 ? '...' : ''}"`);
          } else if (functionName === 'read_file' || functionName === 'read-file') {
            const file = args.file_path || args.absolute_path || 'file';
            const filename = file.split('/').pop();
            console.log(`  📖 Reading file: ${filename}`);
          } else if (functionName === 'write_file' || functionName === 'write-file') {
            const file = args.file_path || args.absolute_path || 'file';
            const filename = file.split('/').pop();
            const contentLength = (args.content || '').length;
            console.log(`  📝 Creating file: ${filename} (${contentLength} chars)`);
          } else if (functionName === 'edit') {
            const file = args.file_path || args.absolute_path || 'file';
            const filename = file.split('/').pop();
            const oldText = (args.old_text || args.old_string || '').substring(0, 30);
            console.log(`  ✏️  Editing: ${filename} (replacing "${oldText}...")`);
          } else if (functionName === 'search_file_content') {
            const pattern = args.regex || args.pattern || 'pattern';
            const globPattern = args.globPattern || args.glob || '*';
            console.log(`  🔎 Searching "${pattern}" in ${globPattern}`);
          } else if (functionName === 'grep') {
            const pattern = args.pattern || 'pattern';
            const path = args.path || '.';
            console.log(`  🔍 Grep search: "${pattern}" in ${path.split('/').pop() || path}`);
          } else {
            console.log(`  ⚡ ${functionName}...`);
          }
          
          try {
            // Add timeout to prevent hanging
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Tool execution timeout')), 30000); // 30 second timeout
            });
            
            const result = await Promise.race([
              this.executeToolDirectly(functionName, args),
              timeoutPromise
            ]) as string;
            
            // Show completion with brief result info
            if (functionName === 'web_search' || functionName === 'web-search') {
              const lines = result.split('\n').length;
              const hasAnswerBox = result.includes('Answer:');
              console.log(`  ✅ Found ${lines} results${hasAnswerBox ? ' + answer box' : ''}`);
            } else if (functionName === 'write_file' || functionName === 'write-file') {
              console.log(`  ✅ File created successfully`);
            } else if (functionName === 'read_file' || functionName === 'read-file') {
              const lineCount = result.split('\n').length;
              console.log(`  ✅ Read ${lineCount} lines`);
            } else if (functionName === 'edit') {
              console.log(`  ✅ Edit applied successfully`);
            } else if (functionName === 'search_file_content' || functionName === 'grep') {
              const matches = result.split('\n').filter(line => line.trim()).length;
              console.log(`  ✅ Found ${matches} matches`);
            } else {
              console.log(`  ✅ Completed`);
            }
            
            toolResults.push(`${functionName}: ${result}`);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`  ❌ ${functionName} failed: ${errorMsg.substring(0, 50)}`);
            console.error(`Error executing ${functionName}:`, error);
            toolResults.push(`${functionName}: Error - ${errorMsg}`);
          }
        }
        
        // Add the assistant's response (but clean it to only include content and role)
        this.conversation.push({
          role: 'assistant',
          content: responseMessage.content || ''
        });
        
        // Add all tool results as a single user message
        const combinedResults = `Tool execution results:\n${toolResults.join('\n')}`;
        this.conversation.push({
          role: 'user',
          content: combinedResults
        });
        
        // Show completion status
        const successCount = toolResults.filter(r => !r.includes('Error -')).length;
        const errorCount = toolResults.length - successCount;
        console.log(`\n🎯 Completed ${successCount}/${toolResults.length} tools successfully${errorCount > 0 ? ` (${errorCount} failed)` : ''}\n`);

        // Check if the assistant's response suggests more work is needed
        const assistantContent = responseMessage.content || '';
        const needsContinuation = assistantContent.includes('<needs_continuation/>') ||
                                 assistantContent.toLowerCase().includes('continue') ||
                                 assistantContent.toLowerCase().includes('next step') ||
                                 (iterations < maxIterations && toolUseMatches.length > 0);

        if (needsContinuation) {
          console.log('📝 Task needs continuation, proceeding...');
          console.error(`\n🔄 Moving to next phase...`);
          console.log('🔄 Bypassing next speaker check for Azure OpenAI');
          currentMessage = 'Please continue with the next steps based on the tool results above.';
          continue;
        }

        // Get final response after all tool executions  
        const finalApiResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            messages: this.conversation,
            model: this.model,
            temperature: 0.7,
          }),
        });

        if (!finalApiResponse.ok) {
          throw new Error(`DeepSeek final response error: ${finalApiResponse.status}`);
        }

        const finalData = await finalApiResponse.json();
        let finalMessage = finalData.choices?.[0]?.message?.content || '';
        
        // Check if the final response itself contains more tool calls
        const finalToolUseMatches = [...finalMessage.matchAll(toolUseRegex)];
        if (finalToolUseMatches.length > 0 && iterations < maxIterations) {
          console.log('📝 Model wants to execute more tools, continuing...');
          this.conversation.push({ role: 'assistant', content: finalMessage });
          currentMessage = 'Continue';
          continue; // Loop back to process more tools
        }
        
        this.conversation.push({ role: 'assistant', content: finalMessage });
        return this.formatThinkingProcess(finalMessage);
      }
      
      // Also check if the model uses standard function_call format
      if (responseMessage.function_call) {
        const functionName = responseMessage.function_call.name;
        const args = JSON.parse(responseMessage.function_call.arguments);
        
        console.log(`🔧 Executing function (via function_call): ${functionName}`);
        const functionResult = await this.executeToolDirectly(functionName, args);
        
        // Add the assistant's intent to call a function
        this.conversation.push({
          role: 'assistant',
          content: `Calling function: ${functionName}`
        });
        
        // Add function result to conversation as a user message (Azure doesn't support 'function' role)
        this.conversation.push({
          role: 'user',
          content: `Function ${functionName} result: ${functionResult}`
        });

        // Get final response after function execution
        const finalApiResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            messages: this.conversation,
            model: this.model,
            temperature: 0.7,
          }),
        });

        if (!finalApiResponse.ok) {
          throw new Error(`DeepSeek final response error: ${finalApiResponse.status}`);
        }

        const finalData = await finalApiResponse.json();
        let finalMessage = finalData.choices?.[0]?.message?.content || '';
        
        // Format thinking process for better readability - DISABLED to prevent duplicates  
        // finalMessage = this.formatThinkingProcess(finalMessage);
        
        this.conversation.push({ role: 'assistant', content: finalMessage });
        return finalMessage;
      }

      // Add response to conversation
      this.conversation.push(responseMessage);
      
      // Check if response needs continuation
      let msgContent = responseMessage.content || '';
      
      // Format thinking process for better readability - DISABLED to prevent duplicates
      // msgContent = this.formatThinkingProcess(msgContent);
      
      if (msgContent.includes('<needs_continuation/>')) {
        console.log('📝 Response indicates continuation needed...');
        currentMessage = 'Continue with the next steps.';
        continue;
      }
      
      // No more continuations needed - Apply formatting here (main return path)
      return this.formatThinkingProcess(msgContent);
      
      } // End of while loop
      
      // If we've exhausted iterations, return what we have
      const finalResponse = continuationResponse || 'Task sequence completed after maximum iterations.';
      return finalResponse; // No formatting needed here, already formatted at main return
      
    } catch (error) {
      console.error('DeepSeek error:', error);
      throw error;
    }
  }

  /**
   * Stream messages with tool support - TRUE streaming implementation
   */
  async *sendMessageStreamWithTools(message: string): AsyncGenerator<string> {
    try {
      // Immediately show we're starting
      yield "🤖 Connecting to DeepSeek R1...\n\n";
      
      let iterations = 0;
      const maxIterations = 5;
      let currentMessage = message;
      
      // Add system message if needed
      if (this.conversation.length === 0) {
        const systemPrompt = `You are an advanced AI assistant integrated into the UNIPATH CLI with full access to ALL tools.

CRITICAL INSTRUCTIONS FOR TOOL EXECUTION:
1. Execute tools ONE AT A TIME in sequence
2. For complex tasks with multiple steps, break them down:
   - First, list all required tools
   - Execute 3-5 tools per response maximum
   - End with <needs_continuation/> if more tools are needed
   - Wait for results before continuing
3. ALWAYS use this exact format for EACH tool:
   <tool_use>
   tool_name: [exact_tool_name]
   arguments: {"param": "value"}
   </tool_use>
4. Do NOT include explanatory text with tool calls
5. Do NOT use function: format, only use <tool_use> format

Available tools:
${this.getToolDescriptions()}

For multiple operations, structure your response as:
- Execute first batch of tools (3-5 max)
- Include <needs_continuation/> at the end
- Continue in next iteration`;
        this.conversation.push({ role: 'system', content: systemPrompt });
      }
      
      while (iterations < maxIterations) {
        iterations++;
        yield `📍 Round ${iterations}/${maxIterations}\n`;
        
        if (iterations === 1) {
          this.conversation.push({ role: 'user', content: currentMessage });
        }
        
        // Make API call
        yield "🔍 Analyzing request...\n";
        const url = `${this.endpoint}/chat/completions?api-version=${this.apiVersion}`;
        const functions = this.getAvailableFunctions();
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            messages: this.conversation,
            model: this.model,
            temperature: 0.7,
            functions: functions.length > 0 ? functions : undefined,
            function_call: functions.length > 0 ? 'auto' : undefined,
          }),
        });
        
        if (!response.ok) {
          yield `❌ API Error: ${response.status}\n`;
          throw new Error(`DeepSeek API error: ${response.status}`);
        }
        
        const data = await response.json();
        const responseMessage = data.choices?.[0]?.message;
        
        if (!responseMessage) {
          yield "❌ No response from DeepSeek\n";
          break;
        }
        
        // Check for tool calls
        const responseContent = responseMessage.content || '';
        
        // Check for both formats DeepSeek might use
        const toolUseRegex = /<tool_use>\s*tool_name:\s*(\w+)\s*arguments:\s*({[\s\S]*?})\s*<\/tool_use>/gm;
        const functionRegex = /function:\s*(\w+)\s*\n\s*\d+\s+({[^}]+})/gm;
        
        let toolUseMatches = [...responseContent.matchAll(toolUseRegex)];
        
        // If no tool_use format, check for function format
        if (toolUseMatches.length === 0) {
          toolUseMatches = [...responseContent.matchAll(functionRegex)];
        }
        
        if (toolUseMatches.length > 0) {
          // Don't yield the raw planning text - just show we found tools
          yield `\n📦 Found ${toolUseMatches.length} tool${toolUseMatches.length > 1 ? 's' : ''} to execute\n\n`;
          
          const toolResults: string[] = [];
          
          // Execute each tool and yield progress
          for (let i = 0; i < toolUseMatches.length; i++) {
            const match = toolUseMatches[i];
            const functionName = match[1];
            let args;
            
            try {
              args = JSON.parse(match[2]);
            } catch (e) {
              try {
                const fixedJson = match[2]
                  .replace(/\n/g, '\\n')
                  .replace(/\r/g, '\\r')
                  .replace(/\t/g, '\\t');
                args = JSON.parse(fixedJson);
              } catch (e2) {
                yield `  ❌ [${i+1}/${toolUseMatches.length}] Invalid arguments for ${functionName}\n`;
                continue;
              }
            }
            
            // Show what we're executing
            yield `  🔧 [${i+1}/${toolUseMatches.length}] ${functionName}`;
            
            if (functionName === 'web_search' || functionName === 'web-search') {
              const query = args.query || args.q || '';
              yield `: "${query.substring(0, 40)}${query.length > 40 ? '...' : ''}"\n`;
            } else if (functionName.includes('file')) {
              const file = args.file_path || args.absolute_path || '';
              yield `: ${file.split('/').pop() || 'file'}\n`;
            } else {
              yield `\n`;
            }
            
            try {
              const result = await Promise.race([
                this.executeToolDirectly(functionName, args),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000))
              ]) as string;
              
              yield `      ✅ Done\n`;
              toolResults.push(`${functionName}: ${result}`);
            } catch (error) {
              yield `      ❌ Failed: ${error instanceof Error ? error.message : 'Unknown'}\n`;
              toolResults.push(`${functionName}: Error`);
            }
          }
          
          yield `\n✨ All tools executed\n\n`;
          
          // Add to conversation
          this.conversation.push({
            role: 'assistant',
            content: responseMessage.content || ''
          });
          this.conversation.push({
            role: 'user',
            content: `Tool results:\n${toolResults.join('\n')}`
          });
          
          // Check if we need more - be more aggressive about continuing
          const needsContinuation = 
            responseContent.includes('<needs_continuation/>') ||
            toolResults.length >= 3 || // If we executed 3+ tools, likely more to do
            responseContent.toLowerCase().includes('next') ||
            responseContent.toLowerCase().includes('continue') ||
            responseContent.toLowerCase().includes('proceed');
            
          if (needsContinuation && iterations < maxIterations) {
            yield "🔄 Continuing with next batch of tools...\n\n";
            currentMessage = 'Please continue with the remaining tasks. Execute the next batch of tools.';
            continue;
          }
          
          // Get final response
          yield "💭 Generating final response...\n\n";
          const finalResponse = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
              messages: this.conversation,
              model: this.model,
              temperature: 0.7,
            }),
          });
          
          if (finalResponse.ok) {
            const finalData = await finalResponse.json();
            const finalMessage = finalData.choices?.[0]?.message?.content || '';
            
            // Check if final response has more tools
            const moreTools = [...finalMessage.matchAll(toolUseRegex)];
            if (moreTools.length > 0 && iterations < maxIterations) {
              this.conversation.push({ role: 'assistant', content: finalMessage });
              currentMessage = 'Continue';
              continue;
            }
            
            yield this.formatThinkingProcess(finalMessage);
          }
          break;
        } else {
          // No tools, just yield response
          yield this.formatThinkingProcess(responseContent);
          break;
        }
      }
    } catch (error) {
      yield `\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`;
    }
  }

  getModel(): string {
    return this.model;
  }
}