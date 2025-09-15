import * as crypto from 'crypto';
/**
 * Project Isolation Manager
 * Ensures strict per-project data isolation
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import { DB_CONFIG } from './constants.js';
import { PrismaClient } from '@prisma/client';

export interface ProjectMetadata {
  projectId: string;
  rootPath: string;
  name: string;
  schemaVersion: number;
  embeddingsModel: string;
  createdAt: string;
  updatedAt: string;
}

export class ProjectManager {
  private projectRoot: string;
  private flexicliDir: string;
  private metadata: ProjectMetadata | null = null;
  
  constructor() {
    this.projectRoot = this.detectProjectRoot();
    this.flexicliDir = join(this.projectRoot, '.flexicli');
    this.ensureProjectStructure();
  }

  /**
   * Initialize with database lookup
   */
  async initializeWithDatabase(): Promise<void> {
    // Try to load from database first, then fall back to file
    await this.loadFromDatabase() || this.loadOrCreateMetadata();
  }
  
  /**
   * Detect project root - use centralized approach when DATABASE_URL is set
   */
  private detectProjectRoot(): string {
    // If DATABASE_URL is set, we're using centralized database - use a fixed root path
    if (process.env.DATABASE_URL) {
      // Extract the project root from DATABASE_URL path for consistency
      const dbPath = process.env.DATABASE_URL.replace('file:', '');
      const projectRoot = dbPath.replace('/.flexicli/flexicli.db', '');
      return projectRoot;
    }
    // Otherwise use current directory for per-directory databases
    return process.cwd();
  }
  
  /**
   * Ensure .flexicli directory structure exists
   */
  private ensureProjectStructure(): void {
    // Create main .flexicli directory
    if (!existsSync(this.flexicliDir)) {
      mkdirSync(this.flexicliDir, { recursive: true });
    }
    
    // Create only needed subdirectories - everything else moved to database
    const subdirs = ['logs']; // Only logs needed for debugging
    for (const dir of subdirs) {
      const path = join(this.flexicliDir, dir);
      if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
      }
    }
    
    // Load or create metadata
    this.loadOrCreateMetadata();
  }
  
  /**
   * Try to load project from database
   */
  private async loadFromDatabase(): Promise<boolean> {
    try {
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: `file:${this.getDbPath()}`
          }
        }
      });

      const project = await prisma.project.findUnique({
        where: { rootPath: this.projectRoot }
      });

      await prisma.$disconnect();

      if (project) {
        this.metadata = {
          projectId: project.id,
          rootPath: project.rootPath,
          name: project.name,
          schemaVersion: DB_CONFIG.SCHEMA_VERSION,
          embeddingsModel: process.env.EMBEDDING_API_MODEL_NAME || 'text-embedding-3-large',
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString()
        };
        console.log(`🔗 Using existing database project: ${project.name} (${project.id.substring(0, 8)}...)`);
        return true;
      }
    } catch (error) {
      console.warn('Failed to load from database, falling back to file-based metadata:', error);
    }
    return false;
  }

  /**
   * Load or create project metadata
   */
  private loadOrCreateMetadata(): void {
    const metaPath = this.getMetaPath();
    
    if (existsSync(metaPath)) {
      try {
        const content = readFileSync(metaPath, 'utf8');
        this.metadata = JSON.parse(content);
        
        // Check schema version
        if (this.metadata && this.metadata.schemaVersion < DB_CONFIG.SCHEMA_VERSION) {
          // TODO: Run migrations
          this.metadata.schemaVersion = DB_CONFIG.SCHEMA_VERSION;
          this.metadata.updatedAt = new Date().toISOString();
          this.saveMetadata();
        }
        
        // IMPORTANT: Use the existing project ID from database if available
        if (this.metadata && this.metadata.projectId === 'unipath-project-1') {
          // Keep the existing ID for compatibility
          console.log('📦 Using existing project ID:', this.metadata.projectId);
        }
      } catch (error) {
        console.warn('Failed to load metadata, creating new:', error);
        this.createMetadata();
      }
    } else {
      this.createMetadata();
    }
  }
  
  /**
   * Create new project metadata
   */
  private createMetadata(): void {
    const projectName = this.projectRoot.split('/').pop() || 'unnamed';
    
    this.metadata = {
      projectId: this.generateProjectId(),
      rootPath: this.projectRoot,
      name: projectName,
      schemaVersion: DB_CONFIG.SCHEMA_VERSION,
      embeddingsModel: process.env.EMBEDDING_API_MODEL_NAME || 'text-embedding-3-large',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.saveMetadata();
  }
  
  /**
   * Generate unique project ID based on path
   */
  private generateProjectId(): string {
    
    return crypto
      .createHash('sha256')
      .update(this.projectRoot)
      .digest('hex')
      .substring(0, 16);
  }
  
  /**
   * Save metadata to disk
   */
  private saveMetadata(): void {
    if (!this.metadata) return;
    
    const metaPath = this.getMetaPath();
    writeFileSync(metaPath, JSON.stringify(this.metadata, null, 2));
  }
  
  /**
   * Get paths for various project files
   */
  getDbPath(): string {
    return join(this.flexicliDir, DB_CONFIG.DB_NAME);
  }
  
  getMetaPath(): string {
    return join(this.flexicliDir, DB_CONFIG.META_FILE);
  }
  
  getCachePath(filename?: string): string {
    const cachePath = join(this.flexicliDir, 'cache');
    return filename ? join(cachePath, filename) : cachePath;
  }
  
  getSessionPath(sessionId?: string): string {
    const sessionPath = join(this.flexicliDir, 'sessions');
    return sessionId ? join(sessionPath, `${sessionId}.json`) : sessionPath;
  }
  
  getLogPath(filename?: string): string {
    const logPath = join(this.flexicliDir, 'logs');
    return filename ? join(logPath, filename) : logPath;
  }
  
  getCheckpointPath(name?: string): string {
    const checkpointPath = join(this.flexicliDir, 'checkpoints');
    return name ? join(checkpointPath, name) : checkpointPath;
  }
  
  /**
   * Get project metadata
   */
  getMetadata(): ProjectMetadata {
    if (!this.metadata) {
      throw new Error('Project metadata not initialized');
    }
    return { ...this.metadata };
  }
  
  /**
   * Get project root path
   */
  getProjectRoot(): string {
    return this.projectRoot;
  }
  
  /**
   * Get project ID
   */
  getProjectId(): string {
    return this.metadata?.projectId || this.generateProjectId();
  }
  
  /**
   * Check if this is a different project than last time
   */
  isNewProject(lastProjectId?: string): boolean {
    return !lastProjectId || lastProjectId !== this.getProjectId();
  }
  
  /**
   * Clean old cache files
   */
  cleanCache(maxAgeDays: number = 7): void {
    const cachePath = this.getCachePath();
    const now = Date.now();
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
    
    try {
      
      const files: string[] = readdirSync(cachePath);
      
      for (const file of files) {
        const filePath = join(cachePath, file);
        const stats = statSync(filePath);
        
        if (now - stats.mtimeMs > maxAge) {
          unlinkSync(filePath);
        }
      }
    } catch (error) {
      console.warn('Failed to clean cache:', error);
    }
  }
  
  /**
   * Rotate logs
   */
  rotateLogs(maxLogs: number = 10, maxSizeMb: number = 50): void {
    const logPath = this.getLogPath();
    
    try {
      
      const files = readdirSync(logPath)
        .map((file: string) => ({
          name: file,
          path: join(logPath, file),
          stats: statSync(join(logPath, file))
        }))
        .sort((a: any, b: any) => b.stats.mtimeMs - a.stats.mtimeMs);
      
      // Remove old logs beyond count
      if (files.length > maxLogs) {
        for (let i = maxLogs; i < files.length; i++) {
          unlinkSync(files[i].path);
        }
      }
      
      // Check total size
      const totalSize = files.reduce((sum: number, file: any) => sum + file.stats.size, 0);
      if (totalSize > maxSizeMb * 1024 * 1024) {
        // Remove oldest files until under limit
        for (let i = files.length - 1; i >= 0; i--) {
          unlinkSync(files[i].path);
          if (files.slice(0, i).reduce((sum: number, f: any) => sum + f.stats.size, 0) < maxSizeMb * 1024 * 1024) {
            break;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to rotate logs:', error);
    }
  }
}