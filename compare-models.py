#!/usr/bin/env python3

from openai import OpenAI
import time
import json

endpoint = "https://unipathai7556217047.services.ai.azure.com/openai/v1/"
api_key = "9c5d0679299045e9bd3513baf6ae0e86"

client = OpenAI(
    base_url=endpoint,
    api_key=api_key
)

# Test scenarios for FlexiCLI use case
test_cases = [
    {
        "name": "Simple Math",
        "prompt": "What is 15 + 27? Reply with just the number.",
        "expected": "42"
    },
    {
        "name": "Task Decomposition",
        "prompt": """REQUEST: "Create a simple calculator function"

IMPORTANT: Return ONLY valid JSON. No explanations, no thinking, no markdown.

Output format:
{"type":"tasks","tasks":[{"description":"[task]","filename":"calculator.ts","content":"[code]"}]}""",
        "check_json": True
    },
    {
        "name": "Tool Calling Decision",
        "prompt": """You have these tools: file (create/edit files), bash (run commands), web (search web).
User request: "What is the current Bitcoin price?"
Which tool should you use? Reply with just the tool name.""",
        "expected_contains": "web"
    },
    {
        "name": "Code Generation",
        "prompt": "Write a TypeScript fibonacci function. Return only the code, no explanations.",
        "check_code": True
    }
]

models = ["DeepSeek-R1-0528", "DeepSeek-V3.1"]
results = {model: [] for model in models}

print("=== COMPARING MODELS FOR FLEXICLI ===\n")

for model in models:
    print(f"\n{'='*50}")
    print(f"Testing: {model}")
    print('='*50)

    total_time = 0
    total_tokens = 0
    scores = []

    for test in test_cases:
        print(f"\n📝 {test['name']}...")

        try:
            start = time.time()
            completion = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": test["prompt"]}],
                temperature=0,
                max_tokens=500
            )
            elapsed = time.time() - start

            # Get response (handle R1's reasoning_content)
            content = completion.choices[0].message.content
            if content is None and hasattr(completion.choices[0].message, 'reasoning_content'):
                # R1 model - extract from reasoning
                reasoning = completion.choices[0].message.reasoning_content
                # Try to extract JSON or code from reasoning
                if "```" in reasoning:
                    parts = reasoning.split("```")
                    if len(parts) > 1:
                        content = parts[1].strip()
                        if content.startswith("json"):
                            content = content[4:].strip()
                else:
                    content = reasoning

            # Score the response
            score = 0
            max_score = 1

            if "expected" in test and content and test["expected"].lower() in content.lower():
                score = 1
            elif "expected_contains" in test and content and test["expected_contains"].lower() in content.lower():
                score = 1
            elif "check_json" in test and content:
                try:
                    parsed = json.loads(content)
                    if "type" in parsed and "tasks" in parsed:
                        score = 1
                except:
                    score = 0
            elif "check_code" in test and content:
                if "function" in content and ("fibonacci" in content or "fib" in content):
                    score = 1
            else:
                score = 0.5  # Partial credit if response exists

            print(f"  ⏱️ Time: {elapsed:.2f}s")
            print(f"  📊 Tokens: {completion.usage.total_tokens}")
            print(f"  ✅ Score: {score}/{max_score}")
            if content:
                print(f"  📄 Response: {content[:100]}...")

            total_time += elapsed
            total_tokens += completion.usage.total_tokens
            scores.append(score)

        except Exception as e:
            print(f"  ❌ Error: {e}")
            scores.append(0)

    # Summary for this model
    avg_score = sum(scores) / len(scores) if scores else 0
    results[model] = {
        "avg_time": total_time / len(test_cases),
        "total_tokens": total_tokens,
        "avg_score": avg_score,
        "total_time": total_time
    }

# Final comparison
print(f"\n{'='*50}")
print("FINAL COMPARISON")
print('='*50)

for model, stats in results.items():
    print(f"\n{model}:")
    print(f"  🏆 Quality Score: {stats['avg_score']:.2%}")
    print(f"  ⚡ Avg Response Time: {stats['avg_time']:.2f}s")
    print(f"  📊 Total Tokens Used: {stats['total_tokens']}")
    print(f"  ⏱️ Total Time: {stats['total_time']:.2f}s")

# Recommendation
v3_stats = results.get("DeepSeek-V3.1", {})
r1_stats = results.get("DeepSeek-R1-0528", {})

print(f"\n{'='*50}")
print("🎯 RECOMMENDATION FOR FLEXICLI:")
print('='*50)

if v3_stats and r1_stats:
    v3_better = (
        v3_stats.get('avg_score', 0) >= r1_stats.get('avg_score', 0) * 0.9 and  # Similar quality
        v3_stats.get('avg_time', float('inf')) < r1_stats.get('avg_time', float('inf'))  # Faster
    )

    if v3_better:
        speedup = r1_stats.get('avg_time', 1) / v3_stats.get('avg_time', 1)
        token_savings = (1 - v3_stats.get('total_tokens', 0) / r1_stats.get('total_tokens', 1)) * 100
        print(f"\n✅ Use DeepSeek-V3.1")
        print(f"  - {speedup:.1f}x faster response times")
        print(f"  - {token_savings:.0f}% fewer tokens used")
        print(f"  - Better for quick, direct responses")
        print(f"  - Ideal for tool calling and code generation")
    else:
        print(f"\n✅ Use DeepSeek-R1-0528")
        print(f"  - Higher quality reasoning")
        print(f"  - Better for complex analysis")