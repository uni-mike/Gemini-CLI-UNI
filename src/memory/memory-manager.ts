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
  private _initialized: boolean = false;
  
  constructor(mode: OperatingMode = 'concise') {
    super();
    this.mode = mode;
    this.projectManager = new ProjectManager();
    this.tokenBudget = new TokenBudgetManager(mode);
    this.embeddings = new EmbeddingsManager();
    
    // Initialize Prisma - use DATABASE_URL env var if available, otherwise use project-specific path
    const databaseUrl = process.env.DATABASE_URL || `file:${this.projectManager.getDbPath()}`;
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl
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

    // IMPORTANT: Ensure project exists in database before creating session
    // This prevents foreign key constraints on new installations
    await this.ensureProjectExists();

    // Start or recover session
    const sessionState = await this.sessionManager.startSession(this.mode);

    // Restore ephemeral state if recovered
    if (sessionState.ephemeralState.turns.length > 0) {
      this.ephemeral.restoreState(sessionState.ephemeralState);
    }

    // Initialize git context in background - don't await to prevent blocking
    // Using setTimeout to ensure it runs after session recovery completes
    setTimeout(() => {
      this.gitContext.initialize().catch(err =>
        console.warn('Failed to initialize git context:', err)
      );
    }, 100);

    // Index codebase in background for semantic search
    setTimeout(() => {
      this.indexCodebase().catch(err =>
        console.warn('Failed to index codebase:', err)
      );
    }, 200);

    // Clean old data
    this.projectManager.cleanCache();
    this.projectManager.rotateLogs();
    await this.sessionManager.cleanOldSessions();

    // Mark as initialized
    this._initialized = true;
  }
  
  /**
   * Get the current operating mode
   */
  getMode(): OperatingMode {
    return this.mode;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionManager.getSessionId();
  }

  /**
   * Check if memory manager is initialized
   */
  get initialized(): boolean {
    return this._initialized;
  }

  /**
   * Ensure database is initialized
   * RACE CONDITION PROTECTION: Handle concurrent database access gracefully
   */
  private async ensureDatabase(): Promise<void> {
    try {
      // Check if database exists by trying to query schema version
      const schemaVersion = await this.prisma.schemaVersion.findFirst({
        orderBy: { appliedAt: 'desc' }
      });

      if (!schemaVersion || schemaVersion.version < 1) {
        // Initialize schema - handle race condition where another agent might have created it
        try {
          await this.prisma.schemaVersion.create({
            data: { version: 1 }
          });
        } catch (createError: any) {
          // If it fails with unique constraint, another agent already created it - that's fine
          if (createError.code === 'P2002') {
            console.log('📊 Schema version already created by another agent');
          } else {
            throw createError;
          }
        }

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
   * Ensure project exists in database (prevents foreign key constraints)
   */
  private async ensureProjectExists(): Promise<void> {
    try {
      const projectId = this.projectManager.getProjectId();
      const metadata = this.projectManager.getMetadata();

      // Upsert project to ensure it exists
      await this.prisma.project.upsert({
        where: { id: projectId },
        create: {
          id: projectId,
          rootPath: metadata.rootPath,
          name: metadata.name
        },
        update: {
          name: metadata.name,
          updatedAt: new Date()
        }
      });

      console.log(`✅ Project ${metadata.name} (${projectId}) ensured in database`);
    } catch (error) {
      console.error('Failed to ensure project exists:', error);
      // Don't throw - allow system to continue even if project creation fails
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
    
    // Emit memory layer update for ephemeral
    this.emit('memory-layer-update', {
      layer: 'ephemeral',
      tokens: this.tokenBudget.getUsage('ephemeral'),
      size: ephemeralContext.length
    });
    
    // Get knowledge summary
    const knowledge = await this.getKnowledgeSummary();
    this.tokenBudget.addToInput('knowledge', knowledge);
    
    // Emit memory layer update for knowledge
    this.emit('memory-layer-update', {
      layer: 'knowledge',
      tokens: this.tokenBudget.getUsage('knowledge'),
      size: knowledge.length
    });
    
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
    
    // Emit memory layer update for retrieval
    this.emit('memory-layer-update', {
      layer: 'retrieval',
      tokens: this.tokenBudget.getUsage('retrieved'),
      size: retrieved.length,
      chunks: chunks.length
    });
    
    // Update session state
    this.sessionManager.updateState({
      retrievalIds: chunks.map(c => c.id)
    });
    
    // Emit overall memory update
    this.emit('memory-update', {
      totalTokens: this.tokenBudget.getTotalUsage(),
      layers: {
        ephemeral: this.tokenBudget.getUsage('ephemeral'),
        knowledge: this.tokenBudget.getUsage('knowledge'),
        retrieval: this.tokenBudget.getUsage('retrieved')
      }
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

    // Track conversation turn and update session metadata
    this.trackConversationTurn().catch(err => {
      console.warn('Failed to track conversation turn:', err);
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
   * Track tokens from API response (for session persistence)
   */
  async trackApiTokens(tokens: number): Promise<void> {
    console.log('📊 [MEMORY] Tracking API tokens:', tokens);

    try {
      const sessionId = this.sessionManager.getSessionId();
      if (!sessionId) {
        console.warn('📊 [MEMORY] No session ID available');
        return;
      }

      // Directly update the session in database - bypass token budget complexity
      await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          tokensUsed: {
            increment: tokens
          }
        }
      });

      console.log(`📊 [MEMORY] ✅ Updated session ${sessionId} with ${tokens} tokens directly`);
    } catch (error) {
      console.error('📊 [MEMORY] ❌ Failed to update session tokens:', error);
    }
  }

  /**
   * Track conversation turn and update session metadata directly
   */
  async trackConversationTurn(): Promise<void> {
    console.log('📊 [MEMORY] Tracking conversation turn');

    try {
      const sessionId = this.sessionManager.getSessionId();
      if (!sessionId) {
        console.warn('📊 [MEMORY] No session ID available for turn tracking');
        return;
      }

      // Get current ephemeral state for turn count
      const sessionState = this.sessionManager.getState();
      const turnCount = sessionState?.ephemeralState.turns.length || 0;

      // Create snapshot metadata
      const snapshotMetadata = {
        sequenceNumber: turnCount,
        timestamp: new Date().toISOString(),
        reason: 'conversation_turn'
      };

      // Directly update session with turn count and snapshot metadata
      await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          turnCount: turnCount,
          lastSnapshot: JSON.stringify(snapshotMetadata)
        }
      });

      console.log(`📊 [MEMORY] ✅ Updated session ${sessionId} with turnCount: ${turnCount} and snapshot metadata`);
    } catch (error) {
      console.error('📊 [MEMORY] ❌ Failed to update conversation turn:', error);
    }
  }

  /**
   * Store a code chunk for semantic retrieval
   * @param path File path
   * @param content Code content
   * @param chunkType Type of chunk (code, doc, diff)
   * @param metadata Optional metadata (language, line numbers, etc.)
   * @returns Chunk ID
   */
  async storeChunk(
    path: string,
    content: string,
    chunkType: 'code' | 'doc' | 'diff' = 'code',
    metadata?: {
      language?: string;
      commitHash?: string;
      lineStart?: number;
      lineEnd?: number;
      [key: string]: any;
    }
  ): Promise<string> {
    try {
      const chunkId = await this.retrieval.storeChunk(path, content, chunkType, metadata);

      // Emit chunk storage event for monitoring
      this.emit('chunk-stored', {
        chunkId,
        path,
        contentLength: content.length,
        chunkType,
        metadata
      });

      console.log(`📦 [MEMORY] Stored chunk: ${path} (${content.length} chars, type: ${chunkType})`);
      return chunkId;
    } catch (error: any) {
      console.error(`📦 [MEMORY] ❌ Failed to store chunk for ${path}:`, error.message);
      throw error;
    }
  }

  /**
   * Store multiple chunks in batch
   * @param chunks Array of chunk data
   * @returns Array of chunk IDs
   */
  async storeChunks(
    chunks: Array<{
      path: string;
      content: string;
      chunkType: 'code' | 'doc' | 'diff';
      metadata?: any;
    }>
  ): Promise<string[]> {
    try {
      const chunkIds = await this.retrieval.storeChunks(chunks);

      // Emit batch storage event
      this.emit('chunks-stored', {
        count: chunks.length,
        totalSize: chunks.reduce((sum, c) => sum + c.content.length, 0),
        paths: chunks.map(c => c.path)
      });

      console.log(`📦 [MEMORY] Stored ${chunks.length} chunks (${chunks.reduce((sum, c) => sum + c.content.length, 0)} total chars)`);
      return chunkIds;
    } catch (error: any) {
      console.error(`📦 [MEMORY] ❌ Failed to store batch chunks:`, error.message);
      throw error;
    }
  }

  /**
   * Index existing codebase for semantic search
   * This runs in background during initialization
   */
  private async indexCodebase(): Promise<void> {
    try {
      const { readdir, readFile, stat } = await import('fs/promises');
      const { join, extname } = await import('path');

      console.log('📦 [MEMORY] Starting codebase indexing...');

      // Check if we already have recent chunks to avoid re-indexing
      const existingChunks = await this.prisma.chunk.count({
        where: {
          projectId: this.projectManager.getProjectId(),
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });

      if (existingChunks > 10) {
        console.log(`📦 [MEMORY] Skipping indexing - ${existingChunks} recent chunks already exist`);
        return;
      }

      // Get project root
      const projectRoot = this.projectManager.getProjectRoot();

      // Directories to index
      const dirsToIndex = ['src', 'lib', 'components', 'pages', 'api', 'utils', 'tests'];

      // Extensions to index
      const extensionsToIndex = [
        '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c',
        '.cs', '.php', '.rb', '.go', '.rs', '.kt', '.swift',
        '.html', '.css', '.scss', '.md', '.json', '.yml', '.yaml'
      ];

      const chunksToStore: Array<{
        path: string;
        content: string;
        chunkType: 'code' | 'doc' | 'diff';
        metadata?: any;
      }> = [];

      // Recursively scan directories
      const scanDirectory = async (dirPath: string, maxDepth: number = 3): Promise<void> => {
        if (maxDepth <= 0) return;

        try {
          const entries = await readdir(dirPath);

          for (const entry of entries) {
            // Skip hidden files, node_modules, build dirs, etc.
            if (entry.startsWith('.') ||
                entry === 'node_modules' ||
                entry === 'dist' ||
                entry === 'build' ||
                entry === 'coverage' ||
                entry === '__pycache__') {
              continue;
            }

            const fullPath = join(dirPath, entry);
            const stats = await stat(fullPath);

            if (stats.isDirectory()) {
              await scanDirectory(fullPath, maxDepth - 1);
            } else if (stats.isFile()) {
              const ext = extname(entry).toLowerCase();

              if (extensionsToIndex.includes(ext) && stats.size < 50000) { // Skip files > 50KB
                try {
                  const content = await readFile(fullPath, 'utf8');

                  if (content.trim().length > 100) { // Only meaningful files
                    const relativePath = fullPath.replace(projectRoot, '').replace(/^\//, '');

                    // Determine language and chunk type
                    const languageMap: Record<string, string> = {
                      '.ts': 'typescript', '.tsx': 'typescript',
                      '.js': 'javascript', '.jsx': 'javascript',
                      '.py': 'python', '.java': 'java', '.cpp': 'cpp',
                      '.c': 'c', '.cs': 'csharp', '.php': 'php',
                      '.rb': 'ruby', '.go': 'go', '.rs': 'rust',
                      '.kt': 'kotlin', '.swift': 'swift',
                      '.html': 'html', '.css': 'css', '.scss': 'scss'
                    };

                    const language = languageMap[ext] || 'text';
                    const chunkType = ['.md', '.txt', '.json', '.yml', '.yaml'].includes(ext) ? 'doc' : 'code';

                    chunksToStore.push({
                      path: relativePath,
                      content,
                      chunkType: chunkType as 'code' | 'doc' | 'diff',
                      metadata: {
                        language,
                        file_extension: ext,
                        line_count: content.split('\n').length,
                        char_count: content.length,
                        indexed_by: 'startup_indexing',
                        indexed_at: new Date().toISOString()
                      }
                    });
                  }
                } catch (error) {
                  // Skip files that can't be read
                }
              }
            }
          }
        } catch (error) {
          // Skip directories that can't be read
        }
      };

      // Scan each target directory
      for (const dir of dirsToIndex) {
        const dirPath = join(projectRoot, dir);
        try {
          await stat(dirPath);
          await scanDirectory(dirPath);
        } catch {
          // Directory doesn't exist, skip
        }
      }

      // Store chunks in batches
      if (chunksToStore.length > 0) {
        const BATCH_SIZE = 20;
        for (let i = 0; i < chunksToStore.length; i += BATCH_SIZE) {
          const batch = chunksToStore.slice(i, i + BATCH_SIZE);
          await this.storeChunks(batch);
        }

        console.log(`📦 [MEMORY] ✅ Indexed ${chunksToStore.length} code files for semantic search`);
      } else {
        console.log('📦 [MEMORY] No code files found to index');
      }

    } catch (error: any) {
      console.error('📦 [MEMORY] ❌ Failed to index codebase:', error.message);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.sessionManager.endSession();
    await this.prisma.$disconnect();
  }
}