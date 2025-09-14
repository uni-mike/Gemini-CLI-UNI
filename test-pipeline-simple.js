import puppeteer from 'puppeteer';

async function testPipeline() {
  console.log('Testing Pipeline Chart with Puppeteer...\n');

  const browser = await puppeteer.launch({
    headless: 'new', // Use new headless mode
    args: ['--no-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Go to the dashboard
    console.log('1. Opening dashboard...');
    await page.goto('http://localhost:3000', {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });

    // Wait for app to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click on Pipeline tab
    console.log('2. Clicking Pipeline tab...');
    const pipelineClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const pipelineBtn = buttons.find(btn => btn.textContent?.includes('Pipeline'));
      if (pipelineBtn) {
        pipelineBtn.click();
        return true;
      }
      return false;
    });
    console.log(`   Pipeline tab clicked: ${pipelineClicked}`);

    // Wait for chart to render
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Check for React Flow
    console.log('\n3. Checking for React Flow container...');
    const hasReactFlow = await page.evaluate(() => {
      const container = document.querySelector('.react-flow');
      return container !== null;
    });
    console.log(`   React Flow exists: ${hasReactFlow}`);

    // Count nodes
    const nodeCount = await page.evaluate(() => {
      return document.querySelectorAll('.react-flow__node').length;
    });
    console.log(`   Nodes rendered: ${nodeCount}`);

    // Count edges
    const edgeCount = await page.evaluate(() => {
      return document.querySelectorAll('.react-flow__edge').length;
    });
    console.log(`   Edges rendered: ${edgeCount}`);

    // Get node text
    if (nodeCount > 0) {
      const nodeTexts = await page.evaluate(() => {
        const nodes = document.querySelectorAll('.react-flow__node');
        return Array.from(nodes).slice(0, 3).map(n => n.textContent?.substring(0, 30));
      });
      console.log('\n4. First 3 nodes:');
      nodeTexts.forEach((text, i) => console.log(`   ${i+1}. ${text}`));
    }

    // Take screenshot
    await page.screenshot({ path: 'pipeline-test.png', fullPage: true });
    console.log('\n📸 Screenshot saved: pipeline-test.png');

    // Keep browser open for manual inspection
    console.log('\n✅ Test complete! Browser will stay open for 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testPipeline();