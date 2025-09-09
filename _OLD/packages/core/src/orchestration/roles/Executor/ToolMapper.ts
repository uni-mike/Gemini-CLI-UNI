import type { ToolCall } from '../../types.js';

interface ToolPattern {
  patterns: string[];
  tool: string;
  extractArgs: (desc: string) => any;
}

export class ToolMapper {
  private toolPatterns: ToolPattern[] = [
    {
      patterns: ['search for', 'find', 'look for', 'grep'],
      tool: 'search_file_content',
      extractArgs: (desc: string) => {
        const match = desc.match(/(?:search|find|look)\s+(?:for\s+)?['"]?([^'"]+)['"]?/i);
        return { pattern: match?.[1] || desc };
      }
    },
    {
      patterns: ['read file', 'open file', 'view file', 'read the'],
      tool: 'read_file',
      extractArgs: (desc: string) => {
        const match = desc.match(/(?:read|open|view)\s+(?:the\s+)?(?:file\s+)?(\S+)/i);
        return { file_path: match?.[1] || '' };
      }
    },
    {
      patterns: ['write to', 'create file', 'save to', 'create a new file'],
      tool: 'write_file',
      extractArgs: (desc: string) => {
        const match = desc.match(/(?:write|create|save)\s+(?:to\s+)?(?:a\s+)?(?:new\s+)?(?:file\s+)?(?:called\s+)?(\S+)/i);
        return { file_path: match?.[1] || '', content: '' };
      }
    },
    {
      patterns: ['edit file', 'modify', 'update file', 'change', 'edit the'],
      tool: 'edit_file',
      extractArgs: (desc: string) => {
        const match = desc.match(/(?:edit|modify|update|change)\s+(?:the\s+)?(?:file\s+)?(\S+)/i);
        return { file_path: match?.[1] || '' };
      }
    },
    {
      patterns: ['run command:', 'execute', 'shell', 'run `'],
      tool: 'shell',
      extractArgs: (desc: string) => {
        const match = desc.match(/(?:run|execute)\s+(?:command:\s+)?[`"]?([^`"]+)[`"]?/i);
        return { command: match?.[1] || desc };
      }
    },
    {
      patterns: ['install', 'npm install', 'pip install'],
      tool: 'shell',
      extractArgs: (desc: string) => {
        const match = desc.match(/((?:npm|pip|yarn)\s+install\s+\S+)/i);
        return { command: match?.[1] || `npm install ${desc.split(' ').pop()}` };
      }
    },
    {
      patterns: ['test', 'run tests', 'npm test'],
      tool: 'shell',
      extractArgs: (desc: string) => {
        const match = desc.match(/(?:run\s+)?test[s]?\s*(\S+)?/i);
        return { command: match?.[1] || 'npm test' };
      }
    },
    {
      patterns: ['web search', 'search online', 'google', 'search for "'],
      tool: 'web_search',
      extractArgs: (desc: string) => {
        const match = desc.match(/(?:search|google)\s+(?:for\s+)?["']([^"']+)["']/i);
        return { query: match?.[1] || desc };
      }
    },
    {
      patterns: ['list files', 'ls', 'directory'],
      tool: 'ls',
      extractArgs: (desc: string) => {
        const match = desc.match(/(?:list|ls)\s+(?:files\s+)?(?:in\s+)?(\S+)?/i);
        return { path: match?.[1] || '.' };
      }
    },
    {
      patterns: ['check', 'verify', 'validate'],
      tool: 'shell',
      extractArgs: (desc: string) => {
        const match = desc.match(/(?:check|verify|validate)\s+(.+)/i);
        return { command: match?.[1] || 'echo "Checking..."' };
      }
    },
    {
      patterns: ['analyze', 'review', 'audit'],
      tool: 'analyze',
      extractArgs: (desc: string) => {
        const match = desc.match(/(?:analyze|review|audit)\s+(.+)/i);
        return { target: match?.[1] || 'codebase' };
      }
    }
  ];

  /**
   * Maps task description to tool calls
   */
  identifyToolCalls(description: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    const lowerDesc = description.toLowerCase();
    
    // Find matching patterns
    for (const { patterns, tool, extractArgs } of this.toolPatterns) {
      if (patterns.some(p => lowerDesc.includes(p))) {
        toolCalls.push({
          name: tool,
          args: extractArgs(description)
        });
        break; // Only match first pattern
      }
    }
    
    // If no pattern matched, try to infer from description
    if (toolCalls.length === 0) {
      toolCalls.push(this.inferToolCall(description));
    }
    
    return toolCalls;
  }

  private inferToolCall(description: string): ToolCall {
    // Default to search if we can't determine
    return {
      name: 'search_file_content',
      args: { pattern: description.split(' ').slice(0, 3).join(' ') }
    };
  }
}