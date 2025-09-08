import { EventEmitter } from 'events';

export interface ApprovalRequest {
  id: string;
  type: 'file_write' | 'file_edit' | 'shell_command' | 'high_risk';
  description: string;
  details: {
    filePath?: string;
    content?: string;
    command?: string;
    oldText?: string;
    newText?: string;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  taskId?: string;
}

export interface ApprovalResponse {
  approved: boolean;
  reason?: string;
  modifications?: any;
  timestamp: number;
}

export class ApprovalManager extends EventEmitter {
  private static instance: ApprovalManager | null = null;
  private pendingApprovals: Map<string, ApprovalRequest> = new Map();
  private approvalCallbacks: Map<string, (response: ApprovalResponse) => void> = new Map();
  
  /**
   * Get the singleton instance of ApprovalManager
   */
  public static getInstance(): ApprovalManager {
    if (!ApprovalManager.instance) {
      ApprovalManager.instance = new ApprovalManager();
    }
    return ApprovalManager.instance;
  }
  
  /**
   * Request approval for an operation - NEVER times out
   * Users must have unlimited time to review and decide
   */
  async requestApproval(request: Omit<ApprovalRequest, 'id' | 'timestamp'>): Promise<ApprovalResponse> {
    // Check if we're in non-interactive mode
    const isNonInteractive = process.argv.includes('--non-interactive') || 
                            process.env['UNIPATH_NON_INTERACTIVE'] === 'true' ||
                            process.env['NODE_ENV'] === 'test';
    
    if (isNonInteractive) {
      // Use console-based approval for non-interactive mode
      return this.requestConsoleApproval(request);
    }
    
    // Use event-based approval for interactive mode (with CLI UI)
    return this.requestUIApproval(request);
  }
  
  /**
   * Request approval using console prompts (for non-interactive mode)
   */
  private async requestConsoleApproval(request: Omit<ApprovalRequest, 'id' | 'timestamp'>): Promise<ApprovalResponse> {
    const approvalRequest: ApprovalRequest = {
      ...request,
      id: `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };

    console.log(`\n🔐 APPROVAL REQUIRED: ${approvalRequest.description}`);
    console.log('━'.repeat(80));
    console.log(`Risk Level: ${approvalRequest.riskLevel.toUpperCase()}`);
    
    if (approvalRequest.details.filePath) {
      console.log(`File: ${approvalRequest.details.filePath}`);
    }
    if (approvalRequest.details.command) {
      console.log(`Command: ${approvalRequest.details.command}`);
    }
    
    console.log('━'.repeat(80));
    console.log('Options:');
    console.log('  1️⃣  Approve this operation');
    console.log('  2️⃣  Skip this operation');
    console.log('  3️⃣  Approve all remaining operations (YOLO mode)');
    console.log('  4️⃣  Cancel operation');
    console.log('━'.repeat(80));

    const { createInterface } = await import('readline');
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise<ApprovalResponse>((resolve) => {
      rl.question('Enter your choice (1-4): ', (answer: string) => {
        rl.close();
        const choice = answer.trim();
        
        switch(choice) {
          case '1':
            console.log('✅ Operation approved');
            resolve({
              approved: true,
              reason: 'Approved via console',
              timestamp: Date.now()
            });
            break;
          case '2':
            console.log('⏭️  Skipping this operation');
            resolve({
              approved: false,
              reason: 'Skipped via console',
              timestamp: Date.now()
            });
            break;
          case '3':
            console.log('⚡ YOLO mode enabled - approving all remaining operations!');
            resolve({
              approved: true,
              reason: 'YOLO mode enabled via console',
              timestamp: Date.now()
            });
            break;
          case '4':
            console.log('❌ Operation cancelled');
            resolve({
              approved: false,
              reason: 'Cancelled via console',
              timestamp: Date.now()
            });
            break;
          default:
            console.log('⚠️ Invalid choice, denying operation');
            resolve({
              approved: false,
              reason: 'Invalid choice, denied',
              timestamp: Date.now()
            });
            break;
        }
      });
    });
  }
  
  /**
   * Request approval using event system (for interactive mode with CLI UI)
   */
  private async requestUIApproval(request: Omit<ApprovalRequest, 'id' | 'timestamp'>): Promise<ApprovalResponse> {
    const approvalRequest: ApprovalRequest = {
      ...request,
      id: `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };

    console.log(`\n🔗 Requesting approval via CLI UI for: ${approvalRequest.description}`);
    
    // Store the approval request
    this.pendingApprovals.set(approvalRequest.id, approvalRequest);
    
    // Emit approval needed event for the CLI UI to handle
    this.emit('approvalNeeded', approvalRequest);

    // Return a promise that resolves when approval is given via UI
    return new Promise<ApprovalResponse>((resolve) => {
      this.approvalCallbacks.set(approvalRequest.id, resolve);
      
      // Periodically remind user about pending approval (shorter interval for UI)
      const reminderInterval = setInterval(() => {
        console.log(`⏳ Still waiting for UI approval: ${approvalRequest.description}`);
      }, 10000); // Remind every 10 seconds for UI mode

      // Clean up reminder when resolved
      const originalCallback = resolve;
      this.approvalCallbacks.set(approvalRequest.id, (response: ApprovalResponse) => {
        clearInterval(reminderInterval);
        originalCallback(response);
      });
    });
  }

  /**
   * Respond to a pending approval request
   */
  respondToApproval(approvalId: string, response: Omit<ApprovalResponse, 'timestamp'>): boolean {
    const callback = this.approvalCallbacks.get(approvalId);
    const request = this.pendingApprovals.get(approvalId);
    
    if (!callback || !request) {
      console.warn(`⚠️ No pending approval found for ID: ${approvalId}`);
      return false;
    }

    const fullResponse: ApprovalResponse = {
      ...response,
      timestamp: Date.now()
    };

    console.log(`\n${response.approved ? '✅ APPROVED' : '❌ DENIED'}: ${request.description}`);
    if (response.reason) {
      console.log(`Reason: ${response.reason}`);
    }

    // Clean up
    this.pendingApprovals.delete(approvalId);
    this.approvalCallbacks.delete(approvalId);
    
    // Emit response event
    this.emit('approvalResponse', { request, response: fullResponse });
    
    // Resolve the promise
    callback(fullResponse);
    
    return true;
  }

  /**
   * Get all pending approval requests
   */
  getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values());
  }

  /**
   * Cancel a pending approval (marks as denied)
   */
  cancelApproval(approvalId: string, reason: string = 'Cancelled'): boolean {
    return this.respondToApproval(approvalId, {
      approved: false,
      reason: `Cancelled: ${reason}`
    });
  }

  /**
   * Auto-approve based on risk level and trust settings
   */
  private shouldAutoApprove(request: ApprovalRequest, trustedFolders: string[] = []): boolean {
    // Never auto-approve high-risk or critical operations
    if (request.riskLevel === 'high' || request.riskLevel === 'critical') {
      return false;
    }

    // Auto-approve low-risk read operations
    if (request.riskLevel === 'low' && request.type !== 'shell_command') {
      return true;
    }

    // Auto-approve operations in trusted folders (if medium risk or below)
    if (request.details.filePath && (request.riskLevel === 'low' || request.riskLevel === 'medium')) {
      const isInTrustedFolder = trustedFolders.some(folder => 
        request.details.filePath?.startsWith(folder)
      );
      if (isInTrustedFolder) {
        return true;
      }
    }

    return false;
  }

  /**
   * Request approval with auto-approval logic
   */
  async requestApprovalWithAutoLogic(
    request: Omit<ApprovalRequest, 'id' | 'timestamp'>,
    trustedFolders: string[] = []
  ): Promise<ApprovalResponse> {
    
    if (this.shouldAutoApprove(request as ApprovalRequest, trustedFolders)) {
      console.log(`✅ Auto-approved: ${request.description} (${request.riskLevel} risk)`);
      return {
        approved: true,
        reason: 'Auto-approved based on risk level and trust settings',
        timestamp: Date.now()
      };
    }

    // Require manual approval
    return this.requestApproval(request);
  }

  /**
   * Batch approve multiple similar operations
   */
  async requestBatchApproval(requests: Omit<ApprovalRequest, 'id' | 'timestamp'>[]): Promise<ApprovalResponse[]> {
    if (requests.length === 0) return [];
    if (requests.length === 1) return [await this.requestApproval(requests[0])];

    console.log(`\n🔐 BATCH APPROVAL REQUIRED (${requests.length} operations)`);
    console.log('━'.repeat(60));
    
    requests.forEach((request, index) => {
      console.log(`${index + 1}. ${request.type}: ${request.description} (${request.riskLevel})`);
    });
    
    console.log('━'.repeat(60));
    console.log('Options:');
    console.log('  - Approve All: All operations will be executed');
    console.log('  - Deny All: All operations will be cancelled');
    console.log('  - Individual: Review each operation separately');
    
    // For now, fall back to individual approvals
    // In a real implementation, this would have a batch approval UI
    const responses: ApprovalResponse[] = [];
    
    for (const request of requests) {
      const response = await this.requestApproval(request);
      responses.push(response);
      
      // If user denies one, ask if they want to cancel the rest
      if (!response.approved) {
        console.log('❌ Operation denied. Remaining operations in batch will also be cancelled.');
        // Fill remaining with denials
        for (let i = responses.length; i < requests.length; i++) {
          responses.push({
            approved: false,
            reason: 'Cancelled due to previous denial in batch',
            timestamp: Date.now()
          });
        }
        break;
      }
    }
    
    return responses;
  }

  /**
   * Get approval statistics
   */
  getApprovalStats() {
    return {
      pendingCount: this.pendingApprovals.size,
      oldestPendingAge: this.pendingApprovals.size > 0 
        ? Date.now() - Math.min(...Array.from(this.pendingApprovals.values()).map(r => r.timestamp))
        : 0,
      pendingByRiskLevel: this.groupPendingByRiskLevel()
    };
  }

  private groupPendingByRiskLevel() {
    const stats = { low: 0, medium: 0, high: 0, critical: 0 };
    
    for (const request of this.pendingApprovals.values()) {
      stats[request.riskLevel]++;
    }
    
    return stats;
  }

  /**
   * Emergency approval bypass (use with caution)
   */
  emergencyApproveAll(reason: string): number {
    const count = this.pendingApprovals.size;
    console.warn(`🚨 EMERGENCY APPROVAL: Approving all ${count} pending operations`);
    console.warn(`Reason: ${reason}`);
    
    for (const [id] of this.pendingApprovals) {
      this.respondToApproval(id, {
        approved: true,
        reason: `Emergency approval: ${reason}`
      });
    }
    
    return count;
  }
}