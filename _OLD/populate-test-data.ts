#!/usr/bin/env tsx
/**
 * Populate database with test data to demonstrate REAL monitoring
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

async function populateTestData() {
  const prisma = new PrismaClient();

  try {
    console.log('🚀 Populating database with REAL test data...\n');

    // Create a project
    const project = await prisma.project.upsert({
      where: { rootPath: process.cwd() },
      update: {},
      create: {
        id: randomUUID(),
        rootPath: process.cwd(),
        name: 'UNIPATH FlexiCLI Project'
      }
    });
    console.log('✅ Created project:', project.name);

    // Create a session
    const session = await prisma.session.create({
      data: {
        id: randomUUID(),
        projectId: project.id,
        mode: 'CONCISE',
        turnCount: 5,
        tokensUsed: 15000,
        status: 'active'
      }
    });
    console.log('✅ Created session:', session.id);

    // Create chunks (simulating code analysis)
    const chunkTypes = ['CODE', 'DOCUMENTATION', 'TEST', 'CONFIG'];
    const files = [
      'src/index.ts',
      'src/memory/memory-manager.ts',
      'src/tools/bash-tool.ts',
      'src/monitoring/backend/server.ts',
      'README.md',
      'package.json'
    ];

    for (const file of files) {
      const chunk = await prisma.chunk.create({
        data: {
          id: randomUUID(),
          projectId: project.id,
          path: file,
          content: `// Sample content for ${file}\nexport function example() { return "real data"; }`,
          chunkType: chunkTypes[Math.floor(Math.random() * chunkTypes.length)],
          language: file.endsWith('.ts') ? 'typescript' : 'markdown',
          tokenCount: Math.floor(Math.random() * 500) + 100,
          embedding: Buffer.from(new Float32Array(1536).fill(0.1))
        }
      });
      console.log(`✅ Created chunk: ${file}`);
    }

    // Create git commits
    const commits = [
      { hash: 'abc123', message: 'feat: Add memory management system', author: 'Mike Admon' },
      { hash: 'def456', message: 'fix: Token budget overflow protection', author: 'Mike Admon' },
      { hash: 'ghi789', message: 'feat: Implement monitoring dashboard', author: 'Mike Admon' },
      { hash: 'jkl012', message: 'refactor: Clean up monitoring structure', author: 'Mike Admon' }
    ];

    for (const commit of commits) {
      await prisma.gitCommit.create({
        data: {
          id: randomUUID(),
          projectId: project.id,
          hash: commit.hash,
          message: commit.message,
          author: commit.author,
          date: new Date(Date.now() - Math.random() * 86400000), // Random time in last 24h
          filesChanged: JSON.stringify(['src/file1.ts', 'src/file2.ts']),
          diffChunks: JSON.stringify([{file: 'src/file1.ts', changes: '+added line\n-removed line'}])
        }
      });
      console.log(`✅ Created commit: ${commit.message}`);
    }

    // Create knowledge entries
    const knowledgeItems = [
      { key: 'project-structure', value: 'TypeScript monorepo with Prisma ORM', importance: 0.9 },
      { key: 'llm-model', value: 'DeepSeek-R1-0528 with 128K context', importance: 1.0 },
      { key: 'monitoring-stack', value: 'Express + Socket.io + Chart.js', importance: 0.8 },
      { key: 'memory-layers', value: '4 layers: ephemeral, semantic, episodic, persistent', importance: 0.95 }
    ];

    for (const item of knowledgeItems) {
      await prisma.knowledge.create({
        data: {
          id: randomUUID(),
          projectId: project.id,
          key: item.key,
          value: item.value,
          category: 'system',
          importance: item.importance,
          embedding: Buffer.from(new Float32Array(1536).fill(0.1))
        }
      });
      console.log(`✅ Created knowledge: ${item.key}`);
    }

    // Create execution logs
    const logTypes = ['TOOL_EXECUTION', 'API_CALL', 'MEMORY_UPDATE', 'ERROR'];
    const tools = ['bash', 'read', 'write', 'search', 'webfetch'];

    for (let i = 0; i < 20; i++) {
      await prisma.executionLog.create({
        data: {
          id: randomUUID(),
          projectId: project.id,
          sessionId: session.id,
          type: logTypes[Math.floor(Math.random() * logTypes.length)],
          tool: tools[Math.floor(Math.random() * tools.length)],
          input: JSON.stringify({ command: 'test command', args: ['arg1', 'arg2'] }),
          output: JSON.stringify({ result: 'success', data: 'sample output' }),
          success: Math.random() > 0.1, // 90% success rate
          duration: Math.floor(Math.random() * 5000), // 0-5 seconds
          errorMessage: Math.random() > 0.9 ? 'Random test error' : null
        }
      });
    }
    console.log('✅ Created 20 execution logs');

    // Create session snapshots
    for (let i = 1; i <= 3; i++) {
      await prisma.sessionSnapshot.create({
        data: {
          id: randomUUID(),
          sessionId: session.id,
          sequenceNumber: i,
          ephemeralState: JSON.stringify({
            turns: [`User: Query ${i}`, `Assistant: Response ${i}`],
            workingDiff: `Changes from turn ${i}`
          }),
          retrievalIds: JSON.stringify([randomUUID(), randomUUID()]),
          mode: 'CONCISE',
          tokenBudget: JSON.stringify({
            used: i * 1000,
            remaining: 128000 - (i * 1000)
          }),
          lastCommand: `test command ${i}`
        }
      });
      console.log(`✅ Created snapshot #${i}`);
    }

    console.log('\n🎉 Database populated with REAL test data!');
    console.log('📊 Open http://localhost:4000 to see the real data in monitoring dashboard');

  } catch (error) {
    console.error('❌ Error populating data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

populateTestData();