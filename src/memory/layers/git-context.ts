/**
 * Git Context Layer - Fixed Version
 * Provides git history and diff context with proper error handling
 */

import { MemoryLayer } from '../types.js';
import { PrismaClient } from '@prisma/client';
import { EmbeddingsManager } from '../embeddings.js';
import { TokenBudgetManager } from '../token-budget.js';
import { execSync } from 'child_process';
import { CHUNK_SIZES } from '../constants.js';

interface GitCommitInfo {
  hash: string;
  author: string;
  date: string;
  message: string;
  filesChanged: string[];
  diffChunks: DiffChunk[];
}

interface DiffChunk {
  file: string;
  additions: number;
  deletions: number;
  content: string;
}

export class GitContextLayer implements MemoryLayer {
  name = 'Git Context';
  priority = 3;
  private prisma: PrismaClient;
  private embeddings: EmbeddingsManager;
  private tokenBudget: TokenBudgetManager;
  private projectId: string;
  private isGitRepo: boolean = false;
  
  constructor(
    prisma: PrismaClient,
    embeddings: EmbeddingsManager,
    tokenBudget: TokenBudgetManager,
    projectId: string
  ) {
    this.prisma = prisma;
    this.embeddings = embeddings;
    this.tokenBudget = tokenBudget;
    this.projectId = projectId;
  }
  
  async initialize(): Promise<void> {
    console.log('🔄 Initializing git context layer...');
    
    try {
      // Check if we're in a git repository
      try {
        execSync('git rev-parse --git-dir', { encoding: 'utf8', stdio: 'pipe' });
      } catch {
        console.log('⚠️  Not a git repository - git context layer disabled');
        this.isGitRepo = false;
        return;
      }
      
      this.isGitRepo = true;
      
      // Load recent commits only if we're in a git repo
      await this.loadRecentCommits();
      
      const stats = await this.getStatistics();
      console.log(`✅ Git context layer initialized with ${stats} commits`);
    } catch (error: any) {
      // Check for specific git errors
      if (error.message?.includes('not a git repository') || 
          error.message?.includes('fatal:') ||
          error.message?.includes('git')) {
        console.log('⚠️  Not a git repository - git context layer disabled');
        this.isGitRepo = false;
        return;
      }
      
      // Log other errors but don't throw - gracefully degrade
      console.warn('Git context initialization warning:', error.message);
      this.isGitRepo = false;
    }
  }
  
  async search(query: string): Promise<any[]> {
    if (!this.isGitRepo) {
      return [];
    }
    
    // Search commits by message or file changes
    const commits = await this.prisma.gitCommit.findMany({
      where: {
        projectId: this.projectId,
        OR: [
          { message: { contains: query } },
          { filesChanged: { contains: query } }
        ]
      },
      orderBy: { date: 'desc' },
      take: 5
    });
    
    return commits.map(commit => ({
      type: 'commit',
      hash: commit.hash,
      message: commit.message,
      date: commit.date,
      filesChanged: JSON.parse(commit.filesChanged)
    }));
  }
  
  async getContext(query: string): Promise<string> {
    if (!this.isGitRepo) {
      return '';
    }
    
    // Get recent commits for context
    const commits = await this.prisma.gitCommit.findMany({
      where: { projectId: this.projectId },
      orderBy: { date: 'desc' },
      take: 10
    });
    
    if (commits.length === 0) {
      return '';
    }
    
    const context = commits.map(commit => {
      const files = JSON.parse(commit.filesChanged);
      return `${commit.hash.substring(0, 7)} - ${commit.message} (${files.length} files)`;
    }).join('\n');
    
    return `Recent commits:\n${context}`;
  }
  
  async getStatistics(): Promise<string> {
    if (!this.isGitRepo) {
      return '0 (not a git repository)';
    }
    
    const count = await this.prisma.gitCommit.count({
      where: { projectId: this.projectId }
    });
    return count.toString();
  }
  
  /**
   * Load recent commits from git log
   */
  private async loadRecentCommits(): Promise<void> {
    try {
      // Get last 10 commits with just metadata and file stats (no patches)
      const gitOutput = execSync('git log --stat --no-patch -10', {
        encoding: 'utf8',
        maxBuffer: 2 * 1024 * 1024, // 2MB buffer should be plenty
        stdio: 'pipe'
      });
      
      if (!gitOutput) {
        console.log('No git commits found');
        return;
      }
      
      const commits = this.parseGitLog(gitOutput);
      
      // Store each commit
      for (const commit of commits) {
        try {
          await this.storeCommit(commit);
        } catch (error) {
          // Skip individual commit errors
          console.debug(`Skipped commit ${commit.hash}: ${error}`);
        }
      }
    } catch (error) {
      console.warn('Failed to load git commits:', error);
    }
  }
  
  /**
   * Parse git log output - Fixed version
   */
  private parseGitLog(gitOutput: string): GitCommitInfo[] {
    const commits: GitCommitInfo[] = [];
    const lines = gitOutput.split('\n');
    
    let currentCommit: GitCommitInfo | null = null;
    let inDiff = false;
    let currentDiff = '';
    let currentFile = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // New commit starts with "commit "
      if (line.startsWith('commit ')) {
        // Save previous commit if exists
        if (currentCommit) {
          if (currentDiff && currentFile) {
            currentCommit.diffChunks.push(this.parseDiffChunk(currentFile, currentDiff));
          }
          commits.push(currentCommit);
        }
        
        // Extract commit hash (40 characters after "commit ")
        const hash = line.substring(7).trim().split(' ')[0];
        
        // Validate it's a proper git hash (40 hex characters)
        if (hash && hash.match(/^[0-9a-f]{40}$/i)) {
          currentCommit = {
            hash,
            author: '',
            date: '',
            message: '',
            filesChanged: [],
            diffChunks: []
          };
          currentDiff = '';
          currentFile = '';
          inDiff = false;
        } else {
          currentCommit = null;
        }
      }
      // Author line
      else if (line.startsWith('Author:') && currentCommit) {
        currentCommit.author = line.substring(7).trim();
      }
      // Date line
      else if (line.startsWith('Date:') && currentCommit) {
        currentCommit.date = line.substring(5).trim();
      }
      // Commit message (indented lines after Date)
      else if (line.startsWith('    ') && currentCommit && !currentCommit.message && !inDiff) {
        currentCommit.message = line.trim();
      }
      // File change stats (looks like " file.txt | 10 ++++")
      else if (line.match(/^\s+[\w\/\.\-]+\s+\|\s+\d+/) && currentCommit) {
        const match = line.match(/^\s+([\w\/\.\-]+)\s+\|/);
        if (match) {
          currentCommit.filesChanged.push(match[1]);
        }
      }
      // Diff header starts with "diff --git"
      else if (line.startsWith('diff --git') && currentCommit) {
        // Save previous diff if exists
        if (currentDiff && currentFile) {
          currentCommit.diffChunks.push(this.parseDiffChunk(currentFile, currentDiff));
        }
        
        // Extract filename from diff header
        const match = line.match(/diff --git a\/(.*) b\/(.*)/);
        if (match) {
          currentFile = match[2] || match[1];
        }
        currentDiff = line + '\n';
        inDiff = true;
      }
      // Continue accumulating diff content
      else if (inDiff && currentCommit && (
        line.startsWith('+++') || 
        line.startsWith('---') || 
        line.startsWith('@@') || 
        line.startsWith('+') || 
        line.startsWith('-') || 
        line.startsWith(' ')
      )) {
        currentDiff += line + '\n';
        
        // Limit diff size
        if (this.tokenBudget.countTokens(currentDiff) > CHUNK_SIZES.DIFF.MAX_PER_FILE) {
          currentCommit.diffChunks.push(this.parseDiffChunk(currentFile, currentDiff));
          currentDiff = '';
          currentFile = '';
          inDiff = false;
        }
      }
      // Empty line or stats line ends the diff
      else if ((line === '' || line.match(/^\s*\d+\s+files? changed/)) && inDiff && currentCommit) {
        if (currentDiff && currentFile) {
          currentCommit.diffChunks.push(this.parseDiffChunk(currentFile, currentDiff));
        }
        currentDiff = '';
        currentFile = '';
        inDiff = false;
      }
    }
    
    // Save last commit
    if (currentCommit) {
      if (currentDiff && currentFile) {
        currentCommit.diffChunks.push(this.parseDiffChunk(currentFile, currentDiff));
      }
      commits.push(currentCommit);
    }
    
    return commits;
  }
  
  /**
   * Parse a diff chunk
   */
  private parseDiffChunk(file: string, diffContent: string): DiffChunk {
    let additions = 0;
    let deletions = 0;
    
    const lines = diffContent.split('\n');
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }
    
    return {
      file,
      additions,
      deletions,
      content: diffContent
    };
  }
  
  /**
   * Store commit in database
   */
  private async storeCommit(commit: GitCommitInfo): Promise<void> {
    // Validate commit data
    if (!commit.hash || !commit.hash.match(/^[0-9a-f]{40}$/i)) {
      // Silently skip invalid hashes
      return;
    }
    
    // Check if already exists
    const existing = await this.prisma.gitCommit.findUnique({
      where: {
        projectId_hash: {
          projectId: this.projectId,
          hash: commit.hash
        }
      }
    });
    
    if (existing) {
      return;
    }
    
    // Parse and validate date
    const commitDate = new Date(commit.date);
    if (isNaN(commitDate.getTime())) {
      // Skip commits with invalid dates
      return;
    }
    
    try {
      // Generate embedding for commit
      const embeddingText = `${commit.message}\nFiles: ${commit.filesChanged.join(', ')}`;
      const embedding = await this.embeddings.embed(embeddingText);
      const embeddingBuffer = Buffer.from(this.embeddings.embeddingToBuffer(embedding));
      
      // Store commit
      await this.prisma.gitCommit.create({
        data: {
          projectId: this.projectId,
          hash: commit.hash,
          author: commit.author || 'Unknown',
          date: commitDate,
          message: commit.message || 'No message',
        filesChanged: JSON.stringify(commit.filesChanged),
        diffChunks: JSON.stringify(
          commit.diffChunks.map(chunk => ({
            file: chunk.file,
            additions: chunk.additions,
            deletions: chunk.deletions,
            summary: this.summarizeDiff(chunk.content)
          }))
        ),
        embedding: embeddingBuffer
        }
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Duplicate constraint - commit already exists, skip silently
        console.debug(`Commit ${commit.hash.substring(0, 7)} already exists, skipping`);
        return;
      }
      // Log other errors but don't crash
      console.debug(`Failed to store commit ${commit.hash.substring(0, 7)}:`, error);
    }
  }
  
  /**
   * Summarize diff content to save space
   */
  private summarizeDiff(diffContent: string): string {
    const lines = diffContent.split('\n');
    const summary: string[] = [];
    
    for (const line of lines) {
      // Keep only important lines
      if (
        line.startsWith('diff --git') ||
        line.startsWith('@@') ||
        line.startsWith('index ')
      ) {
        summary.push(line);
      }
    }
    
    // Add basic stats
    const additions = lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
    const deletions = lines.filter(l => l.startsWith('-') && !l.startsWith('---')).length;
    summary.push(`Changes: +${additions} -${deletions}`);
    
    return summary.join('\n');
  }
  
  // Remove the old parseGitHistory method completely
  // The new initialize() method replaces it
}