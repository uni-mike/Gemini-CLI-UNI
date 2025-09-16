# API Integration Details

## Azure DeepSeek Endpoint

### Configuration
- **Endpoint**: `https://unipathai7556217047.services.ai.azure.com/models`
- **API Version**: `2024-05-01-preview`
- **Model**: `DeepSeek-R1-0528`

### Request Format
```javascript
URL: ${endpoint}/chat/completions?api-version=${apiVersion}

Headers:
  'Content-Type': 'application/json'
  'api-key': ${API_KEY}  // Azure uses api-key, not Authorization Bearer

Body:
{
  messages: [
    { role: 'system', content: '...' },
    { role: 'user', content: '...' }
  ],
  model: 'DeepSeek-R1-0528',
  temperature: 0.7,
  stream: false,
  tools: [...] // optional
}
```

### Common Issues
1. **404 Error**: Don't append model to endpoint URL - it's already included
2. **401 Error**: Use 'api-key' header, not 'Authorization: Bearer'
3. **400 Error**: Ensure model is in request body

## Environment Variables
```bash
API_KEY=your_api_key
ENDPOINT=https://your-resource.services.ai.azure.com/models
API_VERSION=2024-05-01-preview
MODEL=DeepSeek-R1-0528
APPROVAL_MODE=yolo
```