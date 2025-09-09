export interface TimeoutConfig {
  taskExecutionMs: number;
  toolExecutionMs: number;
  systemHealthCheckMs: number;
  recoveryTimeoutMs: number;
  // CRITICAL: Approval flows have NO timeout
  approvalTimeoutMs: null; // Always null - never timeout approvals
}

export class TimeoutManager {
  private static readonly DEFAULT_CONFIG: TimeoutConfig = {
    taskExecutionMs: 30000,     // 30 seconds for task execution
    toolExecutionMs: 15000,     // 15 seconds for individual tools  
    systemHealthCheckMs: 5000,  // 5 seconds for health checks
    recoveryTimeoutMs: 60000,   // 60 seconds for system recovery
    approvalTimeoutMs: null     // NEVER timeout approvals
  };

  private config: TimeoutConfig;

  constructor(config?: Partial<TimeoutConfig>) {
    this.config = { ...TimeoutManager.DEFAULT_CONFIG, ...config };
    
    // Ensure approval timeout is always null
    this.config.approvalTimeoutMs = null;
  }

  /**
   * Create a timeout for task execution
   */
  createTaskTimeout(taskId: string, customTimeoutMs?: number): NodeJS.Timeout {
    const timeout = customTimeoutMs || this.config.taskExecutionMs;
    
    return setTimeout(() => {
      console.warn(`⏰ Task ${taskId} timed out after ${timeout}ms`);
    }, timeout);
  }

  /**
   * Create a timeout for tool execution
   */
  createToolTimeout(toolName: string, customTimeoutMs?: number): NodeJS.Timeout {
    const timeout = customTimeoutMs || this.config.toolExecutionMs;
    
    return setTimeout(() => {
      console.warn(`⏰ Tool ${toolName} timed out after ${timeout}ms`);
    }, timeout);
  }

  /**
   * CRITICAL: Approval operations never timeout
   * This method exists but always returns null to emphasize the policy
   */
  createApprovalTimeout(): null {
    console.log('🔐 Approval requested - NO TIMEOUT (user has unlimited time to decide)');
    return null; // Never create a timeout for approvals
  }

  /**
   * Create timeout with abort signal
   */
  createAbortableTimeout(
    timeoutMs: number,
    signal?: AbortSignal
  ): { timeout: NodeJS.Timeout; aborted: boolean } {
    let aborted = false;
    
    const timeout = setTimeout(() => {
      if (!aborted) {
        console.warn(`⏰ Operation timed out after ${timeoutMs}ms`);
      }
    }, timeoutMs);

    // Handle abort signal
    if (signal) {
      signal.addEventListener('abort', () => {
        aborted = true;
        clearTimeout(timeout);
        console.log('🛑 Operation aborted before timeout');
      });
    }

    return { timeout, aborted };
  }

  /**
   * Get appropriate timeout for different operation types
   */
  getTimeoutForOperation(operationType: string): number | null {
    switch (operationType) {
      case 'approval':
      case 'user_input':
      case 'manual_review':
        return null; // NEVER timeout user interactions
        
      case 'file_read':
        return 5000;
        
      case 'file_write':
      case 'file_edit':  
        return 10000;
        
      case 'shell_command':
        return 30000;
        
      case 'web_search':
        return 15000;
        
      case 'large_file_operation':
        return 120000; // 2 minutes for large files
        
      case 'system_recovery':
        return this.config.recoveryTimeoutMs;
        
      default:
        return this.config.taskExecutionMs;
    }
  }

  /**
   * Check if an operation should have a timeout
   */
  shouldTimeout(operationType: string): boolean {
    const timeout = this.getTimeoutForOperation(operationType);
    return timeout !== null;
  }

  /**
   * Get timeout configuration
   */
  getConfig(): TimeoutConfig {
    return { ...this.config };
  }

  /**
   * Update timeout configuration (except approval timeout which is always null)
   */
  updateConfig(updates: Partial<Omit<TimeoutConfig, 'approvalTimeoutMs'>>): void {
    this.config = {
      ...this.config,
      ...updates,
      approvalTimeoutMs: null // Always ensure this stays null
    };
  }

  /**
   * Create a promise that never times out (for approvals)
   */
  createNonTimeoutPromise<T>(promiseFactory: () => Promise<T>): Promise<T> {
    console.log('⏳ Creating non-timeout promise (for approval or user input)');
    return promiseFactory(); // Return the original promise without any timeout wrapper
  }

  /**
   * Wrap a promise with optional timeout (skips timeout for approvals)
   */
  wrapWithTimeout<T>(
    promiseFactory: () => Promise<T>,
    operationType: string,
    customTimeoutMs?: number
  ): Promise<T> {
    
    if (!this.shouldTimeout(operationType)) {
      console.log(`⏳ ${operationType} - NO TIMEOUT (user interaction)`);
      return this.createNonTimeoutPromise(promiseFactory);
    }

    const timeoutMs = customTimeoutMs || this.getTimeoutForOperation(operationType)!;
    console.log(`⏰ ${operationType} - timeout: ${timeoutMs}ms`);

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${operationType} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promiseFactory()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}