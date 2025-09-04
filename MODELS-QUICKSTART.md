# 🚀 Quick Model Selection Guide

## Available Models & Startup Scripts

### ⚡ Fast Models (2-5 seconds)
```bash
./start-mini.sh      # GPT-4o-mini - Fastest, cost-effective
./start-4o.sh        # GPT-4o - Best balance of speed & quality
./start-deepseek.sh  # DeepSeek R1 - Strong reasoning, open model
```

### 🐌 Slower Models (10-20 seconds)
```bash
./start-azure.sh     # GPT-5 - Highest quality but slow
```

### 🌐 Native Gemini (with full tool support)
```bash
npm run start        # Google Gemini - Full tool integration
```

## Model Comparison

| Model | Speed | Quality | Cost | Tools | Best For |
|-------|-------|---------|------|-------|----------|
| **GPT-4o-mini** | ⚡⚡⚡ (2-3s) | ⭐⭐⭐ | 💰 | ❌ | Quick queries, simple tasks |
| **GPT-4o** | ⚡⚡ (3-5s) | ⭐⭐⭐⭐ | 💰💰 | ❌ | General use, complex tasks |
| **DeepSeek R1** | ⚡⚡ (3-5s) | ⭐⭐⭐⭐ | 💰💰 | ❌ | Reasoning, analysis, code |
| **GPT-5** | 🐌 (10-20s) | ⭐⭐⭐⭐⭐ | 💰💰💰 | ❌ | When you need the best |
| **Gemini** | ⚡⚡⚡ (1-3s) | ⭐⭐⭐⭐ | 💰💰 | ✅ | When you need tools |

## Quick Examples

### Simple question (use mini for speed):
```bash
echo "What is the capital of France?" | ./start-mini.sh
```

### Code review (use GPT-4o or DeepSeek):
```bash
echo "Review this code: $(cat app.js)" | ./start-4o.sh
# or
echo "Analyze this algorithm: $(cat algo.py)" | ./start-deepseek.sh
```

### Complex reasoning (use GPT-5 when quality matters):
```bash
./start-azure.sh
> Explain quantum computing implications for cryptography
```

### File operations (use native Gemini):
```bash
npm run start
> /read package.json
> /shell npm test
> /write report.md
```

## Troubleshooting

### Rate Limits (429 Error)
The system now automatically retries with exponential backoff. If you still hit limits:
1. Wait a minute between requests
2. Use a cheaper model (mini) for testing
3. Upgrade your Azure tier at https://aka.ms/oai/quotaincrease

### Slow Responses
- Switch from GPT-5 to GPT-4o for 3-4x speed improvement
- Use mini for non-critical tasks
- Consider DeepSeek R1 for good balance

### Need Tools?
Only native Gemini (`npm run start`) currently supports file operations and shell commands.
Azure models are chat/Q&A only for now.