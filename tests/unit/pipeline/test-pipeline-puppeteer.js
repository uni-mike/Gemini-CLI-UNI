#!/usr/bin/env node

import puppeteer from 'puppeteer';

async function testPipelineChart() {
  console.log('=== TESTING PIPELINE CHART WITH PUPPETEER ===\n');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Navigate to the dashboard
    console.log('1. Navigating to dashboard...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

    // Wait for the app to load
    await page.waitForSelector('h1', { timeout: 5000 });

    // Get the page title
    const title = await page.$eval('h1', el => el.textContent);
    console.log(`   Dashboard loaded: ${title}`);

    // Check monitoring status
    const statusText = await page.evaluate(() => {
      const statusElements = Array.from(document.querySelectorAll('span'));
      const statusElement = statusElements.find(el =>
        el.textContent.includes('Monitoring Online') ||
        el.textContent.includes('Monitoring Offline')
      );
      return statusElement ? statusElement.textContent : 'Status not found';
    });
    console.log(`   Status: ${statusText}`);

    // Click on Pipeline tab
    console.log('\n2. Clicking on Pipeline tab...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const pipelineButton = buttons.find(btn => btn.textContent.includes('Pipeline'));
      if (pipelineButton) pipelineButton.click();
    });

    // Wait a moment for the tab to switch
    await page.waitForTimeout(1000);

    // Check if React Flow container exists
    console.log('\n3. Checking Pipeline chart container...');
    const hasReactFlow = await page.evaluate(() => {
      return !!document.querySelector('.react-flow');
    });
    console.log(`   React Flow container exists: ${hasReactFlow}`);

    // Count nodes in the pipeline
    console.log('\n4. Counting Pipeline nodes...');
    const nodeCount = await page.evaluate(() => {
      const nodes = document.querySelectorAll('.react-flow__node');
      return nodes.length;
    });
    console.log(`   Nodes found in DOM: ${nodeCount}`);

    // Get node details
    if (nodeCount > 0) {
      console.log('\n5. Node details:');
      const nodeDetails = await page.evaluate(() => {
        const nodes = document.querySelectorAll('.react-flow__node');
        return Array.from(nodes).slice(0, 5).map(node => {
          const textContent = node.textContent || '';
          return textContent.substring(0, 50);
        });
      });
      nodeDetails.forEach((detail, index) => {
        console.log(`   Node ${index + 1}: ${detail}`);
      });
    }

    // Check for edges
    const edgeCount = await page.evaluate(() => {
      const edges = document.querySelectorAll('.react-flow__edge');
      return edges.length;
    });
    console.log(`\n6. Edges found in DOM: ${edgeCount}`);

    // Check for any error messages
    const hasError = await page.evaluate(() => {
      const body = document.body.textContent || '';
      return body.includes('error') || body.includes('Error');
    });

    if (hasError) {
      console.log('\n⚠️ Warning: Error text found on page');
    }

    // Take a screenshot for debugging
    await page.screenshot({ path: 'pipeline-debug.png', fullPage: true });
    console.log('\n📸 Screenshot saved as pipeline-debug.png');

    console.log('\n=== TEST COMPLETE ===');
    console.log(`Summary: ${nodeCount} nodes, ${edgeCount} edges`);

  } catch (error) {
    console.error('Error during test:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testPipelineChart();