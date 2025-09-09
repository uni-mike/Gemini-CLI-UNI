/**
 * Tool executor for DeepSeek
 * Handles tool execution with approval flow and error handling
 */

import type { Config } from '../../config/config.js';
import type { ToolRegistry } from '../../tools/tool-registry.js';
import { ApprovalMode } from '../../config/config.js';
import type { ToolCall } from './DeepSeekMessageParser.js';

export interface ExecutionResult {
  success: boolean;
  result: string;
  error?: string;
}

export interface ApprovalDetails {
  type: string;
  description: string;
  filePath?: string;
  command?: string;
  oldContent?: string;
  newContent?: string;
}

export class DeepSeekToolExecutor {
  private toolRegistry: ToolRegistry;
  private config: Config;
  private confirmationCallback?: (details: ApprovalDetails) => Promise<boolean>;

  constructor(config: Config) {
    this.config = config;
    this.toolRegistry = config.getToolRegistry();
  }

  /**
   * Set callback for approval prompts
   */
  setConfirmationCallback(callback: (details: ApprovalDetails) => Promise<boolean>) {
    this.confirmationCallback = callback;
  }

  /**
   * Execute a tool call with proper error handling and approval
   */
  async execute(toolCall: ToolCall): Promise<ExecutionResult> {
    try {
      // Map tool name variations
      const mappedName = this.mapToolName(toolCall.name);
      
      // Try registry first
      const registryResult = await this.executeFromRegistry(mappedName, toolCall.arguments);
      if (registryResult) {
        return registryResult;
      }

      // Fallback to direct implementation
      return await this.executeFallback(mappedName, toolCall.arguments);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Tool execution error for ${toolCall.name}:`, errorMsg);
      
      return {
        success: false,
        result: '',
        error: errorMsg
      };
    }
  }

  /**
   * Execute tool from registry - ALWAYS use registry first
   */
  private async executeFromRegistry(
    toolName: string, 
    args: Record<string, any>
  ): Promise<ExecutionResult | null> {
    try {
      const allTools = this.toolRegistry.getAllTools();
      
      // Find tool by name (with various naming conventions)
      const tool = this.findTool(toolName, allTools);
      
      if (!tool) {
        console.log(`🔍 Tool '${toolName}' not found in registry (${allTools.length} tools available)`);
        return null; // Will try fallback
      }
      
      console.log(`✅ Found tool '${tool.name}' in registry`);

      // Build and execute tool
      const invocation = tool.build(args);
      const abortController = new AbortController();
      
      // Check if confirmation needed
      const confirmationDetails = await invocation.shouldConfirmExecute(abortController.signal);
      
      if (confirmationDetails && !this.shouldAutoApprove()) {
        const approved = await this.requestApproval(toolName, args, confirmationDetails);
        if (!approved) {
          return {
            success: false,
            result: 'Operation cancelled by user',
            error: 'User declined approval'
          };
        }
      }
      
      // Execute the tool
      const result = await invocation.execute(abortController.signal);
      
      return {
        success: true,
        result: this.formatToolResult(result)
      };
    } catch (error) {
      // Registry execution failed, will try fallback
      return null;
    }
  }

  /**
   * Fallback implementation - only for when registry is completely unavailable
   * This should rarely be used in production
   */
  private async executeFallback(
    toolName: string,
    args: Record<string, any>
  ): Promise<ExecutionResult> {
    console.warn(`⚠️ Using fallback for tool '${toolName}' - registry should handle this!`);
    
    // Only basic operations as emergency fallback
    if (this.isFileOperation(toolName)) {
      return await this.executeFileOperation(toolName, args);
    }
    
    if (this.isShellOperation(toolName)) {
      return await this.executeShellCommand(args);
    }
    
    if (this.isWebSearch(toolName)) {
      return await this.executeWebSearch(args);
    }
    
    return {
      success: false,
      result: '',
      error: `Tool '${toolName}' not found. Available tools: ${this.toolRegistry.getAllTools().map(t => t.name).join(', ')}`
    };
  }

  /**
   * Execute file operations
   */
  private async executeFileOperation(
    toolName: string,
    args: Record<string, any>
  ): Promise<ExecutionResult> {
    const fs = await import('fs/promises');
    const filePath = args['file_path'] || args['absolute_path'] || args['path'] || '';
    
    try {
      if (toolName.includes('read')) {
        const content = await fs.readFile(filePath, 'utf-8');
        return { success: true, result: content };
      }
      
      if (toolName.includes('write')) {
        if (!this.shouldAutoApprove()) {
          const approved = await this.requestApproval(toolName, args, {
            type: 'file_write',
            description: `Write to ${filePath}`,
            filePath,
            newContent: args['content']
          });
          
          if (!approved) {
            return {
              success: false,
              result: 'Write operation cancelled',
              error: 'User declined'
            };
          }
        }
        
        await fs.writeFile(filePath, args['content'] || '');
        return { success: true, result: `File written successfully to ${filePath}` };
      }
      
      if (toolName.includes('replace') || toolName.includes('edit')) {
        const currentContent = await fs.readFile(filePath, 'utf-8');
        const oldText = args['old_text'] || args['old_string'] || '';
        const newText = args['new_text'] || args['new_string'] || '';
        
        if (!currentContent.includes(oldText)) {
          return {
            success: false,
            result: '',
            error: `Text not found in ${filePath}`
          };
        }
        
        if (!this.shouldAutoApprove()) {
          const approved = await this.requestApproval(toolName, args, {
            type: 'file_edit',
            description: `Edit ${filePath}`,
            filePath,
            oldContent: oldText,
            newContent: newText
          });
          
          if (!approved) {
            return {
              success: false,
              result: 'Edit operation cancelled',
              error: 'User declined'
            };
          }
        }
        
        const newContent = currentContent.replace(oldText, newText);
        await fs.writeFile(filePath, newContent);
        return { success: true, result: `File edited successfully: ${filePath}` };
      }
      
      return {
        success: false,
        result: '',
        error: `Unknown file operation: ${toolName}`
      };
    } catch (error) {
      return {
        success: false,
        result: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Execute shell commands
   */
  private async executeShellCommand(args: Record<string, any>): Promise<ExecutionResult> {
    const command = args['command'] || '';
    
    if (!this.shouldAutoApprove()) {
      const approved = await this.requestApproval('shell', args, {
        type: 'shell_command',
        description: `Run command: ${command}`,
        command
      });
      
      if (!approved) {
        return {
          success: false,
          result: 'Command cancelled',
          error: 'User declined'
        };
      }
    }
    
    try {
      const { execSync } = await import('child_process');
      const result = execSync(command, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 10 });
      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        result: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Execute web search using SerpAPI
   */
  private async executeWebSearch(args: Record<string, any>): Promise<ExecutionResult> {
    const query = args['query'] || args['q'] || '';
    
    if (!query) {
      return {
        success: false,
        result: '',
        error: 'No search query provided'
      };
    }
    
    try {
      // Using the API key from the original implementation
      const SERPAPI_KEY = '44608547a3c72872ff9cf50c518ce3b0a44f85b7348bfdda1a5b3d0da302237f';
      const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${SERPAPI_KEY}&num=5`;
      
      const response = await fetch(searchUrl);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }
      
      const data = await response.json();
      const results: string[] = [];
      
      // Add answer box if available
      if (data.answer_box) {
        const answer = data.answer_box.answer || data.answer_box.snippet;
        if (answer) {
          results.push(`Answer: ${answer}`);
        }
      }
      
      // Add organic results
      if (data.organic_results) {
        data.organic_results.slice(0, 5).forEach((result: any, i: number) => {
          results.push(`\n${i + 1}. ${result.title}\n   URL: ${result.link}\n   ${result.snippet}`);
        });
      }
      
      return {
        success: true,
        result: results.length > 0 ? results.join('\n') : 'No search results found'
      };
    } catch (error) {
      return {
        success: false,
        result: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Helper methods
   */
  private mapToolName(name: string): string {
    // Normalize tool names
    return name
      .toLowerCase()
      .replace(/-/g, '_')
      .replace(/\s+/g, '_');
  }

  private findTool(name: string, tools: any[]): any {
    // More comprehensive name matching for dynamic tools
    const normalizedName = name.toLowerCase().replace(/[_-]/g, '');
    
    return tools.find(t => {
      const toolName = (t.name || '').toLowerCase().replace(/[_-]/g, '');
      const toolNameWithoutSuffix = toolName.replace(/tool$/, '');
      const nameWithoutPrefix = normalizedName.replace(/^(read|write|search|run|execute|get|set|list)/, '');
      
      return toolName === normalizedName ||
             toolNameWithoutSuffix === normalizedName ||
             toolName === nameWithoutPrefix ||
             toolName.includes(normalizedName) ||
             normalizedName.includes(toolName);
    });
  }

  private isFileOperation(name: string): boolean {
    return /read|write|replace|edit|file/i.test(name);
  }

  private isShellOperation(name: string): boolean {
    return /shell|bash|run_shell|command/i.test(name);
  }

  private isWebSearch(name: string): boolean {
    return /web_search|websearch|search_web/i.test(name);
  }

  private shouldAutoApprove(): boolean {
    const mode = this.config.getApprovalMode();
    return mode === ApprovalMode.AUTO_EDIT || 
           mode === ApprovalMode.YOLO ||    
           (mode === ApprovalMode.DEFAULT && this.config.isTrustedFolder());
  }

  private async requestApproval(
    toolName: string,
    args: Record<string, any>,
    details: ApprovalDetails
  ): Promise<boolean> {
    if (!this.confirmationCallback) {
      console.log('⚠️ Approval needed but no callback set');
      return true; // Default to approve for now
    }
    
    return await this.confirmationCallback(details);
  }

  private formatToolResult(result: any): string {
    if (typeof result === 'string') {
      return result;
    }
    
    if (result && typeof result === 'object') {
      return result.output || result.llmContent || JSON.stringify(result);
    }
    
    return 'Tool executed successfully';
  }
}