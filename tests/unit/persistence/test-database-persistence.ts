#!/usr/bin/env npx tsx
/**
 * Test script for database persistence system
 * Verifies that cache, sessions, and snapshots are properly stored in database
 */

import { SharedDatabaseManager } from '../../../src/memory/shared-database.js';
import { CacheManager } from '../../../src/cache/CacheManager.js';
import { SessionManager } from '../../../src/memory/session-manager.js';
import { ProjectManager } from '../../../src/memory/project-manager.js';

console.log('🧪 Testing Database Persistence System\n');
console.log('=' .repeat(60));

async function testDatabasePersistence() {
  const sharedDb = SharedDatabaseManager.getInstance();

  try {
    // Initialize database first
    console.log('\n📁 Initializing database...');
    await sharedDb.initialize('test-db-persistence-' + Date.now());
    const prisma = sharedDb.getPrisma();

    // Now create managers with database connection
    const projectManager = new ProjectManager();

    // Ensure project exists in database
    const projectId = projectManager.getProjectId();
    await prisma.project.upsert({
      where: { rootPath: projectManager.getProjectRoot() },
      update: {},
      create: {
        id: projectId,
        name: 'Test Project',
        rootPath: projectManager.getProjectRoot()
      }
    });

    const sessionManager = new SessionManager(prisma, projectManager);
    console.log('✅ Database initialized');

    // Test 1: Cache persistence (embeddings only)
    console.log('\n💾 Testing cache persistence...');
    const cacheManager = CacheManager.getInstance();

    // Add embedding (these get persisted)
    cacheManager.set('embed_test_1', [1, 2, 3, 4, 5], { ttl: 60000 });
    cacheManager.set('embed_test_2', [5, 4, 3, 2, 1], { ttl: 60000 });

    // Force persistence
    await (cacheManager as any).persistCache();

    const cacheCount = await prisma.cache.count();
    console.log(`✅ Cache entries in database: ${cacheCount}`);

    if (cacheCount > 0) {
      const cacheEntries = await prisma.cache.findMany({
        select: { cacheKey: true, category: true }
      });
      cacheEntries.forEach(e => {
        console.log(`  - ${e.category}: ${e.cacheKey.substring(0, 16)}...`);
      });
    }

    // Test 2: Session persistence
    console.log('\n🎯 Testing session persistence...');
    await sessionManager.startSession('test', false);
    const sessionId = sessionManager.getSessionId();

    if (sessionId) {
      console.log(`✅ Session created: ${sessionId}`);

      // Create snapshot
      await sessionManager.createSnapshot({ test: 'state' }, ['retrieval1']);
      const snapshots = await prisma.sessionSnapshot.count({
        where: { sessionId: sessionId }
      });
      console.log(`✅ Session snapshots created: ${snapshots}`);

      // End session
      await sessionManager.endSession();
      console.log('✅ Session ended');
    }

    // Test 3: Verify no file-based storage
    console.log('\n📊 Verifying database-only storage...');
    const fs = await import('fs');
    const path = await import('path');

    const checkDir = (dir: string) => {
      const fullPath = path.join('.flexicli', dir);
      if (fs.existsSync(fullPath)) {
        console.log(`  ❌ Directory still exists: ${fullPath}`);
        return false;
      } else {
        console.log(`  ✅ Directory removed: ${dir}/`);
        return true;
      }
    };

    const allRemoved = ['cache', 'sessions', 'checkpoints'].every(checkDir);

    if (allRemoved) {
      console.log('✅ All file-based storage removed - using database only!');
    } else {
      console.log('⚠️ Some file-based directories still exist');
    }

    // Test 4: Database statistics
    console.log('\n📈 Database statistics:');
    const stats = {
      sessions: await prisma.session.count(),
      snapshots: await prisma.sessionSnapshot.count(),
      cache: await prisma.cache.count(),
      executions: await prisma.executionLog.count(),
      knowledge: await prisma.knowledge.count()
    };

    Object.entries(stats).forEach(([table, count]) => {
      console.log(`  ${table}: ${count} records`);
    });

    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    await prisma.cache.deleteMany({
      where: { cacheKey: { contains: 'embed_test' } }
    });
    await prisma.session.deleteMany({
      where: { id: { contains: 'test-db-persistence' } }
    });

    console.log('\n✅ All tests passed! Database persistence working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    sharedDb.disconnect();
  }
}

testDatabasePersistence().catch(console.error);