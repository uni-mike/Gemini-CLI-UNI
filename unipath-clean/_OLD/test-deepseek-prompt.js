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

async function testPrompt(systemPrompt, userMessage) {
  const url = `${ENDPOINT}/chat/completions?api-version=${API_VERSION}`;
  
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];

  console.log('\n🔵 SYSTEM PROMPT:\n', systemPrompt);
  console.log('\n🟢 USER MESSAGE:', userMessage);
  
  try {
    const response = await fetch(url, {
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

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'No response';
    console.log('\n🟡 DEEPSEEK RESPONSE:\n', content);
    
    // Simulate tool execution
    if (content.includes('web_search')) {
      console.log('\n🔧 SIMULATING TOOL EXECUTION...');
      const toolResult = `Tool results:
web_search: Answer: ** 112,767.92 USD

1. **Bitcoin price today, BTC to USD live price, marketcap ...
📰 Source: CoinMarketCap
The live Bitcoin price today is $112,767.92 USD with a 24-hour trading volume of $45,234,567,890 USD.

2. **Bitcoin Price Today | BTC to USD Live Price, Market Cap...  
📰 Source: Binance
Bitcoin BTC price graph info 24 hours, market cap, and supply. Price: $112,845 USD`;

      // Now ask for summary with tool results
      messages.push({ role: 'assistant', content });
      messages.push({ role: 'user', content: toolResult });
      
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
      const summary = data2.choices?.[0]?.message?.content || 'No summary';
      console.log('\n🟣 DEEPSEEK SUMMARY AFTER TOOLS:\n', summary);
    }
    
    return content;
  } catch (error) {
    console.error('Error:', error);
  }
}

// Test different prompts
async function runTests() {
  console.log('='.repeat(80));
  console.log('TEST 1: Basic prompt');
  console.log('='.repeat(80));
  
  await testPrompt(
    `You are UNIPATH CLI. When using tools, always provide a clear summary after.
Available tools:
- web_search: Search the internet

After using web_search for prices, ALWAYS say: "Bottom Line: [Asset] is at $[price] USD"`,
    'What is the Bitcoin price?'
  );

  console.log('\n' + '='.repeat(80));
  console.log('TEST 2: More explicit prompt');
  console.log('='.repeat(80));
  
  await testPrompt(
    `You are UNIPATH CLI. 

WORKFLOW:
1. Execute the requested tool
2. After receiving tool results, provide a CLEAR SUMMARY

For price queries: You MUST respond with "Bottom Line: [Asset] is currently at $[price] USD"

Available tools:
- web_search: Search the internet

Example:
User: Bitcoin price?
<tool_use>
tool_name: web_search
arguments: {"query": "Bitcoin price USD"}
</tool_use>
[After tool results come back]
Bottom Line: Bitcoin is currently at $112,767 USD`,
    'What is the Bitcoin price?'
  );

  console.log('\n' + '='.repeat(80));
  console.log('TEST 3: Even more explicit');
  console.log('='.repeat(80));
  
  await testPrompt(
    `You are UNIPATH CLI.

When asked about prices:
1. Use web_search tool
2. Wait for results
3. MANDATORY: Respond with exactly this format: "Bottom Line: [Asset] is currently at $[price] USD"

Available tools:
- web_search: Search the internet

Your response AFTER tool execution MUST include the phrase "Bottom Line:"`,
    'Bitcoin price'
  );
}

runTests();