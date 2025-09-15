/**
 * Automatic Background Process Cleanup
 * Handles graceful shutdown and cleanup of child processes
 */

import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export class ProcessCleanupManager extends EventEmitter {
  private static instance: ProcessCleanupManager;
  private childProcesses: Set<ChildProcess> = new Set();
  private exitHandlersRegistered = false;
  private isCleaningUp = false;

  private constructor() {
    super();
    this.registerExitHandlers();
  }

  static getInstance(): ProcessCleanupManager {
    if (!ProcessCleanupManager.instance) {
      ProcessCleanupManager.instance = new ProcessCleanupManager();
    }
    return ProcessCleanupManager.instance;
  }

  /**
   * Register a child process for automatic cleanup
   */
  register(process: ChildProcess): void {
    this.childProcesses.add(process);

    // Remove from set when process exits naturally
    process.once('exit', () => {
      this.childProcesses.delete(process);
    });
  }

  /**
   * Unregister a child process
   */
  unregister(process: ChildProcess): void {
    this.childProcesses.delete(process);
  }

  /**
   * Register exit handlers for graceful cleanup
   */
  private registerExitHandlers(): void {
    if (this.exitHandlersRegistered) return;

    const cleanup = async (signal: string) => {
      if (this.isCleaningUp) return;
      this.isCleaningUp = true;

      console.log(`\n🧹 Cleaning up ${this.childProcesses.size} background processes (${signal})...`);

      // Give processes time to cleanup gracefully
      const cleanupPromises: Promise<void>[] = [];

      for (const process of this.childProcesses) {
        cleanupPromises.push(this.cleanupProcess(process));
      }

      // Wait for all cleanups with timeout
      await Promise.race([
        Promise.all(cleanupPromises),
        new Promise(resolve => setTimeout(resolve, 5000))
      ]);

      this.emit('cleanup-complete');

      // Exit after cleanup
      if (signal !== 'beforeExit') {
        process.exit(0);
      }
    };

    // Handle different exit signals
    process.on('SIGINT', () => cleanup('SIGINT'));
    process.on('SIGTERM', () => cleanup('SIGTERM'));
    process.on('SIGHUP', () => cleanup('SIGHUP'));
    process.on('beforeExit', () => cleanup('beforeExit'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught exception:', error);
      cleanup('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
      cleanup('unhandledRejection');
    });

    this.exitHandlersRegistered = true;
  }

  /**
   * Cleanup a single process
   */
  private async cleanupProcess(childProcess: ChildProcess): Promise<void> {
    return new Promise((resolve) => {
      if (!childProcess.killed && childProcess.pid) {
        const timeout = setTimeout(() => {
          // Force kill if graceful shutdown fails
          try {
            childProcess.kill('SIGKILL');
          } catch (e) {
            // Process might already be dead
          }
          resolve();
        }, 3000);

        childProcess.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });

        // Try graceful shutdown first
        try {
          childProcess.kill('SIGTERM');
        } catch (e) {
          // Process might already be dead
          clearTimeout(timeout);
          resolve();
        }
      } else {
        resolve();
      }
    });
  }

  /**
   * Manually cleanup all processes
   */
  async cleanupAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const process of this.childProcesses) {
      promises.push(this.cleanupProcess(process));
    }
    await Promise.all(promises);
    this.childProcesses.clear();
  }

  /**
   * Get count of active processes
   */
  getActiveCount(): number {
    return this.childProcesses.size;
  }
}

// Export singleton instance
export const processCleanup = ProcessCleanupManager.getInstance();