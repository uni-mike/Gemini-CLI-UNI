import { EventEmitter } from 'events';

interface ResourcePool {
  maxConcurrentOrchestrators: number;
  activeOrchestrators: number;
  queuedRequests: Array<{ resolve: Function; reject: Function; priority: number }>;
  memoryLimit: number;
  currentMemoryUsage: number;
}

export class ResourcePoolManager extends EventEmitter {
  private static instance: ResourcePoolManager;
  private pool: ResourcePool;
  private cleanupInterval?: NodeJS.Timeout;

  private constructor() {
    super();
    
    // Calculate optimal limits based on system resources
    const totalMemory = this.getSystemMemory();
    const cpuCores = require('os').cpus().length;
    
    this.pool = {
      maxConcurrentOrchestrators: Math.min(cpuCores * 2, 12), // Max 12 orchestrators
      activeOrchestrators: 0,
      queuedRequests: [],
      memoryLimit: Math.floor(totalMemory * 0.7), // Use 70% of system memory
      currentMemoryUsage: 0
    };
    
    this.startResourceMonitoring();
  }

  static getInstance(): ResourcePoolManager {
    if (!ResourcePoolManager.instance) {
      ResourcePoolManager.instance = new ResourcePoolManager();
    }
    return ResourcePoolManager.instance;
  }

  /**
   * Acquire resources for a new orchestrator
   */
  async acquireOrchestrator(priority: number = 0): Promise<string> {
    const orchestratorId = `orchestrator-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      if (this.canAcquireImmediate()) {
        this.doAcquire(orchestratorId);
        resolve(orchestratorId);
      } else {
        // Queue the request
        this.pool.queuedRequests.push({ resolve, reject, priority });
        this.pool.queuedRequests.sort((a, b) => b.priority - a.priority); // Higher priority first
        
        console.log(`⏳ Orchestrator queued (position ${this.pool.queuedRequests.length}, priority ${priority})`);
      }
    });
  }

  /**
   * Release resources when orchestrator completes
   */
  releaseOrchestrator(orchestratorId: string): void {
    if (this.pool.activeOrchestrators > 0) {
      this.pool.activeOrchestrators--;
      this.updateMemoryUsage();
      
      console.log(`✅ Released orchestrator ${orchestratorId.substring(0, 12)}... (${this.pool.activeOrchestrators} active)`);
      
      // Process queued requests
      this.processQueue();
    }
  }

  /**
   * Check if system has enough resources
   */
  private canAcquireImmediate(): boolean {
    const memoryOk = this.getCurrentMemoryUsage() < this.pool.memoryLimit;
    const concurrencyOk = this.pool.activeOrchestrators < this.pool.maxConcurrentOrchestrators;
    
    return memoryOk && concurrencyOk;
  }

  private doAcquire(orchestratorId: string): void {
    this.pool.activeOrchestrators++;
    this.updateMemoryUsage();
    
    console.log(`🚀 Acquired orchestrator ${orchestratorId.substring(0, 12)}... (${this.pool.activeOrchestrators}/${this.pool.maxConcurrentOrchestrators} active)`);
  }

  private processQueue(): void {
    while (this.pool.queuedRequests.length > 0 && this.canAcquireImmediate()) {
      const request = this.pool.queuedRequests.shift()!;
      const orchestratorId = `orchestrator-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      this.doAcquire(orchestratorId);
      request.resolve(orchestratorId);
    }
  }

  private getCurrentMemoryUsage(): number {
    const memUsage = process.memoryUsage();
    return memUsage.heapUsed + memUsage.external;
  }

  private updateMemoryUsage(): void {
    this.pool.currentMemoryUsage = this.getCurrentMemoryUsage();
  }

  private getSystemMemory(): number {
    const totalMemory = require('os').totalmem();
    return totalMemory;
  }

  private startResourceMonitoring(): void {
    this.cleanupInterval = setInterval(() => {
      this.updateMemoryUsage();
      
      const memoryUsagePercent = (this.pool.currentMemoryUsage / this.pool.memoryLimit) * 100;
      
      if (memoryUsagePercent > 90) {
        console.warn(`⚠️ High memory usage: ${memoryUsagePercent.toFixed(1)}%`);
        this.emit('highMemoryUsage', { usage: memoryUsagePercent });
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          console.log('🗑️ Forced garbage collection');
        }
      }
      
      // Adaptive limit adjustment based on system performance
      this.adjustLimitsBasedOnPerformance();
      
    }, 5000); // Check every 5 seconds
  }

  private adjustLimitsBasedOnPerformance(): void {
    const memoryUsagePercent = (this.pool.currentMemoryUsage / this.pool.memoryLimit) * 100;
    
    // If consistently high memory usage, reduce concurrent limit
    if (memoryUsagePercent > 80 && this.pool.maxConcurrentOrchestrators > 2) {
      this.pool.maxConcurrentOrchestrators = Math.max(2, this.pool.maxConcurrentOrchestrators - 1);
      console.log(`🔧 Reduced max concurrent orchestrators to ${this.pool.maxConcurrentOrchestrators} due to memory pressure`);
    }
    
    // If low memory usage, gradually increase limit
    if (memoryUsagePercent < 50 && this.pool.maxConcurrentOrchestrators < 12) {
      this.pool.maxConcurrentOrchestrators = Math.min(12, this.pool.maxConcurrentOrchestrators + 1);
      console.log(`🚀 Increased max concurrent orchestrators to ${this.pool.maxConcurrentOrchestrators}`);
    }
  }

  /**
   * Get current pool status
   */
  getStatus() {
    return {
      activeOrchestrators: this.pool.activeOrchestrators,
      maxConcurrentOrchestrators: this.pool.maxConcurrentOrchestrators,
      queuedRequests: this.pool.queuedRequests.length,
      memoryUsage: this.pool.currentMemoryUsage,
      memoryLimit: this.pool.memoryLimit,
      memoryUsagePercent: (this.pool.currentMemoryUsage / this.pool.memoryLimit) * 100
    };
  }

  /**
   * Emergency shutdown - reject all queued requests and cleanup
   */
  emergencyShutdown(): void {
    console.warn('🚨 Emergency resource pool shutdown initiated');
    
    // Reject all queued requests
    this.pool.queuedRequests.forEach(request => {
      request.reject(new Error('System shutdown'));
    });
    this.pool.queuedRequests = [];
    
    // Clear monitoring
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.emit('emergencyShutdown');
  }

  /**
   * Clean shutdown - wait for active orchestrators to complete
   */
  async gracefulShutdown(timeoutMs: number = 30000): Promise<void> {
    console.log('🛑 Initiating graceful resource pool shutdown...');
    
    // Stop accepting new requests
    this.pool.queuedRequests.forEach(request => {
      request.reject(new Error('System shutting down'));
    });
    this.pool.queuedRequests = [];
    
    // Wait for active orchestrators to complete
    const startTime = Date.now();
    
    while (this.pool.activeOrchestrators > 0 && (Date.now() - startTime) < timeoutMs) {
      console.log(`⏳ Waiting for ${this.pool.activeOrchestrators} active orchestrators to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (this.pool.activeOrchestrators > 0) {
      console.warn(`⚠️ Shutdown timeout: ${this.pool.activeOrchestrators} orchestrators still active`);
    }
    
    // Clear monitoring
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    console.log('✅ Resource pool shutdown complete');
  }
}