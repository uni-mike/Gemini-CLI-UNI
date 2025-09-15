/**
 * Tool Registry
 * Manages all available tools
 */

import { Tool, ToolResult } from './base.js';
import { EventEmitter } from 'events';
import { ApprovalManager, ApprovalRequest, SensitivityLevel } from '../approval/approval-manager.js';
import { Config } from '../config/Config.js';

export class ToolRegistry extends EventEmitter {
  private tools: Map<string, Tool> = new Map();
  private approvalManager?: ApprovalManager;
  
  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
    this.emit('tool-registered', tool.name);
  }

  setApprovalManager(approvalManager: ApprovalManager): void {
    this.approvalManager = approvalManager;
  }
  
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }
  
  list(): string[] {
    return Array.from(this.tools.keys());
  }
  
  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }
  
  async execute(name: string, params: any): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool "${name}" not found`
      };
    }

    if (!tool.validate(params)) {
      return {
        success: false,
        error: `Invalid parameters for tool "${name}"`
      };
    }

    // Check for approval if approval manager is set
    if (this.approvalManager) {
      const sensitivityLevel = ApprovalManager.classifyOperation(name, 'execute', params);

      if (sensitivityLevel !== SensitivityLevel.NONE) {
        const approvalRequest: ApprovalRequest = {
          toolName: name,
          operation: 'execute',
          params,
          sensitivityLevel,
          description: `Execute ${name} tool with the provided parameters`,
          risks: this.getRisksForTool(name, params)
        };

        // Emit event that approval is starting
        if (process.env.DEBUG === 'true') {
          console.log('🔔 [ToolRegistry] Emitting approval-pending event for:', name);
        }
        this.emit('approval-pending', { toolName: name, request: approvalRequest });

        const approvalResult = await this.approvalManager.requestApproval(approvalRequest);

        // Emit event that approval is complete
        if (process.env.DEBUG === 'true') {
          console.log('🔔 [ToolRegistry] Emitting approval-complete event for:', name, 'approved:', approvalResult.approved);
        }
        this.emit('approval-complete', { toolName: name, approved: approvalResult.approved });

        if (!approvalResult.approved) {
          return {
            success: false,
            error: `Operation denied by user: ${approvalResult.reason}`
          };
        }
      }
    }

    this.emit('tool-start', { name, params });

    try {
      const result = await tool.execute(params);
      this.emit('tool-complete', { name, result });
      return result;
    } catch (error) {
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
      this.emit('tool-error', { name, error: errorResult.error });
      return errorResult;
    }
  }

  private getRisksForTool(toolName: string, params: any): string[] {
    const risks: string[] = [];

    if (toolName === 'bash') {
      const command = params.command?.toLowerCase() || '';
      if (command.includes('rm ')) {
        risks.push('May delete files permanently');
      }
      if (command.includes('git push')) {
        risks.push('Will push changes to remote repository');
      }
      if (command.includes('sudo')) {
        risks.push('Requires admin privileges');
      }
    }

    if (toolName === 'write_file' || toolName === 'file') {
      const filePath = params.file_path || params.path || '';
      if (filePath.includes('package.json')) {
        risks.push('May modify project dependencies');
      }
      if (filePath.includes('.env')) {
        risks.push('May expose environment variables');
      }
    }

    return risks;
  }
}

export const globalRegistry = new ToolRegistry();