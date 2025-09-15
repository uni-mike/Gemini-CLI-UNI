/**
 * Agent Lock Manager - Ensures single agent execution per project
 *
 * This solves the critical database lock issue by ensuring only one agent
 * instance can access the database at a time within a project.
 *
 * Features:
 * - Process-based locking with PID tracking
 * - Automatic stale lock cleanup
 * - Graceful shutdown handling
 * - Timeout protection for hung processes
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

export interface AgentLockInfo {
  pid: number;
  timestamp: number;
  projectRoot: string;
  sessionId: string;
}

export class AgentLockManager {
  private static instance: AgentLockManager;
  private lockFilePath: string;
  private currentLock: AgentLockInfo | null = null;
  private lockTimeout: number = 30 * 60 * 1000; // 30 minutes

  private constructor(projectRoot: string) {
    this.lockFilePath = join(projectRoot, '.flexicli', '.agent-lock');

    // Setup graceful shutdown
    process.on('SIGINT', () => this.releaseLock());
    process.on('SIGTERM', () => this.releaseLock());
    process.on('exit', () => this.releaseLock());
  }

  static getInstance(projectRoot: string): AgentLockManager {
    if (!AgentLockManager.instance) {
      AgentLockManager.instance = new AgentLockManager(projectRoot);
    }
    return AgentLockManager.instance;
  }

  /**
   * Acquire exclusive lock for agent execution
   */
  async acquireLock(sessionId: string): Promise<boolean> {
    try {
      // Check for existing lock
      if (existsSync(this.lockFilePath)) {
        const existingLock = this.readLockFile();

        if (existingLock && this.isLockValid(existingLock)) {
          if (existingLock.sessionId === sessionId) {
            // Same session, refresh the lock
            this.currentLock = existingLock;
            this.writeLockFile();
            return true;
          } else {
            // Another agent is running
            console.log(`🔒 Agent already running (PID: ${existingLock.pid}, Session: ${existingLock.sessionId.substring(0, 8)}...)`);
            return false;
          }
        } else {
          // Stale lock, clean it up
          console.log('🧹 Cleaning up stale agent lock');
          this.cleanupStaleLock();
        }
      }

      // Create new lock
      this.currentLock = {
        pid: process.pid,
        timestamp: Date.now(),
        projectRoot: process.cwd(),
        sessionId
      };

      this.writeLockFile();
      console.log(`🔐 Agent lock acquired (PID: ${process.pid}, Session: ${sessionId.substring(0, 8)}...)`);
      return true;

    } catch (error) {
      console.error('Failed to acquire agent lock:', error);
      return false;
    }
  }

  /**
   * Release the current lock
   */
  releaseLock(): void {
    if (this.currentLock && this.currentLock.pid === process.pid) {
      try {
        if (existsSync(this.lockFilePath)) {
          unlinkSync(this.lockFilePath);
        }
        console.log(`🔓 Agent lock released (PID: ${process.pid})`);
        this.currentLock = null;
      } catch (error) {
        console.warn('Failed to release agent lock:', error);
      }
    }
  }

  /**
   * Check if current process has the lock
   */
  hasLock(): boolean {
    return this.currentLock !== null && this.currentLock.pid === process.pid;
  }

  /**
   * Get current lock info
   */
  getCurrentLock(): AgentLockInfo | null {
    if (existsSync(this.lockFilePath)) {
      return this.readLockFile();
    }
    return null;
  }

  /**
   * Check if an agent is currently running
   */
  isAgentRunning(): boolean {
    if (!existsSync(this.lockFilePath)) {
      return false;
    }

    const lock = this.readLockFile();
    return lock ? this.isLockValid(lock) : false;
  }

  /**
   * Wait for lock to become available
   */
  async waitForLock(sessionId: string, maxWaitMs: number = 60000): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 1000; // Check every second

    while (Date.now() - startTime < maxWaitMs) {
      if (await this.acquireLock(sessionId)) {
        return true;
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    console.log('⏰ Timeout waiting for agent lock');
    return false;
  }

  /**
   * Read lock file content
   */
  private readLockFile(): AgentLockInfo | null {
    try {
      const content = readFileSync(this.lockFilePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.warn('Failed to read lock file:', error);
      return null;
    }
  }

  /**
   * Write lock file
   */
  private writeLockFile(): void {
    if (!this.currentLock) return;

    try {
      writeFileSync(this.lockFilePath, JSON.stringify(this.currentLock, null, 2));
    } catch (error) {
      console.error('Failed to write lock file:', error);
    }
  }

  /**
   * Check if lock is still valid
   */
  private isLockValid(lock: AgentLockInfo): boolean {
    // Check if process is still running
    if (!this.isProcessRunning(lock.pid)) {
      return false;
    }

    // Check if lock has timed out
    if (Date.now() - lock.timestamp > this.lockTimeout) {
      console.log(`⏰ Lock expired (age: ${Math.floor((Date.now() - lock.timestamp) / 1000)}s)`);
      return false;
    }

    return true;
  }

  /**
   * Check if a process is still running
   */
  private isProcessRunning(pid: number): boolean {
    try {
      // Sending signal 0 doesn't actually send a signal, but checks if process exists
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clean up stale lock file
   */
  private cleanupStaleLock(): void {
    try {
      if (existsSync(this.lockFilePath)) {
        unlinkSync(this.lockFilePath);
      }
    } catch (error) {
      console.warn('Failed to cleanup stale lock:', error);
    }
  }

  /**
   * Force release any existing lock (use with caution)
   */
  forceRelease(): void {
    try {
      if (existsSync(this.lockFilePath)) {
        const lock = this.readLockFile();
        if (lock) {
          console.log(`🔨 Force releasing lock (PID: ${lock.pid}, Session: ${lock.sessionId.substring(0, 8)}...)`);
        }
        unlinkSync(this.lockFilePath);
      }
    } catch (error) {
      console.warn('Failed to force release lock:', error);
    }
  }

  /**
   * Get lock statistics
   */
  getLockStats(): {
    hasLock: boolean;
    isRunning: boolean;
    currentLock: AgentLockInfo | null;
    lockAge?: number;
  } {
    const currentLock = this.getCurrentLock();
    const lockAge = currentLock ? Date.now() - currentLock.timestamp : undefined;

    return {
      hasLock: this.hasLock(),
      isRunning: this.isAgentRunning(),
      currentLock,
      lockAge
    };
  }
}