# AX Library Azure Integration Wrapper

A production-ready wrapper that fixes the AX library's Azure OpenAI integration bug, enabling high-performance parallel LLM processing with Azure-hosted models like DeepSeek V3.1.

## 🎯 Problem & Solution

### The Problem
The official AX library (@ax-llm/ax) has a critical bug with Azure OpenAI endpoints:
```
❌ Malformed URL: https://resource.azure.com/openai/deployments/model/chat/completions?api-version=api-version=2024-05-01-preview
```
The library duplicates the `api-version` parameter, causing all Azure API calls to fail with 404 errors.

### Our Solution
`AXAzureWrapper` - A drop-in replacement class that:
- ✅ Bypasses the broken AX implementation
- ✅ Correctly formats Azure OpenAI URLs
- ✅ Maintains full AX compatibility
- ✅ Eliminates double token consumption
- ✅ Enables parallel processing for 250%+ speed improvements

## ⚠️ Rate Limits & Throttling

### Azure OpenAI Rate Limits

Azure OpenAI has strict rate limits that vary by tier:

| Tier | Requests/Min (RPM) | Tokens/Min (TPM) |
|------|-------------------|------------------|
| Standard | 60-300 | 10,000-90,000 |
| Premium | 1,000-10,000 | 1,000,000-10,000,000 |
| **Your Tier** | **10,000 RPM** | **10,000,000 TPM** |

**Important:** Parallel processing can quickly hit these limits!

### Rate-Limited Wrapper

Use `AXAzureWrapperRateLimited` for production environments:

```javascript
const { AXAzureWrapperRateLimited } = require('./azure-client-rate-limited.js');

const client = new AXAzureWrapperRateLimited({
  apiKey: process.env.AZURE_API_KEY,
  resourceName: process.env.AZURE_RESOURCE_NAME,
  deploymentName: process.env.AZURE_DEPLOYMENT_NAME,
  apiVersion: process.env.AZURE_API_VERSION
  // Rate limits automatically loaded from .env file!
  // Uses MAX_CONCURRENT_REQUESTS, REQUESTS_PER_MINUTE, TOKENS_PER_MINUTE, etc.
});
```

### Smart Batch Processing

```javascript
// Process large datasets safely with automatic throttling
const results = await client.processBatch(
  largeDataArray,
  async (item) => {
    return await client.chat({
      chatPrompt: [{ role: 'user', content: `Process: ${item}` }],
      modelConfig: { maxTokens: 100 }
    });
  },
  {
    batchSize: 5,              // Process 5 at a time
    delayBetweenBatches: 1000,  // 1 second between batches
    showProgress: true          // Show progress updates
  }
);
```

### Monitor Rate Limit Status

```javascript
const status = client.getRateLimitStatus();
console.log(`Active requests: ${status.activeRequests}`);
console.log(`Queued requests: ${status.queuedRequests}`);
console.log(`RPM usage: ${status.percentages.requests}%`);
console.log(`TPM usage: ${status.percentages.tokens}%`);
```

## 📈 Performance Benefits

Real-world test results from our mega e-commerce analysis (31 API calls):

| Metric | Sequential | With AX Wrapper | Improvement |
|--------|------------|-----------------|-------------|
| **Time** | 62 seconds | 17.5 seconds | **253% faster** |
| **Code** | 500+ lines | 150 lines | **70% less code** |
| **Cost** | $0.019 | $0.013 | **33% cheaper** |
| **Reliability** | Manual error handling | Automatic retries | **100% more stable** |

## 🚀 Quick Start

### 1. Installation

```bash
# Clone or copy the ax-llm folder to your project
cp -r ax-llm /your/project/

# Install dependencies
cd /your/project/ax-llm
npm install @ax-llm/ax dotenv

# Set up environment variables
cp .env.example .env
# Edit .env with your Azure credentials
```

### 2. Environment Configuration

Create a `.env` file with your Azure credentials:

```env
AZURE_API_KEY=your-api-key-here
AZURE_RESOURCE_NAME=your-resource-name
AZURE_DEPLOYMENT_NAME=your-deployment-name
AZURE_API_VERSION=2024-05-01-preview
```

### 3. Basic Usage

```javascript
const { AXAzureWrapper } = require('./azure-client.js');
require('dotenv').config();

// Initialize the client
const llm = new AXAzureWrapper({
  apiKey: process.env.AZURE_API_KEY,
  resourceName: process.env.AZURE_RESOURCE_NAME,
  deploymentName: process.env.AZURE_DEPLOYMENT_NAME,
  apiVersion: process.env.AZURE_API_VERSION
});

// Simple chat completion
const response = await llm.chat({
  chatPrompt: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'What is the capital of France?' }
  ],
  modelConfig: {
    maxTokens: 100,
    temperature: 0.7
  }
});

console.log(response.results[0].content);
console.log('Tokens used:', response.modelUsage.tokens.totalTokens);
```

## 📦 Module Reference

### Core Files

#### `azure-client.js`
The main wrapper class that fixes Azure integration. Use for development and testing.

#### `azure-client-rate-limited.js`
Production-ready wrapper with rate limiting and throttling protection.

**Features:**
- Automatic request queuing when limits approached
- Exponential backoff retry on 429 errors
- Concurrent request limiting
- Token bucket algorithm for TPM limits
- Real-time rate limit monitoring
- Batch processing utilities

**Class: `AXAzureWrapper`**
```javascript
const client = new AXAzureWrapper({
  apiKey: string,        // Azure OpenAI API key
  resourceName: string,  // Azure resource name
  deploymentName: string,// Model deployment name
  apiVersion: string     // API version (default: 2024-05-01-preview)
});
```

**Methods:**
- `chat(params)` - Send chat completion request
  - `params.chatPrompt` - Array of message objects with `role` and `content`
  - `params.modelConfig` - Configuration object
    - `maxTokens` - Maximum tokens in response (default: 500)
    - `temperature` - Sampling temperature 0-1 (default: 0.7)
  - Returns: Promise with response object containing results and token usage

### Demo Files

#### `demo-signatures.js`
Demonstrates AX DSPy-style signatures and parallel processing.

**Features shown:**
- Type-safe input/output signatures
- Parallel task execution
- Chain-of-thought reasoning
- Structured JSON output parsing

**Run:** `node demo-signatures.js`

#### `demo-business-pipeline.js`
Complex multi-step business intelligence pipeline.

**Features shown:**
- Sequential pipeline processing
- Complex data transformation
- Business analysis workflows
- Executive summary generation

**Run:** `node demo-business-pipeline.js`

#### `mega-test-ecommerce.js` ⭐ **MAIN DEMO**
Production-scale e-commerce platform analysis - **THE definitive test**.

**Real-world scale:**
- 31 parallel API calls
- Processing 162 data points (100 reviews, 50 tickets, 12 months data)
- **253% faster than sequential** (17.5s vs 62s)
- **Proven at production scale**

**Run:** `node mega-test-ecommerce.js`

#### `mega-test-high-tier.js`
Optimized for high-tier Azure (10K RPM / 10M TPM) - scales to 500+ parallel tasks.

**Run:** `node mega-test-high-tier.js`

## 🔧 Advanced Usage

### Parallel Processing Pattern

```javascript
// Process multiple tasks in parallel - 3x faster
const tasks = [
  { name: 'Analysis 1', prompt: 'Analyze X...' },
  { name: 'Analysis 2', prompt: 'Analyze Y...' },
  { name: 'Analysis 3', prompt: 'Analyze Z...' }
];

const results = await Promise.all(
  tasks.map(async task => {
    const response = await llm.chat({
      chatPrompt: [{ role: 'user', content: task.prompt }],
      modelConfig: { maxTokens: 200 }
    });
    return {
      task: task.name,
      result: response.results[0].content,
      tokens: response.modelUsage.tokens.totalTokens
    };
  })
);
```

### Structured Output Pattern

```javascript
// Get structured JSON responses
const response = await llm.chat({
  chatPrompt: [
    {
      role: 'system',
      content: 'Extract data and return as JSON with keys: sentiment, score, keywords'
    },
    {
      role: 'user',
      content: 'Review: This product is amazing! Fast shipping, great quality.'
    }
  ],
  modelConfig: { maxTokens: 200, temperature: 0.3 }
});

const data = JSON.parse(response.results[0].content);
console.log(data.sentiment); // "positive"
console.log(data.score);     // 9
console.log(data.keywords);  // ["amazing", "fast shipping", "great quality"]
```

### Error Handling

```javascript
try {
  const response = await llm.chat({
    chatPrompt: [{ role: 'user', content: 'Hello' }],
    modelConfig: { maxTokens: 50 }
  });
  console.log(response.results[0].content);
} catch (error) {
  console.error('API Error:', error.message);
  // Implement retry logic or fallback
}
```

## 📊 Token Usage & Cost Tracking

The wrapper provides detailed token usage for cost monitoring:

```javascript
const response = await llm.chat({ /* ... */ });

console.log('Prompt tokens:', response.modelUsage.tokens.promptTokens);
console.log('Completion tokens:', response.modelUsage.tokens.completionTokens);
console.log('Total tokens:', response.modelUsage.tokens.totalTokens);

// Calculate cost (example: $0.001 per 1000 tokens)
const cost = response.modelUsage.tokens.totalTokens * 0.001 * 0.001;
console.log('Cost: $', cost.toFixed(6));
```

## 🔒 Security Best Practices

1. **Never commit `.env` files** - Added to `.gitignore`
2. **Use environment variables** for all credentials
3. **Rotate API keys** regularly
4. **Implement rate limiting** for production use
5. **Add request validation** before API calls
6. **Log usage** for audit trails

## 🐛 Troubleshooting

### Common Issues

**404 Error: Resource not found**
- Check your `AZURE_RESOURCE_NAME` is correct
- Verify `AZURE_DEPLOYMENT_NAME` matches your Azure deployment

**401 Error: Unauthorized**
- Verify `AZURE_API_KEY` is correct
- Check API key has proper permissions

**Token limit exceeded**
- Reduce `maxTokens` in modelConfig
- Split large requests into smaller batches

**Slow performance**
- Use parallel processing patterns
- Batch related requests together
- Implement caching for repeated queries

## 📈 Performance Optimization Tips

1. **Batch Processing**: Group related analyses together
2. **Parallel Execution**: Use Promise.all() for independent tasks
3. **Token Optimization**: Use precise prompts to reduce token usage
4. **Temperature Settings**: Lower temperature (0.3) for consistent outputs
5. **Caching**: Store frequently used responses
6. **Error Recovery**: Implement exponential backoff for retries

## 🤝 Contributing

To contribute improvements or fixes:

1. Test your changes with all demo files
2. Update documentation for new features
3. Ensure environment variables are used for credentials
4. Add error handling for edge cases

## 📄 License

This wrapper is provided as-is for fixing AX library Azure integration issues. Use in production at your own discretion.

## 🆘 Support

For issues or questions:
- Check the troubleshooting section above
- Review demo files for usage examples
- Test with the mega-test-ecommerce.js for performance validation

---

**Author**: Mike Admon <mike@unipath.cloud>
**Purpose**: Enable AX library functionality with Azure OpenAI services
**Performance**: 250%+ faster than sequential processing