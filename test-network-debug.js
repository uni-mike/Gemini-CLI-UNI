import puppeteer from 'puppeteer';

async function debugNetworkRequests() {
  console.log('=== Network Request Debugging with Puppeteer ===\n');

  const browser = await puppeteer.launch({
    headless: false, // Run with UI to see what's happening
    devtools: true,  // Open DevTools automatically
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Enable request interception to monitor all network activity
    await page.setRequestInterception(true);

    // Track all requests
    const requests = new Map();
    const pendingRequests = new Set();

    // Log all network requests
    page.on('request', (request) => {
      const url = request.url();
      const method = request.method();
      const timestamp = new Date().toISOString();

      // Track API requests specifically
      if (url.includes('/api/')) {
        const requestId = `${method}-${url}-${timestamp}`;
        requests.set(requestId, {
          url,
          method,
          startTime: Date.now(),
          status: 'initiated',
          headers: request.headers()
        });
        pendingRequests.add(requestId);

        console.log(`📤 [${timestamp}] REQUEST INITIATED:`);
        console.log(`   URL: ${url}`);
        console.log(`   Method: ${method}`);
        console.log(`   Headers:`, JSON.stringify(request.headers(), null, 2));
      }

      // Continue all requests
      request.continue();
    });

    // Log all responses
    page.on('response', (response) => {
      const url = response.url();
      const status = response.status();
      const timestamp = new Date().toISOString();

      if (url.includes('/api/')) {
        console.log(`📥 [${timestamp}] RESPONSE RECEIVED:`);
        console.log(`   URL: ${url}`);
        console.log(`   Status: ${status}`);
        console.log(`   Headers:`, JSON.stringify(response.headers(), null, 2));

        // Find and update matching request
        for (const [id, req] of requests.entries()) {
          if (req.url === url) {
            req.status = 'completed';
            req.responseStatus = status;
            req.duration = Date.now() - req.startTime;
            pendingRequests.delete(id);
            console.log(`   Duration: ${req.duration}ms`);
            break;
          }
        }
      }
    });

    // Log request failures
    page.on('requestfailed', (request) => {
      const url = request.url();
      const failure = request.failure();
      const timestamp = new Date().toISOString();

      if (url.includes('/api/')) {
        console.log(`❌ [${timestamp}] REQUEST FAILED:`);
        console.log(`   URL: ${url}`);
        console.log(`   Error: ${failure ? failure.errorText : 'Unknown error'}`);

        // Update request status
        for (const [id, req] of requests.entries()) {
          if (req.url === url) {
            req.status = 'failed';
            req.error = failure?.errorText;
            pendingRequests.delete(id);
            break;
          }
        }
      }
    });

    // Monitor console logs
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error' || text.includes('fetch') || text.includes('Failed')) {
        console.log(`🔴 [CONSOLE ${type.toUpperCase()}]: ${text}`);
      }
    });

    // Monitor page errors
    page.on('pageerror', (error) => {
      console.log(`🔴 [PAGE ERROR]: ${error.message}`);
    });

    console.log('1. Opening dashboard at http://localhost:3000...\n');

    // Navigate with network idle detection
    try {
      await page.goto('http://localhost:3000', {
        waitUntil: 'networkidle0', // Wait until network is idle
        timeout: 30000
      });
      console.log('✅ Page loaded with networkidle0\n');
    } catch (navError) {
      console.log(`⚠️ Navigation timeout or error: ${navError.message}`);
      console.log('Continuing to analyze pending requests...\n');
    }

    // Wait a bit to see if requests complete
    console.log('2. Waiting 5 seconds to observe network behavior...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check for pending requests
    console.log('\n=== PENDING REQUESTS ANALYSIS ===');
    if (pendingRequests.size > 0) {
      console.log(`\n⚠️ Found ${pendingRequests.size} pending requests:`);
      for (const id of pendingRequests) {
        const req = requests.get(id);
        if (req) {
          const duration = Date.now() - req.startTime;
          console.log(`\n   🔄 STILL PENDING after ${duration}ms:`);
          console.log(`      URL: ${req.url}`);
          console.log(`      Method: ${req.method}`);
        }
      }
    } else {
      console.log('✅ No pending requests');
    }

    // Check backend connectivity directly
    console.log('\n\n=== BACKEND CONNECTIVITY TEST ===');
    const backendTest = await page.evaluate(async () => {
      const results = [];

      // Test each endpoint directly from browser
      const endpoints = ['/api/health', '/api/overview', '/api/pipeline', '/api/memory'];

      for (const endpoint of endpoints) {
        const startTime = Date.now();
        try {
          // Use fetch with explicit timeout via AbortController
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);

          const response = await fetch(endpoint, {
            method: 'GET',
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          const duration = Date.now() - startTime;

          let data = null;
          try {
            data = await response.json();
          } catch (e) {
            data = 'Failed to parse JSON';
          }

          results.push({
            endpoint,
            status: response.status,
            ok: response.ok,
            duration,
            dataReceived: data !== null,
            error: null
          });
        } catch (error) {
          const duration = Date.now() - startTime;
          results.push({
            endpoint,
            status: null,
            ok: false,
            duration,
            dataReceived: false,
            error: error.message
          });
        }
      }

      return results;
    });

    console.log('Direct fetch test results from browser:');
    for (const result of backendTest) {
      if (result.ok) {
        console.log(`✅ ${result.endpoint}: ${result.status} in ${result.duration}ms`);
      } else {
        console.log(`❌ ${result.endpoint}: ${result.error || `Status ${result.status}`} after ${result.duration}ms`);
      }
    }

    // Check if backend server is actually running
    console.log('\n\n=== CHECKING BACKEND SERVER ===');
    const backendCheck = await page.evaluate(async () => {
      try {
        const response = await fetch('http://localhost:4000/api/health');
        return { running: true, status: response.status };
      } catch (e) {
        return { running: false, error: e.message };
      }
    });

    if (backendCheck.running) {
      console.log(`✅ Backend server is running (status: ${backendCheck.status})`);
    } else {
      console.log(`❌ Backend server not responding: ${backendCheck.error}`);
      console.log('   Make sure backend is running on port 4000');
    }

    // Check Vite proxy configuration
    console.log('\n\n=== VITE PROXY ANALYSIS ===');
    const proxyTest = await page.evaluate(async () => {
      // Check if requests are being proxied correctly
      const testUrl = '/api/overview';
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      }).catch(e => ({ error: e.message }));

      if (response.error) {
        return { proxied: false, error: response.error };
      }

      return {
        proxied: true,
        url: response.url,
        status: response.status,
        type: response.type
      };
    });

    console.log('Proxy test result:', proxyTest);

    // Get network timing information
    console.log('\n\n=== NETWORK TIMING ANALYSIS ===');
    const timingInfo = await page.evaluate(() => {
      const perf = performance.getEntriesByType('resource');
      const apiCalls = perf.filter(entry => entry.name.includes('/api/'));

      return apiCalls.map(entry => ({
        name: entry.name,
        duration: Math.round(entry.duration),
        transferSize: entry.transferSize,
        responseEnd: Math.round(entry.responseEnd),
        fetchStart: Math.round(entry.fetchStart),
        responseStart: Math.round(entry.responseStart),
        requestStart: Math.round(entry.requestStart),
        connectEnd: Math.round(entry.connectEnd),
        connectStart: Math.round(entry.connectStart)
      }));
    });

    if (timingInfo.length > 0) {
      console.log('Performance timing for API calls:');
      timingInfo.forEach(timing => {
        console.log(`\n   ${timing.name}:`);
        console.log(`      Total duration: ${timing.duration}ms`);
        console.log(`      Connect time: ${timing.connectEnd - timing.connectStart}ms`);
        console.log(`      Request to response: ${timing.responseStart - timing.requestStart}ms`);
        console.log(`      Transfer size: ${timing.transferSize} bytes`);
      });
    } else {
      console.log('No API call timing information found');
    }

    // Keep browser open for manual inspection
    console.log('\n\n=== SUMMARY ===');
    console.log(`Total requests tracked: ${requests.size}`);
    console.log(`Pending requests: ${pendingRequests.size}`);
    console.log('\nBrowser will stay open for manual inspection...');
    console.log('Check the Network tab in DevTools for more details');
    console.log('Press Ctrl+C to exit');

    // Keep alive
    await new Promise(() => {});

  } catch (error) {
    console.error('Test error:', error);
  }
}

debugNetworkRequests();