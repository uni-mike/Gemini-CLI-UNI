/**
 * Memory Manager
 * Orchestrates all memory layers with strict token budgeting
 */

import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { ProjectManager } from './project-manager.js';
import { TokenBudgetManager } from './token-budget.js';
import { EmbeddingsManager } from './embeddings.js';
import { SessionManager } from './session-manager.js';
import { EphemeralMemory } from './layers/ephemeral.js';
import { RetrievalLayer } from './layers/retrieval.js';
import { GitContextLayer } from './layers/git-context.js';
import { OperatingMode, TOKEN_LIMITS } from './constants.js';
import { Message } from '../llm/provider.js';

export interface MemoryContext {
  ephemeral: string;
  retrieved: string;
  knowledge: string;
  gitContext: string;
  totalTokens: number;
}

export interface PromptComponents {
  systemPrompt: string;
  modeDeclaration: string;
  knowledge: string;
  ephemeral: string;
  retrieved: string;
  userQuery: string;
  outputContract: string;
}

export class MemoryManager extends EventEmitter {
  private projectManager: ProjectManager;
  private tokenBudget: TokenBudgetManager;
  private embeddings: EmbeddingsManager;
  private sessionManager: SessionManager;
  private ephemeral: EphemeralMemory;
  private retrieval: RetrievalLayer;
  private gitContext: GitContextLayer;
  private prisma: PrismaClient;
  private mode: OperatingMode;
  
  constructor(mode: OperatingMode = 'concise') {
    super();
    this.mode = mode;
    this.projectManager = new ProjectManager();
    this.tokenBudget = new TokenBudgetManager(mode);
    this.embeddings = new EmbeddingsManager();
    
    // Initialize Prisma with project-specific database
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${this.projectManager.getDbPath()}`
        }
      }
    });
    
    const projectId = this.projectManager.getProjectId();
    
    this.sessionManager = new SessionManager(this.prisma, this.projectManager);
    this.ephemeral = new EphemeralMemory(this.tokenBudget);
    this.retrieval = new RetrievalLayer(this.prisma, this.embeddings, this.tokenBudget, projectId);
    this.gitContext = new GitContextLayer(this.prisma, this.embeddings, this.tokenBudget, projectId);
  }
  
  /**
   * Initialize memory system
   */
  async initialize(): Promise<void> {
    // Initialize project manager with database lookup
    await this.projectManager.initializeWithDatabase();
    
    // Run database migrations if needed
    await this.ensureDatabase();
    
    // Start or recover session
    const sessionState = await this.sessionManager.startSession(this.mode);
    
    // Restore ephemeral state if recovered
    if (sessionState.ephemeralState.turns.length > 0) {
      this.ephemeral.restoreState(sessionState.ephemeralState);
    }
    
    // Parse git history in background
    this.gitContext.parseGitHistory().catch(err => 
      console.warn('Failed to parse git history:', err)
    );
    
    // Clean old data
    this.projectManager.cleanCache();
    this.projectManager.rotateLogs();
    await this.sessionManager.cleanOldSessions();
  }
  
  /**
   * Ensure database is initialized
   */
  private async ensureDatabase(): Promise<void> {
    try {
      // Check if database exists by trying to query schema version
      const schemaVersion = await this.prisma.schemaVersion.findFirst({
        orderBy: { appliedAt: 'desc' }
      });
      
      if (!schemaVersion || schemaVersion.version < 1) {
        // Initialize schema
        await this.prisma.schemaVersion.create({
          data: { version: 1 }
        });
        
        // Ensure project record exists
        const projectId = this.projectManager.getProjectId();
        const metadata = this.projectManager.getMetadata();
        
        await this.prisma.project.upsert({
          where: { id: projectId },
          create: {
            id: projectId,
            rootPath: metadata.rootPath,
            name: metadata.name
          },
          update: {
            name: metadata.name
          }
        });
      }
    } catch (error) {
      console.warn('Database initialization warning:', error);
      // Database might not exist yet, Prisma will create it on first write
    }
  }
  
  /**
   * Build prompt with all memory layers
   */
  async buildPrompt(userQuery: string, options?: {
    includeExplanation?: boolean;
    focusFiles?: string[];
  }): Promise<PromptComponents> {
    this.tokenBudget.reset();
    
    // Track user query tokens
    this.tokenBudget.addToInput('query', userQuery);
    
    // Update working context
    if (options?.focusFiles) {
      this.ephemeral.updateWorkingContext({ focusFiles: options.focusFiles });
    }
    
    // Add turn to ephemeral
    this.ephemeral.addTurn('user', userQuery);
    
    // Get components within budget
    const components = await this.gatherComponents(userQuery, options);
    
    // Build system prompt
    const systemPrompt = this.buildSystemPrompt();
    
    // Build mode declaration
    const modeDeclaration = this.buildModeDeclaration();
    
    // Build output contract
    const outputContract = this.buildOutputContract(options?.includeExplanation);
    
    // Track operation for snapshot
    this.sessionManager.trackOperation();
    
    return {
      systemPrompt,
      modeDeclaration,
      knowledge: components.knowledge,
      ephemeral: components.ephemeral,
      retrieved: components.retrieved,
      userQuery,
      outputContract
    };
  }
  
  /**
   * Gather memory components within budget
   */
  private async gatherComponents(query: string, options?: {
    focusFiles?: string[];
  }): Promise<{
    ephemeral: string;
    retrieved: string;
    knowledge: string;
  }> {
    // Get ephemeral context
    const ephemeralContext = this.ephemeral.getFormattedContext();
    this.tokenBudget.addToInput('ephemeral', ephemeralContext);
    
    // Get knowledge summary
    const knowledge = await this.getKnowledgeSummary();
    this.tokenBudget.addToInput('knowledge', knowledge);
    
    // Calculate remaining budget for retrieval
    const retrievalBudget = this.tokenBudget.getRemainingBudget('retrieved');
    
    // Retrieve relevant chunks
    const chunks = await this.retrieval.retrieveWithinBudget(
      query,
      retrievalBudget,
      {
        fileFilter: options?.focusFiles,
        recencyBoost: true,
        proximityBoost: true
      }
    );
    
    // Format retrieved context
    const retrieved = this.formatRetrieved(chunks);
    this.tokenBudget.addToInput('retrieved', retrieved);
    
    // Update session state
    this.sessionManager.updateState({
      retrievalIds: chunks.map(c => c.id)
    });
    
    return {
      ephemeral: ephemeralContext,
      retrieved,
      knowledge
    };
  }
  
  /**
   * Build system prompt
   */
  private buildSystemPrompt(): string {
    const reasoningCap = this.tokenBudget.getReasoningCap();
    
    return `You are FlexiCLI's coding assistant. Reason internally but DO NOT output reasoning unless explicitly requested. Follow output contracts strictly. Obey token budgets. Prefer minimal changes and compile-ready code. Internal reasoning token budget ≤ ${reasoningCap}.`;
  }
  
  /**
   * Build mode declaration
   */
  private buildModeDeclaration(): string {
    const outputLimit = this.tokenBudget.getOutputLimit();
    const reasoningCap = this.tokenBudget.getReasoningCap();
    
    return `Operating Mode: ${this.mode}
Max Output Tokens: ${outputLimit}
Reasoning Cap: ${reasoningCap}
Output must be valid JSON only.`;
  }
  
  /**
   * Build output contract
   */
  private buildOutputContract(includeExplanation?: boolean): string {
    if (includeExplanation) {
      return `Output Contract:
{
  "code": "string",      // Full code or unified diff
  "explanation": "string" // Brief explanation
}`;
    }
    
    return `Output Contract:
{
  "code": "string",      // Full code or unified diff
  "explanation": null    // Omit unless --explain flag
}`;
  }
  
  /**
   * Get knowledge summary
   */
  private async getKnowledgeSummary(): Promise<string> {
    const knowledge = await this.prisma.knowledge.findMany({
      where: { projectId: this.projectManager.getProjectId() },
      orderBy: { importance: 'desc' },
      take: 10
    });
    
    if (knowledge.length === 0) {
      return 'No project-specific knowledge stored.';
    }
    
    const items = knowledge.map(k => `${k.key}: ${k.value}`);
    return `Project Knowledge:\n${items.join('\n')}`;
  }
  
  /**
   * Format retrieved chunks
   */
  private formatRetrieved(chunks: any[]): string {
    if (chunks.length === 0) {
      return 'No relevant context retrieved.';
    }
    
    const formatted = chunks.map(chunk => {
      const header = `--- ${chunk.path} (similarity: ${chunk.similarity.toFixed(2)}) ---`;
      return `${header}\n${chunk.content}`;
    });
    
    return `Retrieved Context:\n${formatted.join('\n\n')}`;
  }
  
  /**
   * Add assistant response
   */
  addAssistantResponse(response: string): void {
    this.ephemeral.addTurn('assistant', response);
    this.sessionManager.updateState({
      ephemeralState: this.ephemeral.getState()
    });
  }
  
  /**
   * Store knowledge
   */
  async storeKnowledge(key: string, value: string, category: string = 'preference'): Promise<void> {
    await this.prisma.knowledge.upsert({
      where: {
        projectId_key: {
          projectId: this.projectManager.getProjectId(),
          key
        }
      },
      create: {
        projectId: this.projectManager.getProjectId(),
        key,
        value,
        category
      },
      update: {
        value,
        category
      }
    });
  }
  
  /**
   * Save important snapshot
   */
  async saveSnapshot(reason: string): Promise<void> {
    this.sessionManager.updateState({
      ephemeralState: this.ephemeral.getState(),
      tokenBudget: this.tokenBudget.getUsage()
    });
    await this.sessionManager.saveImportantSnapshot(reason);
  }
  
  /**
   * Get token usage report
   */
  getTokenReport(): string {
    return this.tokenBudget.getUsageReport();
  }
  
  /**
   * Set operating mode
   */
  setMode(mode: OperatingMode): void {
    this.mode = mode;
    this.tokenBudget.setMode(mode);
  }
  
  /**
   * Format messages for LLM
   */
  formatMessages(components: PromptComponents): Message[] {
    const messages: Message[] = [
      {
        role: 'system',
        content: `${components.systemPrompt}\n\n${components.modeDeclaration}`
      }
    ];
    
    // Add context as system message
    if (components.knowledge || components.ephemeral || components.retrieved) {
      const context = [
        components.knowledge,
        components.ephemeral,
        components.retrieved
      ].filter(Boolean).join('\n\n');
      
      if (context) {
        messages.push({
          role: 'system',
          content: context
        });
      }
    }
    
    // Add user query
    messages.push({
      role: 'user',
      content: `${components.userQuery}\n\n${components.outputContract}`
    });
    
    return messages;
  }
  
  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.sessionManager.endSession();
    await this.prisma.$disconnect();
  }
}