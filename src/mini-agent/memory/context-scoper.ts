/**
 * ContextScoper - Memory filtering and isolation for mini-agents
 * Manages scoped memory contexts to provide focused, relevant information to mini-agents
 */

import { EventEmitter } from 'events';
import { MemoryManager, MemoryContext } from '../../memory/memory-manager.js';
import { ScopedMemoryContext, MiniAgentTask } from '../core/types.js';

export interface ContextScopeResult {
  scopedContext: ScopedMemoryContext;
  filteredMemory: MemoryContext;
  excludedContent: string[];
  tokenCount: number;
  relevanceScore: number;
}

export class ContextScoper extends EventEmitter {
  private memoryManager: MemoryManager;

  constructor(memoryManager: MemoryManager) {
    super();
    this.memoryManager = memoryManager;
  }

  /**
   * Create a scoped memory context for a mini-agent task
   */
  public async createScopedContext(
    task: MiniAgentTask,
    fullMemoryContext: MemoryContext
  ): Promise<ContextScopeResult> {
    try {
      // Extract task-specific requirements
      const requirements = this.analyzeTaskRequirements(task);

      // Filter memory components based on relevance
      const filteredMemory = await this.filterMemoryContext(
        fullMemoryContext,
        requirements,
        task.context
      );

      // Calculate relevance score
      const relevanceScore = this.calculateRelevanceScore(
        filteredMemory,
        requirements
      );

      // Count tokens in filtered context
      const tokenCount = this.estimateTokenCount(filteredMemory);

      // Ensure token limit compliance
      const optimizedMemory = await this.optimizeForTokenLimit(
        filteredMemory,
        task.context.maxTokens
      );

      // Create final scoped context
      const scopedContext: ScopedMemoryContext = {
        relevantFiles: task.context.relevantFiles,
        searchPatterns: task.context.searchPatterns,
        domainKnowledge: task.context.domainKnowledge,
        excludedContext: task.context.excludedContext,
        maxTokens: task.context.maxTokens,
        projectContext: this.extractProjectContext(optimizedMemory),
        sessionId: task.id,
        parentContext: task.parentId
      };

      const result: ContextScopeResult = {
        scopedContext,
        filteredMemory: optimizedMemory,
        excludedContent: this.getExcludedContent(fullMemoryContext, optimizedMemory),
        tokenCount: this.estimateTokenCount(optimizedMemory),
        relevanceScore
      };

      this.emit('context-scoped', {
        taskId: task.id,
        originalTokens: this.estimateTokenCount(fullMemoryContext),
        scopedTokens: result.tokenCount,
        relevanceScore: result.relevanceScore,
        compressionRatio: result.tokenCount / this.estimateTokenCount(fullMemoryContext)
      });

      return result;

    } catch (error: any) {
      this.emit('context-scope-error', {
        taskId: task.id,
        error: error.message
      });
      throw error;
    }
  }

  private analyzeTaskRequirements(task: MiniAgentTask): TaskRequirements {
    const requirements: TaskRequirements = {
      taskType: task.type,
      keywords: this.extractKeywordsFromPrompt(task.prompt),
      filePatterns: task.context.relevantFiles,
      searchTerms: task.context.searchPatterns,
      domainFocus: task.context.domainKnowledge,
      exclusions: task.context.excludedContext,
      priority: task.priority || 'normal'
    };

    // Add task-specific requirements
    switch (task.type) {
      case 'search':
        requirements.needsFileContent = true;
        requirements.needsPatternMatching = true;
        break;
      case 'migration':
        requirements.needsCodeStructure = true;
        requirements.needsRelatedFiles = true;
        requirements.needsTestFiles = true;
        break;
      case 'analysis':
        requirements.needsFullContext = true;
        requirements.needsMetrics = true;
        break;
      case 'refactor':
        requirements.needsCodeStructure = true;
        requirements.needsRelatedFiles = true;
        break;
      case 'test':
        requirements.needsTestFiles = true;
        requirements.needsRelatedFiles = true;
        break;
      case 'documentation':
        requirements.needsApiStructure = true;
        requirements.needsExamples = true;
        break;
    }

    return requirements;
  }

  private extractKeywordsFromPrompt(prompt: string): string[] {
    // Extract important keywords from the prompt
    const keywords: string[] = [];

    // Common technical terms
    const technicalTerms = prompt.match(/\b(function|class|method|interface|type|component|service|api|database|test|bug|feature|refactor|migrate|analyze)\w*\b/gi) || [];
    keywords.push(...technicalTerms);

    // File extensions and patterns
    const filePatterns = prompt.match(/\*\.\w+|\b\w+\.\w+\b/g) || [];
    keywords.push(...filePatterns);

    // Quoted strings (likely important identifiers)
    const quotedTerms = prompt.match(/"([^"]+)"|'([^']+)'|`([^`]+)`/g) || [];
    keywords.push(...quotedTerms.map(term => term.slice(1, -1)));

    // CamelCase identifiers
    const camelCaseTerms = prompt.match(/\b[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*\b/g) || [];
    keywords.push(...camelCaseTerms);

    return [...new Set(keywords.filter(k => k.length > 2))];
  }

  private async filterMemoryContext(
    fullContext: MemoryContext,
    requirements: TaskRequirements,
    scopeConfig: ScopedMemoryContext
  ): Promise<MemoryContext> {
    // Start with full context and filter down
    let filteredContext: MemoryContext = {
      ephemeral: fullContext.ephemeral,
      retrieved: fullContext.retrieved,
      knowledge: fullContext.knowledge,
      gitContext: fullContext.gitContext,
      totalTokens: fullContext.totalTokens
    };

    // Apply file pattern filtering
    if (requirements.filePatterns.length > 0) {
      filteredContext = await this.filterByFilePatterns(filteredContext, requirements.filePatterns);
    }

    // Apply keyword filtering
    if (requirements.keywords.length > 0) {
      filteredContext = await this.filterByKeywords(filteredContext, requirements.keywords);
    }

    // Apply domain-specific filtering
    if (requirements.domainFocus.length > 0) {
      filteredContext = await this.filterByDomain(filteredContext, requirements.domainFocus);
    }

    // Apply exclusion filters
    if (requirements.exclusions.length > 0) {
      filteredContext = await this.applyExclusions(filteredContext, requirements.exclusions);
    }

    // Task-specific filtering
    filteredContext = await this.applyTaskSpecificFiltering(filteredContext, requirements);

    return filteredContext;
  }

  private async filterByFilePatterns(
    context: MemoryContext,
    patterns: string[]
  ): Promise<MemoryContext> {
    const filteredContext = { ...context };

    // Filter ephemeral memory for file-related content
    const ephemeralLines = context.ephemeral.split('\n');
    const relevantLines = ephemeralLines.filter(line => {
      return patterns.some(pattern => {
        // Convert glob pattern to regex
        const regexPattern = pattern
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.');
        return new RegExp(regexPattern, 'i').test(line);
      });
    });

    filteredContext.ephemeral = relevantLines.join('\n');

    // Similar filtering for other memory components
    const retrievedLines = context.retrieved.split('\n');
    const relevantRetrieved = retrievedLines.filter(line => {
      return patterns.some(pattern => {
        const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
        return new RegExp(regexPattern, 'i').test(line) ||
               line.toLowerCase().includes(pattern.toLowerCase().replace('*', ''));
      });
    });

    filteredContext.retrieved = relevantRetrieved.join('\n');

    return filteredContext;
  }

  private async filterByKeywords(
    context: MemoryContext,
    keywords: string[]
  ): Promise<MemoryContext> {
    const filteredContext = { ...context };

    // Create keyword regex pattern
    const keywordPattern = new RegExp(
      keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
      'gi'
    );

    // Filter each memory component
    const ephemeralLines = context.ephemeral.split('\n');
    const relevantEphemeral = ephemeralLines.filter(line =>
      keywordPattern.test(line)
    );

    const retrievedLines = context.retrieved.split('\n');
    const relevantRetrieved = retrievedLines.filter(line =>
      keywordPattern.test(line)
    );

    const knowledgeLines = context.knowledge.split('\n');
    const relevantKnowledge = knowledgeLines.filter(line =>
      keywordPattern.test(line)
    );

    filteredContext.ephemeral = relevantEphemeral.join('\n');
    filteredContext.retrieved = relevantRetrieved.join('\n');
    filteredContext.knowledge = relevantKnowledge.join('\n');

    return filteredContext;
  }

  private async filterByDomain(
    context: MemoryContext,
    domains: string[]
  ): Promise<MemoryContext> {
    const filteredContext = { ...context };

    // Domain-specific filtering logic
    const domainPatterns = domains.map(domain => {
      switch (domain.toLowerCase()) {
        case 'authentication':
        case 'auth':
          return /auth|login|password|token|session|security/gi;
        case 'database':
        case 'db':
          return /database|db|sql|query|table|schema|migration/gi;
        case 'api':
          return /api|endpoint|route|controller|request|response/gi;
        case 'ui':
        case 'interface':
          return /ui|interface|component|render|view|template/gi;
        case 'testing':
        case 'test':
          return /test|spec|mock|assert|expect|jest|mocha/gi;
        case 'performance':
          return /performance|optimize|cache|memory|cpu|benchmark/gi;
        default:
          return new RegExp(domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      }
    });

    // Apply domain filtering
    const ephemeralLines = context.ephemeral.split('\n');
    const domainRelevantEphemeral = ephemeralLines.filter(line =>
      domainPatterns.some(pattern => pattern.test(line))
    );

    const retrievedLines = context.retrieved.split('\n');
    const domainRelevantRetrieved = retrievedLines.filter(line =>
      domainPatterns.some(pattern => pattern.test(line))
    );

    filteredContext.ephemeral = domainRelevantEphemeral.join('\n');
    filteredContext.retrieved = domainRelevantRetrieved.join('\n');

    return filteredContext;
  }

  private async applyExclusions(
    context: MemoryContext,
    exclusions: string[]
  ): Promise<MemoryContext> {
    const filteredContext = { ...context };

    // Create exclusion patterns
    const exclusionPatterns = exclusions.map(exclusion =>
      new RegExp(exclusion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    );

    // Filter out excluded content
    const ephemeralLines = context.ephemeral.split('\n');
    const filteredEphemeral = ephemeralLines.filter(line =>
      !exclusionPatterns.some(pattern => pattern.test(line))
    );

    const retrievedLines = context.retrieved.split('\n');
    const filteredRetrieved = retrievedLines.filter(line =>
      !exclusionPatterns.some(pattern => pattern.test(line))
    );

    filteredContext.ephemeral = filteredEphemeral.join('\n');
    filteredContext.retrieved = filteredRetrieved.join('\n');

    return filteredContext;
  }

  private async applyTaskSpecificFiltering(
    context: MemoryContext,
    requirements: TaskRequirements
  ): Promise<MemoryContext> {
    let filteredContext = { ...context };

    // Apply task-specific filters based on requirements
    if (requirements.needsCodeStructure) {
      filteredContext = await this.enhanceWithCodeStructure(filteredContext);
    }

    if (requirements.needsTestFiles) {
      filteredContext = await this.enhanceWithTestContext(filteredContext);
    }

    if (requirements.needsApiStructure) {
      filteredContext = await this.enhanceWithApiContext(filteredContext);
    }

    return filteredContext;
  }

  private async enhanceWithCodeStructure(context: MemoryContext): Promise<MemoryContext> {
    // Add code structure information
    const codePatterns = /class\s+\w+|function\s+\w+|interface\s+\w+|type\s+\w+/gi;

    const ephemeralLines = context.ephemeral.split('\n');
    const structureLines = ephemeralLines.filter(line => codePatterns.test(line));

    return {
      ...context,
      knowledge: context.knowledge + '\n\nCODE STRUCTURE:\n' + structureLines.join('\n')
    };
  }

  private async enhanceWithTestContext(context: MemoryContext): Promise<MemoryContext> {
    // Add test-related context
    const testPatterns = /\.test\.|\.spec\.|describe\(|it\(|test\(/gi;

    const ephemeralLines = context.ephemeral.split('\n');
    const testLines = ephemeralLines.filter(line => testPatterns.test(line));

    return {
      ...context,
      knowledge: context.knowledge + '\n\nTEST CONTEXT:\n' + testLines.join('\n')
    };
  }

  private async enhanceWithApiContext(context: MemoryContext): Promise<MemoryContext> {
    // Add API-related context
    const apiPatterns = /router\.|app\.|@\w+|endpoint|route/gi;

    const ephemeralLines = context.ephemeral.split('\n');
    const apiLines = ephemeralLines.filter(line => apiPatterns.test(line));

    return {
      ...context,
      knowledge: context.knowledge + '\n\nAPI CONTEXT:\n' + apiLines.join('\n')
    };
  }

  private calculateRelevanceScore(
    filteredContext: MemoryContext,
    requirements: TaskRequirements
  ): number {
    let score = 0.0;
    const maxScore = 100.0;

    // Keyword coverage
    const contentText = [
      filteredContext.ephemeral,
      filteredContext.retrieved,
      filteredContext.knowledge
    ].join(' ').toLowerCase();

    const keywordMatches = requirements.keywords.filter(keyword =>
      contentText.includes(keyword.toLowerCase())
    );
    score += (keywordMatches.length / Math.max(requirements.keywords.length, 1)) * 40;

    // File pattern coverage
    const filePatternMatches = requirements.filePatterns.filter(pattern => {
      const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
      return new RegExp(regexPattern, 'i').test(contentText);
    });
    score += (filePatternMatches.length / Math.max(requirements.filePatterns.length, 1)) * 30;

    // Domain relevance
    const domainMatches = requirements.domainFocus.filter(domain =>
      contentText.includes(domain.toLowerCase())
    );
    score += (domainMatches.length / Math.max(requirements.domainFocus.length, 1)) * 30;

    return Math.min(score, maxScore);
  }

  private estimateTokenCount(context: MemoryContext): number {
    // Rough token estimation: ~4 characters per token
    const totalContent = [
      context.ephemeral,
      context.retrieved,
      context.knowledge,
      context.gitContext
    ].join(' ');

    return Math.ceil(totalContent.length / 4);
  }

  private async optimizeForTokenLimit(
    context: MemoryContext,
    maxTokens: number
  ): Promise<MemoryContext> {
    const currentTokens = this.estimateTokenCount(context);

    if (currentTokens <= maxTokens) {
      return context;
    }

    // Calculate reduction ratio
    const reductionRatio = maxTokens / currentTokens;

    // Prioritize content reduction
    const optimizedContext: MemoryContext = {
      ephemeral: this.reduceContent(context.ephemeral, reductionRatio * 0.4),
      retrieved: this.reduceContent(context.retrieved, reductionRatio * 0.3),
      knowledge: this.reduceContent(context.knowledge, reductionRatio * 0.2),
      gitContext: this.reduceContent(context.gitContext, reductionRatio * 0.1),
      totalTokens: maxTokens
    };

    return optimizedContext;
  }

  private reduceContent(content: string, ratio: number): string {
    const lines = content.split('\n');
    const keepCount = Math.max(1, Math.floor(lines.length * ratio));

    // Keep most relevant lines (prioritize lines with more technical terms)
    const scoredLines = lines.map(line => ({
      line,
      score: this.calculateLineRelevanceScore(line)
    }));

    scoredLines.sort((a, b) => b.score - a.score);

    return scoredLines
      .slice(0, keepCount)
      .map(item => item.line)
      .join('\n');
  }

  private calculateLineRelevanceScore(line: string): number {
    let score = 0;

    // Technical keywords
    const technicalTerms = ['function', 'class', 'interface', 'type', 'const', 'let', 'var', 'import', 'export'];
    technicalTerms.forEach(term => {
      if (line.toLowerCase().includes(term)) score += 2;
    });

    // File references
    if (line.includes('.') && (line.includes('/') || line.includes('\\'))) score += 3;

    // Error messages or important statements
    if (line.toLowerCase().includes('error') || line.toLowerCase().includes('warning')) score += 2;

    // Comments with documentation
    if (line.trim().startsWith('//') || line.trim().startsWith('/*')) score += 1;

    return score;
  }

  private extractProjectContext(context: MemoryContext): string {
    // Extract high-level project context
    const projectInfo: string[] = [];

    // Look for package.json, tsconfig.json references
    if (context.ephemeral.includes('package.json')) {
      projectInfo.push('Node.js/JavaScript project');
    }
    if (context.ephemeral.includes('tsconfig.json')) {
      projectInfo.push('TypeScript project');
    }
    if (context.ephemeral.includes('.py') || context.ephemeral.includes('python')) {
      projectInfo.push('Python project');
    }

    // Look for framework indicators
    if (context.ephemeral.includes('react')) projectInfo.push('React framework');
    if (context.ephemeral.includes('vue')) projectInfo.push('Vue framework');
    if (context.ephemeral.includes('angular')) projectInfo.push('Angular framework');
    if (context.ephemeral.includes('express')) projectInfo.push('Express.js server');

    return projectInfo.join(', ') || 'General software project';
  }

  private getExcludedContent(
    fullContext: MemoryContext,
    filteredContext: MemoryContext
  ): string[] {
    const excluded: string[] = [];

    // Find excluded ephemeral content
    const fullEphemeralLines = fullContext.ephemeral.split('\n');
    const filteredEphemeralLines = filteredContext.ephemeral.split('\n');
    const excludedEphemeral = fullEphemeralLines.filter(line =>
      !filteredEphemeralLines.includes(line)
    );
    excluded.push(...excludedEphemeral);

    return excluded.filter(line => line.trim().length > 0);
  }
}

// Helper interfaces
interface TaskRequirements {
  taskType: string;
  keywords: string[];
  filePatterns: string[];
  searchTerms: string[];
  domainFocus: string[];
  exclusions: string[];
  priority: string;
  needsFileContent?: boolean;
  needsPatternMatching?: boolean;
  needsCodeStructure?: boolean;
  needsRelatedFiles?: boolean;
  needsTestFiles?: boolean;
  needsFullContext?: boolean;
  needsMetrics?: boolean;
  needsApiStructure?: boolean;
  needsExamples?: boolean;
}