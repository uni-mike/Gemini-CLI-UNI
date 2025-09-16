/**
 * Context Injector - Automatically injects memory context into AI prompts
 */

import { SharedDatabaseManager } from './shared-database.js';
import { MemoryManager } from './memory-manager.js';

export class ContextInjector {
  private db: any;
  private memoryManager: MemoryManager | null = null;
  private initialized = false;

  constructor() {
    // Don't initialize in constructor - wait for lazy init
  }

  private async ensureInitialized() {
    if (this.initialized) return;

    try {
      const dbManager = SharedDatabaseManager.getInstance();
      // Check if database is initialized
      try {
        this.db = dbManager.getPrisma();
        this.initialized = true;
      } catch {
        // Database not ready yet, will try again later
      }
    } catch (error) {
      // Silent fail - database will be initialized later
    }
  }

  setMemoryManager(memoryManager: MemoryManager) {
    this.memoryManager = memoryManager;
  }

  /**
   * Inject relevant context into messages array for AI
   */
  async injectContext(messages: any[], userPrompt: string): Promise<any[]> {
    const enrichedMessages = [...messages];

    await this.ensureInitialized();

    try {
      // Get recent session history
      const recentSessions = await this.getRecentSessionContext();

      // Get relevant knowledge
      const relevantKnowledge = await this.getRelevantKnowledge(userPrompt);

      // Get recent interactions
      const recentInteractions = await this.getRecentInteractions();

      // Build context message
      let contextContent = '';

      if (recentSessions) {
        contextContent += `\n## Recent Session Context\n${recentSessions}\n`;
      }

      if (relevantKnowledge) {
        contextContent += `\n## Relevant Knowledge Base\n${relevantKnowledge}\n`;
      }

      if (recentInteractions) {
        contextContent += `\n## Recent Actions\n${recentInteractions}\n`;
      }

      // If we have context, inject it as a system message
      if (contextContent) {
        // Add system context at the beginning
        enrichedMessages.unshift({
          role: 'system',
          content: `You have access to the following memory and context from previous interactions:${contextContent}\n\nUse this context to provide informed responses and maintain continuity across sessions. If the user asks about recent activities or previous work, refer to this context.`
        });

        // Also add a note about the memory_retrieval tool
        enrichedMessages.push({
          role: 'system',
          content: 'Note: You have access to a memory_retrieval tool that can query the full database of stored memories, knowledge, sessions, and git history. Use it when you need more detailed historical information.'
        });
      }

    } catch (error) {
      console.error('Failed to inject context:', error);
      // Continue without context rather than failing
    }

    return enrichedMessages;
  }

  private async getRecentSessionContext(): Promise<string | null> {
    try {
      await this.ensureInitialized();
      if (!this.db) return null;

      const sessions = await this.db.session.findMany({
        take: 3,
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          mode: true,
          turnCount: true,
          tokensUsed: true,
          startedAt: true,
          status: true
        }
      });

      if (!sessions || sessions.length === 0) return null;

      return sessions.map((s: any) =>
        `- Session ${s.id.substring(0, 8)}: ${s.turnCount} turns, ${s.tokensUsed} tokens, started ${s.startedAt}`
      ).join('\n');
    } catch (error) {
      return null;
    }
  }

  private async getRelevantKnowledge(query: string): Promise<string | null> {
    try {
      await this.ensureInitialized();
      if (!this.db) return null;

      // Get most important knowledge entries
      const knowledge = await this.db.knowledge.findMany({
        take: 5,
        orderBy: [
          { importance: 'desc' },
          { updatedAt: 'desc' }
        ],
        select: {
          key: true,
          value: true,
          category: true
        }
      });

      // Also search for query-specific knowledge
      const searchResults = await this.db.knowledge.findMany({
        where: {
          OR: [
            { key: { contains: query.split(' ')[0] } },
            { value: { contains: query.split(' ')[0] } }
          ]
        },
        take: 3,
        select: {
          key: true,
          value: true,
          category: true
        }
      });

      const allKnowledge = [...knowledge, ...searchResults];
      const unique = Array.from(new Map(allKnowledge.map(k => [k.key, k])).values());

      if (unique.length === 0) return null;

      return unique.map((k: any) =>
        `- [${k.category}] ${k.key}: ${k.value.substring(0, 100)}${k.value.length > 100 ? '...' : ''}`
      ).join('\n');
    } catch (error) {
      return null;
    }
  }

  private async getRecentInteractions(): Promise<string | null> {
    try {
      await this.ensureInitialized();
      if (!this.db) return null;

      const executions = await this.db.executionLog.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        where: { success: true },
        select: {
          tool: true,
          input: true,
          createdAt: true
        }
      });

      if (!executions || executions.length === 0) return null;

      return executions.map((e: any) =>
        `- ${e.tool}: ${e.input ? e.input.substring(0, 50) : 'no input'} (${e.createdAt})`
      ).join('\n');
    } catch (error) {
      return null;
    }
  }

  /**
   * Create a summary of all available memory layers for the AI
   */
  async getMemorySummary(): Promise<string> {
    try {
      await this.ensureInitialized();
      if (!this.db) return 'Memory system unavailable';

      const [
        sessionCount,
        knowledgeCount,
        executionCount,
        chunkCount,
        gitCount
      ] = await Promise.all([
        this.db.session.count(),
        this.db.knowledge.count(),
        this.db.executionLog.count(),
        this.db.chunk.count(),
        this.db.gitCommit.count()
      ]);

      return `Memory System Status:
- ${sessionCount} sessions tracked (conversation history)
- ${knowledgeCount} knowledge entries (facts and context from past work)
- ${executionCount} tool executions (what tools were used and when)
- ${chunkCount} code chunks (indexed code segments)
- ${gitCount} git commits (project history)

To access this data, use memory_retrieval tool with these actions:
- action: "search", query: "search term" - Search all layers
- action: "get_sessions" - Get conversation history
- action: "get_knowledge" - Access stored facts
- action: "get_recent" - Recent tool usage
- action: "get_all_layers" - Complete overview

Example: When user asks "what have we done recently?", use memory_retrieval with action: "get_recent" or "get_sessions"`;
    } catch (error) {
      return 'Memory system status unknown';
    }
  }
}

// Singleton instance
export const contextInjector = new ContextInjector();