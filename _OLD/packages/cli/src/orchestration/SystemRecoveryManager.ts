import { EventEmitter } from 'events';
import * as os from 'os';

interface SystemMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  memoryUsagePercent: number;
  freeMemory: number;
  loadAverage: number[];
  uptime: number;
  cpuUsage?: number;
}

export class SystemRecoveryManager extends EventEmitter {
  private static instance: SystemRecoveryManager;
  private monitoringInterval?: NodeJS.Timeout;
  private recoveryMode = false;
  private lastCpuUsage?: NodeJS.CpuUsage;
  private emergencyThresholds = {
    memoryPercent: 95,
    freeMemoryMB: 100,
    loadAverage: os.cpus().length * 2,
    cpuPercent: 98
  };

  private constructor() {
    super();
    this.startSystemMonitoring();
  }

  static getInstance(): SystemRecoveryManager {
    if (!SystemRecoveryManager.instance) {
      SystemRecoveryManager.instance = new SystemRecoveryManager();
    }
    return SystemRecoveryManager.instance;
  }

  private startSystemMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      const metrics = this.getSystemMetrics();
      this.analyzeSystemHealth(metrics);
    }, 2000); // Check every 2 seconds
  }

  private getSystemMetrics(): SystemMetrics {
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const loadAverage = os.loadavg();
    
    let cpuUsage: number | undefined;
    if (this.lastCpuUsage) {
      const currentCpuUsage = process.cpuUsage(this.lastCpuUsage);
      const totalTime = currentCpuUsage.user + currentCpuUsage.system;
      cpuUsage = (totalTime / 1000000) * 100; // Convert to percentage
    }
    this.lastCpuUsage = process.cpuUsage();

    return {
      memoryUsage,
      memoryUsagePercent: ((totalMemory - freeMemory) / totalMemory) * 100,
      freeMemory: freeMemory / 1024 / 1024, // Convert to MB
      loadAverage,
      uptime: os.uptime(),
      cpuUsage
    };
  }

  private analyzeSystemHealth(metrics: SystemMetrics): void {
    const issues: string[] = [];
    let severity: 'warning' | 'critical' | 'emergency' = 'warning';

    // Memory analysis
    if (metrics.memoryUsagePercent > this.emergencyThresholds.memoryPercent) {
      issues.push(`Memory usage critical: ${metrics.memoryUsagePercent.toFixed(1)}%`);
      severity = 'emergency';
    } else if (metrics.freeMemory < this.emergencyThresholds.freeMemoryMB) {
      issues.push(`Low free memory: ${metrics.freeMemory.toFixed(1)}MB`);
      severity = 'critical';
    }

    // Load average analysis
    const currentLoad = metrics.loadAverage[0];
    if (currentLoad > this.emergencyThresholds.loadAverage) {
      issues.push(`High load average: ${currentLoad.toFixed(2)}`);
      if (severity !== 'emergency') severity = 'critical';
    }

    // CPU analysis
    if (metrics.cpuUsage && metrics.cpuUsage > this.emergencyThresholds.cpuPercent) {
      issues.push(`CPU usage critical: ${metrics.cpuUsage.toFixed(1)}%`);
      severity = 'emergency';
    }

    // Process heap analysis
    const heapPercent = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
    if (heapPercent > 90) {
      issues.push(`Heap usage high: ${heapPercent.toFixed(1)}%`);
      if (severity === 'warning') severity = 'critical';
    }

    if (issues.length > 0) {
      this.handleSystemStress(severity, issues, metrics);
    } else if (this.recoveryMode) {
      this.exitRecoveryMode(metrics);
    }
  }

  private async handleSystemStress(severity: string, issues: string[], metrics: SystemMetrics): Promise<void> {
    console.warn(`🚨 System stress detected (${severity}): ${issues.join(', ')}`);
    
    if (!this.recoveryMode) {
      this.recoveryMode = true;
      this.emit('systemStress', { severity, issues, metrics });
    }

    switch (severity) {
      case 'emergency':
        await this.emergencyRecovery(issues, metrics);
        break;
      case 'critical':
        await this.criticalRecovery(issues, metrics);
        break;
      case 'warning':
        await this.warningRecovery(issues, metrics);
        break;
    }
  }

  private async emergencyRecovery(issues: string[], metrics: SystemMetrics): Promise<void> {
    console.error('🚨 EMERGENCY RECOVERY INITIATED');
    
    // 1. Force garbage collection
    if (global.gc) {
      console.log('🗑️ Forcing immediate garbage collection...');
      global.gc();
      global.gc(); // Run twice for good measure
    }

    // 2. Clear all possible caches
    if (require.cache) {
      const cacheKeys = Object.keys(require.cache);
      console.log(`🧹 Clearing ${cacheKeys.length} cached modules...`);
      cacheKeys.forEach(key => {
        try {
          delete require.cache[key];
        } catch (e) {
          // Ignore errors when clearing cache
        }
      });
    }

    // 3. Emergency shutdown of non-critical processes
    this.emit('emergencyShutdown', { reason: 'System resource exhaustion', metrics });

    // 4. Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 5. Final attempt to free memory
    if (global.gc) {
      global.gc();
    }

    console.log('🚨 Emergency recovery completed');
  }

  private async criticalRecovery(issues: string[], metrics: SystemMetrics): Promise<void> {
    console.warn('⚠️ CRITICAL RECOVERY INITIATED');

    // 1. Aggressive garbage collection
    if (global.gc) {
      console.log('🗑️ Running aggressive garbage collection...');
      for (let i = 0; i < 3; i++) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // 2. Reduce concurrent operations
    this.emit('reduceLoad', { 
      reason: 'Critical system stress', 
      recommendations: {
        maxConcurrentTasks: 1,
        maxConcurrentOrchestrators: 2,
        enableStreamingMode: true
      }
    });

    // 3. Clear large data structures
    this.emit('clearCaches', { level: 'aggressive' });

    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('⚠️ Critical recovery completed');
  }

  private async warningRecovery(issues: string[], metrics: SystemMetrics): Promise<void> {
    console.log('💡 WARNING RECOVERY INITIATED');

    // 1. Gentle garbage collection
    if (global.gc) {
      global.gc();
    }

    // 2. Reduce system load slightly
    this.emit('reduceLoad', {
      reason: 'System under stress',
      recommendations: {
        maxConcurrentTasks: Math.max(1, Math.floor(os.cpus().length * 0.8)),
        enableMemoryOptimizations: true
      }
    });

    console.log('💡 Warning recovery completed');
  }

  private exitRecoveryMode(metrics: SystemMetrics): void {
    console.log('✅ System health restored, exiting recovery mode');
    this.recoveryMode = false;
    
    this.emit('systemRecovered', { 
      metrics,
      recommendations: {
        maxConcurrentTasks: os.cpus().length,
        maxConcurrentOrchestrators: Math.min(os.cpus().length * 2, 12),
        enableAllFeatures: true
      }
    });
  }

  /**
   * Get current system health status
   */
  getHealthStatus(): { status: string; metrics: SystemMetrics; inRecoveryMode: boolean } {
    const metrics = this.getSystemMetrics();
    
    let status = 'healthy';
    if (metrics.memoryUsagePercent > 85 || metrics.freeMemory < 200) {
      status = 'stressed';
    }
    if (metrics.memoryUsagePercent > 95 || metrics.freeMemory < 100) {
      status = 'critical';
    }

    return {
      status,
      metrics,
      inRecoveryMode: this.recoveryMode
    };
  }

  /**
   * Manual recovery trigger
   */
  async triggerManualRecovery(level: 'gentle' | 'aggressive' | 'emergency' = 'gentle'): Promise<void> {
    console.log(`🔧 Manual recovery triggered (${level})`);
    
    const metrics = this.getSystemMetrics();
    
    switch (level) {
      case 'emergency':
        await this.emergencyRecovery(['Manual trigger'], metrics);
        break;
      case 'aggressive':
        await this.criticalRecovery(['Manual trigger'], metrics);
        break;
      case 'gentle':
        await this.warningRecovery(['Manual trigger'], metrics);
        break;
    }
  }

  /**
   * Cleanup and shutdown
   */
  shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    console.log('🛑 System recovery manager shutdown');
  }
}