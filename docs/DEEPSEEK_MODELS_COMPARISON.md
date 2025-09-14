# DeepSeek Models Comparison: V3.1 vs R1

## Model Capabilities

### DeepSeek-V3.1
- **Context Window**: 64K-130K tokens (total input + output)
- **Max Output Tokens**: 32,000 tokens (verified on Azure)
- **Response Time**: ~2.5s for simple queries, ~17s for complex prompts
- **Optimized For**: Tool calling, direct responses, code generation
- **Azure Support**: ✅ Full support with 32K output capability

### DeepSeek-R1 (R1-0528)
- **Context Window**: 128K tokens
- **Max Output Tokens**: 32,768 tokens (Azure), up to 163,840 in some configs
- **Response Time**: ~25s for simple queries, 60s+ for complex
- **Optimized For**: Deep reasoning, complex analysis
- **Special Feature**: Returns reasoning in `reasoning_content` field

## Performance Comparison (from testing)

| Metric | DeepSeek-V3.1 | DeepSeek-R1 |
|--------|---------------|-------------|
| Simple Math (2+2) | 2.5s | 6.78s |
| Token Usage | 22 tokens | 120+ tokens |
| Complex Prompts | 17s | 60s+ |
| Tool Calling | ✅ Optimized | ⚠️ Slower |
| JSON Response | ✅ Direct | ⚠️ Wrapped in reasoning |

## Economic Token Allocation (Implemented)

### DeepSeek-V3.1 Token Strategy
```typescript
// Dynamic allocation based on prompt complexity
if (estimatedTokens < 500) {
  maxTokens = 2000;  // Simple prompts ($0.22/1K)
} else if (estimatedTokens < 2000) {
  maxTokens = 8000;  // Medium complexity ($0.88/1K)
} else if (estimatedTokens < 5000) {
  maxTokens = 16000; // Complex prompts ($1.76/1K)
} else {
  maxTokens = 32000; // Very complex prompts ($3.52/1K)
}
```

## Pricing (per 1M tokens)
- **DeepSeek-V3**: Input: $0.27, Output: $1.10
- **DeepSeek-R1**: Similar pricing tier

## Recommendations

### Use DeepSeek-V3.1 for:
- ✅ Tool calling and code generation
- ✅ Quick responses needed
- ✅ Direct JSON/structured output
- ✅ Production workloads requiring speed
- ✅ FlexiCLI operations

### Use DeepSeek-R1 for:
- ✅ Complex reasoning tasks
- ✅ Mathematical proofs
- ✅ Deep analysis requirements
- ✅ When reasoning trace is valuable

## Implementation Notes

1. **Timeout Settings**: 60 seconds for V3.1, 120+ for R1
2. **Response Cleaning**: V3.1 may wrap JSON in markdown, R1 uses reasoning_content
3. **Error Handling**: Both models need retry logic with exponential backoff
4. **Token Optimization**: Dynamic allocation saves costs on simple prompts

## FlexiCLI Configuration

Current default: **DeepSeek-V3.1** (10x faster, optimized for tool calling)

```typescript
// src/config/config.ts
private model: string = 'DeepSeek-V3.1';

// src/llm/deepseek-client.ts
this.timeout = config.timeout || 60000; // 60s for V3.1
```