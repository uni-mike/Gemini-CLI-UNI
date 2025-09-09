import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.deepseek') });

const ENDPOINT = process.env.ENDPOINT;
const API_KEY = process.env.API_KEY;
const MODEL = process.env.MODEL;
const API_VERSION = process.env.API_VERSION;

async function testRealFlow() {
  const url = `${ENDPOINT}/chat/completions?api-version=${API_VERSION}`;
  
  const systemPrompt = `You are UNIPATH CLI. Complete tasks efficiently with minimal tool usage.

TOOL FORMAT:
<tool_use>
tool_name: [exact_name]
arguments: {"param": "value"}
</tool_use>

CRITICAL RULES:
1. Use web_search for internet queries (Bitcoin price, weather, news)
2. After executing tools, ALWAYS provide a concise summary
3. For price queries: State "Bottom Line: [Asset] is currently at $[price] USD"

Available tools:
- web_search: Search the internet for information`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'What is the current Bitcoin price?' }
  ];

  console.log('🟢 INITIAL REQUEST: What is the current Bitcoin price?\n');
  
  // First call - should return tool use
  const response1 = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      messages,
      model: MODEL,
      temperature: 0.7,
    })
  });

  const data1 = await response1.json();
  const content1 = data1.choices?.[0]?.message?.content || 'No response';
  console.log('🟡 DEEPSEEK RESPONSE 1 (tool call):\n', content1.substring(0, 500), '\n');
  
  // Add assistant response
  messages.push({ role: 'assistant', content: content1 });
  
  // Simulate tool execution result
  const toolResult = `Tool results:
web_search: Answer: ** 112,767.92 USD

1. **Bitcoin price today, BTC to USD live price, marketcap ...
📰 Source: CoinMarketCap
The live Bitcoin price today is $112,767.92 USD with a 24-hour trading volume of $45,234,567,890 USD.

2. **Bitcoin Price Today | BTC to USD Live Price, Market Cap...  
📰 Source: Binance
Bitcoin BTC price graph info 24 hours, market cap, and supply. Price: $112,845 USD`;

  messages.push({ role: 'user', content: toolResult });
  
  console.log('🔧 TOOL RESULTS PROVIDED\n');
  
  // Second call - should provide summary
  const response2 = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      messages,
      model: MODEL,
      temperature: 0.7,
    })
  });

  const data2 = await response2.json();
  const content2 = data2.choices?.[0]?.message?.content || 'No response';
  console.log('🟣 DEEPSEEK RESPONSE 2 (summary):\n', content2);
  
  // Check if it has bottom line
  if (content2.toLowerCase().includes('bottom line')) {
    console.log('\n✅ SUCCESS: Bottom line found in response!');
  } else {
    console.log('\n❌ FAILED: No bottom line in response');
  }
}

testRealFlow().catch(console.error);