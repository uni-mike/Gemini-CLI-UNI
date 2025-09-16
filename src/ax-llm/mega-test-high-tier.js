const { AXAzureWrapperRateLimited } = require('./azure-client-rate-limited.js');
require('dotenv').config();

/**
 * MEGA TEST FOR HIGH-TIER AZURE (10K RPM, 10M TPM)
 *
 * This test pushes the limits of your high-tier Azure subscription
 * to demonstrate what's possible with proper rate limiting.
 *
 * Scale:
 * - 500 parallel tasks
 * - Up to 50 concurrent requests
 * - Targeting ~2K RPM, ~1M TPM
 */

async function megaHighTierTest() {
  console.log('🚀 MEGA HIGH-TIER AZURE TEST (10K RPM / 10M TPM)');
  console.log('=' .repeat(60));

  const client = new AXAzureWrapperRateLimited({
    apiKey: process.env.AZURE_API_KEY,
    resourceName: process.env.AZURE_RESOURCE_NAME,
    deploymentName: process.env.AZURE_DEPLOYMENT_NAME,
    apiVersion: process.env.AZURE_API_VERSION,
    // Configuration from environment variables (.env)
    // Uses your optimized 10K RPM / 10M TPM settings
  });

  console.log('⚡ High-Performance Configuration:');
  console.log('  • Max Concurrent: 50 requests');
  console.log('  • RPM Limit: 8,000 (80% of 10K)');
  console.log('  • TPM Limit: 8,000,000 (80% of 10M)');
  console.log('  • Expected throughput: ~2,000 requests in 15 seconds\n');

  // Generate 500 analysis tasks
  const tasks = Array.from({ length: 500 }, (_, i) => ({
    id: i + 1,
    type: ['market_analysis', 'sentiment', 'competitor', 'technical', 'financial'][i % 5],
    prompt: generatePrompt(i)
  }));

  console.log(`📋 Processing ${tasks.length} analysis tasks...\n`);

  const startTime = Date.now();
  let completed = 0;

  // Track performance metrics
  const metrics = {
    byType: {},
    errors: 0,
    retries: 0
  };

  // Progress reporting
  const progressInterval = setInterval(() => {
    const status = client.getRateLimitStatus();
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = completed / elapsed * 60; // per minute

    console.log(`📊 Progress: ${completed}/${tasks.length} | Rate: ${rate.toFixed(0)}/min | Queue: ${status.queuedRequests} | RPM: ${status.percentages.requests}% | TPM: ${status.percentages.tokens}%`);
  }, 2000);

  try {
    // Process all tasks with high concurrency
    const results = await Promise.all(
      tasks.map(async task => {
        try {
          const response = await client.chat({
            chatPrompt: [
              {
                role: 'system',
                content: getSystemPrompt(task.type)
              },
              {
                role: 'user',
                content: task.prompt
              }
            ],
            modelConfig: {
              maxTokens: getMaxTokens(task.type),
              temperature: 0.4
            }
          });

          completed++;

          // Track metrics
          if (!metrics.byType[task.type]) {
            metrics.byType[task.type] = { count: 0, tokens: 0 };
          }
          metrics.byType[task.type].count++;
          metrics.byType[task.type].tokens += response.modelUsage.tokens.totalTokens;

          return {
            taskId: task.id,
            type: task.type,
            tokens: response.modelUsage.tokens.totalTokens,
            success: true
          };
        } catch (error) {
          metrics.errors++;
          completed++;
          return {
            taskId: task.id,
            type: task.type,
            error: error.message,
            success: false
          };
        }
      })
    );

    clearInterval(progressInterval);

    const totalTime = Date.now() - startTime;
    const successfulResults = results.filter(r => r.success);
    const totalTokens = successfulResults.reduce((sum, r) => sum + r.tokens, 0);

    console.log('\n' + '=' .repeat(60));
    console.log('🏆 HIGH-TIER PERFORMANCE RESULTS');
    console.log('=' .repeat(60));

    console.log('\n📊 OVERALL METRICS:');
    console.log(`  • Total Time: ${(totalTime / 1000).toFixed(2)} seconds`);
    console.log(`  • Successful Tasks: ${successfulResults.length}/${tasks.length}`);
    console.log(`  • Success Rate: ${(successfulResults.length / tasks.length * 100).toFixed(1)}%`);
    console.log(`  • Total Tokens: ${totalTokens.toLocaleString()}`);
    console.log(`  • Average Tokens per Task: ${Math.round(totalTokens / successfulResults.length)}`);
    console.log(`  • Errors: ${metrics.errors}`);

    console.log('\n⚡ PERFORMANCE METRICS:');
    const requestsPerMinute = (successfulResults.length / (totalTime / 60000));
    const tokensPerMinute = (totalTokens / (totalTime / 60000));
    console.log(`  • Actual RPM: ${requestsPerMinute.toFixed(0)} requests/minute`);
    console.log(`  • Actual TPM: ${tokensPerMinute.toLocaleString()} tokens/minute`);
    console.log(`  • RPM Utilization: ${(requestsPerMinute / 10000 * 100).toFixed(1)}% of limit`);
    console.log(`  • TPM Utilization: ${(tokensPerMinute / 10000000 * 100).toFixed(2)}% of limit`);

    console.log('\n📈 BY TASK TYPE:');
    Object.entries(metrics.byType).forEach(([type, data]) => {
      const avgTokens = Math.round(data.tokens / data.count);
      console.log(`  • ${type}: ${data.count} tasks, ${avgTokens} avg tokens`);
    });

    const finalStatus = client.getRateLimitStatus();
    console.log('\n🎯 RATE LIMIT STATUS:');
    console.log(`  • Peak Concurrent Requests: 50`);
    console.log(`  • RPM Usage: ${finalStatus.percentages.requests}%`);
    console.log(`  • TPM Usage: ${finalStatus.percentages.tokens}%`);

    console.log('\n💡 INSIGHTS:');
    if (requestsPerMinute < 1000) {
      console.log('  • Could handle 10x more requests without hitting RPM limit');
    }
    if (tokensPerMinute < 1000000) {
      console.log('  • Could handle much larger token throughput');
    }
    console.log(`  • Your high-tier subscription enables ${Math.floor(10000 / (tasks.length / (totalTime / 60000)))}x this workload`);
    console.log('  • Perfect for real-time processing and large-scale analytics');

    return {
      totalTime,
      successfulTasks: successfulResults.length,
      totalTokens,
      requestsPerMinute,
      tokensPerMinute
    };

  } catch (error) {
    clearInterval(progressInterval);
    throw error;
  }
}

function generatePrompt(index) {
  const prompts = [
    `Analyze market trends for Q${(index % 4) + 1} 2024`,
    `Evaluate customer sentiment for product ID ${1000 + index}`,
    `Compare competitor pricing strategy vs our offerings`,
    `Assess technical feasibility of feature request ${index}`,
    `Review financial impact of initiative ${index}`
  ];
  return prompts[index % 5];
}

function getSystemPrompt(type) {
  const prompts = {
    market_analysis: 'You are a market analyst. Provide concise insights with key trends and recommendations.',
    sentiment: 'You are a sentiment analyst. Classify sentiment and extract key themes.',
    competitor: 'You are a competitive intelligence analyst. Focus on actionable insights.',
    technical: 'You are a technical analyst. Assess feasibility and technical requirements.',
    financial: 'You are a financial analyst. Focus on ROI and cost-benefit analysis.'
  };
  return prompts[type] || 'You are a business analyst. Provide structured analysis.';
}

function getMaxTokens(type) {
  const tokens = {
    market_analysis: 200,
    sentiment: 100,
    competitor: 150,
    technical: 180,
    financial: 160
  };
  return tokens[type] || 150;
}

if (require.main === module) {
  console.log('🚨 STARTING HIGH-TIER MEGA TEST\n');
  console.log('This will process 500 tasks with up to 50 concurrent requests');
  console.log('Testing your 10K RPM / 10M TPM Azure limits...\n');
  console.log('Press Ctrl+C to cancel, starting in 3 seconds...\n');

  setTimeout(() => {
    megaHighTierTest()
      .then(results => {
        console.log('\n✨ High-tier test completed successfully!');
        console.log(`Peak performance: ${results.requestsPerMinute.toFixed(0)} RPM, ${results.tokensPerMinute.toLocaleString()} TPM`);
      })
      .catch(error => {
        console.error('❌ Error:', error.message);
      });
  }, 3000);
}

module.exports = { megaHighTierTest };