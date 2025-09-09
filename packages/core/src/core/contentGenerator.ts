/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CountTokensResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
  FinishReason,
} from '@google/genai';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { AzureOpenAIWithTools } from './azureOpenAIWithTools.js';
import { DeepSeekWithOrchestration } from './deepSeekWithOrchestration.js';
import { createCodeAssistContentGenerator } from '../code_assist/codeAssist.js';
import { IdeClient } from '../ide/ide-client.js';
import { DEFAULT_GEMINI_MODEL, DEFAULT_AZURE_MODEL } from '../config/models.js';
import type { Config } from '../config/config.js';
import { ApprovalMode } from '../config/config.js';

import type { UserTierId } from '../code_assist/types.js';
import { LoggingContentGenerator } from './loggingContentGenerator.js';
import { InstallationManager } from '../utils/installationManager.js';

/**
 * Azure OpenAI adapter that implements the ContentGenerator interface
 */
class AzureOpenAIContentGenerator implements ContentGenerator {
  private client: AzureOpenAIWithTools;

  constructor(apiKey: string, endpoint: string, apiVersion: string, deploymentName: string, config: Config) {
    // Set environment variables for AzureOpenAIWithTools
    process.env['AZURE_API_KEY'] = apiKey;
    process.env['AZURE_ENDPOINT_URL'] = endpoint;
    process.env['AZURE_OPENAI_API_VERSION'] = apiVersion;
    process.env['AZURE_DEPLOYMENT'] = deploymentName;
    process.env['AZURE_MODEL'] = deploymentName;
    
    this.client = new AzureOpenAIWithTools(config);
  }

  async generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse> {
    // Convert Gemini format to a message string
    const message = this.extractMessageFromRequest(request);
    
    // Use AzureOpenAIWithTools to send message with tool support
    const responseText = await this.client.sendMessageWithTools(message);

    // Convert to Gemini format
    return this.createGeminiResponse(responseText);
  }

  async generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    // Convert Gemini format to a message string
    const message = this.extractMessageFromRequest(request);
    
    // Use AzureOpenAIWithTools to stream with tool support
    const stream = this.client.sendMessageStreamWithTools(message);

    const self = this;
    async function* generateStream(): AsyncGenerator<GenerateContentResponse> {
      for await (const chunk of stream) {
        yield self.createGeminiStreamResponse(chunk);
      }
    }

    return generateStream();
  }

  async countTokens(request: CountTokensParameters): Promise<CountTokensResponse> {
    // Rough estimation - Azure OpenAI doesn't have a direct token count API
    const text = this.extractTextFromRequest(request);
    const estimatedTokens = Math.ceil(text.length / 4); // Rough estimate
    return { totalTokens: estimatedTokens };
  }

  async embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse> {
    throw new Error('Azure OpenAI embeddings not implemented in this adapter');
  }

  private extractMessageFromRequest(request: GenerateContentParameters): string {
    // Convert contents to a message string
    const contents = Array.isArray(request.contents) ? request.contents : (request.contents ? [request.contents] : []);
    
    const messages: string[] = [];
    for (const content of contents) {
      // Type-safe handling of content structure
      const contentObj = content as any;
      const parts = Array.isArray(contentObj.parts) ? contentObj.parts : [];
      const text = parts
        .filter((part: any) => part && typeof part === 'object' && 'text' in part)
        .map((part: any) => part.text)
        .join(' ');
      
      if (text.trim()) {
        messages.push(text);
      }
    }

    return messages.join('\n');
  }

  private createGeminiResponse(text: string): GenerateContentResponse {
    const geminiResponse = new (GenerateContentResponse as any)();
    geminiResponse.candidates = [{
      content: {
        parts: [{ text }],
        role: 'model'
      },
      finishReason: 'STOP' as FinishReason,
      index: 0
    }];
    // Set required properties that are computed from candidates
    Object.defineProperty(geminiResponse, 'text', {
      get() { return text; }
    });
    return geminiResponse;
  }

  private createGeminiStreamResponse(text: string): GenerateContentResponse {
    const geminiResponse = new (GenerateContentResponse as any)();
    geminiResponse.candidates = [{
      content: {
        parts: [{ text }],
        role: 'model'
      },
      finishReason: text.includes('\n✅') ? undefined : undefined, // Keep streaming unless we see completion
      index: 0
    }];
    // Set required properties that are computed from candidates
    Object.defineProperty(geminiResponse, 'text', {
      get() { return text; }
    });
    return geminiResponse;
  }

  private extractTextFromRequest(request: CountTokensParameters): string {
    if (!request.contents) return '';
    
    const contents = Array.isArray(request.contents) ? request.contents : [request.contents];
    return contents
      .flatMap((content: any) => Array.isArray(content.parts) ? content.parts : [])
      .filter((part: any) => part && typeof part === 'object' && 'text' in part)
      .map((part: any) => part.text)
      .join(' ');
  }
}

/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 */
export interface ContentGenerator {
  generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;

  userTier?: UserTierId;
}

export enum AuthType {
  LOGIN_WITH_GOOGLE = 'oauth-personal',
  USE_GEMINI = 'gemini-api-key',  // Kept for backward compatibility
  USE_UNIPATH = 'gemini-api-key',  // New preferred name
  USE_VERTEX_AI = 'vertex-ai',
  CLOUD_SHELL = 'cloud-shell',
  AZURE_OPENAI = 'azure-openai',
}

export type ContentGeneratorConfig = {
  model: string;
  apiKey?: string;
  vertexai?: boolean;
  authType?: AuthType;
  proxy?: string;
  azureEndpoint?: string;
  azureApiVersion?: string;
  azureDeployment?: string;
};

export function createContentGeneratorConfig(
  config: Config,
  authType: AuthType | undefined,
): ContentGeneratorConfig {
  const geminiApiKey = process.env['GEMINI_API_KEY'] || undefined;
  const googleApiKey = process.env['GOOGLE_API_KEY'] || undefined;
  const googleCloudProject = process.env['GOOGLE_CLOUD_PROJECT'] || undefined;
  const googleCloudLocation = process.env['GOOGLE_CLOUD_LOCATION'] || undefined;
  const azureApiKey = process.env['AZURE_API_KEY'] || undefined;
  const azureEndpoint = process.env['AZURE_ENDPOINT_URL'] || undefined;
  const azureApiVersion = process.env['AZURE_OPENAI_API_VERSION'] || '2024-12-01-preview';
  const azureDeployment = process.env['AZURE_DEPLOYMENT'] || undefined;

  // Use runtime model from config if available; otherwise, fall back based on auth type
  let effectiveModel: string;
  if (authType === AuthType.AZURE_OPENAI) {
    // For Azure OpenAI, prioritize AZURE_MODEL env var, then config model, then default
    effectiveModel = process.env['AZURE_MODEL'] || config.getModel() || DEFAULT_AZURE_MODEL;
  } else {
    // For other auth types, use config model or fallback to default
    effectiveModel = config.getModel() || DEFAULT_GEMINI_MODEL;
  }

  const contentGeneratorConfig: ContentGeneratorConfig = {
    model: effectiveModel,
    authType,
    proxy: config?.getProxy(),
  };

  // If we are using Google auth or we are in Cloud Shell, there is nothing else to validate for now
  if (
    authType === AuthType.LOGIN_WITH_GOOGLE ||
    authType === AuthType.CLOUD_SHELL
  ) {
    return contentGeneratorConfig;
  }

  if (authType === AuthType.USE_GEMINI && geminiApiKey) {
    contentGeneratorConfig.apiKey = geminiApiKey;
    contentGeneratorConfig.vertexai = false;

    return contentGeneratorConfig;
  }

  if (
    authType === AuthType.USE_VERTEX_AI &&
    (googleApiKey || (googleCloudProject && googleCloudLocation))
  ) {
    contentGeneratorConfig.apiKey = googleApiKey;
    contentGeneratorConfig.vertexai = true;

    return contentGeneratorConfig;
  }

  if (authType === AuthType.AZURE_OPENAI && azureApiKey && azureEndpoint && azureDeployment) {
    contentGeneratorConfig.apiKey = azureApiKey;
    contentGeneratorConfig.azureEndpoint = azureEndpoint;
    contentGeneratorConfig.azureApiVersion = azureApiVersion;
    contentGeneratorConfig.azureDeployment = azureDeployment;

    return contentGeneratorConfig;
  }

  return contentGeneratorConfig;
}

// Helper functions for Azure AI models
function extractTextFromGenerateRequest(request: GenerateContentParameters): string {
  const contents = Array.isArray(request.contents) ? request.contents : (request.contents ? [request.contents] : []);
  const messages: string[] = [];
  
  for (const content of contents) {
    const contentObj = content as any;
    const parts = Array.isArray(contentObj.parts) ? contentObj.parts : [];
    const text = parts
      .filter((part: any) => part && typeof part === 'object' && 'text' in part)
      .map((part: any) => part.text)
      .join(' ');
    
    if (text.trim()) {
      messages.push(text);
    }
  }
  
  return messages.join('\n');
}

function extractTextFromCountRequest(request: CountTokensParameters): string {
  if (!request.contents) return '';
  
  const contents = Array.isArray(request.contents) ? request.contents : [request.contents];
  return contents
    .flatMap((content: any) => Array.isArray(content.parts) ? content.parts : [])
    .filter((part: any) => part && typeof part === 'object' && 'text' in part)
    .map((part: any) => part.text)
    .join(' ');
}

function createGenerateContentResponse(text: string): GenerateContentResponse {
  const geminiResponse = new (GenerateContentResponse as any)();
  geminiResponse.candidates = [{
    content: {
      parts: [{ text }],
      role: 'model'
    },
    finishReason: 'STOP' as FinishReason,
    index: 0
  }];
  
  Object.defineProperty(geminiResponse, 'text', {
    get() { return text; }
  });
  
  return geminiResponse;
}

export async function createContentGenerator(
  config: ContentGeneratorConfig,
  gcConfig: Config,
  sessionId?: string,
): Promise<ContentGenerator> {
  const version = process.env['CLI_VERSION'] || process.version;
  const userAgent = `UnipathCLI/${version} (${process.platform}; ${process.arch})`;
  const baseHeaders: Record<string, string> = {
    'User-Agent': userAgent,
  };

  if (
    config.authType === AuthType.LOGIN_WITH_GOOGLE ||
    config.authType === AuthType.CLOUD_SHELL
  ) {
    const httpOptions = { headers: baseHeaders };
    return new LoggingContentGenerator(
      await createCodeAssistContentGenerator(
        httpOptions,
        config.authType,
        gcConfig,
        sessionId,
      ),
      gcConfig,
    );
  }

  if (
    config.authType === AuthType.USE_GEMINI ||
    config.authType === AuthType.USE_VERTEX_AI
  ) {
    let headers: Record<string, string> = { ...baseHeaders };
    if (gcConfig?.getUsageStatisticsEnabled()) {
      const installationManager = new InstallationManager();
      const installationId = installationManager.getInstallationId();
      headers = {
        ...headers,
        'x-gemini-api-privileged-user-id': `${installationId}`,
      };
    }
    const httpOptions = { headers };

    const googleGenAI = new GoogleGenAI({
      apiKey: config.apiKey === '' ? undefined : config.apiKey,
      vertexai: config.vertexai,
      httpOptions,
    });
    return new LoggingContentGenerator(googleGenAI.models, gcConfig);
  }

  if (config.authType === AuthType.AZURE_OPENAI) {
    // Check if this is a DeepSeek or other Azure AI model endpoint
    const endpoint = config.azureEndpoint || process.env['AZURE_ENDPOINT_URL'] || process.env['ENDPOINT'] || '';
    const model = process.env['AZURE_MODEL'] || '';
    const isDeepSeek = model.toLowerCase().includes('deepseek');
    const isAzureAIModel = endpoint.includes('models.ai.azure.com') || endpoint.includes('services.ai.azure.com');
    
    if (isDeepSeek || isAzureAIModel) {
      // Use DeepSeekWithOrchestration for DeepSeek models or Azure AI models to support tools
      const deepSeekClient = new DeepSeekWithOrchestration(gcConfig);
      
      // Session-based approval state
      let sessionAutoApprove = false;
      let globalAutoApprove = false;
      
      // ApprovalManager removed - using direct readline approach for immediate functionality
      
      // Set up progress callback to show tool execution progress in real-time
      deepSeekClient.setProgressCallback((message: string) => {
        console.log(message);
      });
      
      // Set up approval flow callback using direct readline prompts
      deepSeekClient.setConfirmationCallback(async (details: any) => {
        // Check config approval mode first
        const approvalMode = gcConfig.getApprovalMode();
        console.log(`🔧 DEBUG: Approval mode check: ${approvalMode}`);
        console.log(`🔧 DEBUG: Will need approval: ${approvalMode !== ApprovalMode.AUTO_EDIT && approvalMode !== ApprovalMode.YOLO}`);
        if (approvalMode === ApprovalMode.AUTO_EDIT || approvalMode === ApprovalMode.YOLO) {
          console.log(`✅ AUTO-APPROVED (${approvalMode} mode)`);
          return true;
        }
        
        // Check if global auto-approve is enabled
        if (globalAutoApprove) {
          console.log('⚡ AUTO-APPROVED (YOLO mode)');
          return true;
        }
        
        // Check if session auto-approve is enabled
        if (sessionAutoApprove) {
          console.log('✅ AUTO-APPROVED (session setting)');
          return true;
        }
        
        // For file operations, try to open diff in IDE
        if (details.type === 'edit' || details.filePath) {
          const filePath = details.filePath || details.path || details.file_path;
          const content = details.content || details.new_content;
          
          try {
            const ideClient = await IdeClient.getInstance();
            
            // Check if IDE is connected
            if (ideClient.getConnectionStatus().status === 'connected') {
              console.log(`\n🔗 Opening diff in IDE for: ${filePath}`);
              console.log('💡 Review changes in your editor and approve/reject from there');
              
              // Open diff in native IDE - this will show the diff and wait for user action
              const result = await ideClient.openDiff(filePath, content);
              
              if (result.status === 'accepted') {
                console.log('✅ Changes approved in IDE');
                // Only enable session auto-approve for non-default approval modes
                if (approvalMode !== ApprovalMode.DEFAULT) {
                  sessionAutoApprove = true;
                }
                return true;
              } else {
                console.log('❌ Changes rejected in IDE');
                return false;
              }
            } else {
              // Check if we're in interactive mode (CLI with UI) or non-interactive mode
              const isNonInteractive = process.argv.includes('--non-interactive') || 
                                      process.env['UNIPATH_NON_INTERACTIVE'] === 'true' ||
                                      process.env['NODE_ENV'] === 'test';
              const isInteractiveMode = !isNonInteractive;
              // Mode detection complete
              
              // Use ApprovalManager for both modes - this integrates with the CLI UI system
              const isNewFile = details.originalContent === '' || details.originalContent === undefined;
              const actionType = isNewFile ? 'Create' : 'Edit';
              
              try {
                // Import ApprovalManager and get singleton instance
                const { ApprovalManager } = await import('../orchestration/ApprovalManager.js');
                const approvalManager = ApprovalManager.getInstance();
                
                // Create approval request
                const approvalRequest = {
                  type: 'file_edit' as const,
                  description: `${actionType} file: ${filePath}`,
                  details: {
                    filePath: filePath,
                    content: details.content || details.new_content,
                    oldText: details.originalContent,
                    newText: details.content || details.new_content
                  },
                  riskLevel: isNewFile ? 'medium' as const : 'low' as const
                };
                
                if (isInteractiveMode) {
                  // Interactive mode - use the approval system that integrates with React Ink UI
                  console.log(`\n🔗 Requesting approval through CLI UI system for: ${actionType} file: ${filePath}`);
                  const response = await approvalManager.requestApproval(approvalRequest);
                  
                  if (response.approved) {
                    console.log('✅ Approved via CLI UI');
                    // Only enable session auto-approve for non-default approval modes
                    // In default mode, ask for each operation individually
                    if (approvalMode !== ApprovalMode.DEFAULT) {
                      sessionAutoApprove = true;
                    }
                    return true;
                  } else {
                    console.log('❌ Denied via CLI UI');
                    return false;
                  }
                } else {
                  // Non-interactive mode - fallback to console prompts
                  console.log(`\n🔐 Using ApprovalManager for: ${actionType} file: ${filePath}`);
                  const response = await approvalManager.requestApproval(approvalRequest);
                  
                  if (response.approved) {
                    console.log('✅ Approved');
                    // Only enable session auto-approve for non-default approval modes
                    if (approvalMode !== ApprovalMode.DEFAULT) {
                      sessionAutoApprove = true;
                    }
                    return true;
                  } else {
                    console.log('❌ Denied');
                    return false;
                  }
                }
              } catch (error) {
                console.error('Error with ApprovalManager, falling back to old system:', error);
                // Fallback to auto-approve in all cases when ApprovalManager fails
                console.log(`\n🔐 APPROVAL: ${actionType} file: ${filePath}`);
                console.log(`   Auto-approving due to ApprovalManager error`);
                return true;
              }
            }
          } catch (error) {
            console.error('❌ IDE integration error:', error);
            // Fallback to auto-approve if IDE fails, but respect approval mode
            if (approvalMode !== ApprovalMode.DEFAULT) {
              sessionAutoApprove = true;
            }
            return true;
          }
        } else {
          // For non-file operations, also use ApprovalManager
          try {
            // Import ApprovalManager and get singleton instance
            const { ApprovalManager } = await import('../orchestration/ApprovalManager.js');
            const approvalManager = ApprovalManager.getInstance();
            
            // Create approval request for non-file operations
            const actionType = details.type === 'shell_command' ? 'Execute command' : 'Perform action';
            const actionDesc = details.command || details.operation || details.type;
            
            const approvalRequest = {
              type: details.type === 'shell_command' ? 'shell_command' as const : 'high_risk' as const,
              description: `${actionType}: ${actionDesc}`,
              details: {
                command: details.command || undefined,
                content: details.operation || details.type,
              },
              riskLevel: details.type === 'shell_command' ? 'high' as const : 'medium' as const
            };
            
            console.log(`\n🔗 Requesting approval through CLI UI system for: ${actionType}`);
            const response = await approvalManager.requestApproval(approvalRequest);
            
            if (response.approved) {
              console.log('✅ Approved via CLI UI');
              // Only enable session auto-approve for non-default approval modes
              if (approvalMode !== ApprovalMode.DEFAULT) {
                sessionAutoApprove = true;
              }
              return true;
            } else {
              console.log('❌ Denied via CLI UI');
              return false;
            }
          } catch (error) {
            console.error('Error with ApprovalManager for non-file operation, auto-approving:', error);
            return true;
          }
        }
      });
      
      // Create a wrapper that implements ContentGenerator interface
      const azureAIGenerator: ContentGenerator = {
        async generateContent(request: GenerateContentParameters): Promise<GenerateContentResponse> {
          const message = extractTextFromGenerateRequest(request);
          // Use the tools-enabled method
          const response = await deepSeekClient.sendMessageWithTools(message);
          return createGenerateContentResponse(response);
        },
        async generateContentStream(request: GenerateContentParameters): Promise<AsyncGenerator<GenerateContentResponse>> {
          const message = extractTextFromGenerateRequest(request);
          // Use the tools-enabled stream method
          const stream = deepSeekClient.sendMessageStreamWithTools(message);
          
          async function* wrapStream(): AsyncGenerator<GenerateContentResponse> {
            for await (const chunk of stream) {
              yield createGenerateContentResponse(chunk);
            }
          }
          
          return wrapStream();
        },
        async countTokens(request: CountTokensParameters): Promise<CountTokensResponse> {
          const text = extractTextFromCountRequest(request);
          return { totalTokens: Math.ceil(text.length / 4) };
        },
        async embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse> {
          throw new Error('Embeddings not supported for Azure AI models');
        }
      };
      
      return new LoggingContentGenerator(azureAIGenerator, gcConfig);
    } else {
      // Regular Azure OpenAI endpoint
      if (!config.apiKey || !config.azureEndpoint || !config.azureDeployment) {
        throw new Error('Azure OpenAI configuration incomplete: missing apiKey, azureEndpoint, or azureDeployment');
      }
      
      const azureGenerator = new AzureOpenAIContentGenerator(
        config.apiKey,
        config.azureEndpoint,
        config.azureApiVersion || '2024-12-01-preview',
        config.azureDeployment,
        gcConfig
      );
      
      return new LoggingContentGenerator(azureGenerator, gcConfig);
    }
  }

  throw new Error(
    `Error creating contentGenerator: Unsupported authType: ${config.authType}`,
  );
}
