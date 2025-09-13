#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');

async function testMonitoringUI() {
  console.log("=== TESTING MONITORING UI WITH PUPPETEER ===\n");

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate to monitoring UI
    console.log("1. Loading monitoring UI...");
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(2000); // Wait for React to render

    // Take screenshot of initial view
    await page.screenshot({ path: 'monitoring-overview.png', fullPage: true });
    console.log("   ✓ Screenshot saved: monitoring-overview.png");

    // Check Overview tab content
    console.log("\n2. Checking OVERVIEW TAB:");
    const tokenUsage = await page.$eval('[class*="Token"] + * .text-2xl', el => el.textContent).catch(() => '0');
    const activeTasks = await page.$eval('[class*="Active"] + * .text-2xl', el => el.textContent).catch(() => '0');
    console.log(`   Token Usage: ${tokenUsage}`);
    console.log(`   Active Tasks: ${activeTasks}`);

    // Check server status
    const serverStatus = await page.$eval('[class*="Status"]', el => el.textContent).catch(() => 'Not found');
    console.log(`   Server Status: ${serverStatus}`);

    // Click Tools tab
    console.log("\n3. Checking TOOLS TAB:");
    const toolsTab = await page.$('button:has-text("Tools")').catch(() => null) ||
                     await page.$('[class*="Tools"]').catch(() => null) ||
                     await page.$$eval('button', buttons => buttons.find(b => b.textContent.includes('Tools')));

    if (toolsTab) {
      await toolsTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'monitoring-tools.png', fullPage: true });
      console.log("   ✓ Screenshot saved: monitoring-tools.png");

      // Count tools with executions
      const toolCards = await page.$$('[class*="rounded-lg"][class*="p-3"]');
      console.log(`   Tools displayed: ${toolCards.length}`);
    }

    // Click Memory tab
    console.log("\n4. Checking MEMORY TAB:");
    const memoryTab = await page.$$eval('button', buttons => {
      const btn = buttons.find(b => b.textContent.includes('Memory'));
      if (btn) btn.click();
      return !!btn;
    });

    if (memoryTab) {
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'monitoring-memory.png', fullPage: true });
      console.log("   ✓ Screenshot saved: monitoring-memory.png");

      // Check for memory chunks
      const memoryContent = await page.$eval('body', el => el.textContent);
      const hasChunks = memoryContent.includes('chunks') || memoryContent.includes('Code Index');
      console.log(`   Memory data visible: ${hasChunks ? 'YES' : 'NO'}`);
    }

    // Click Sessions tab
    console.log("\n5. Checking SESSIONS TAB:");
    const sessionsTab = await page.$$eval('button', buttons => {
      const btn = buttons.find(b => b.textContent.includes('Sessions'));
      if (btn) btn.click();
      return !!btn;
    });

    if (sessionsTab) {
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'monitoring-sessions.png', fullPage: true });
      console.log("   ✓ Screenshot saved: monitoring-sessions.png");

      // Check session IDs
      const sessionRows = await page.$$('tr');
      console.log(`   Sessions displayed: ${sessionRows.length - 1}`); // Minus header row

      // Check if IDs are properly displayed
      const firstSessionId = await page.$eval('td.font-mono', el => el.textContent).catch(() => 'No sessions');
      console.log(`   First session ID: ${firstSessionId}`);
      const idProblem = firstSessionId === 'session-' || firstSessionId.length < 10;
      if (idProblem) {
        console.log(`   ⚠️  WARNING: Session IDs are truncated!`);
      }
    }

    // Check for "No agents connected" message
    const pageContent = await page.$eval('body', el => el.textContent);
    if (pageContent.includes('No agents connected')) {
      console.log("\n⚠️  WARNING: UI shows 'No agents connected'");
    }
    if (pageContent.includes('Monitoring Offline')) {
      console.log("⚠️  WARNING: UI shows 'Monitoring Offline'");
    }

    console.log("\n=== TEST COMPLETE ===");
    console.log("Check the screenshot files to see actual UI state");

  } catch (error) {
    console.error("Error during testing:", error.message);
    await page.screenshot({ path: 'monitoring-error.png', fullPage: true });
    console.log("Error screenshot saved: monitoring-error.png");
  } finally {
    await browser.close();
  }
}

testMonitoringUI();