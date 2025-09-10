/**
 * Web Tool - Enhanced with SerpAPI for real Google search results
 * Search and fetch web content using SerpAPI
 */

import { Tool, ToolParams, ToolResult, ParameterSchema } from './base.js';

const SERPAPI_KEY = '44608547a3c72872ff9cf50c518ce3b0a44f85b7348bfdda1a5b3d0da302237f';

export class WebTool extends Tool {
  name = 'web';
  description = 'Real web search using SerpAPI (Google search) and content fetching';
  
  parameterSchema: ParameterSchema[] = [
    { name: 'action', type: 'string', required: true, enum: ['search', 'fetch'], description: 'Operation type' },
    { name: 'query', type: 'string', required: false, description: 'Search query (required for search)' },
    { name: 'url', type: 'string', required: false, description: 'URL to fetch (required for fetch)' },
    { name: 'max_results', type: 'number', required: false, description: 'Maximum search results (1-10, default: 5)' },
    { name: 'search_type', type: 'string', required: false, enum: ['general', 'news'], description: 'Search type (default: general)' }
  ];
  
  async execute(params: ToolParams): Promise<ToolResult> {
    const { action, query, url, max_results, search_type } = params;
    
    try {
      switch (action) {
        case 'search':
          try {
            const maxResults = params.max_results || 5;
            const searchType = params.search_type || 'general';
            
            // Build SerpAPI URL
            let engine = 'google';
            let additionalParams = '';
            
            if (searchType === 'news') {
              additionalParams = '&tbm=nws';
            }
            
            const searchUrl = `https://serpapi.com/search.json?engine=${engine}&q=${encodeURIComponent(query)}&api_key=${SERPAPI_KEY}&num=${maxResults}${additionalParams}`;
            
            const response = await fetch(searchUrl);
            if (!response.ok) {
              throw new Error(`SerpAPI error: ${response.status}`);
            }
            
            const data = await response.json() as any;
            let results = '';
            let answer = '';
            
            // Extract direct answer from answer box (great for prices, facts)
            if (data.answer_box) {
              if (data.answer_box.answer) {
                answer = data.answer_box.answer;
              } else if (data.answer_box.result) {
                answer = `${data.answer_box.result}${data.answer_box.currency ? ' ' + data.answer_box.currency : ''}`;
              } else if (data.answer_box.snippet) {
                answer = data.answer_box.snippet;
              }
            }
            
            if (answer) {
              results += `📊 Direct Answer: ${answer}\n\n`;
            }
            
            // Extract organic search results
            if (data.organic_results && Array.isArray(data.organic_results)) {
              results += '🔍 Search Results:\n';
              data.organic_results.slice(0, maxResults).forEach((result: any, i: number) => {
                results += `${i + 1}. **${result.title || 'No title'}**\n`;
                results += `   ${result.snippet || 'No description'}\n`;
                results += `   🔗 ${result.link || ''}\n\n`;
              });
            }
            
            // Handle news results
            if (data.news_results && Array.isArray(data.news_results)) {
              results += '📰 News Results:\n';
              data.news_results.slice(0, maxResults).forEach((result: any, i: number) => {
                results += `${i + 1}. **${result.title || 'No title'}**\n`;
                if (result.date) results += `   📅 ${result.date}\n`;
                if (result.source?.name) results += `   📰 ${result.source.name}\n`;
                results += `   ${result.snippet || 'No description'}\n`;
                results += `   🔗 ${result.link || ''}\n\n`;
              });
            }
            
            if (!answer && (!data.organic_results || data.organic_results.length === 0) && (!data.news_results || data.news_results.length === 0)) {
              results = `No results found for: ${query}\nTry different keywords or check spelling.`;
            }
            
            return { success: true, output: results.trim() };
            
          } catch (error: any) {
            return {
              success: false,
              error: `Web search failed: ${error.message}`
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