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

# Complex prompt similar to what the CLI is using
complex_prompt = """Create a complete Todo application with React frontend and Express backend. Include:
1) Backend API with CRUD operations for todos (Express + TypeScript)
2) Frontend with React and TypeScript
3) SQLite database with Prisma ORM
4) Authentication with JWT
5) Tests for API endpoints
6) Docker compose setup
7) README with setup instructions
8) Search for best practices online first

Return a JSON response with the structure:
{
  "type": "tasks",
  "tasks": [
    {
      "tool": "web",
      "parameters": {...}
    },
    {
      "tool": "bash",
      "parameters": {...}
    },
    {
      "tool": "file",
      "parameters": {...}
    }
  ]
}
"""

print("=" * 60)
print("DEEPSEEK-V3.1 TIMEOUT TEST")
print("=" * 60)
print(f"Testing with 5-minute timeout (300 seconds)")
print(f"Prompt length: {len(complex_prompt)} characters")
print("=" * 60)

start = time.time()
try:
    print(f"[{time.strftime('%H:%M:%S')}] Sending request to DeepSeek-V3.1...")

    completion = client.chat.completions.create(
        model='DeepSeek-V3.1',
        messages=[
            {
                'role': 'user',
                'content': complex_prompt,
            }
        ],
        temperature=0,
        max_tokens=2000,
        timeout=300  # 5 minutes
    )

    elapsed = time.time() - start

    print(f"\n✅ SUCCESS in {elapsed:.2f} seconds!")
    print("-" * 60)

    response = completion.choices[0].message.content
    print(f"Response length: {len(response)} characters")
    print(f"Token usage:")
    print(f"  - Prompt tokens: {completion.usage.prompt_tokens}")
    print(f"  - Completion tokens: {completion.usage.completion_tokens}")
    print(f"  - Total tokens: {completion.usage.total_tokens}")

    print("\nFirst 500 chars of response:")
    print(response[:500])

    # Try to parse as JSON
    try:
        parsed = json.loads(response)
        print("\n✅ Response is valid JSON")
        if "tasks" in parsed:
            print(f"Number of tasks: {len(parsed['tasks'])}")
    except:
        print("\n⚠️ Response is not valid JSON (might be markdown wrapped)")

except Exception as e:
    elapsed = time.time() - start
    print(f"\n❌ FAILED after {elapsed:.2f} seconds")
    print(f"Error type: {type(e).__name__}")
    print(f"Error message: {e}")

print("\n" + "=" * 60)
print("TEST COMPLETE")
print("=" * 60)