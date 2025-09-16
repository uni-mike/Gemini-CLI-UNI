const { AxAIAzureOpenAI, ax } = require('@ax-llm/ax');
const https = require('https');
require('dotenv').config();

class AXAzureWrapper extends AxAIAzureOpenAI {
  constructor(config) {
    super(config);
    this._config = {
      apiKey: config.apiKey,
      resourceName: config.resourceName,
      deploymentName: config.deploymentName || config.deployment,
      apiVersion: config.apiVersion || '2024-05-01-preview',
      endpoint: config.endpoint || `https://${config.resourceName}.services.ai.azure.com`
    };
  }

  async chat(params) {
    return this._directAPICall(params);
  }

  async _directAPICall(params) {
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
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
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
}

async function testAXAzureDeepSeek() {
  console.log('🚀 AX Library + Azure DeepSeek V3.1 - WORKING SOLUTION\n');
  console.log('=' .repeat(50));

  const client = new AXAzureWrapper({
    apiKey: process.env.AZURE_API_KEY,
    resourceName: process.env.AZURE_RESOURCE_NAME,
    deploymentName: process.env.AZURE_DEPLOYMENT_NAME,
    apiVersion: process.env.AZURE_API_VERSION
  });

  console.log('\n📝 Test 1: Simple Query');
  console.log('-'.repeat(30));

  try {
    const response = await client.chat({
      model: 'DeepSeek-V3.1',
      chatPrompt: [
        { role: 'user', content: 'What is 2+2?' }
      ],
      modelConfig: {
        maxTokens: 50,
        temperature: 0.1
      }
    });

    console.log('✅ Response:', response.results[0].content);
    console.log('📊 Tokens used:', response.modelUsage.tokens.totalTokens);
  } catch (error) {
    console.log('❌ Failed:', error.message);
  }

  console.log('\n📝 Test 2: Code Generation');
  console.log('-'.repeat(30));

  try {
    const response = await client.chat({
      chatPrompt: [
        { role: 'user', content: 'Write a JavaScript function to reverse a string' }
      ],
      modelConfig: {
        maxTokens: 200,
        temperature: 0.5
      }
    });

    console.log('✅ Response:', response.results[0].content);
    console.log('📊 Tokens used:', response.modelUsage.tokens.totalTokens);
  } catch (error) {
    console.log('❌ Failed:', error.message);
  }

  console.log('\n📝 Test 3: Multi-turn Conversation');
  console.log('-'.repeat(30));

  try {
    const conversation = [
      { role: 'user', content: 'What is React?' },
      { role: 'assistant', content: 'React is a JavaScript library for building user interfaces.' },
      { role: 'user', content: 'What are its main features?' }
    ];

    const response = await client.chat({
      chatPrompt: conversation,
      modelConfig: { maxTokens: 300, temperature: 0.5 }
    });

    console.log('✅ Response:', response.results[0].content);
    console.log('📊 Tokens used:', response.modelUsage.tokens.totalTokens);
  } catch (error) {
    console.log('❌ Failed:', error.message);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✨ All tests completed!');
}

module.exports = { AXAzureWrapper };

if (require.main === module) {
  testAXAzureDeepSeek().catch(console.error);
}