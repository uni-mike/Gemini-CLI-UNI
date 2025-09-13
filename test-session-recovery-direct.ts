#!/usr/bin/env npx tsx
/**
 * Direct test of session recovery hang issue
 * Focuses specifically on the git history parsing problem
 */

import { execSync } from 'child_process';
import { performance } from 'perf_hooks';

console.log('🚀 Testing Git History Parsing Performance\n');
console.log('=' .repeat(60));

async function testGitHistoryParsing() {
  try {
    // Test 1: Git log with different sizes
    console.log('\n📊 Testing Git Log Performance:');
    console.log('  Repository has', execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim(), 'total commits\n');
    
    const tests = [
      { commits: 5, patches: false },
      { commits: 10, patches: false },
      { commits: 20, patches: false },
      { commits: 50, patches: false },
      { commits: 100, patches: false },
      { commits: 5, patches: true },
      { commits: 10, patches: true },
      { commits: 20, patches: true },
      { commits: 50, patches: true },
      { commits: 100, patches: true },
      { commits: 200, patches: true }
    ];
    
    const results = [];
    
    for (const test of tests) {
      const desc = `${test.commits} commits ${test.patches ? 'WITH patches' : 'without patches'}`;
      process.stdout.write(`  Testing ${desc}... `);
      
      const cmd = test.patches 
        ? `git log --patch --no-color --stat -n ${test.commits} --format='%H|%an|%aI|%s'`
        : `git log --oneline -n ${test.commits}`;
      
      const startTime = performance.now();
      
      try {
        const result = execSync(cmd, {
          encoding: 'utf8',
          timeout: 5000,
          maxBuffer: 50 * 1024 * 1024
        });
        
        const duration = performance.now() - startTime;
        const sizeKB = Math.round(result.length / 1024);
        
        console.log(`✅ ${Math.round(duration)}ms (${sizeKB}KB)`);
        results.push({
          ...test,
          success: true,
          duration,
          sizeKB
        });
      } catch (error: any) {
        const duration = performance.now() - startTime;
        console.log(`❌ Failed after ${Math.round(duration)}ms`);
        
        if (error.code === 'ETIMEDOUT') {
          console.log(`    ⚠️ TIMEOUT - This is likely causing the hang!`);
        } else {
          console.log(`    Error: ${error.message}`);
        }
        
        results.push({
          ...test,
          success: false,
          duration,
          error: error.message
        });
      }
    }
    
    // Analysis
    console.log('\n📈 Performance Analysis:');
    
    const successfulPatchTests = results.filter(r => r.success && r.patches);
    if (successfulPatchTests.length > 0) {
      const slowest = successfulPatchTests.reduce((max, r) => r.duration > max.duration ? r : max);
      console.log(`  Slowest successful: ${slowest.commits} commits with patches - ${Math.round(slowest.duration)}ms`);
    }
    
    const failedTests = results.filter(r => !r.success);
    if (failedTests.length > 0) {
      console.log('\n  ⚠️ Failed configurations:');
      failedTests.forEach(t => {
        console.log(`    - ${t.commits} commits ${t.patches ? 'with patches' : 'without patches'}`);
      });
    }
    
    // Test 2: Async git parsing with proper error handling
    console.log('\n🔧 Testing Async Git Parsing (proposed fix):');
    
    const parseGitHistoryAsync = (maxCommits: number): Promise<string> => {
      return new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        
        // Use a smaller buffer and timeout
        exec(
          `git log --patch --no-color --stat -n ${maxCommits} --format='%H|%an|%aI|%s'`,
          {
            encoding: 'utf8',
            timeout: 3000, // 3 second timeout
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer
          },
          (error: any, stdout: string, stderr: string) => {
            if (error) {
              if (error.code === 'ETIMEDOUT') {
                console.warn('Git history parsing timed out, using limited history');
                // Fall back to simpler command
                exec(
                  `git log --oneline -n 20`,
                  { encoding: 'utf8', timeout: 1000 },
                  (err2: any, stdout2: string) => {
                    if (err2) {
                      reject(err2);
                    } else {
                      resolve(stdout2);
                    }
                  }
                );
              } else {
                reject(error);
              }
            } else {
              resolve(stdout);
            }
          }
        );
      });
    };
    
    // Test async approach
    const asyncStartTime = performance.now();
    try {
      console.log('  Testing async parsing with 50 commits...');
      const result = await parseGitHistoryAsync(50);
      const asyncDuration = performance.now() - asyncStartTime;
      console.log(`  ✅ Async parsing succeeded in ${Math.round(asyncDuration)}ms`);
      console.log(`  Result size: ${Math.round(result.length / 1024)}KB`);
    } catch (error: any) {
      const asyncDuration = performance.now() - asyncStartTime;
      console.log(`  ❌ Async parsing failed after ${Math.round(asyncDuration)}ms:`, error.message);
    }
    
    // Recommendations
    console.log('\n' + '=' .repeat(60));
    console.log('💡 RECOMMENDATIONS TO FIX SESSION RECOVERY HANG:\n');
    
    console.log('1. IMMEDIATE FIX - Reduce git history parsing:');
    console.log('   Change maxCommits from 200 to 20-50 in git-context.ts');
    console.log('');
    
    console.log('2. BETTER FIX - Make git parsing async with timeout:');
    console.log('   Use exec() instead of execSync() with proper timeout handling');
    console.log('');
    
    console.log('3. BEST FIX - Defer git parsing:');
    console.log('   Parse git history AFTER session recovery, not during');
    console.log('   Use .catch() to handle errors without blocking');
    console.log('');
    
    console.log('4. OPTIMIZATION - Cache parsed git history:');
    console.log('   Store parsed commits in database to avoid re-parsing');
    console.log('   Only parse new commits since last cache update');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testGitHistoryParsing()
  .then(() => {
    console.log('\n✨ Git history parsing test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });