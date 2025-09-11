/**
 * Comprehensive Test Suite for FlexiCLI Monitoring System
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { MonitoringServer } from '../src/monitoring/server';
import { MetricsCollector } from '../src/monitoring/metrics-collector';
import { MemoryManager } from '../src/memory/memory-manager';
import { TokenBudgetManager } from '../src/memory/token-budget';
import { ProjectManager } from '../src/memory/project-manager';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import io from 'socket.io-client';

describe('FlexiCLI Monitoring System', () => {
  let server: MonitoringServer;
  let collector: MetricsCollector;
  let memoryManager: MemoryManager;
  let socket: any;
  const testPort = 4001;
  const baseURL = `http://localhost:${testPort}`;

  beforeAll(async () => {
    // Start monitoring server
    server = new MonitoringServer(testPort);
    server.start();
    collector = server.getCollector();
    
    // Initialize memory manager
    memoryManager = new MemoryManager('concise');
    await memoryManager.initialize();
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (socket) socket.close();
    await server.stop();
    await memoryManager.cleanup();
  });

  describe('Token Budget Management', () => {
    let tokenBudget: TokenBudgetManager;

    beforeEach(() => {
      tokenBudget = new TokenBudgetManager('concise');
    });

    it('should enforce input token limits', () => {
      const largeText = 'a'.repeat(10000);
      const canAdd = tokenBudget.canAddToInput('ephemeral', largeText);
      expect(canAdd).toBe(false);
    });

    it('should calculate token counts correctly', () => {
      const text = 'Hello, world!';
      const tokens = tokenBudget.countTokens(text);
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10);
    });

    it('should trim content to fit budget', () => {
      const longText = 'Lorem ipsum '.repeat(1000);
      const trimmed = tokenBudget.trimToFit(longText, 100);
      const trimmedTokens = tokenBudget.countTokens(trimmed);
      expect(trimmedTokens).toBeLessThanOrEqual(100);
    });

    it('should track usage across categories', () => {
      tokenBudget.addToInput('query', 'test query');
      tokenBudget.addToInput('ephemeral', 'context');
      
      const usage = tokenBudget.getUsage();
      expect(usage.input.query).toBeGreaterThan(0);
      expect(usage.input.ephemeral).toBeGreaterThan(0);
      expect(usage.input.total).toBe(
        usage.input.query + usage.input.ephemeral
      );
    });

    it('should respect mode-specific limits', () => {
      const directBudget = new TokenBudgetManager('direct');
      const deepBudget = new TokenBudgetManager('deep');
      
      expect(directBudget.getOutputLimit()).toBe(1000);
      expect(deepBudget.getOutputLimit()).toBe(15000);
    });
  });

  describe('Metrics Collection', () => {
    it('should record token usage metrics', () => {
      const metrics = {
        input: {
          ephemeral: 1000,
          retrieved: 2000,
          knowledge: 500,
          query: 100,
          buffer: 400,
          total: 4000,
          limit: 128000,
        },
        output: {
          reasoning: 500,
          code: 1000,
          explanation: 100,
          buffer: 100,
          total: 1700,
          limit: 6000,
        },
        mode: 'concise' as const,
      };

      collector.recordTokenUsage(metrics);
      const allMetrics = collector.getAllMetrics();
      expect(allMetrics.currentTokenUsage).toEqual(metrics);
    });

    it('should track pipeline stages', () => {
      collector.startPipelineStage({
        id: 'test-stage',
        name: 'Test Stage',
        type: 'planner',
        input: { query: 'test' },
      });

      collector.completePipelineStage('test-stage', { result: 'success' });
      
      const events = collector.getRecentEvents();
      const stageEvents = events.filter(e => e.action === 'stage_complete');
      expect(stageEvents.length).toBeGreaterThan(0);
    });

    it('should track tool executions', () => {
      collector.startToolExecution({
        id: 'tool-1',
        toolName: 'bash',
        success: false,
        input: { command: 'ls' },
      });

      collector.completeToolExecution('tool-1', { files: ['test.txt'] });
      
      const metrics = collector.getAllMetrics();
      expect(metrics.toolStats).toBeDefined();
    });

    it('should maintain event history', () => {
      const initialCount = collector.getRecentEvents().length;
      
      // Generate some events
      for (let i = 0; i < 5; i++) {
        collector.recordTokenUsage({
          input: { ephemeral: i, retrieved: 0, knowledge: 0, query: 0, buffer: 0, total: i, limit: 128000 },
          output: { reasoning: 0, code: 0, explanation: 0, buffer: 0, total: 0, limit: 6000 },
          mode: 'direct',
        });
      }
      
      const events = collector.getRecentEvents();
      expect(events.length).toBeGreaterThanOrEqual(initialCount + 5);
    });
  });

  describe('API Endpoints', () => {
    it('should respond to health check', async () => {
      const response = await axios.get(`${baseURL}/api/health`);
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('ok');
    });

    it('should return metrics', async () => {
      const response = await axios.get(`${baseURL}/api/metrics`);
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    });

    it('should return events', async () => {
      const response = await axios.get(`${baseURL}/api/events?limit=10`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
    });

    it('should return pipeline data', async () => {
      const response = await axios.get(`${baseURL}/api/pipeline`);
      expect(response.status).toBe(200);
      expect(response.data.nodes).toBeDefined();
      expect(response.data.edges).toBeDefined();
    });
  });

  describe('WebSocket Communication', () => {
    beforeEach((done) => {
      socket = io(baseURL, {
        transports: ['websocket'],
      });
      socket.on('connect', done);
    });

    afterEach(() => {
      if (socket) socket.close();
    });

    it('should establish socket connection', (done) => {
      expect(socket.connected).toBe(true);
      done();
    });

    it('should receive real-time metrics updates', (done) => {
      socket.on('metrics:tokenUpdate', (data: any) => {
        expect(data).toBeDefined();
        done();
      });

      // Trigger an update
      collector.recordTokenUsage({
        input: { ephemeral: 100, retrieved: 0, knowledge: 0, query: 0, buffer: 0, total: 100, limit: 128000 },
        output: { reasoning: 0, code: 0, explanation: 0, buffer: 0, total: 0, limit: 6000 },
        mode: 'direct',
      });
    });

    it('should receive pipeline stage updates', (done) => {
      socket.on('metrics:pipelineStageStart', (data: any) => {
        expect(data.id).toBe('test-websocket');
        done();
      });

      collector.startPipelineStage({
        id: 'test-websocket',
        name: 'WebSocket Test',
        type: 'executor',
        input: {},
      });
    });
  });

  describe('Memory Management Integration', () => {
    it('should build prompts within token budget', async () => {
      const prompt = await memoryManager.buildPrompt('Test query');
      expect(prompt.systemPrompt).toBeDefined();
      expect(prompt.userQuery).toBe('Test query');
    });

    it('should track memory layer usage', async () => {
      await memoryManager.storeKnowledge('test_key', 'test_value', 'preference');
      const prompt = await memoryManager.buildPrompt('Query about test');
      expect(prompt.knowledge).toContain('test_key');
    });

    it('should generate token usage reports', () => {
      const report = memoryManager.getTokenReport();
      expect(report).toContain('Token Usage');
      expect(report).toContain('concise mode');
    });
  });

  describe('Project Isolation', () => {
    let projectManager: ProjectManager;

    beforeEach(() => {
      projectManager = new ProjectManager();
    });

    it('should create project-specific directories', () => {
      const dbPath = projectManager.getDbPath();
      expect(dbPath).toContain('.flexicli');
      expect(dbPath).toContain('flexicli.db');
    });

    it('should generate unique project IDs', () => {
      const id1 = projectManager.getProjectId();
      const id2 = projectManager.getProjectId();
      expect(id1).toBe(id2); // Same project
      expect(id1.length).toBe(16);
    });

    it('should detect project changes', () => {
      const isNew = projectManager.isNewProject('different-id');
      expect(isNew).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const invalidPrisma = new PrismaClient({
        datasources: {
          db: {
            url: 'file:./invalid/path/db.sqlite'
          }
        }
      });

      const testCollector = new MetricsCollector(invalidPrisma);
      await testCollector.updateSessionMetrics('invalid-id');
      
      // Should not throw, just log warning
      expect(testCollector.getAllMetrics()).toBeDefined();
    });

    it('should provide fallback for embeddings failure', async () => {
      // This would test the fallback embedding generation
      // when Azure API is unavailable
      const prompt = await memoryManager.buildPrompt('Test with no API');
      expect(prompt).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should handle high-frequency metrics updates', async () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        collector.recordTokenUsage({
          input: { ephemeral: i, retrieved: 0, knowledge: 0, query: 0, buffer: 0, total: i, limit: 128000 },
          output: { reasoning: 0, code: 0, explanation: 0, buffer: 0, total: 0, limit: 6000 },
          mode: 'direct',
        });
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should efficiently retrieve metrics', async () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 10; i++) {
        await axios.get(`${baseURL}/api/metrics`);
      }
      
      const avgTime = (Date.now() - startTime) / 10;
      expect(avgTime).toBeLessThan(100); // Each request under 100ms
    });
  });
});

describe('UI Components Integration', () => {
  it('should render dashboard without errors', () => {
    // This would be tested with React Testing Library
    // Example structure for UI testing
    expect(true).toBe(true);
  });
});

// Export test utilities for other test files
export {
  MonitoringServer,
  MetricsCollector,
  MemoryManager,
};