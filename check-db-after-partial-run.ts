#!/usr/bin/env npx tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
console.log('🔍 Checking database after partial agent run...\n');

const counts = {
  project: await prisma.project.count(),
  session: await prisma.session.count(),
  cache: await prisma.cache.count(),
  executionLog: await prisma.executionLog.count(),
  gitCommit: await prisma.gitCommit.count()
};

console.log('📊 Table counts after partial run:');
Object.entries(counts).forEach(([table, count]) => {
  const icon = count > 0 ? '✅' : '⚪';
  console.log(`  ${icon} ${table}: ${count} records`);
});

if (counts.cache > 0) {
  const cacheEntries = await prisma.cache.findMany({
    select: { originalKey: true, category: true, accessCount: true, createdAt: true },
    orderBy: { createdAt: 'desc' }
  });
  console.log(`\n💾 Cache entries (${cacheEntries.length}):`);
  cacheEntries.forEach((entry, i) => {
    const time = new Date(entry.createdAt).toLocaleTimeString();
    console.log(`  ${i+1}. ${entry.originalKey.substring(0, 25)}... (${entry.category}, ${entry.accessCount}x, ${time})`);
  });
}

await prisma.$disconnect();
