/**
 * Session Manager
 * Handles session lifecycle and crash recovery
 */

import { PrismaClient, Session, SessionSnapshot } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { ProjectManager } from './project-manager.js';
import { EphemeralState } from './layers/ephemeral.js';
import { TokenUsage } from './token-budget.js';
import { SESSION_CONFIG, OperatingMode } from './constants.js';

export interface SessionState {
  sessionId: string;
  mode: OperatingMode;
  ephemeralState: EphemeralState;
  retrievalIds: string[];
  tokenBudget: TokenUsage;
  lastCommand?: string;
  workingFiles: string[];
  appliedPatches: string[];
}

export class SessionManager {
  private prisma: PrismaClient;
  private projectManager: ProjectManager;
  private currentSession: Session | null = null;
  private sessionState: SessionState | null = null;
  private operationCount: number = 0;
  
  constructor(prisma: PrismaClient, projectManager: ProjectManager) {
    this.prisma = prisma;
    this.projectManager = projectManager;
  }
  
  /**
   * Start a new session or recover from crash
   */
  async startSession(mode: OperatingMode = 'concise'): Promise<SessionState> {
    const projectId = this.projectManager.getProjectId();
    
    // Check for crashed sessions
    const crashedSession = await this.findCrashedSession(projectId);
    
    if (crashedSession) {
      console.log('🔄 Recovering from previous session...');
      return await this.recoverSession(crashedSession);
    }
    
    // Start new session
    return await this.createNewSession(projectId, mode);
  }
  
  /**
   * Create a new session
   */
  private async createNewSession(projectId: string, mode: OperatingMode): Promise<SessionState> {
    const sessionId = uuidv4();
    
    // Create session in database
    this.currentSession = await this.prisma.session.create({
      data: {
        id: sessionId,
        projectId,
        mode,
        status: 'active'
      }
    });
    
    // Initialize session state
    this.sessionState = {
      sessionId,
      mode,
      ephemeralState: {
        turns: [],
        workingContext: { focusFiles: [] },
        totalTokens: 0
      },
      retrievalIds: [],
      tokenBudget: {
        input: {
          ephemeral: 0,
          retrieved: 0,
          knowledge: 0,
          query: 0,
          buffer: 0,
          total: 0
        },
        output: {
          reasoning: 0,
          code: 0,
          explanation: 0,
          buffer: 0,
          total: 0
        },
        mode
      },
      workingFiles: [],
      appliedPatches: []
    };
    
    this.operationCount = 0;
    
    // Save initial snapshot
    await this.saveSnapshot();
    
    return this.sessionState;
  }
  
  /**
   * Find crashed sessions
   * RACE CONDITION PROTECTION: Handle database table not existing during concurrent startup
   */
  private async findCrashedSession(projectId: string): Promise<Session | null> {
    try {
      const sessions = await this.prisma.session.findMany({
        where: {
          projectId,
          status: 'active'
        },
        orderBy: { startedAt: 'desc' },
        take: 1
      });

      if (sessions.length === 0) {
        return null;
      }

      const session = sessions[0];

      // Check if session is stale (older than 1 hour)
      const ageMs = Date.now() - session.startedAt.getTime();
      if (ageMs > 60 * 60 * 1000) {
        // Mark as crashed and return for recovery
        await this.prisma.session.update({
          where: { id: session.id },
          data: { status: 'crashed' }
        });
        return session;
      }

      return null;
    } catch (dbError: any) {
      // Handle case where Session table doesn't exist yet (concurrent startup)
      if (dbError.code === 'P2021') {
        console.log('📊 Session table not ready yet, skipping crash recovery');
        return null;
      }
      throw dbError;
    }
  }
  
  /**
   * Recover from crashed session
   */
  private async recoverSession(session: Session): Promise<SessionState> {
    // Find latest snapshot
    const snapshot = await this.prisma.sessionSnapshot.findFirst({
      where: { sessionId: session.id },
      orderBy: { sequenceNumber: 'desc' }
    });
    
    if (!snapshot) {
      // No snapshot, start fresh
      return await this.createNewSession(
        session.projectId,
        session.mode as OperatingMode
      );
    }
    
    // Restore session state
    try {
      const ephemeralState = JSON.parse(snapshot.ephemeralState);
      const retrievalIds = JSON.parse(snapshot.retrievalIds);
      const tokenBudget = JSON.parse(snapshot.tokenBudget);
      
      this.currentSession = session;
      this.sessionState = {
        sessionId: session.id,
        mode: snapshot.mode as OperatingMode,
        ephemeralState,
        retrievalIds,
        tokenBudget,
        lastCommand: snapshot.lastCommand || undefined,
        workingFiles: [],
        appliedPatches: []
      };
      
      this.operationCount = snapshot.sequenceNumber;
      
      // Update session status
      await this.prisma.session.update({
        where: { id: session.id },
        data: { status: 'active' }
      });
      
      console.log(`✅ Recovered session from snapshot #${snapshot.sequenceNumber}`);
      
      // Record recovery in TODO.md
      this.recordRecovery(session.id, snapshot.sequenceNumber);
      
      return this.sessionState;
    } catch (error) {
      console.warn('Failed to restore snapshot, starting fresh:', error);
      return await this.createNewSession(
        session.projectId,
        session.mode as OperatingMode
      );
    }
  }
  
  /**
   * Save session snapshot
   */
  async saveSnapshot(): Promise<void> {
    if (!this.currentSession || !this.sessionState) {
      return;
    }
    
    this.operationCount++;
    
    // Only save at intervals or on important operations
    if (this.operationCount % SESSION_CONFIG.SNAPSHOT_INTERVAL !== 0) {
      return;
    }
    
    try {
      await this.prisma.sessionSnapshot.create({
        data: {
          sessionId: this.currentSession.id,
          sequenceNumber: this.operationCount,
          ephemeralState: JSON.stringify(this.sessionState.ephemeralState),
          retrievalIds: JSON.stringify(this.sessionState.retrievalIds),
          mode: this.sessionState.mode,
          tokenBudget: JSON.stringify(this.sessionState.tokenBudget),
          lastCommand: this.sessionState.lastCommand
        }
      });
      
      // Update session with latest snapshot info
      await this.prisma.session.update({
        where: { id: this.currentSession.id },
        data: {
          lastSnapshot: JSON.stringify({
            sequenceNumber: this.operationCount,
            timestamp: new Date().toISOString()
          }),
          turnCount: this.sessionState.ephemeralState.turns.length,
          tokensUsed: this.sessionState.tokenBudget.input.total
        }
      });
      
      // Clean old snapshots
      await this.cleanOldSnapshots();
    } catch (error) {
      console.warn('Failed to save snapshot:', error);
    }
  }
  
  /**
   * Save snapshot on important operation
   */
  async saveImportantSnapshot(reason: string): Promise<void> {
    if (!this.currentSession || !this.sessionState) {
      return;
    }
    
    // Force save regardless of interval
    const prevCount = this.operationCount;
    this.operationCount = Math.ceil(this.operationCount / SESSION_CONFIG.SNAPSHOT_INTERVAL) * SESSION_CONFIG.SNAPSHOT_INTERVAL;
    
    await this.saveSnapshot();
    
    console.log(`💾 Saved snapshot for: ${reason}`);
    
    this.operationCount = prevCount + 1;
  }
  
  /**
   * Clean old snapshots
   */
  private async cleanOldSnapshots(): Promise<void> {
    if (!this.currentSession) {
      return;
    }
    
    // Get all snapshots for this session
    const snapshots = await this.prisma.sessionSnapshot.findMany({
      where: { sessionId: this.currentSession.id },
      orderBy: { sequenceNumber: 'desc' }
    });
    
    // Keep only the latest N snapshots
    if (snapshots.length > SESSION_CONFIG.MAX_SNAPSHOTS) {
      const toDelete = snapshots.slice(SESSION_CONFIG.MAX_SNAPSHOTS);
      
      await this.prisma.sessionSnapshot.deleteMany({
        where: {
          id: { in: toDelete.map(s => s.id) }
        }
      });
    }
  }
  
  /**
   * Update session state
   */
  updateState(updates: Partial<SessionState>): void {
    if (!this.sessionState) {
      return;
    }
    
    this.sessionState = {
      ...this.sessionState,
      ...updates
    };
  }
  
  /**
   * Track operation
   */
  trackOperation(): void {
    this.operationCount++;
  }
  
  /**
   * End session gracefully
   */
  async endSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }
    
    // Save final snapshot
    await this.saveImportantSnapshot('session end');
    
    // Update session status
    await this.prisma.session.update({
      where: { id: this.currentSession.id },
      data: {
        status: 'completed',
        endedAt: new Date()
      }
    });
    
    this.currentSession = null;
    this.sessionState = null;
    this.operationCount = 0;
  }
  
  /**
   * Get current session state
   */
  getState(): SessionState | null {
    return this.sessionState;
  }
  
  /**
   * Get session ID
   */
  getSessionId(): string | null {
    return this.currentSession?.id || null;
  }
  
  /**
   * Record recovery in TODO.md
   */
  private recordRecovery(sessionId: string, snapshotNumber: number): void {
    const todoPath = 'TODO.md';
    let content = '';
    
    if (existsSync(todoPath)) {
      content = readFileSync(todoPath, 'utf8');
    }
    
    const recoveryNote = `\n- [ ] Session recovered: ${sessionId} from snapshot #${snapshotNumber} at ${new Date().toISOString()}\n`;
    
    // Add to Assumptions section
    if (content.includes('## Assumptions')) {
      content = content.replace(
        '## Assumptions',
        `## Assumptions\n${recoveryNote}`
      );
    } else {
      content += `\n## Assumptions\n${recoveryNote}`;
    }
    
    writeFileSync(todoPath, content);
  }
  
  /**
   * Clean old sessions
   */
  async cleanOldSessions(maxAgeDays: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
    
    // Find old sessions
    const oldSessions = await this.prisma.session.findMany({
      where: {
        projectId: this.projectManager.getProjectId(),
        startedAt: { lt: cutoffDate }
      }
    });
    
    // Delete snapshots first
    for (const session of oldSessions) {
      await this.prisma.sessionSnapshot.deleteMany({
        where: { sessionId: session.id }
      });
    }
    
    // Delete sessions
    await this.prisma.session.deleteMany({
      where: {
        id: { in: oldSessions.map(s => s.id) }
      }
    });
    
    console.log(`🧹 Cleaned ${oldSessions.length} old sessions`);
  }
}