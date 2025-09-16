#!/usr/bin/env npx tsx
/**
 * Validate that both critical fixes are working:
 * 1. C-005: Cache database is now being used
 * 2. A-001: No more file-based cache/session/checkpoint directories
 */

import { SharedDatabaseManager } from './src/memory/shared-database.js';
import { CacheManager } from './src/cache/CacheManager.js';
import * as fs from 'fs';
import * as path from 'path';

console.log('🔍 VALIDATING CRITICAL FIXES\n');
console.log('=' .repeat(60));

async function validateFixes() {
  let allPassed = true;

  try {
    // Initialize system
    const sharedDb = SharedDatabaseManager.getInstance();
    await sharedDb.initialize('validate-fixes-' + Date.now());
    const prisma = sharedDb.getPrisma();
    const cacheManager = CacheManager.getInstance();

    // TEST 1: C-005 - Cache database is now being used
    console.log('\n✓ FIX C-005: Cache Database Usage');
    console.log('  Testing that CacheManager now writes to database...');

    // Clear any existing test cache
    await prisma.cache.deleteMany({
      where: { cacheKey: { contains: 'test_embed' } }
    });

    const beforeCount = await prisma.cache.count();
    console.log(`  Before: ${beforeCount} cache entries`);

    // Add embeddings (these should persist to DB immediately)
    cacheManager.set('embed_test_validation_1', [1, 2, 3, 4, 5], { ttl: 60000 });
    cacheManager.set('embed_test_validation_2', [5, 4, 3, 2, 1], { ttl: 60000 });
    cacheManager.set('regular_key', 'not persisted', { ttl: 60000 }); // Won't persist

    // Give immediate persistence time to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const afterCount = await prisma.cache.count();
    console.log(`  After: ${afterCount} cache entries`);

    // Check if validation entries were created
    const validationEntries = await prisma.cache.findMany({
      where: { originalKey: { contains: 'validation' } },
      select: { cacheKey: true, category: true, projectId: true, originalKey: true }
    });

    if (validationEntries.length >= 2) {
      console.log('  ✅ SUCCESS: Cache is writing to database!');
      validationEntries.forEach(e => {
        console.log(`    - ${e.category}: ${e.originalKey.substring(0, 30)}... (project: ${e.projectId?.substring(0, 8)}...)`);
      });
    } else {
      console.log(`  ❌ FAILED: Cache validation entries not found (found ${validationEntries.length}, expected 2)`);
      allPassed = false;
    }

    // Cleanup test cache
    await prisma.cache.deleteMany({
      where: { originalKey: { contains: 'validation' } }
    });

    // TEST 2: A-001 - No more file-based persistence
    console.log('\n✓ FIX A-001: File-Based Storage Removal');
    console.log('  Verifying old directories are removed...');

    const checkDir = (dir: string): boolean => {
      const fullPath = path.join('.flexicli', dir);
      const exists = fs.existsSync(fullPath);
      if (!exists) {
        console.log(`  ✅ Removed: ${dir}/ (no longer exists)`);
        return true;
      } else {
        console.log(`  ❌ Still exists: ${fullPath}`);
        return false;
      }
    };

    const dirsRemoved = ['cache', 'sessions', 'checkpoints'].map(checkDir);
    const allRemoved = dirsRemoved.every(r => r);

    if (allRemoved) {
      console.log('  ✅ SUCCESS: All file-based storage removed!');
    } else {
      console.log('  ❌ FAILED: Some directories still exist');
      allPassed = false;
    }

    // Verify logs directory still exists
    if (fs.existsSync('.flexicli/logs')) {
      console.log('  ✅ Logs directory preserved (correct)');
    }

    // TEST 3: Verify projectId is set
    console.log('\n✓ Additional Check: ProjectId Configuration');
    const projectId = (cacheManager as any).projectId;
    if (projectId) {
      console.log(`  ✅ CacheManager has projectId: ${projectId.substring(0, 8)}...`);
    } else {
      console.log('  ❌ CacheManager missing projectId');
      allPassed = false;
    }

    // Final summary
    console.log('\n' + '=' .repeat(60));
    if (allPassed) {
      console.log('🎉 ALL FIXES VALIDATED SUCCESSFULLY!');
      console.log('  - C-005: Cache database is working ✅');
      console.log('  - A-001: File-based storage removed ✅');
      console.log('  - ProjectId properly configured ✅');
    } else {
      console.log('⚠️ SOME FIXES FAILED VALIDATION');
    }

    sharedDb.disconnect();
    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

validateFixes();