/**
 * File-based Persistence Manager
 * Handles file-based logging, caching, session state, and checkpoints
 * Complements the SQLite database with file-based persistence
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createWriteStream, WriteStream } from 'fs';
import * as crypto from 'crypto';

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string;
  message: string;
  data?: any;
}

export interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  ttl?: number;
}

export interface SessionState {
  id: string;
  startedAt: string;
  lastUpdated: string;
  prompt: string;
  mode: string;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  tools: string[];
  memory: {
    ephemeral: number;
    knowledge: number;
    retrieval: number;
  };
  pipeline: {
    planning?: { duration: number; completed: boolean };
    execution?: { duration: number; completed: boolean };
  };
}

export interface Checkpoint {
  id: string;
  sessionId: string;
  timestamp: string;
  stage: string;
  state: any;
  metadata?: Record<string, any>;
}

export class FilePersistenceManager {
  private static instance: FilePersistenceManager;
  private baseDir: string;
  private logStream: WriteStream | null = null;
  private cacheDir: string;
  private sessionsDir: string;
  private checkpointsDir: string;
  private logsDir: string;
  
  private constructor() {
    this.baseDir = path.join(process.cwd(), '.flexicli');
    this.cacheDir = path.join(this.baseDir, 'cache');
    this.sessionsDir = path.join(this.baseDir, 'sessions');
    this.checkpointsDir = path.join(this.baseDir, 'checkpoints');
    this.logsDir = path.join(this.baseDir, 'logs');
  }
  
  static getInstance(): FilePersistenceManager {
    if (!FilePersistenceManager.instance) {
      FilePersistenceManager.instance = new FilePersistenceManager();
    }
    return FilePersistenceManager.instance;
  }
  
  async initialize(): Promise<void> {
    // Ensure all directories exist
    await this.ensureDirectories();
    
    // Initialize log stream
    await this.initializeLogStream();
    
    console.log('📁 File persistence manager initialized');
  }
  
  private async ensureDirectories(): Promise<void> {
    const dirs = [this.cacheDir, this.sessionsDir, this.checkpointsDir, this.logsDir];
    
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.warn(`Failed to create directory ${dir}:`, error);
      }
    }
  }
  
  private async initializeLogStream(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logsDir, `flexicli-${today}.log`);
    
    this.logStream = createWriteStream(logFile, { flags: 'a' });
    
    this.logStream.on('error', (error) => {
      console.error('Log stream error:', error);
      this.logStream = null;
    });
  }
  
  // ===== LOGGING FUNCTIONS =====
  
  async log(entry: LogEntry): Promise<void> {
    const timestamp = entry.timestamp || new Date().toISOString();
    const logLine = JSON.stringify({
      ...entry,
      timestamp
    }) + '\n';
    
    // Write to stream if available
    if (this.logStream && !this.logStream.destroyed) {
      this.logStream.write(logLine);
    }
    
    // Also write to daily log file as backup
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logsDir, `flexicli-${today}.log`);
    
    try {
      await fs.appendFile(logFile, logLine);
    } catch (error) {
      console.warn('Failed to write log:', error);
    }
  }
  
  async logDebug(component: string, message: string, data?: any): Promise<void> {
    await this.log({ level: 'debug', component, message, data, timestamp: new Date().toISOString() });
  }
  
  async logInfo(component: string, message: string, data?: any): Promise<void> {
    await this.log({ level: 'info', component, message, data, timestamp: new Date().toISOString() });
  }
  
  async logWarn(component: string, message: string, data?: any): Promise<void> {
    await this.log({ level: 'warn', component, message, data, timestamp: new Date().toISOString() });
  }
  
  async logError(component: string, message: string, data?: any): Promise<void> {
    await this.log({ level: 'error', component, message, data, timestamp: new Date().toISOString() });
  }
  
  async getRecentLogs(lines: number = 100): Promise<LogEntry[]> {
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logsDir, `flexicli-${today}.log`);
    
    try {
      const content = await fs.readFile(logFile, 'utf-8');
      const allLines = content.trim().split('\n');
      const recentLines = allLines.slice(-lines);
      
      return recentLines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean) as LogEntry[];
    } catch (error) {
      return [];
    }
  }
  
  // ===== CACHE FUNCTIONS =====
  
  private getCacheKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }
  
  async cacheSet(key: string, value: any, ttl?: number): Promise<void> {
    const hashedKey = this.getCacheKey(key);
    const cacheFile = path.join(this.cacheDir, `${hashedKey}.json`);
    
    const entry: CacheEntry = {
      key,
      value,
      timestamp: Date.now(),
      ttl
    };
    
    try {
      await fs.writeFile(cacheFile, JSON.stringify(entry, null, 2));
      await this.logDebug('Cache', `Set cache key: ${key}`);
    } catch (error) {
      await this.logError('Cache', `Failed to set cache key ${key}:`, error);
    }
  }
  
  async cacheGet(key: string): Promise<any | null> {
    const hashedKey = this.getCacheKey(key);
    const cacheFile = path.join(this.cacheDir, `${hashedKey}.json`);
    
    try {
      const content = await fs.readFile(cacheFile, 'utf-8');
      const entry: CacheEntry = JSON.parse(content);
      
      // Check TTL
      if (entry.ttl) {
        const age = Date.now() - entry.timestamp;
        if (age > entry.ttl) {
          await fs.unlink(cacheFile);
          return null;
        }
      }
      
      return entry.value;
    } catch (error) {
      return null;
    }
  }
  
  async cacheDelete(key: string): Promise<void> {
    const hashedKey = this.getCacheKey(key);
    const cacheFile = path.join(this.cacheDir, `${hashedKey}.json`);
    
    try {
      await fs.unlink(cacheFile);
      await this.logDebug('Cache', `Deleted cache key: ${key}`);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }
  
  async cacheClear(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.cacheDir, file));
        }
      }
      
      await this.logInfo('Cache', 'Cache cleared');
    } catch (error) {
      await this.logError('Cache', 'Failed to clear cache:', error);
    }
  }
  
  // ===== SESSION STATE FUNCTIONS =====
  
  async saveSessionState(session: SessionState): Promise<void> {
    const sessionFile = path.join(this.sessionsDir, `${session.id}.json`);
    
    try {
      await fs.writeFile(sessionFile, JSON.stringify(session, null, 2));
      await this.logDebug('Session', `Saved session state: ${session.id}`);
    } catch (error) {
      await this.logError('Session', `Failed to save session ${session.id}:`, error);
    }
  }
  
  async loadSessionState(sessionId: string): Promise<SessionState | null> {
    const sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
    
    try {
      const content = await fs.readFile(sessionFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }
  
  async updateSessionState(sessionId: string, updates: Partial<SessionState>): Promise<void> {
    const current = await this.loadSessionState(sessionId);
    
    if (current) {
      const updated: SessionState = {
        ...current,
        ...updates,
        lastUpdated: new Date().toISOString()
      };
      
      await this.saveSessionState(updated);
    }
  }
  
  async listSessions(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    } catch (error) {
      return [];
    }
  }
  
  async getRecentSessions(limit: number = 10): Promise<SessionState[]> {
    const sessionIds = await this.listSessions();
    const sessions: SessionState[] = [];
    
    for (const id of sessionIds) {
      const session = await this.loadSessionState(id);
      if (session) {
        sessions.push(session);
      }
    }
    
    // Sort by last updated, most recent first
    sessions.sort((a, b) => 
      new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    );
    
    return sessions.slice(0, limit);
  }
  
  // ===== CHECKPOINT FUNCTIONS =====
  
  async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
    const checkpointFile = path.join(
      this.checkpointsDir,
      checkpoint.sessionId,
      `${checkpoint.id}.json`
    );
    
    try {
      // Ensure session directory exists
      await fs.mkdir(path.dirname(checkpointFile), { recursive: true });
      
      await fs.writeFile(checkpointFile, JSON.stringify(checkpoint, null, 2));
      await this.logDebug('Checkpoint', `Saved checkpoint: ${checkpoint.id}`);
    } catch (error) {
      await this.logError('Checkpoint', `Failed to save checkpoint ${checkpoint.id}:`, error);
    }
  }
  
  async loadCheckpoint(checkpointId: string, sessionId: string): Promise<Checkpoint | null> {
    const checkpointFile = path.join(
      this.checkpointsDir,
      sessionId,
      `${checkpointId}.json`
    );
    
    try {
      const content = await fs.readFile(checkpointFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }
  
  async listCheckpoints(sessionId: string): Promise<string[]> {
    const sessionDir = path.join(this.checkpointsDir, sessionId);
    
    try {
      const files = await fs.readdir(sessionDir);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    } catch (error) {
      return [];
    }
  }
  
  async getLatestCheckpoint(sessionId: string): Promise<Checkpoint | null> {
    const checkpointIds = await this.listCheckpoints(sessionId);
    
    if (checkpointIds.length === 0) {
      return null;
    }
    
    const checkpoints: Checkpoint[] = [];
    
    for (const id of checkpointIds) {
      const checkpoint = await this.loadCheckpoint(id, sessionId);
      if (checkpoint) {
        checkpoints.push(checkpoint);
      }
    }
    
    // Sort by timestamp, most recent first
    checkpoints.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    return checkpoints[0] || null;
  }
  
  // ===== CLEANUP FUNCTIONS =====
  
  async cleanupOldFiles(daysToKeep: number = 7): Promise<void> {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    // Clean old logs
    try {
      const logFiles = await fs.readdir(this.logsDir);
      for (const file of logFiles) {
        const filePath = path.join(this.logsDir, file);
        const stat = await fs.stat(filePath);
        
        if (stat.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          await this.logInfo('Cleanup', `Deleted old log file: ${file}`);
        }
      }
    } catch (error) {
      await this.logError('Cleanup', 'Failed to clean logs:', error);
    }
    
    // Clean old cache entries
    try {
      const cacheFiles = await fs.readdir(this.cacheDir);
      for (const file of cacheFiles) {
        const filePath = path.join(this.cacheDir, file);
        
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const entry: CacheEntry = JSON.parse(content);
          
          if (entry.timestamp < cutoffTime) {
            await fs.unlink(filePath);
          }
        } catch {
          // Skip invalid files
        }
      }
    } catch (error) {
      await this.logError('Cleanup', 'Failed to clean cache:', error);
    }
  }
  
  async getStorageStats(): Promise<{
    logs: { count: number; size: number };
    cache: { count: number; size: number };
    sessions: { count: number; size: number };
    checkpoints: { count: number; size: number };
  }> {
    const stats = {
      logs: { count: 0, size: 0 },
      cache: { count: 0, size: 0 },
      sessions: { count: 0, size: 0 },
      checkpoints: { count: 0, size: 0 }
    };
    
    // Helper to get directory stats
    const getDirStats = async (dir: string) => {
      let count = 0;
      let size = 0;
      
      try {
        const files = await fs.readdir(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = await fs.stat(filePath);
          
          if (stat.isFile()) {
            count++;
            size += stat.size;
          }
        }
      } catch {
        // Directory might not exist
      }
      
      return { count, size };
    };
    
    stats.logs = await getDirStats(this.logsDir);
    stats.cache = await getDirStats(this.cacheDir);
    stats.sessions = await getDirStats(this.sessionsDir);
    stats.checkpoints = await getDirStats(this.checkpointsDir);
    
    return stats;
  }
  
  async close(): Promise<void> {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }
}

export default FilePersistenceManager;