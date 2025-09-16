/**
 * Memory Retrieval Tool - Provides AI access to stored memories and knowledge
 */

import { Tool, ToolResult, ParameterSchema } from './base.js';
import { SharedDatabaseManager } from '../memory/shared-database.js';
import { MemoryManager } from '../memory/memory-manager.js';

export class MemoryRetrievalTool extends Tool {
  name = 'memory_retrieval';
  description = `Access ALL memory layers: sessions (conversation history), knowledge (stored facts), executions (tool usage), chunks (code), cache (embeddings), git (commits).
Actions:
- search: Search across all layers with a query
- get_sessions: Get recent conversation sessions
- get_knowledge: Access stored knowledge entries
- get_recent: Get recent tool executions
- get_context: Get current context summary
- get_cache: Access cached embeddings
- get_git_history: View git commits
- get_all_layers: Complete overview of all data
Use this when users ask about past work, recent activities, or need historical context.`;

  parameterSchema: ParameterSchema[] = [
    {
      name: 'action',
      type: 'string',
      required: false,
      default: 'search',
      enum: ['search', 'get_sessions', 'get_knowledge', 'get_recent', 'get_context', 'get_cache', 'get_git_history', 'get_all_layers'],
      description: 'Type of memory retrieval operation'
    },
    {
      name: 'query',
      type: 'string',
      required: false,
      description: 'Search query for semantic search (for search action)'
    },
    {
      name: 'category',
      type: 'string',
      required: false,
      description: 'Knowledge category to filter by'
    },
    {
      name: 'limit',
      type: 'number',
      required: false,
      default: 10,
      description: 'Maximum number of results to return'
    }
  ];

  private db: any;
  private memoryManager: MemoryManager | null = null;

  constructor() {
    super();
    this.initializeDatabase();
  }

  private async initializeDatabase() {
    try {
      const dbManager = SharedDatabaseManager.getInstance();
      this.db = dbManager.getPrisma();

      // Try to get memory manager if available
      if (global.memoryManager) {
        this.memoryManager = global.memoryManager;
      }
    } catch (error) {
      console.error('Failed to initialize database for memory retrieval:', error);
    }
  }

  async execute(args: any): Promise<ToolResult> {
    try {
      // Debug logging
      if (process.env.DEBUG === 'true') {
        console.log('Memory retrieval called with args:', JSON.stringify(args));
      }

      // Ensure database is initialized
      if (!this.db) {
        await this.initializeDatabase();
        if (!this.db) {
          return {
            success: false,
            error: 'Database not available for memory retrieval'
          };
        }
      }

      // Default to get_recent if no action specified and no query
      const action = args.action || (args.query ? 'search' : 'get_recent');
      const limit = Math.min(args.limit || 10, 50); // Cap at 50 results

      switch (action) {
        case 'search':
          return await this.searchMemories(args.query, limit);
        case 'get_sessions':
          return await this.getRecentSessions(limit);
        case 'get_knowledge':
          return await this.getKnowledge(args.category, limit);
        case 'get_recent':
          return await this.getRecentInteractions(limit);
        case 'get_context':
          return await this.getFullContext(limit);
        case 'get_cache':
          return await this.getCacheEntries(args.query, limit);
        case 'get_git_history':
          return await this.getGitHistory(limit);
        case 'get_all_layers':
          return await this.getAllDataLayers(limit);
        default:
          return {
            success: false,
            error: `Unknown action: ${action}`
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Memory retrieval failed: ${error.message}`
      };
    }
  }

  private async searchMemories(query: string, limit: number): Promise<ToolResult> {
    if (!query) {
      return {
        success: false,
        error: 'Query parameter required for search action'
      };
    }

    try {
      // Search in Knowledge base
      const knowledgeResults = await this.db.knowledge.findMany({
        where: {
          OR: [
            { key: { contains: query } },
            { value: { contains: query } }
          ]
        },
        take: limit,
        orderBy: { updatedAt: 'desc' }
      });

      // Search in ExecutionLog
      const executionResults = await this.db.executionLog.findMany({
        where: {
          OR: [
            { tool: { contains: query } },
            { input: { contains: query } },
            { output: { contains: query } }
          ]
        },
        take: limit,
        orderBy: { createdAt: 'desc' }
      });

      // Search in Chunks if available
      const chunkResults = await this.db.chunk.findMany({
        where: {
          content: { contains: query }
        },
        take: limit,
        orderBy: { createdAt: 'desc' }
      });

      const results = {
        knowledge: knowledgeResults.map((k: any) => ({
          key: k.key,
          value: k.value,
          category: k.category,
          importance: k.importance,
          updated: k.updatedAt
        })),
        executions: executionResults.map((e: any) => ({
          tool: e.tool,
          input: e.input?.substring(0, 100),
          output: e.output?.substring(0, 200),
          success: e.success,
          createdAt: e.createdAt
        })),
        chunks: chunkResults.map((c: any) => ({
          content: c.content.substring(0, 200),
          metadata: c.metadata,
          created: c.createdAt
        }))
      };

      return {
        success: true,
        output: JSON.stringify(results, null, 2)
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Search failed: ${error.message}`
      };
    }
  }

  private async getRecentSessions(limit: number): Promise<ToolResult> {
    try {
      const sessions = await this.db.session.findMany({
        take: limit,
        orderBy: { startedAt: 'desc' },
        include: {
          snapshots: {
            take: 1,
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      const results = sessions.map((s: any) => ({
        id: s.id,
        tokensUsed: s.tokensUsed,
        turnCount: s.turnCount,
        startedAt: s.startedAt,
        status: s.status,
        lastSnapshot: s.lastSnapshot || 'No snapshot'
      }));

      return {
        success: true,
        output: JSON.stringify({ count: results.length, sessions: results }, null, 2)
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get sessions: ${error.message}`
      };
    }
  }

  private async getKnowledge(category: string | undefined, limit: number): Promise<ToolResult> {
    try {
      const where = category ? { category } : {};
      const knowledge = await this.db.knowledge.findMany({
        where,
        take: limit,
        orderBy: [
          { importance: 'desc' },
          { updatedAt: 'desc' }
        ]
      });

      const grouped: Record<string, any[]> = {};
      for (const item of knowledge) {
        const cat = item.category || 'uncategorized';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({
          key: item.key,
          value: item.value,
          importance: item.importance
        });
      }

      return {
        success: true,
        output: JSON.stringify({ count: knowledge.length, knowledge: grouped }, null, 2)
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get knowledge: ${error.message}`
      };
    }
  }

  private async getRecentInteractions(limit: number): Promise<ToolResult> {
    try {
      const executions = await this.db.executionLog.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' }
      });

      const results = executions.map((e: any) => ({
        tool: e.tool,
        input: e.input?.substring(0, 100),
        success: e.success,
        output: e.output?.substring(0, 100),
        error: e.errorMessage?.substring(0, 100),
        time: e.createdAt
      }));

      return {
        success: true,
        output: JSON.stringify({ count: results.length, interactions: results }, null, 2)
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get interactions: ${error.message}`
      };
    }
  }

  private async getFullContext(limit: number): Promise<ToolResult> {
    try {
      // Get current session info
      const currentSession = await this.db.session.findFirst({
        orderBy: { startedAt: 'desc' }
      });

      // Get recent knowledge
      const recentKnowledge = await this.db.knowledge.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' }
      });

      // Get recent executions
      const recentExecutions = await this.db.executionLog.findMany({
        take: 5,
        orderBy: { timestamp: 'desc' }
      });

      // Get git commits if available
      const gitCommits = await this.db.gitCommit.findMany({
        take: 3,
        orderBy: { timestamp: 'desc' }
      });

      const context = {
        currentSession: currentSession ? {
          id: currentSession.id,
          tokens: currentSession.tokensUsed,
          turns: currentSession.turnCount,
          startedAt: currentSession.startedAt
        } : null,
        recentKnowledge: recentKnowledge.map((k: any) => ({
          key: k.key,
          value: k.value.substring(0, 100),
          category: k.category
        })),
        recentActions: recentExecutions.map((e: any) => ({
          tool: e.tool,
          input: e.input?.substring(0, 50),
          success: e.success
        })),
        recentCommits: gitCommits.map((c: any) => ({
          message: c.message?.substring(0, 50),
          author: c.author,
          time: c.date
        }))
      };

      return {
        success: true,
        output: JSON.stringify(context, null, 2)
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get context: ${error.message}`
      };
    }
  }

  private async getCacheEntries(query: string | undefined, limit: number): Promise<ToolResult> {
    try {
      const where = query ? {
        OR: [
          { key: { contains: query } },
          { value: { contains: query } }
        ]
      } : {};

      const cacheEntries = await this.db.cache.findMany({
        where,
        take: limit,
        orderBy: { lastAccess: 'desc' }
      });

      const results = cacheEntries.map((c: any) => ({
        key: c.cacheKey,
        value: c.value ? JSON.parse(c.value) : null,
        category: c.category,
        lastAccess: c.lastAccess,
        accessCount: c.accessCount
      }));

      return {
        success: true,
        output: JSON.stringify({ count: results.length, cache: results }, null, 2)
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get cache entries: ${error.message}`
      };
    }
  }

  private async getGitHistory(limit: number): Promise<ToolResult> {
    try {
      const commits = await this.db.gitCommit.findMany({
        take: limit,
        orderBy: { date: 'desc' }
      });

      const results = commits.map((c: any) => ({
        hash: c.hash,
        message: c.message,
        author: c.author,
        date: c.date,
        filesChanged: c.filesChanged ? JSON.parse(c.filesChanged) : [],
        diffChunks: c.diffChunks ? JSON.parse(c.diffChunks) : []
      }));

      return {
        success: true,
        output: JSON.stringify({ count: results.length, commits: results }, null, 2)
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get git history: ${error.message}`
      };
    }
  }

  private async getAllDataLayers(limit: number): Promise<ToolResult> {
    try {
      // Get counts from all tables
      const [
        sessionCount,
        knowledgeCount,
        executionCount,
        chunkCount,
        cacheCount,
        gitCount,
        snapshotCount
      ] = await Promise.all([
        this.db.session.count(),
        this.db.knowledge.count(),
        this.db.executionLog.count(),
        this.db.chunk.count(),
        this.db.cache.count(),
        this.db.gitCommit.count(),
        this.db.sessionSnapshot.count()
      ]);

      // Get samples from each layer
      const [
        sessions,
        knowledge,
        executions,
        chunks,
        cache,
        commits,
        snapshots
      ] = await Promise.all([
        this.db.session.findMany({ take: 3, orderBy: { startedAt: 'desc' } }),
        this.db.knowledge.findMany({ take: 3, orderBy: { importance: 'desc' } }),
        this.db.executionLog.findMany({ take: 3, orderBy: { createdAt: 'desc' } }),
        this.db.chunk.findMany({ take: 3, orderBy: { createdAt: 'desc' } }),
        this.db.cache.findMany({ take: 3, orderBy: { lastAccess: 'desc' } }),
        this.db.gitCommit.findMany({ take: 3, orderBy: { date: 'desc' } }),
        this.db.sessionSnapshot.findMany({ take: 3, orderBy: { createdAt: 'desc' } })
      ]);

      const allLayers = {
        summary: {
          sessions: sessionCount,
          knowledge: knowledgeCount,
          executions: executionCount,
          chunks: chunkCount,
          cache: cacheCount,
          commits: gitCount,
          snapshots: snapshotCount
        },
        sessionLayer: sessions.map((s: any) => ({
          id: s.id.substring(0, 8),
          tokens: s.tokensUsed,
          turns: s.turnCount,
          startedAt: s.startedAt,
          status: s.status
        })),
        knowledgeLayer: knowledge.map((k: any) => ({
          key: k.key,
          value: k.value.substring(0, 50),
          category: k.category,
          importance: k.importance
        })),
        executionLayer: executions.map((e: any) => ({
          tool: e.tool,
          input: e.input?.substring(0, 30),
          success: e.success
        })),
        chunkLayer: chunks.map((c: any) => ({
          content: c.content.substring(0, 50),
          type: c.chunkType,
          path: c.path
        })),
        cacheLayer: cache.map((c: any) => ({
          key: c.cacheKey.substring(0, 30),
          accessCount: c.accessCount,
          lastAccess: c.lastAccess
        })),
        gitLayer: commits.map((c: any) => ({
          hash: c.hash.substring(0, 7),
          message: c.message?.substring(0, 30),
          author: c.author,
          date: c.date
        })),
        snapshotLayer: snapshots.map((s: any) => ({
          sessionId: s.sessionId.substring(0, 8),
          sequenceNumber: s.sequenceNumber,
          createdAt: s.createdAt
        }))
      };

      return {
        success: true,
        output: JSON.stringify(allLayers, null, 2)
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get all data layers: ${error.message}`
      };
    }
  }
}

// Make MemoryManager globally accessible for the tool
declare global {
  var memoryManager: MemoryManager | undefined;
}