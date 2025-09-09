/**
 * Parser for DeepSeek messages and tool calls
 * Handles multiple formats DeepSeek might use
 */

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

export class DeepSeekMessageParser {
  // Regex patterns for different tool call formats
  private readonly patterns = {
    // Format: <tool_use>tool_name: xxx\narguments: {...}</tool_use>
    toolUse: /<tool_use>\s*tool_name:\s*(\w+)\s*arguments:\s*({[\s\S]*?})\s*<\/tool_use>/gm,
    
    // Format: function: xxx\n```json\n{...}\n```
    functionJson: /function:\s*(\w+)\s*\n*```json\n*({[\s\S]*?})\n*```/gm,
    
    // Format: function: xxx\n{...}
    functionDirect: /function:\s*(\w+)\s*\n\s*({[^}]+})/gm,
    
    // Legacy format with numbers
    functionNumbered: /function:\s*(\w+)\s*\n\s*\d+\s+({[^}]+})/gm,
  };

  /**
   * Parse tool calls from DeepSeek response
   */
  parseToolCalls(content: string): ToolCall[] {
    const tools: ToolCall[] = [];
    
    // Try each pattern in order of preference
    for (const [formatName, pattern] of Object.entries(this.patterns)) {
      const matches = [...content.matchAll(pattern)];
      
      if (matches.length > 0) {
        console.log(`Found ${matches.length} tool calls using ${formatName} format`);
        
        for (const match of matches) {
          const toolCall = this.parseMatch(match);
          if (toolCall) {
            tools.push(toolCall);
          }
        }
        
        // If we found matches with one pattern, don't try others
        if (tools.length > 0) {
          break;
        }
      }
    }
    
    // Deduplicate tool calls (in case of repeated calls)
    return this.deduplicateTools(tools);
  }

  /**
   * Parse a single regex match into a tool call
   */
  private parseMatch(match: RegExpMatchArray): ToolCall | null {
    try {
      const name = match[1];
      const argsString = match[2];
      
      // Parse arguments JSON
      let args: Record<string, any>;
      
      try {
        args = JSON.parse(argsString);
      } catch (e) {
        // Try to fix common JSON issues
        const fixed = this.fixJson(argsString);
        args = JSON.parse(fixed);
      }
      
      return { name, arguments: args };
    } catch (error) {
      console.error(`Failed to parse tool call: ${error}`);
      console.error(`Match content: ${match[0]}`);
      return null;
    }
  }

  /**
   * Fix common JSON formatting issues
   */
  private fixJson(json: string): string {
    return json
      // Escape newlines in string values
      .replace(/:\s*"([^"]*)\n([^"]*)"/, ':"$1\\n$2"')
      // Escape unescaped quotes
      .replace(/([^\\])"/g, '$1\\"')
      // Remove trailing commas
      .replace(/,\s*}/, '}')
      .replace(/,\s*]/, ']')
      // Ensure proper escaping
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Remove duplicate tool calls
   */
  private deduplicateTools(tools: ToolCall[]): ToolCall[] {
    const seen = new Set<string>();
    const unique: ToolCall[] = [];
    
    for (const tool of tools) {
      const key = `${tool.name}:${JSON.stringify(tool.arguments)}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(tool);
      } else {
        console.log(`Skipping duplicate tool call: ${tool.name}`);
      }
    }
    
    return unique;
  }

  /**
   * Check if response contains tool calls
   */
  hasToolCalls(content: string): boolean {
    for (const pattern of Object.values(this.patterns)) {
      if (pattern.test(content)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Extract thinking process from response
   */
  extractThinking(content: string): string {
    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/i) ||
                       content.match(/<THINK>([\s\S]*?)<\/THINK>/i);
    
    return thinkMatch ? thinkMatch[1].trim() : '';
  }

  /**
   * Extract main message (without thinking or tool calls)
   */
  extractMessage(content: string): string {
    let cleaned = content;
    
    // Remove thinking tags
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<THINK>[\s\S]*?<\/THINK>/gi, '');
    
    // Remove tool calls
    for (const pattern of Object.values(this.patterns)) {
      cleaned = cleaned.replace(pattern, '');
    }
    
    return cleaned.trim();
  }

  /**
   * Check if message indicates continuation is needed
   */
  needsContinuation(content: string): boolean {
    const markers = [
      '<needs_continuation/>',
      'CONTINUE_NEEDED',
      'continue_execution',
      'will continue',
      'proceeding with next'
    ];
    
    const lowerContent = content.toLowerCase();
    return markers.some(marker => lowerContent.includes(marker.toLowerCase()));
  }
}