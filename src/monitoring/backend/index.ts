/**
 * Monitoring System Entry Point
 * Can be used with or without agent integration
 */

import { UnifiedMonitoringServer as MonitoringServer } from './unified-server.js';
import { MonitoringBridge } from './monitoring-bridge.js';
import { Orchestrator } from '../../core/orchestrator.js';
import { MemoryManager } from '../../memory/memory-manager.js';
import { PrismaClient } from '@prisma/client';
import { ProjectManager } from '../../memory/project-manager.js';

export interface MonitoringOptions {
  port?: number;
  enableRealtime?: boolean;
  projectRoot?: string;
}

export class MonitoringSystem {
  private server: MonitoringServer;
  private bridge: MonitoringBridge;
  private projectManager: ProjectManager;
  private prisma: PrismaClient;
  
  constructor(options: MonitoringOptions = {}) {
    const port = options.port || 4000;
    
    // Initialize project manager
    this.projectManager = new ProjectManager();
    
    // Initialize Prisma
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${this.projectManager.getDbPath()}`
        }
      }
    });
    
    // Create monitoring server
    this.server = new MonitoringServer(port);
    
    // Create monitoring bridge
    this.bridge = new MonitoringBridge(
      this.prisma,
      options.projectRoot || this.projectManager.getProjectRoot()
    );
  }
  
  /**
   * Start monitoring (works without agent)
   */
  async start() {
    // Start the bridge (autonomous monitoring)
    await this.bridge.start();
    
    // Start the web server
    this.server.start();
    
    console.log(`
╔════════════════════════════════════════════════════════╗
║           FlexiCLI Monitoring System Active            ║
╠════════════════════════════════════════════════════════╣
║  Dashboard: http://localhost:4000                      ║
║  Status: Autonomous mode (reading DB/logs/files)       ║
║  Agent: Not required - will attach if available        ║
╚════════════════════════════════════════════════════════╝
    `);
  }
  
  /**
   * Optional: Attach to running agent for real-time data
   */
  attachToAgent(orchestrator?: Orchestrator, memoryManager?: MemoryManager) {
    if (orchestrator) {
      this.bridge.attachToOrchestrator(orchestrator);
    }
    
    if (memoryManager) {
      this.bridge.attachToMemoryManager(memoryManager);
    }
    
    console.log('🔗 Monitoring attached to agent (real-time mode enabled)');
  }
  
  /**
   * Detach from agent (monitoring continues)
   */
  detachFromAgent() {
    this.bridge.detach();
    console.log('🔌 Monitoring detached (continuing in autonomous mode)');
  }
  
  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      server: `http://localhost:${this.server.getPort() || 4000}`,
      health: this.bridge.getHealth(),
      metrics: this.bridge.getAllMetrics()
    };
  }
  
  /**
   * Stop monitoring completely
   */
  async stop() {
    await this.bridge.stop();
    await this.server.stop();
    await this.prisma.$disconnect();
    console.log('🛑 Monitoring system stopped');
  }
}

/**
 * Standalone monitoring launcher (no agent required)
 */
export async function startStandaloneMonitoring(port = 4000) {
  const monitoring = new MonitoringSystem({ port });
  await monitoring.start();
  
  // Keep running
  process.on('SIGINT', async () => {
    await monitoring.stop();
    process.exit(0);
  });
  
  return monitoring;
}

/**
 * Example: How to use with existing agent
 */
export function integrateWithAgent(
  orchestrator: Orchestrator,
  memoryManager: MemoryManager,
  options?: MonitoringOptions
) {
  const monitoring = new MonitoringSystem(options);
  
  // Start monitoring first (autonomous mode)
  monitoring.start().then(() => {
    // Then attach to agent for real-time data
    monitoring.attachToAgent(orchestrator, memoryManager);
  });
  
  // Agent can crash, monitoring continues
  orchestrator.on('error', () => {
    console.log('⚠️ Agent error detected, monitoring continues autonomously');
  });
  
  return monitoring;
}