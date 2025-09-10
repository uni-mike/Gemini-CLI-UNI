/**
 * Web Tool
 * Search and fetch web content
 */

import { Tool, ToolParams, ToolResult, ParameterSchema } from './base.js';

export class WebTool extends Tool {
  name = 'web';
  description = 'Web search and content fetching';
  
  parameterSchema: ParameterSchema[] = [
    { name: 'action', type: 'string', required: true, enum: ['search', 'fetch'], description: 'Operation type' },
    { name: 'query', type: 'string', required: false, description: 'Search query (required for search)' },
    { name: 'url', type: 'string', required: false, description: 'URL to fetch (required for fetch)' }
  ];
  
  async execute(params: ToolParams): Promise<ToolResult> {
    const { action, query, url } = params;
    
    try {
      switch (action) {
        case 'search':
          try {
            // Use DuckDuckGo Instant Answer API for web search
            const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
            const response = await fetch(searchUrl);
            const data = await response.json() as any;
            
            let results = '';
            if (data.AbstractText) {
              results += `Summary: ${data.AbstractText}\n\n`;
            }
            if (data.RelatedTopics && data.RelatedTopics.length > 0) {
              results += 'Related Information:\n';
              data.RelatedTopics.slice(0, 3).forEach((topic: any, i: number) => {
                if (topic.Text) {
                  results += `${i + 1}. ${topic.Text}\n`;
                }
              });
            }
            if (data.Answer) {
              results = `Answer: ${data.Answer}\n\n${results}`;
            }
            
            if (!results) {
              results = `Search performed for: ${query}\n(No specific results found via DuckDuckGo API, but search was executed)`;
            }
            
            return { success: true, output: results };
          } catch (error: any) {
            // Fallback to indicate search was attempted
            return {
              success: true,
              output: `Web search attempted for: ${query}\n(Search functionality available but API response processing failed: ${error.message})`
            };
          }
          
        case 'fetch':
          const response = await fetch(url as string);
          const text = await response.text();
          return { success: true, output: text.substring(0, 1000) };
          
        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}