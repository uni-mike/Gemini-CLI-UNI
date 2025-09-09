/**
 * System prompts and templates for DeepSeek
 * Centralized prompt management for consistency
 */

export class DeepSeekPrompts {
  /**
   * Get the main system prompt for DeepSeek
   */
  static getSystemPrompt(toolDescriptions: string): string {
    return `You are UNIPATH CLI. Complete tasks efficiently with minimal tool usage.

TOOL FORMAT (use exactly one of these formats):

Format 1 - Preferred:
<tool_use>
tool_name: [exact_name]
arguments: {"param": "value"}
</tool_use>

Format 2 - Alternative:
function: [exact_name]
\`\`\`json
{"param": "value"}
\`\`\`

CRITICAL RULES:
1. Use the MINIMUM number of tools necessary
2. NEVER call the same tool multiple times with same parameters
3. For web/internet queries: ALWAYS use web_search (NOT search_file_content)
   - web_search: For internet/web searches (Bitcoin price, weather, news)
   - search_file_content: For searching within local files only
4. For "create X with Y info": 
   - First: ONE web_search to get data
   - Then: ONE write_file with that data
5. ALWAYS use REAL content, never placeholders like "..." or "TODO"
6. Complete tasks in ONE round when possible
7. After web searches for prices/data: ALWAYS provide a clear BOTTOM LINE summary
   Example: "Bottom Line: Bitcoin is currently trading at $52,345 USD"

WORKFLOW EXAMPLES:

Example 1 - Create file with web data:
User: "create bitcoin.md with Bitcoin price"
<tool_use>
tool_name: web_search
arguments: {"query": "Bitcoin price USD current"}
</tool_use>
[After getting results]
<tool_use>
tool_name: write_file
arguments: {"file_path": "/path/bitcoin.md", "content": "# Bitcoin Price\\n\\nCurrent: $52,345\\nChange: +2.3%\\n[actual data from search]"}
</tool_use>
Bottom Line: Bitcoin is currently trading at $52,345 USD.

Example 2 - Price inquiry:
User: "Bitcoin price"
<tool_use>
tool_name: web_search
arguments: {"query": "Bitcoin BTC price USD current"}
</tool_use>
Bottom Line: Bitcoin is currently trading at $52,345 USD (up 2.3% today).

Available tools:
${toolDescriptions}

IMPORTANT: After executing tools, ALWAYS provide a concise summary with the bottom line.
For price queries: State "Bottom Line: [Asset] is currently at $[price] USD"
For other queries: Provide a clear, direct answer based on the results.

Execute immediately. Be efficient. Use real data.`;
  }

  /**
   * Get the continuation prompt when more tools are needed
   */
  static getContinuationPrompt(): string {
    return 'Please continue with the remaining tasks. Execute the next batch of tools.';
  }

  /**
   * Get prompt for complex task detection
   */
  static getComplexityAnalysisPrompt(task: string): string {
    return `Analyze if this task needs to be broken into chunks:
"${task}"

Consider:
1. Does it involve multiple unrelated operations?
2. Does it require more than 10 distinct tool calls?
3. Would breaking it down improve clarity?

Respond with: needs chunking: true/false`;
  }

  /**
   * Get prompt for task chunking
   */
  static getChunkingPrompt(task: string): string {
    return `Break this complex task into logical chunks:
"${task}"

Format as a numbered TODO list with tool requirements, then automatically begin execution of the first step.`;
  }

  /**
   * Format tool descriptions for the prompt
   */
  static formatToolDescriptions(tools: Array<{ name: string; description: string }>): string {
    return tools
      .map(tool => `- ${tool.name}: ${tool.description}`)
      .join('\n');
  }

  /**
   * Check if a response indicates continuation is needed
   */
  static needsContinuation(response: string): boolean {
    return response.includes('<needs_continuation/>') ||
           response.includes('CONTINUE_NEEDED') ||
           response.includes('continue_execution');
  }

  /**
   * Clean up DeepSeek's response formatting
   */
  static cleanResponse(response: string): string {
    return response
      // Remove DeepSeek's special tokens
      .replace(/<｜.*?｜>/g, '')
      // Remove thinking tags
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/<THINK>[\s\S]*?<\/THINK>/g, '')
      // Clean up extra whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}