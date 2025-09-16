#!/usr/bin/env python3

from openai import OpenAI
import time

endpoint = "https://unipathai7556217047.services.ai.azure.com/openai/v1/"
api_key = "9c5d0679299045e9bd3513baf6ae0e86"

client = OpenAI(
    base_url=endpoint,
    api_key=api_key
)

# Test both models
models = ["DeepSeek-R1-0528", "DeepSeek-V3.1"]

for model in models:
    print(f"\n=== Testing {model} ===")
    try:
        start = time.time()
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": "What is 2+2? Answer with just the number.",
                }
            ],
            temperature=0,
            max_tokens=50
        )

        elapsed = time.time() - start

        print(f"✅ Success in {elapsed:.2f}s")
        print(f"Content: {completion.choices[0].message.content}")

        # Check for reasoning_content (specific to R1)
        if hasattr(completion.choices[0].message, 'reasoning_content'):
            print(f"Reasoning: {completion.choices[0].message.reasoning_content[:100] if completion.choices[0].message.reasoning_content else 'None'}...")

        print(f"Tokens: {completion.usage.total_tokens}")

    except Exception as e:
        print(f"❌ Error: {e}")