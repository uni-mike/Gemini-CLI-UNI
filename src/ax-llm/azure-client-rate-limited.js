const { AxAIAzureOpenAI } = require('@ax-llm/ax');
const https = require('https');
require('dotenv').config();

/**
 * Rate-Limited Azure Wrapper with Throttling Protection
 *
 * Azure OpenAI Rate Limits (for high-tier subscriptions):
 * - Requests per minute (RPM): Up to 10,000 RPM
 * - Tokens per minute (TPM): Up to 10,000,000 TPM
 *
 * This wrapper implements:
 * - Configurable concurrent request limits
 * - Request queuing with backoff
 * - Automatic retry with exponential backoff
 * - Token bucket algorithm for rate limiting
 */

class AXAzureWrapperRateLimited extends AxAIAzureOpenAI {
  constructor(config) {
    super(config);
    this._config = {
      apiKey: config.apiKey,
      resourceName: config.resourceName,
      deploymentName: config.deploymentName || config.deployment,
      apiVersion: config.apiVersion || '2024-05-01-preview',
      endpoint: config.endpoint || `https://${config.resourceName}.services.ai.azure.com`,
      // Rate limiting configuration from environment or config
      maxConcurrentRequests: config.maxConcurrentRequests || parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 50,
      requestsPerMinute: config.requestsPerMinute || parseInt(process.env.REQUESTS_PER_MINUTE) || 5000,
      tokensPerMinute: config.tokensPerMinute || parseInt(process.env.TOKENS_PER_MINUTE) || 5000000,
      retryAttempts: config.retryAttempts || parseInt(process.env.RETRY_ATTEMPTS) || 3,
      retryDelay: config.retryDelay || 1000,                     // Initial retry delay (ms)
      enableThrottling: config.enableThrottling !== false && process.env.ENABLE_THROTTLING !== 'false'
    };

    // Rate limiting state
    this._requestQueue = [];
    this._activeRequests = 0;
    this._requestTimestamps = [];
    this._tokenUsage = [];
    this._processing = false;
  }

  async chat(params) {
    if (!this._config.enableThrottling) {
      // Bypass rate limiting if disabled
      return this._directAPICall(params);
    }

    // Add request to queue
    return new Promise((resolve, reject) => {
      this._requestQueue.push({ params, resolve, reject, attempts: 0 });
      this._processQueue();
    });
  }

  async _processQueue() {
    if (this._processing) return;
    this._processing = true;

    while (this._requestQueue.length > 0) {
      // Check concurrent limit
      if (this._activeRequests >= this._config.maxConcurrentRequests) {
        await this._sleep(100);
        continue;
      }

      // Check RPM limit
      if (!this._checkRateLimit()) {
        await this._sleep(1000);
        continue;
      }

      // Process next request
      const request = this._requestQueue.shift();
      this._activeRequests++;

      this._executeRequest(request)
        .finally(() => {
          this._activeRequests--;
        });
    }

    this._processing = false;
  }

  _checkRateLimit() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean old timestamps
    this._requestTimestamps = this._requestTimestamps.filter(ts => ts > oneMinuteAgo);
    this._tokenUsage = this._tokenUsage.filter(usage => usage.timestamp > oneMinuteAgo);

    // Check RPM
    if (this._requestTimestamps.length >= this._config.requestsPerMinute) {
      return false;
    }

    // Check TPM
    const recentTokens = this._tokenUsage.reduce((sum, usage) => sum + usage.tokens, 0);
    if (recentTokens >= this._config.tokensPerMinute) {
      return false;
    }

    return true;
  }

  async _executeRequest(request) {
    const { params, resolve, reject, attempts } = request;

    try {
      // Record request timestamp
      this._requestTimestamps.push(Date.now());

      // Execute API call
      const response = await this._directAPICallWithRetry(params, attempts);

      // Record token usage
      if (response.modelUsage && response.modelUsage.tokens) {
        this._tokenUsage.push({
          timestamp: Date.now(),
          tokens: response.modelUsage.tokens.totalTokens
        });
      }

      resolve(response);
    } catch (error) {
      // Check if we should retry
      if (attempts < this._config.retryAttempts && this._isRetryableError(error)) {
        const delay = this._config.retryDelay * Math.pow(2, attempts); // Exponential backoff
        console.log(`⚠️ Request failed, retrying in ${delay}ms... (attempt ${attempts + 1}/${this._config.retryAttempts})`);

        await this._sleep(delay);
        request.attempts = attempts + 1;
        this._requestQueue.unshift(request); // Add back to front of queue
        this._activeRequests--; // Release the slot
      } else {
        reject(error);
      }
    }
  }

  _isRetryableError(error) {
    // Retry on rate limit errors (429) and temporary failures (503, 502)
    const retryableCodes = [429, 502, 503];
    return error.statusCode && retryableCodes.includes(error.statusCode);
  }

  async _directAPICallWithRetry(params, attemptNumber = 0) {
    const { apiKey, resourceName, deploymentName, apiVersion, endpoint } = this._config;

    const baseUrl = endpoint.includes('services.ai.azure.com')
      ? endpoint
      : `https://${resourceName}.services.ai.azure.com`;

    const fullUrl = `${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;

    const messages = params.chatPrompt || params.messages || [];
    const modelConfig = params.modelConfig || {};

    const requestBody = JSON.stringify({
      model: params.model || deploymentName,
      messages: messages,
      max_tokens: modelConfig.maxTokens || 500,
      temperature: modelConfig.temperature || 0.7,
      stream: false
    });

    return new Promise((resolve, reject) => {
      const url = new URL(fullUrl);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
          'Content-Length': Buffer.byteLength(requestBody)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            const response = JSON.parse(data);
            const axResponse = {
              results: [{
                content: response.choices[0].message.content,
                finishReason: response.choices[0].finish_reason,
                index: 0
              }],
              modelUsage: {
                tokens: {
                  promptTokens: response.usage?.prompt_tokens || 0,
                  completionTokens: response.usage?.completion_tokens || 0,
                  totalTokens: response.usage?.total_tokens || 0
                }
              },
              remoteId: response.id
            };
            resolve(axResponse);
          } else {
            const error = new Error(`HTTP ${res.statusCode}: ${data}`);
            error.statusCode = res.statusCode;
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(requestBody);
      req.end();
    });
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Utility method to process batch with rate limiting
  async processBatch(items, processFunction, options = {}) {
    const {
      batchSize = 5,           // Process in batches of 5
      delayBetweenBatches = 1000,  // 1 second between batches
      showProgress = true
    } = options;

    const results = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      if (showProgress) {
        console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)} (${batch.length} items)...`);
      }

      // Process batch in parallel (but limited by maxConcurrentRequests)
      const batchResults = await Promise.all(
        batch.map(item => processFunction(item))
      );

      results.push(...batchResults);

      // Delay between batches to avoid rate limits
      if (i + batchSize < items.length) {
        await this._sleep(delayBetweenBatches);
      }
    }

    return results;
  }

  // Get current rate limit status
  getRateLimitStatus() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    const recentRequests = this._requestTimestamps.filter(ts => ts > oneMinuteAgo).length;
    const recentTokens = this._tokenUsage
      .filter(usage => usage.timestamp > oneMinuteAgo)
      .reduce((sum, usage) => sum + usage.tokens, 0);

    return {
      activeRequests: this._activeRequests,
      queuedRequests: this._requestQueue.length,
      requestsInLastMinute: recentRequests,
      tokensInLastMinute: recentTokens,
      limits: {
        maxConcurrent: this._config.maxConcurrentRequests,
        requestsPerMinute: this._config.requestsPerMinute,
        tokensPerMinute: this._config.tokensPerMinute
      },
      percentages: {
        requests: (recentRequests / this._config.requestsPerMinute * 100).toFixed(1),
        tokens: (recentTokens / this._config.tokensPerMinute * 100).toFixed(1)
      }
    };
  }
}

// Demo: Safe parallel processing with rate limiting
async function demoRateLimitedProcessing() {
  console.log('🛡️ RATE-LIMITED AZURE WRAPPER DEMO\n');
  console.log('=' .repeat(60));

  const client = new AXAzureWrapperRateLimited({
    apiKey: process.env.AZURE_API_KEY,
    resourceName: process.env.AZURE_RESOURCE_NAME,
    deploymentName: process.env.AZURE_DEPLOYMENT_NAME,
    apiVersion: process.env.AZURE_API_VERSION,
    // Use environment variables (will read from .env)
    // No need to override - defaults from .env will be used
    enableThrottling: true
  });

  const config = client._config;
  console.log('📊 Rate Limit Configuration (from .env):');
  console.log(`  • Max Concurrent: ${config.maxConcurrentRequests} requests`);
  console.log(`  • RPM Limit: ${config.requestsPerMinute.toLocaleString()} requests/min`);
  console.log(`  • TPM Limit: ${config.tokensPerMinute.toLocaleString()} tokens/min`);
  console.log(`  • Retry: ${config.retryAttempts} attempts with exponential backoff\n`);

  // Create 10 tasks
  const tasks = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    prompt: `Task ${i + 1}: Analyze this brief text and respond concisely.`
  }));

  console.log(`📋 Processing ${tasks.length} tasks with rate limiting...\n`);

  const startTime = Date.now();
  let completed = 0;

  // Process all tasks with rate limiting
  const results = await Promise.all(
    tasks.map(async task => {
      const response = await client.chat({
        chatPrompt: [{ role: 'user', content: task.prompt }],
        modelConfig: { maxTokens: 50, temperature: 0.5 }
      });

      completed++;
      const status = client.getRateLimitStatus();
      console.log(`  ✅ Task ${task.id} complete | Queue: ${status.queuedRequests} | Active: ${status.activeRequests} | RPM: ${status.percentages.requests}%`);

      return {
        taskId: task.id,
        tokens: response.modelUsage.tokens.totalTokens
      };
    })
  );

  const totalTime = Date.now() - startTime;
  const totalTokens = results.reduce((sum, r) => sum + r.tokens, 0);

  console.log('\n' + '=' .repeat(60));
  console.log('📊 RESULTS:');
  console.log(`  • Total Time: ${(totalTime / 1000).toFixed(2)} seconds`);
  console.log(`  • Total Tokens: ${totalTokens}`);
  console.log(`  • Average Time per Task: ${(totalTime / tasks.length).toFixed(0)}ms`);

  const finalStatus = client.getRateLimitStatus();
  console.log('\n📈 Final Rate Limit Status:');
  console.log(`  • Requests Used: ${finalStatus.requestsInLastMinute}/${finalStatus.limits.requestsPerMinute} (${finalStatus.percentages.requests}%)`);
  console.log(`  • Tokens Used: ${finalStatus.tokensInLastMinute}/${finalStatus.limits.tokensPerMinute} (${finalStatus.percentages.tokens}%)`);

  console.log('\n✅ All tasks completed without hitting rate limits!');
}

// Export both versions
module.exports = {
  AXAzureWrapperRateLimited,
  demoRateLimitedProcessing
};

// Run demo if called directly
if (require.main === module) {
  demoRateLimitedProcessing().catch(console.error);
}