/**
 * UNIPATH DeepSeek CLI Configuration
 * Focused exclusively on DeepSeek integration
 */

export interface DeepSeekConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  approvalMode?: 'auto' | 'manual' | 'review';
  trustedFolders?: string[];
  orchestration?: {
    enabled: boolean;
    maxConcurrentTasks?: number;
    defaultTimeoutMs?: number;
    maxRetries?: number;
  };
}

export const DEFAULT_DEEPSEEK_CONFIG: DeepSeekConfig = {
  apiKey: process.env['DEEPSEEK_API_KEY'] || '',
  baseUrl: process.env['DEEPSEEK_BASE_URL'] || 'https://api.deepseek.com/v1',
  model: 'deepseek-coder',
  temperature: 0.7,
  maxTokens: 4000,
  approvalMode: 'manual',
  trustedFolders: [],
  orchestration: {
    enabled: true,
    maxConcurrentTasks: 3,
    defaultTimeoutMs: 30000,
    maxRetries: 2
  }
};

export class DeepSeekConfigManager {
  private config: DeepSeekConfig;

  constructor(config?: Partial<DeepSeekConfig>) {
    this.config = { ...DEFAULT_DEEPSEEK_CONFIG, ...config };
  }

  get(): DeepSeekConfig {
    return this.config;
  }

  set(updates: Partial<DeepSeekConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  isValid(): boolean {
    return !!this.config.apiKey;
  }

  isTrustedFolder(path: string): boolean {
    return this.config.trustedFolders?.some(folder => 
      path.startsWith(folder)
    ) || false;
  }

  getApprovalMode(): 'auto' | 'manual' | 'review' {
    return this.config.approvalMode || 'manual';
  }
}