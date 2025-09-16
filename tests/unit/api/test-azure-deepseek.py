#!/usr/bin/env python3

from openai import OpenAI
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration from environment
endpoint = "https://unipathai7556217047.services.ai.azure.com/openai/v1/"
model_name = "DeepSeek-R1-0528"
deployment_name = "DeepSeek-R1-0528"
api_key = "9c5d0679299045e9bd3513baf6ae0e86"

print(f"Testing Azure DeepSeek endpoint...")
print(f"Endpoint: {endpoint}")
print(f"Deployment: {deployment_name}")
print(f"API Key: {api_key[:10]}...")
print()

try:
    client = OpenAI(
        base_url=endpoint,
        api_key=api_key
    )

    print("Sending request...")
    completion = client.chat.completions.create(
        model=deployment_name,
        messages=[
            {
                "role": "user",
                "content": "What is 2+2?",
            }
        ],
        temperature=0,
        max_tokens=10
    )

    print("Success!")
    print(f"Full completion object: {completion}")
    print(f"Choices: {completion.choices}")
    if completion.choices:
        print(f"Message: {completion.choices[0].message}")
        print(f"Content: {completion.choices[0].message.content}")

except Exception as e:
    print(f"Error: {e}")
    print(f"Error type: {type(e).__name__}")