/**
 * EventBus - Centralized event system for mini-agent communication
 * Handles all events between mini-agents, spawner, and main orchestrator
 */

import { EventEmitter } from 'events';
import { MiniAgentEvent, EventBus as IEventBus } from '../core/types.js';

export class EventBus extends EventEmitter implements IEventBus {
  private eventHistory: (MiniAgentEvent & { id: string })[] = [];
  private maxHistorySize: number;
  private eventCounters: Map<string, number> = new Map();

  constructor(maxHistorySize: number = 1000) {
    super();
    this.maxHistorySize = maxHistorySize;
    this.setupEventLogging();
  }

  private setupEventLogging(): void {
    // Log all events for debugging and monitoring
    this.on('newListener', (event: string) => {
      if (!event.startsWith('_internal')) {
        console.debug(`EventBus: New listener for ${event}`);
      }
    });

    this.on('removeListener', (event: string) => {
      if (!event.startsWith('_internal')) {
        console.debug(`EventBus: Removed listener for ${event}`);
      }
    });
  }

  public emit<T extends MiniAgentEvent>(event: T): void {
    const eventId = this.generateEventId();
    const enrichedEvent = { ...event, id: eventId };

    // Add to history
    this.addToHistory(enrichedEvent);

    // Update counters
    this.updateEventCounter(event.type);

    // Emit the event
    super.emit(event.type, enrichedEvent);
    super.emit('*', enrichedEvent); // Wildcard listener

    // Emit internal monitoring event
    super.emit('_internal:event-emitted', {
      eventType: event.type,
      eventId,
      timestamp: event.timestamp,
      data: event
    });

    console.debug(`EventBus: Emitted ${event.type} event [${eventId}]`);
  }

  public on<T extends MiniAgentEvent>(
    eventType: T['type'] | '*',
    handler: (event: T) => void
  ): void {
    super.on(eventType, handler);
  }

  public off<T extends MiniAgentEvent>(
    eventType: T['type'] | '*',
    handler: (event: T) => void
  ): void {
    super.off(eventType, handler);
  }

  public once<T extends MiniAgentEvent>(
    eventType: T['type'] | '*',
    handler: (event: T) => void
  ): void {
    super.once(eventType, handler);
  }

  public removeAllListeners(eventType?: MiniAgentEvent['type']): void {
    if (eventType) {
      super.removeAllListeners(eventType);
    } else {
      super.removeAllListeners();
    }
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addToHistory(event: MiniAgentEvent & { id: string }): void {
    this.eventHistory.push(event);

    // Trim history if it exceeds max size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  private updateEventCounter(eventType: string): void {
    const currentCount = this.eventCounters.get(eventType) || 0;
    this.eventCounters.set(eventType, currentCount + 1);
  }

  // Event filtering and querying methods
  public getEventHistory(
    eventType?: MiniAgentEvent['type'],
    agentId?: string,
    since?: number
  ): (MiniAgentEvent & { id: string })[] {
    let filtered = this.eventHistory;

    if (eventType) {
      filtered = filtered.filter(event => event.type === eventType);
    }

    if (agentId) {
      filtered = filtered.filter(event => {
        // Check if event has agentId property
        return (event as any).agentId === agentId;
      });
    }

    if (since) {
      filtered = filtered.filter(event => event.timestamp >= since);
    }

    return filtered;
  }

  public getEventStats(): EventStats {
    const totalEvents = this.eventHistory.length;
    const eventTypeBreakdown: Record<string, number> = {};

    this.eventCounters.forEach((count, eventType) => {
      eventTypeBreakdown[eventType] = count;
    });

    const recentEvents = this.eventHistory
      .filter(event => Date.now() - event.timestamp < 60000) // Last minute
      .length;

    return {
      totalEvents,
      recentEvents,
      eventTypeBreakdown,
      historySize: this.eventHistory.length,
      maxHistorySize: this.maxHistorySize
    };
  }

  public getAgentTimeline(agentId: string): AgentTimeline {
    const agentEvents = this.getEventHistory(undefined, agentId);

    const timeline: AgentTimelineEvent[] = agentEvents.map(event => ({
      timestamp: event.timestamp,
      eventType: event.type,
      eventId: event.id,
      data: event
    }));

    // Sort by timestamp
    timeline.sort((a, b) => a.timestamp - b.timestamp);

    return {
      agentId,
      events: timeline,
      totalEvents: timeline.length,
      timespan: timeline.length > 0 ? {
        start: timeline[0].timestamp,
        end: timeline[timeline.length - 1].timestamp
      } : null
    };
  }

  // Event pattern detection
  public detectEventPatterns(timeWindowMs: number = 60000): EventPattern[] {
    const now = Date.now();
    const recentEvents = this.eventHistory.filter(
      event => now - event.timestamp <= timeWindowMs
    );

    const patterns: EventPattern[] = [];

    // Detect rapid fire patterns (same event type in quick succession)
    const rapidFireThreshold = 5; // events
    const rapidFireWindow = 5000; // 5 seconds

    const eventGroups = this.groupEventsByType(recentEvents);

    Object.entries(eventGroups).forEach(([eventType, events]) => {
      const rapidSequences = this.findRapidSequences(
        events,
        rapidFireThreshold,
        rapidFireWindow
      );

      rapidSequences.forEach(sequence => {
        patterns.push({
          type: 'rapid_fire',
          eventType,
          count: sequence.length,
          timespan: sequence[sequence.length - 1].timestamp - sequence[0].timestamp,
          confidence: this.calculatePatternConfidence('rapid_fire', sequence)
        });
      });
    });

    // Detect agent lifecycle patterns
    const lifecyclePatterns = this.detectLifecyclePatterns(recentEvents);
    patterns.push(...lifecyclePatterns);

    return patterns;
  }

  private groupEventsByType(
    events: (MiniAgentEvent & { id: string })[]
  ): Record<string, (MiniAgentEvent & { id: string })[]> {
    const groups: Record<string, (MiniAgentEvent & { id: string })[]> = {};

    events.forEach(event => {
      if (!groups[event.type]) {
        groups[event.type] = [];
      }
      groups[event.type].push(event);
    });

    return groups;
  }

  private findRapidSequences(
    events: (MiniAgentEvent & { id: string })[],
    minCount: number,
    windowMs: number
  ): (MiniAgentEvent & { id: string })[][] {
    const sequences: (MiniAgentEvent & { id: string })[][] = [];

    for (let i = 0; i < events.length - minCount + 1; i++) {
      const subsequence: (MiniAgentEvent & { id: string })[] = [events[i]];

      for (let j = i + 1; j < events.length; j++) {
        if (events[j].timestamp - events[i].timestamp <= windowMs) {
          subsequence.push(events[j]);
        } else {
          break;
        }
      }

      if (subsequence.length >= minCount) {
        sequences.push(subsequence);
      }
    }

    return sequences;
  }

  private detectLifecyclePatterns(
    events: (MiniAgentEvent & { id: string })[]
  ): EventPattern[] {
    const patterns: EventPattern[] = [];

    // Group events by agent ID
    const agentGroups: Record<string, (MiniAgentEvent & { id: string })[]> = {};

    events.forEach(event => {
      const agentId = (event as any).agentId;
      if (agentId) {
        if (!agentGroups[agentId]) {
          agentGroups[agentId] = [];
        }
        agentGroups[agentId].push(event);
      }
    });

    // Analyze each agent's lifecycle
    Object.entries(agentGroups).forEach(([agentId, agentEvents]) => {
      const lifecycle = this.analyzeAgentLifecycle(agentEvents);

      if (lifecycle.hasCompleteCycle) {
        patterns.push({
          type: 'complete_lifecycle',
          eventType: 'agent_lifecycle',
          count: lifecycle.events.length,
          timespan: lifecycle.duration,
          confidence: lifecycle.confidence,
          agentId
        });
      }

      if (lifecycle.hasFailurePattern) {
        patterns.push({
          type: 'failure_pattern',
          eventType: 'agent_failure',
          count: lifecycle.failureCount,
          timespan: lifecycle.duration,
          confidence: lifecycle.failureConfidence,
          agentId
        });
      }
    });

    return patterns;
  }

  private analyzeAgentLifecycle(
    events: (MiniAgentEvent & { id: string })[]
  ): AgentLifecycleAnalysis {
    const sortedEvents = events.sort((a, b) => a.timestamp - b.timestamp);

    const hasSpawned = sortedEvents.some(e => e.type === 'AGENT_SPAWNED');
    const hasCompleted = sortedEvents.some(e => e.type === 'AGENT_COMPLETED');
    const hasFailed = sortedEvents.some(e => e.type === 'AGENT_FAILED');
    const hasDestroyed = sortedEvents.some(e => e.type === 'AGENT_DESTROYED');

    const failureEvents = sortedEvents.filter(e => e.type === 'AGENT_FAILED');

    return {
      events: sortedEvents,
      hasCompleteCycle: hasSpawned && (hasCompleted || hasFailed) && hasDestroyed,
      hasFailurePattern: failureEvents.length > 1,
      duration: sortedEvents.length > 0 ?
        sortedEvents[sortedEvents.length - 1].timestamp - sortedEvents[0].timestamp : 0,
      confidence: this.calculateLifecycleConfidence(sortedEvents),
      failureCount: failureEvents.length,
      failureConfidence: failureEvents.length > 1 ? 0.8 : 0.0
    };
  }

  private calculatePatternConfidence(
    patternType: string,
    events: (MiniAgentEvent & { id: string })[]
  ): number {
    switch (patternType) {
      case 'rapid_fire':
        // Higher confidence for more events in shorter time
        const timespan = events[events.length - 1].timestamp - events[0].timestamp;
        return Math.min(1.0, events.length / (timespan / 1000));

      default:
        return 0.5;
    }
  }

  private calculateLifecycleConfidence(
    events: (MiniAgentEvent & { id: string })[]
  ): number {
    const expectedSequence = [
      'SPAWN_REQUESTED',
      'AGENT_SPAWNED',
      'PROGRESS_UPDATE',
      'AGENT_COMPLETED',
      'CLEANUP_INITIATED',
      'AGENT_DESTROYED'
    ];

    let sequenceScore = 0;
    let lastIndex = -1;

    events.forEach(event => {
      const index = expectedSequence.indexOf(event.type);
      if (index > lastIndex) {
        sequenceScore++;
        lastIndex = index;
      }
    });

    return sequenceScore / expectedSequence.length;
  }

  // Cleanup and maintenance
  public clearHistory(): void {
    this.eventHistory = [];
    this.eventCounters.clear();
    super.emit('_internal:history-cleared', { timestamp: Date.now() });
  }

  public getMemoryUsage(): EventBusMemoryUsage {
    const historySize = JSON.stringify(this.eventHistory).length;
    const counterSize = JSON.stringify(Array.from(this.eventCounters.entries())).length;

    return {
      historyMemoryBytes: historySize,
      counterMemoryBytes: counterSize,
      totalMemoryBytes: historySize + counterSize,
      eventCount: this.eventHistory.length,
      listenerCount: this.listenerCount('*') + this.eventNames().length
    };
  }

  public pruneHistory(olderThanMs: number): number {
    const cutoffTime = Date.now() - olderThanMs;
    const originalLength = this.eventHistory.length;

    this.eventHistory = this.eventHistory.filter(
      event => event.timestamp >= cutoffTime
    );

    const prunedCount = originalLength - this.eventHistory.length;

    super.emit('_internal:history-pruned', {
      timestamp: Date.now(),
      prunedCount,
      remainingCount: this.eventHistory.length
    });

    return prunedCount;
  }
}

// Supporting interfaces
interface EventStats {
  totalEvents: number;
  recentEvents: number;
  eventTypeBreakdown: Record<string, number>;
  historySize: number;
  maxHistorySize: number;
}

interface AgentTimeline {
  agentId: string;
  events: AgentTimelineEvent[];
  totalEvents: number;
  timespan: {
    start: number;
    end: number;
  } | null;
}

interface AgentTimelineEvent {
  timestamp: number;
  eventType: string;
  eventId: string;
  data: MiniAgentEvent;
}

interface EventPattern {
  type: 'rapid_fire' | 'complete_lifecycle' | 'failure_pattern';
  eventType: string;
  count: number;
  timespan: number;
  confidence: number;
  agentId?: string;
}

interface AgentLifecycleAnalysis {
  events: (MiniAgentEvent & { id: string })[];
  hasCompleteCycle: boolean;
  hasFailurePattern: boolean;
  duration: number;
  confidence: number;
  failureCount: number;
  failureConfidence: number;
}

interface EventBusMemoryUsage {
  historyMemoryBytes: number;
  counterMemoryBytes: number;
  totalMemoryBytes: number;
  eventCount: number;
  listenerCount: number;
}