/**
 * Git Context Layer
 * Parses and stores git commit history with embeddings
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { EmbeddingsManager } from '../embeddings.js';
import { TokenBudgetManager } from '../token-budget.js';
import { CHUNK_SIZES } from '../constants.js';
// @ts-ignore
import * as diff from 'jsdiff';

export interface GitCommitInfo {
  hash: string;
  author: string;
  date: Date;
  message: string;
  filesChanged: string[];
  diffChunks: DiffChunk[];
}

export interface DiffChunk {
  file: string;
  additions: number;
  deletions: number;
  content: string;
}

export class GitContextLayer {
  private prisma: PrismaClient;
  private embeddings: EmbeddingsManager;
  private tokenBudget: TokenBudgetManager;
  private projectId: string;
  
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
  
  /**
   * Parse and store git history
   */
  async parseGitHistory(maxCommits: number = 50): Promise<void> {
    try {
      // Reduced from 200 to 50 commits to prevent hangs during session recovery
      // Get git log with patches - use smaller buffer and commit limit
      const gitLog = execSync(
        `git log --patch --no-color --stat -n ${maxCommits} --format='%H|%an|%aI|%s'`,
        { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 3000 } // 20MB buffer, 3s timeout
      );
      
      const commits = this.parseGitLog(gitLog);
      
      // Store commits in database
      for (const commit of commits) {
        await this.storeCommit(commit);
      }
    } catch (error) {
      console.warn('Failed to parse git history:', error);
    }
  }
  
  /**
   * Parse git log output
   */
  private parseGitLog(gitLog: string): GitCommitInfo[] {
    const commits: GitCommitInfo[] = [];
    const lines = gitLog.split('\n');
    
    let currentCommit: GitCommitInfo | null = null;
    let inDiff = false;
    let currentDiff = '';
    let currentFile = '';
    
    for (const line of lines) {
      // Commit header line
      if (line.includes('|') && !inDiff) {
        // Save previous commit if exists
        if (currentCommit && currentDiff) {
          currentCommit.diffChunks.push(this.parseDiffChunk(currentFile, currentDiff));
        }
        
        const [hash, author, date, ...messageParts] = line.split('|');
        currentCommit = {
          hash: hash?.trim() || '',
          author: author?.trim() || '',
          date: new Date(date?.trim() || Date.now()),
          message: messageParts.join('|').trim() || '',
          filesChanged: [],
          diffChunks: []
        };
        commits.push(currentCommit);
        currentDiff = '';
        currentFile = '';
        inDiff = false;
      }
      // File change stat
      else if (line.match(/^\s*\d+\s+files? changed/) && currentCommit) {
        // Stats line, ignore
      }
      // File change list
      else if (line.match(/^\s+[\w\/\.\-]+\s+\|\s+\d+/) && currentCommit) {
        const match = line.match(/^\s+([\w\/\.\-]+)\s+\|/);
        if (match) {
          currentCommit.filesChanged.push(match[1]);
        }
      }
      // Diff header
      else if (line.startsWith('diff --git') && currentCommit) {
        // Save previous diff chunk
        if (currentDiff && currentFile) {
          currentCommit.diffChunks.push(this.parseDiffChunk(currentFile, currentDiff));
        }
        
        const match = line.match(/diff --git a\/(.*) b\/(.*)/);
        if (match) {
          currentFile = match[2];
        }
        currentDiff = line + '\n';
        inDiff = true;
      }
      // Accumulate diff content
      else if (inDiff && currentCommit) {
        currentDiff += line + '\n';
        
        // Stop accumulating if diff gets too large
        if (this.tokenBudget.countTokens(currentDiff) > CHUNK_SIZES.DIFF.MAX_PER_FILE) {
          currentCommit.diffChunks.push(this.parseDiffChunk(currentFile, currentDiff));
          currentDiff = '';
          inDiff = false;
        }
      }
    }
    
    // Save last diff
    if (currentCommit && currentDiff && currentFile) {
      currentCommit.diffChunks.push(this.parseDiffChunk(currentFile, currentDiff));
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
    // Check if commit already exists
    const existing = await this.prisma.gitCommit.findUnique({
      where: {
        projectId_hash: {
          projectId: this.projectId,
          hash: commit.hash
        }
      }
    });
    
    if (existing) {
      return; // Skip if already stored
    }
    
    // Generate embedding for commit message + file list
    const embeddingText = `${commit.message}\nFiles: ${commit.filesChanged.join(', ')}`;
    const embedding = await this.embeddings.embed(embeddingText);
    const embeddingBuffer = Buffer.from(this.embeddings.embeddingToBuffer(embedding));
    
    // Validate commit data before storing
    if (!commit.hash || commit.hash.length < 7 || !commit.hash.match(/^[0-9a-f]/i)) {
      console.warn('Skipping invalid commit hash:', commit.hash);
      return;
    }
    
    // Validate date
    const commitDate = new Date(commit.date);
    if (isNaN(commitDate.getTime())) {
      console.warn('Skipping commit with invalid date:', commit.date);
      return;
    }
    
    // Store commit
    await this.prisma.gitCommit.create({
      data: {
        projectId: this.projectId,
        hash: commit.hash,
        author: commit.author,
        date: commitDate,
        message: commit.message,
        filesChanged: JSON.stringify(commit.filesChanged),
        diffChunks: JSON.stringify(
          commit.diffChunks.map(chunk => ({
            file: chunk.file,
            additions: chunk.additions,
            deletions: chunk.deletions,
            // Store only summary, not full content to save space
            summary: this.summarizeDiff(chunk.content)
          }))
        ),
        embedding: embeddingBuffer
      }
    });
  }
  
  /**
   * Summarize diff content
   */
  private summarizeDiff(diffContent: string): string {
    const lines = diffContent.split('\n');
    const summary: string[] = [];
    
    // Keep headers and context lines
    for (const line of lines) {
      if (
        line.startsWith('diff --git') ||
        line.startsWith('index ') ||
        line.startsWith('---') ||
        line.startsWith('+++') ||
        line.startsWith('@@')
      ) {
        summary.push(line);
      }
    }
    
    // Add change count
    let additions = 0;
    let deletions = 0;
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) additions++;
      if (line.startsWith('-') && !line.startsWith('---')) deletions++;
    }
    
    summary.push(`// +${additions} -${deletions} lines`);
    
    return summary.join('\n');
  }
  
  /**
   * Retrieve commits related to query
   */
  async retrieveCommits(
    query: string,
    options: {
      limit?: number;
      filesFilter?: string[];
      afterDate?: Date;
    } = {}
  ): Promise<GitCommitInfo[]> {
    const { limit = 10, filesFilter, afterDate } = options;
    
    // Generate query embedding
    const queryEmbedding = await this.embeddings.embed(query);
    
    // Fetch commits from database
    const commits = await this.prisma.gitCommit.findMany({
      where: {
        projectId: this.projectId,
        ...(afterDate ? { date: { gte: afterDate } } : {})
      },
      orderBy: { date: 'desc' }
    });
    
    // Filter by files if specified
    let filtered = commits;
    if (filesFilter && filesFilter.length > 0) {
      filtered = commits.filter(commit => {
        const files = JSON.parse(commit.filesChanged) as string[];
        return files.some(file => filesFilter.some(filter => file.includes(filter)));
      });
    }
    
    // Calculate similarities
    const scored = filtered
      .filter(commit => commit.embedding !== null)
      .map(commit => {
        const commitEmbedding = this.embeddings.bufferToEmbedding(Buffer.from(commit.embedding!));
        const similarity = this.embeddings.cosineSimilarity(queryEmbedding, commitEmbedding);
        
        return {
          commit,
          similarity
        };
      });
    
    // Sort by similarity
    scored.sort((a, b) => b.similarity - a.similarity);
    
    // Take top results
    const topCommits = scored.slice(0, limit);
    
    // Convert back to GitCommitInfo format
    return topCommits.map(({ commit }) => ({
      hash: commit.hash,
      author: commit.author,
      date: commit.date,
      message: commit.message,
      filesChanged: JSON.parse(commit.filesChanged),
      diffChunks: JSON.parse(commit.diffChunks)
    }));
  }
  
  /**
   * Get commits for specific files
   */
  async getCommitsForFiles(files: string[], limit: number = 10): Promise<GitCommitInfo[]> {
    const commits = await this.prisma.gitCommit.findMany({
      where: {
        projectId: this.projectId
      },
      orderBy: { date: 'desc' },
      take: limit * 3 // Get more initially to filter
    });
    
    // Filter by files
    const filtered = commits.filter(commit => {
      const changedFiles = JSON.parse(commit.filesChanged) as string[];
      return files.some(file => changedFiles.includes(file));
    });
    
    // Convert to GitCommitInfo format
    return filtered.slice(0, limit).map(commit => ({
      hash: commit.hash,
      author: commit.author,
      date: commit.date,
      message: commit.message,
      filesChanged: JSON.parse(commit.filesChanged),
      diffChunks: JSON.parse(commit.diffChunks)
    }));
  }
  
  /**
   * Clear all git commits for project
   */
  async clearAll(): Promise<void> {
    await this.prisma.gitCommit.deleteMany({
      where: { projectId: this.projectId }
    });
  }
}