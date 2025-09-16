import numpy as np

def create_embedding(text):
    """Create a simple embedding vector for demonstration"""
    # Simple hash-based embedding for demonstration
    embedding = np.zeros(10)
    for i, char in enumerate(text):
        if i < 10:
            embedding[i] = ord(char) % 100 / 100.0
    return embedding

# Test the embedding function
test_text = "hello world"
embedding = create_embedding(test_text)
print(f"Text: {test_text}")
print(f"Embedding: {embedding}")
print(f"Embedding shape: {embedding.shape}")