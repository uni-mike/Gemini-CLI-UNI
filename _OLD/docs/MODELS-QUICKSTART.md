# 🚀 Quick Model Selection Guide

## Available Models & Startup Scripts

### ⚡ Fast Models with Tools (RECOMMENDED)
```bash
./start-deepseek.sh  # DeepSeek R1 - ⭐ BEST CHOICE: Fast + Full Tools + Great reasoning
npm run start        # Google Gemini - Original with full tool support
```

### ⚡ Fast Models (Chat Only)
```bash
./start-mini.sh      # GPT-4o-mini - Fastest, cost-effective, no tools
./start-4o.sh        # GPT-4o - Good balance, no tools
```

### 🐌 Slower Models (Chat Only)
```bash
./start-azure.sh     # GPT-5 - Highest quality but slow, no tools
```

## Model Comparison - Updated for DeepSeek R1 Tools!

| Model | Speed | Quality | Cost | Tools | Best For |
|-------|-------|---------|------|-------|----------|
| **DeepSeek R1** ⭐ | ⚡⚡ (3-5s) | ⭐⭐⭐⭐⭐ | 💰💰 | ✅ **FULL** | **Everything! Files, shell, reasoning** |
| **Gemini** | ⚡⚡⚡ (1-3s) | ⭐⭐⭐⭐ | 💰💰 | ✅ **FULL** | Original tool support |
| **GPT-4o-mini** | ⚡⚡⚡ (2-3s) | ⭐⭐⭐ | 💰 | ❌ None | Quick queries, simple tasks |
| **GPT-4o** | ⚡⚡ (3-5s) | ⭐⭐⭐⭐ | 💰💰 | ❌ None | General use, complex tasks |
| **GPT-5** | 🐌 (10-20s) | ⭐⭐⭐⭐⭐ | 💰💰💰 | ❌ None | When you need the best quality |

## 🛠️ Tool Support Breakdown

### DeepSeek R1 ⭐ (RECOMMENDED)
✅ **File Operations**: Read, write, edit files with diff previews  
✅ **Shell Commands**: Execute system commands with approval  
✅ **Search Tools**: Grep, glob, ripgrep for code exploration  
✅ **Web Tools**: Search and fetch web content  
✅ **Memory**: Save and recall context across sessions  
✅ **Approval Flow**: Claude-style security with previews  

### Google Gemini
✅ **All Tools**: Complete original tool support  
✅ **IDE Integration**: Native VS Code extension support  

### Azure Models (GPT-5, GPT-4o, GPT-4o-mini)
❌ **No Tools**: Chat only, no file operations  
❌ **No Shell**: Can't execute commands  
❌ **No Files**: Can't read or write files  

## Quick Examples

### 🌟 RECOMMENDED: DeepSeek R1 with Tools
```bash
./start-deepseek.sh
> Read package.json and analyze dependencies
> Search for TODO comments in the codebase
> Edit src/app.js and fix the TypeScript errors
> Run npm test and show me the results
```

### File Operations (DeepSeek R1 only):
```bash
echo "Create a new README.md with project overview" | ./start-deepseek.sh
echo "Search for all console.log statements" | ./start-deepseek.sh
echo "Edit config.js and update the port to 3000" | ./start-deepseek.sh
```

### Simple questions (use mini for speed):
```bash
echo "What is the capital of France?" | ./start-mini.sh
```

### Code review without tools (GPT-4o or GPT-5):
```bash
echo "Review this code: $(cat app.js)" | ./start-4o.sh
```

### Complex reasoning without tools (GPT-5):
```bash
echo "Explain quantum computing implications for cryptography" | ./start-azure.sh
```

## When to Use Each Model

### Use DeepSeek R1 when you need:
- ⭐ **File operations** (read, write, edit)
- ⭐ **Shell commands** (run tests, build, deploy)  
- ⭐ **Code exploration** (search, analyze)
- ⭐ **Security** (approval flow with previews)
- ⭐ **Complex reasoning** with tool support

### Use Gemini when you need:
- Original tool support
- IDE integration
- Google's ecosystem

### Use GPT models when you need:
- **GPT-4o-mini**: Quick simple questions
- **GPT-4o**: Complex chat without tools  
- **GPT-5**: Highest quality analysis (chat only)

## 🎯 Recommendation

**Start with DeepSeek R1**: `./start-deepseek.sh`

It's the perfect balance of:
- ⚡ Speed (3-5 seconds)
- 🧠 Intelligence (excellent reasoning)  
- 🛠️ Tools (complete file/shell/web support)
- 🔒 Security (approval flow)
- 💰 Cost-effectiveness

## Configuration Files

```bash
# DeepSeek R1 (recommended)
.env.deepseek

# Other models
.env.mini      # GPT-4o-mini
.env.4o        # GPT-4o  
.env           # GPT-5
```

---

**🌟 TL;DR: Use `./start-deepseek.sh` for the best experience!**