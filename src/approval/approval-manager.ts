/**
 * Approval Manager
 * Handles user approvals for sensitive operations
 */

import { Config, ApprovalMode } from '../config/Config.js';
import * as readline from 'readline';

export enum SensitivityLevel {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

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

export type ApprovalCallback = (result: ApprovalResult) => void;

export class ApprovalManager {
  private config: Config;
  private rl: readline.Interface;
  private approvalCache: Map<string, boolean> = new Map();
  private pendingApproval: { request: ApprovalRequest; callback: ApprovalCallback } | null = null;
  private uiMode: boolean = false;

  constructor(config: Config) {
    this.config = config;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Enable UI mode for React Ink integration
   */
  setUIMode(enabled: boolean): void {
    this.uiMode = enabled;
  }

  /**
   * Request approval for a sensitive operation
   */
  async requestApproval(request: ApprovalRequest): Promise<ApprovalResult> {
    const approvalMode = this.config.getApprovalMode();

    if (process.env.DEBUG === 'true') {
      console.log('🔍 [ApprovalManager] requestApproval called:', {
        toolName: request.toolName,
        sensitivityLevel: request.sensitivityLevel,
        approvalMode,
        uiMode: this.uiMode,
        interactive: this.config.isInteractive()
      });
    }

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
    // In UI mode, we return a promise that resolves when UI responds
    if (this.uiMode) {
      if (process.env.DEBUG === 'true') {
        console.log('🔍 [ApprovalManager] Using UI mode for approval');
      }
      return await this.promptUserUI(request);
    }
    if (process.env.DEBUG === 'true') {
      console.log('🔍 [ApprovalManager] Using raw mode for approval');
    }
    return await this.promptUser(request);
  }

  /**
   * Prompt the user for approval using reliable readline interface
   */
  private async promptUser(request: ApprovalRequest): Promise<ApprovalResult> {
    // Check if we're in interactive mode
    if (!this.config.isInteractive()) {
      return { approved: false, reason: 'Non-interactive mode' };
    }

    const icon = this.getSensitivityIcon(request.sensitivityLevel);

    console.log('\n' + '═'.repeat(70));
    console.log(`${icon} APPROVAL REQUIRED - ${request.sensitivityLevel.toUpperCase()} RISK`);
    console.log('═'.repeat(70));
    console.log(`Tool: ${request.toolName}`);
    console.log(`Operation: ${request.description}`);
    if (request.risks && request.risks.length > 0) {
      console.log('Risks:');
      request.risks.forEach(risk => console.log(`  • ${risk}`));
    }
    console.log('');
    console.log('Options:');
    console.log('  [1] ✅ Approve - Execute this operation now');
    console.log('  [2] 🔒 Approve & Remember - Allow similar operations');
    console.log('  [3] ❌ Deny - Block this operation');
    console.log('  [4] 📋 Show Details - View full parameters');
    console.log('');
    console.log('═'.repeat(70));

    // Use raw input mode for immediate key response
    return new Promise<ApprovalResult>((resolve) => {
      // Enable raw mode to capture single keypress
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();

      process.stdout.write('Your choice (1-4): ');

      const handleKeypress = (chunk: Buffer) => {
        const key = chunk.toString();

        switch (key) {
          case '1':
            process.stdout.write('1\n✅ Operation approved\n');
            cleanup();
            resolve({ approved: true, reason: 'User approved' });
            break;
          case '2':
            process.stdout.write('2\n🔒 Operation approved and remembered\n');
            const cacheKey = `${request.toolName}:${request.sensitivityLevel}`;
            this.approvalCache.set(cacheKey, true);
            cleanup();
            resolve({ approved: true, reason: 'Approved and remembered', rememberChoice: true });
            break;
          case '3':
            process.stdout.write('3\n❌ Operation denied\n');
            cleanup();
            resolve({ approved: false, reason: 'User denied' });
            break;
          case '4':
            process.stdout.write('4\n\n📋 Full Parameters:\n');
            console.log(JSON.stringify(request.params, null, 2));
            console.log('\n' + '═'.repeat(70));
            process.stdout.write('Your choice (1-3): ');
            // Stay in listening mode after showing details
            break;
          case '\u0003': // Ctrl+C
            process.stdout.write('\n❌ Operation cancelled by user\n');
            cleanup();
            resolve({ approved: false, reason: 'Cancelled by user' });
            // Force exit immediately on Ctrl+C
            process.exit(1);
            break;
          case '\r':
          case '\n':
            // Ignore Enter key presses
            break;
          default:
            process.stdout.write('\nInvalid choice. Please press 1, 2, 3, or 4: ');
            break;
        }
      };

      const cleanup = () => {
        process.stdin.removeListener('data', handleKeypress);
        if (process.stdin.setRawMode) {
          process.stdin.setRawMode(false);
        }
        process.stdin.pause();
      };

      process.stdin.on('data', handleKeypress);
    });
  }

  private getSensitivityIcon(level: SensitivityLevel): string {
    const icons = {
      [SensitivityLevel.NONE]: '🟢',
      [SensitivityLevel.LOW]: '🟡',
      [SensitivityLevel.MEDIUM]: '🟠',
      [SensitivityLevel.HIGH]: '🔴',
      [SensitivityLevel.CRITICAL]: '⚠️'
    };
    return icons[level];
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
    if (toolName === 'read_file' || toolName === 'read-file' || toolName === 'Read' ||
        toolName === 'glob' || toolName === 'Glob' ||
        toolName === 'grep' || toolName === 'Grep' ||
        toolName === 'rg' || toolName === 'ripgrep' || toolName === 'rip-grep' ||
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
   * Prompt user in UI mode - returns a promise that resolves when UI responds
   */
  private async promptUserUI(request: ApprovalRequest): Promise<ApprovalResult> {
    if (process.env.DEBUG === 'true') {
      console.log('🔍 [ApprovalManager] Creating pending approval for UI');
    }
    return new Promise<ApprovalResult>((resolve) => {
      this.pendingApproval = { request, callback: resolve };
      if (process.env.DEBUG === 'true') {
        console.log('🔍 [ApprovalManager] Pending approval set, waiting for UI response');
      }
    });
  }

  /**
   * Get pending approval request for UI to display
   */
  getPendingApproval(): ApprovalRequest | null {
    return this.pendingApproval?.request || null;
  }

  /**
   * Respond to pending approval from UI
   */
  respondToApproval(result: ApprovalResult): void {
    if (this.pendingApproval) {
      const { callback, request } = this.pendingApproval;

      // Handle remember choice
      if (result.rememberChoice) {
        const cacheKey = `${request.toolName}:${request.sensitivityLevel}`;
        this.approvalCache.set(cacheKey, result.approved);
      }

      this.pendingApproval = null;
      callback(result);
    }
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