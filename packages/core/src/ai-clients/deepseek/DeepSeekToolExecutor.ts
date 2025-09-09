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
   * ONLY uses registry - NO hardcoded fallbacks
   */
  async execute(toolCall: ToolCall): Promise<ExecutionResult> {
    try {
      // Map tool name variations
      const mappedName = this.mapToolName(toolCall.name);
      
      // ONLY use registry - no fallbacks!
      const registryResult = await this.executeFromRegistry(mappedName, toolCall.arguments);
      if (registryResult) {
        return registryResult;
      }

      // No tool found in registry
      const allTools = this.toolRegistry.getAllTools();
      return {
        success: false,
        result: '',
        error: `Tool '${toolCall.name}' not found in registry. Available tools: ${allTools.map(t => t.name).join(', ')}`
      };
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
   * Execute tool from registry - THIS IS THE ONLY WAY
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
        console.log(`Available tools: ${allTools.map(t => t.name).join(', ')}`);
        return null; // No fallback - registry is the only source
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
      // Registry execution failed - no fallback
      console.error(`Registry execution error for ${toolName}:`, error);
      throw error; // Propagate to main execute method
    }
  }

  // ALL HARDCODED IMPLEMENTATIONS REMOVED
  // Registry is the ONLY source of tools - no exceptions!

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
    const normalizedName = name.toLowerCase().replace(/[_-]/g, '').replace(/\s+/g, '');
    
    // First try exact match
    let tool = tools.find(t => {
      const toolName = (t.name || '').toLowerCase().replace(/[_-]/g, '').replace(/\s+/g, '');
      return toolName === normalizedName;
    });
    
    if (tool) return tool;
    
    // Try various transformations
    return tools.find(t => {
      const toolName = (t.name || '').toLowerCase().replace(/[_-]/g, '').replace(/\s+/g, '');
      const toolNameWithoutSuffix = toolName.replace(/tool$/, '');
      const nameWithoutPrefix = normalizedName.replace(/^(read|write|search|run|execute|get|set|list)/, '');
      
      // Check various matches
      return toolNameWithoutSuffix === normalizedName ||
             toolName === nameWithoutPrefix ||
             // Special case for web_search -> websearch mapping
             (normalizedName === 'websearch' && toolName === 'websearch') ||
             (normalizedName === 'websearch' && toolName === 'websearchtool') ||
             // Include partial matches as last resort
             toolName.includes(normalizedName) ||
             normalizedName.includes(toolName);
    });
  }

  // Helper methods removed - registry handles everything

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