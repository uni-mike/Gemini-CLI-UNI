/**
 * Unified Configuration Class
 * Single source of truth for all configuration
 */

export enum ApprovalMode {
  DEFAULT = 'default',
  AUTO_EDIT = 'autoEdit',
  YOLO = 'yolo',
}

export class Config {
  private model: string = 'DeepSeek-V3.1';
  private approvalMode: ApprovalMode = ApprovalMode.DEFAULT;
  private interactive: boolean = true;
  private debugMode: boolean = false;
  
  constructor() {
    // Read from environment variables
    this.approvalMode = (process.env.APPROVAL_MODE as ApprovalMode) || ApprovalMode.DEFAULT;
    this.debugMode = process.env.DEBUG === 'true';
    
    // Check if stdin is a TTY for interactive mode
    this.interactive = process.stdin.isTTY || process.env.APPROVAL_MODE === 'yolo';
  }
  
  async initialize(): Promise<void> {
    // Load any async configuration here
    console.log('Config initialized:', {
      model: this.model,
      approvalMode: this.approvalMode,
      interactive: this.interactive,
      debugMode: this.debugMode
    });
  }
  
  getModel(): string {
    return this.model;
  }
  
  setModel(model: string): void {
    this.model = model;
  }
  
  getApprovalMode(): ApprovalMode {
    return this.approvalMode;
  }
  
  isInteractive(): boolean {
    return this.interactive;
  }
  
  getDebugMode(): boolean {
    return this.debugMode;
  }
}