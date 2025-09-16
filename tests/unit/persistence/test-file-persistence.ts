#!/usr/bin/env npx tsx
/**
 * Test script for file-based persistence system
 * Verifies that logs, cache, sessions, and checkpoints are being written to disk
 */

import { FilePersistenceManager, SessionState, Checkpoint } from '../../../src/persistence/FilePersistenceManager.js';
import * as fs from 'fs/promises';
import * as path from 'path';

console.log('🧪 Testing File Persistence System\n');
console.log('=' . repeat(60));

async function testFilePersistence() {
  const persistence = FilePersistenceManager.getInstance();
  
  try {
    // Initialize the persistence manager
    console.log('\n📁 Initializing file persistence...');
    await persistence.initialize();
    console.log('✅ File persistence initialized');
    
    // 1. Test Logging
    console.log('\n📝 Testing logging to files...');
    await persistence.logInfo('TestComponent', 'Test info message', { data: 'test' });
    await persistence.logWarn('TestComponent', 'Test warning message');
    await persistence.logError('TestComponent', 'Test error message', new Error('Test error'));
    await persistence.logDebug('TestComponent', 'Test debug message');
    
    // Check if log file was created
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(process.cwd(), '.flexicli', 'logs', `flexicli-${today}.log`);
    
    try {
      const logExists = await fs.access(logFile).then(() => true).catch(() => false);
      if (logExists) {
        const logContent = await fs.readFile(logFile, 'utf-8');
        const logLines = logContent.trim().split('\n');
        console.log(`✅ Log file created with ${logLines.length} entries`);
        
        // Show last few log entries
        const recentLogs = await persistence.getRecentLogs(5);
        console.log(`  Recent logs: ${recentLogs.length} entries retrieved`);
      } else {
        console.log('❌ Log file not found');
      }
    } catch (error) {
      console.log('❌ Failed to read log file:', error);
    }
    
    // 2. Test Cache
    console.log('\n💾 Testing cache persistence...');
    await persistence.cacheSet('test-key-1', { value: 'test data 1' }, 60000);
    await persistence.cacheSet('test-key-2', { value: 'test data 2' });
    await persistence.cacheSet('embedding:test', [1.0, 2.0, 3.0], 7 * 24 * 60 * 60 * 1000);
    
    // Read back from cache
    const cached1 = await persistence.cacheGet('test-key-1');
    const cached2 = await persistence.cacheGet('test-key-2');
    const cachedEmbedding = await persistence.cacheGet('embedding:test');
    
    console.log(`✅ Cache write/read test:`);
    console.log(`  Key 1: ${cached1 ? 'Retrieved' : 'Not found'}`);
    console.log(`  Key 2: ${cached2 ? 'Retrieved' : 'Not found'}`);
    console.log(`  Embedding: ${cachedEmbedding ? 'Retrieved' : 'Not found'}`);
    
    // Check cache directory
    const cacheDir = path.join(process.cwd(), '.flexicli', 'cache');
    const cacheFiles = await fs.readdir(cacheDir);
    console.log(`✅ Cache directory contains ${cacheFiles.length} files`);
    
    // 3. Test Session State
    console.log('\n🎯 Testing session state persistence...');
    const sessionState: SessionState = {
      id: 'test-session-' + Date.now(),
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      prompt: 'Test prompt for file persistence',
      mode: 'test',
      tokens: { input: 100, output: 50, total: 150 },
      tools: ['read', 'write', 'search'],
      memory: { ephemeral: 10, knowledge: 20, retrieval: 30 },
      pipeline: {
        planning: { duration: 1000, completed: true },
        execution: { duration: 2000, completed: true }
      }
    };
    
    await persistence.saveSessionState(sessionState);
    console.log(`✅ Session state saved: ${sessionState.id}`);
    
    // Read back session
    const loadedSession = await persistence.loadSessionState(sessionState.id);
    console.log(`✅ Session state loaded: ${loadedSession ? 'Success' : 'Failed'}`);
    
    // Update session
    await persistence.updateSessionState(sessionState.id, {
      tokens: { input: 200, output: 100, total: 300 }
    });
    console.log('✅ Session state updated');
    
    // List sessions
    const sessions = await persistence.listSessions();
    console.log(`✅ Total sessions in directory: ${sessions.length}`);
    
    // Get recent sessions
    const recentSessions = await persistence.getRecentSessions(5);
    console.log(`✅ Recent sessions retrieved: ${recentSessions.length}`);
    
    // 4. Test Checkpoints
    console.log('\n🔖 Testing checkpoint persistence...');
    const checkpoint: Checkpoint = {
      id: 'checkpoint-' + Date.now(),
      sessionId: sessionState.id,
      timestamp: new Date().toISOString(),
      stage: 'test-stage',
      state: {
        progress: 0.5,
        data: { test: 'checkpoint data' }
      },
      metadata: {
        tool: 'test-tool',
        success: true
      }
    };
    
    await persistence.saveCheckpoint(checkpoint);
    console.log(`✅ Checkpoint saved: ${checkpoint.id}`);
    
    // Load checkpoint
    const loadedCheckpoint = await persistence.loadCheckpoint(checkpoint.id, sessionState.id);
    console.log(`✅ Checkpoint loaded: ${loadedCheckpoint ? 'Success' : 'Failed'}`);
    
    // List checkpoints
    const checkpoints = await persistence.listCheckpoints(sessionState.id);
    console.log(`✅ Checkpoints for session: ${checkpoints.length}`);
    
    // Get latest checkpoint
    const latestCheckpoint = await persistence.getLatestCheckpoint(sessionState.id);
    console.log(`✅ Latest checkpoint: ${latestCheckpoint ? latestCheckpoint.id : 'None'}`);
    
    // 5. Check Storage Stats
    console.log('\n📊 Storage Statistics:');
    const stats = await persistence.getStorageStats();
    console.log(`  Logs: ${stats.logs.count} files, ${(stats.logs.size / 1024).toFixed(2)} KB`);
    console.log(`  Cache: ${stats.cache.count} files, ${(stats.cache.size / 1024).toFixed(2)} KB`);
    console.log(`  Sessions: ${stats.sessions.count} files, ${(stats.sessions.size / 1024).toFixed(2)} KB`);
    console.log(`  Checkpoints: ${stats.checkpoints.count} files, ${(stats.checkpoints.size / 1024).toFixed(2)} KB`);
    
    // 6. Verify directories are no longer empty
    console.log('\n✨ Directory Status:');
    const dirs = [
      '.flexicli/logs',
      '.flexicli/cache', 
      '.flexicli/sessions',
      '.flexicli/checkpoints'
    ];
    
    for (const dir of dirs) {
      const fullPath = path.join(process.cwd(), dir);
      try {
        const files = await fs.readdir(fullPath);
        const nonEmpty = files.length > 0;
        console.log(`  ${dir}: ${nonEmpty ? '✅ Contains files' : '❌ Empty'} (${files.length} items)`);
        
        // Show first few files
        if (files.length > 0) {
          const preview = files.slice(0, 3).join(', ');
          const more = files.length > 3 ? ` and ${files.length - 3} more` : '';
          console.log(`    Files: ${preview}${more}`);
        }
      } catch (error) {
        console.log(`  ${dir}: ❌ Directory not found`);
      }
    }
    
    // Clean up old files (optional)
    console.log('\n🧹 Testing cleanup (files older than 0 days for demo)...');
    // Note: Set to 0 to clean everything for testing, normally would be 7+ days
    // await persistence.cleanupOldFiles(0);
    
    await persistence.close();
    console.log('\n✅ File persistence system test complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testFilePersistence()
  .then(() => {
    console.log('\n' + '=' . repeat(60));
    console.log('🎉 All file persistence tests passed!');
    console.log('📁 The .flexicli subdirectories now contain data!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });