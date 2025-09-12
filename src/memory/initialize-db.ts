#!/usr/bin/env npx tsx
/**
 * Initialize FlexiCLI Database
 * Ensures proper database structure and initial project record
 */

import { PrismaClient } from '@prisma/client';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as crypto from 'crypto';

async function initializeDatabase() {
  const projectRoot = process.cwd();
  const flexicliDir = join(projectRoot, '.flexicli');
  const dbPath = join(flexicliDir, 'flexicli.db');
  
  // Ensure .flexicli directory exists
  if (!existsSync(flexicliDir)) {
    mkdirSync(flexicliDir, { recursive: true });
    console.log('✅ Created .flexicli directory');
  }
  
  // Initialize Prisma
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: `file:${dbPath}`
      }
    }
  });
  
  try {
    // Generate project ID based on path
    const projectId = crypto
      .createHash('sha256')
      .update(projectRoot)
      .digest('hex')
      .substring(0, 16);
    
    const projectName = projectRoot.split('/').pop() || 'flexicli-project';
    
    console.log('🔧 Initializing database for project:', projectName);
    console.log('📁 Project root:', projectRoot);
    console.log('🔑 Project ID:', projectId);
    
    // Ensure schema version
    const schemaVersion = await prisma.schemaVersion.findFirst({
      orderBy: { appliedAt: 'desc' }
    });
    
    if (!schemaVersion) {
      await prisma.schemaVersion.create({
        data: { version: 1 }
      });
      console.log('✅ Created schema version record');
    }
    
    // Create or update project record
    const project = await prisma.project.upsert({
      where: { id: projectId },
      create: {
        id: projectId,
        rootPath: projectRoot,
        name: projectName
      },
      update: {
        rootPath: projectRoot,
        name: projectName,
        updatedAt: new Date()
      }
    });
    
    console.log('✅ Project record:', {
      id: project.id,
      name: project.name,
      rootPath: project.rootPath
    });
    
    // Clean up orphaned sessions
    const orphanedSessions = await prisma.session.findMany({
      where: {
        projectId: {
          not: projectId
        }
      }
    });
    
    if (orphanedSessions.length > 0) {
      console.log(`🧹 Found ${orphanedSessions.length} orphaned sessions`);
      
      // Delete snapshots first
      for (const session of orphanedSessions) {
        await prisma.sessionSnapshot.deleteMany({
          where: { sessionId: session.id }
        });
      }
      
      // Delete sessions
      await prisma.session.deleteMany({
        where: {
          id: { in: orphanedSessions.map(s => s.id) }
        }
      });
      
      console.log('✅ Cleaned orphaned sessions');
    }
    
    // Mark any active sessions as crashed for recovery
    const activeSessions = await prisma.session.updateMany({
      where: {
        projectId,
        status: 'active'
      },
      data: {
        status: 'crashed'
      }
    });
    
    if (activeSessions.count > 0) {
      console.log(`⚠️  Marked ${activeSessions.count} active sessions as crashed for recovery`);
    }
    
    // Create subdirectories
    const subdirs = ['cache', 'sessions', 'logs', 'checkpoints'];
    for (const dir of subdirs) {
      const path = join(flexicliDir, dir);
      if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
        console.log(`✅ Created ${dir} directory`);
      }
    }
    
    // Test database operations
    const chunkCount = await prisma.chunk.count();
    const commitCount = await prisma.gitCommit.count();
    const knowledgeCount = await prisma.knowledge.count();
    
    console.log('\n📊 Database Statistics:');
    console.log(`  - Chunks: ${chunkCount}`);
    console.log(`  - Git Commits: ${commitCount}`);
    console.log(`  - Knowledge Entries: ${knowledgeCount}`);
    
    console.log('\n✅ Database initialized successfully!');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase();
}

export { initializeDatabase };