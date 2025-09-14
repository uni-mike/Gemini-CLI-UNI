/**
 * Approval Manager
 * Handles user approvals for sensitive operations
 */

import { Config, ApprovalMode } from '../config/Config.js';
import * as readline from 'readline';
import React from 'react';
import { render } from 'ink';
import { ApprovalUI, SensitivityLevel } from '../ui/ApprovalUI.js';

export interface ApprovalRequest {
  toolName: string;
  operation: string;
  params: any;
  sensitivityLevel: SensitivityLevel;
  description: string;
  risks?: string[];
}

export interface ApprovalResult {
  approved: boolean;
  reason?: string;
  rememberChoice?: boolean;
}

export class ApprovalManager {
  private config: Config;
  private rl: readline.Interface;
  private approvalCache: Map<string, boolean> = new Map();

  constructor(config: Config) {
    this.config = config;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Request approval for a sensitive operation
   */
  async requestApproval(request: ApprovalRequest): Promise<ApprovalResult> {
    const approvalMode = this.config.getApprovalMode();

    // YOLO mode - auto-approve everything (for testing/development)
    if (approvalMode === ApprovalMode.YOLO) {
      return { approved: true, reason: 'YOLO mode - auto-approved' };
    }

    // Check cache for remembered decisions
    const cacheKey = `${request.toolName}:${request.sensitivityLevel}`;
    if (this.approvalCache.has(cacheKey)) {
      const cached = this.approvalCache.get(cacheKey)!;
      return { approved: cached, reason: cached ? 'Previously approved' : 'Previously denied' };
    }

    // AUTO_EDIT mode - auto-approve low/medium, ask for high/critical
    if (approvalMode === ApprovalMode.AUTO_EDIT) {
      if (request.sensitivityLevel === SensitivityLevel.NONE ||
          request.sensitivityLevel === SensitivityLevel.LOW) {
        return { approved: true, reason: 'Auto-approved (low risk)' };
      }
    }

    // DEFAULT mode or high-sensitivity operations - always ask
    return await this.promptUser(request);
  }

  /**
   * Prompt the user for approval with beautiful React Ink UI
   */
  private async promptUser(request: ApprovalRequest): Promise<ApprovalResult> {
    return new Promise((resolve) => {
      let approvalApp: any;

      const handleApprove = () => {
        approvalApp?.unmount();
        resolve({ approved: true, reason: 'User approved' });
      };

      const handleApproveAndRemember = () => {
        approvalApp?.unmount();
        const cacheKey = `${request.toolName}:${request.sensitivityLevel}`;
        this.approvalCache.set(cacheKey, true);
        resolve({ approved: true, reason: 'Approved and remembered', rememberChoice: true });
      };

      const handleReject = () => {
        approvalApp?.unmount();
        resolve({ approved: false, reason: 'User denied' });
      };

      const handleShowDetails = () => {
        // Details are shown within the React component
      };

      approvalApp = render(
        React.createElement(ApprovalUI, {
          toolName: request.toolName,
          operation: request.operation,
          args: request.params,
          sensitivityLevel: request.sensitivityLevel,
          description: request.description,
          risks: request.risks,
          onApprove: handleApprove,
          onApproveAndRemember: handleApproveAndRemember,
          onReject: handleReject,
          onShowDetails: handleShowDetails,
        })
      );
    });
  }

  /**
   * Classify tool operations by sensitivity
   */
  static classifyOperation(toolName: string, operation: string, params: any): SensitivityLevel {
    // Critical operations (can damage system or security)
    if (toolName === 'bash') {
      const command = params.command?.toLowerCase() || '';
      if (command.includes('rm -rf') ||
          command.includes('sudo') ||
          command.includes('chmod') ||
          command.includes('curl') ||
          command.includes('wget') ||
          command.includes('format') ||
          command.includes('mkfs')) {
        return SensitivityLevel.CRITICAL;
      }
      if (command.includes('rm ') ||
          command.includes('mv ') ||
          command.includes('cp ') ||
          command.includes('git push') ||
          command.includes('git reset --hard')) {
        return SensitivityLevel.HIGH;
      }
      return SensitivityLevel.MEDIUM;
    }

    // Git operations
    if (toolName === 'git') {
      const gitCommand = params.command?.toLowerCase() || '';
      if (gitCommand.includes('push') ||
          gitCommand.includes('reset --hard') ||
          gitCommand.includes('clean -fd') ||
          gitCommand.includes('rebase')) {
        return SensitivityLevel.HIGH;
      }
      if (gitCommand.includes('add') ||
          gitCommand.includes('commit') ||
          gitCommand.includes('checkout')) {
        return SensitivityLevel.MEDIUM;
      }
      return SensitivityLevel.LOW;
    }

    // File operations
    if (toolName === 'write_file' || toolName === 'file') {
      const filePath = params.file_path || params.path || '';
      if (filePath.includes('package.json') ||
          filePath.includes('.env') ||
          filePath.includes('config') ||
          filePath.startsWith('/etc/') ||
          filePath.startsWith('/usr/') ||
          filePath.includes('Dockerfile') ||
          filePath.includes('.sh') ||
          filePath.includes('.bat')) {
        return SensitivityLevel.HIGH;
      }
      // Check if modifying existing files vs creating new ones
      if (operation === 'modify' || operation === 'edit') {
        return SensitivityLevel.MEDIUM;
      }
      return SensitivityLevel.LOW;
    }

    // Edit operations
    if (toolName === 'edit' || toolName === 'smart-edit') {
      return SensitivityLevel.MEDIUM;
    }

    // Web operations
    if (toolName === 'web') {
      return SensitivityLevel.MEDIUM;
    }

    // Read operations are generally safe - should not trigger approval
    if (toolName === 'read_file' || toolName === 'Read' || toolName === 'glob' ||
        toolName === 'Glob' || toolName === 'grep' || toolName === 'Grep' ||
        toolName === 'ls' || toolName === 'memory' || toolName === 'bash') {
      // For bash commands, check if they are safe read operations
      if (toolName === 'bash') {
        const command = params.command?.toLowerCase() || '';
        // Safe read-only commands should not trigger approval
        if (command.match(/^(ls|cat|head|tail|pwd|whoami|date|echo|which|find|locate|tree|du|df|ps|top|history|env|printenv|uname|file|stat|wc)\s/) ||
            command === 'ls' || command === 'pwd' || command === 'whoami' ||
            command === 'date' || command === 'history' || command === 'env' ||
            command.startsWith('echo ') || command.startsWith('cat ') ||
            command.startsWith('head ') || command.startsWith('tail ') ||
            command.startsWith('find ') || command.startsWith('grep ') ||
            command.startsWith('tree') || command.startsWith('which ')) {
          return SensitivityLevel.NONE;
        }
        // All other bash commands follow normal classification below
      } else {
        // Non-bash read tools are always safe
        return SensitivityLevel.NONE;
      }
    }

    // Default to low for unknown operations
    return SensitivityLevel.LOW;
  }


  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.rl.close();
  }

  /**
   * Clear approval cache
   */
  clearCache(): void {
    this.approvalCache.clear();
  }

  /**
   * Get cached approvals (for debugging)
   */
  getCachedApprovals(): Map<string, boolean> {
    return new Map(this.approvalCache);
  }

}