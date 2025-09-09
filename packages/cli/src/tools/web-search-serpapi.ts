/**
 * SerpAPI Web Search Tool - Production-ready web search using SerpAPI
 * Supports Google search with real results
 */

import type { ToolInvocation, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import { ToolErrorType } from './tool-error.js';
import { getErrorMessage } from '../utils/errors.js';
import { type Config } from '../config/core-config.js';

const SERPAPI_KEY = '44608547a3c72872ff9cf50c518ce3b0a44f85b7348bfdda1a5b3d0da302237f';

export interface SerpAPIWebSearchParams {
  query: string;
  max_results?: number;
  search_type?: 'general' | 'news' | 'images' | 'videos' | 'scholar';
}

export interface SerpAPISearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  date?: string;
}

export interface SerpAPIWebSearchResult extends ToolResult {
  results?: SerpAPISearchResult[];
  answer?: string;
  total_results?: number;
}

class SerpAPIWebSearchInvocation extends BaseToolInvocation<
  SerpAPIWebSearchParams,
  SerpAPIWebSearchResult
> {
  constructor(params: SerpAPIWebSearchParams) {
    super(params);
  }

  override getDescription(): string {
    return `Searching the web for: "${this.params.query}"`;
  }

  async execute(signal: AbortSignal): Promise<SerpAPIWebSearchResult> {
    try {
      const maxResults = this.params.max_results || 5;
      const searchType = this.params.search_type || 'general';
      
      console.log(`🔍 Searching web via SerpAPI for: "${this.params.query}" (type: ${searchType})`);
      
      // Build the API URL based on search type
      let engine = 'google';
      let additionalParams = '';
      
      switch (searchType) {
        case 'news':
          additionalParams = '&tbm=nws';
          break;
        case 'images':
          additionalParams = '&tbm=isch';
          break;
        case 'videos':
          additionalParams = '&tbm=vid';
          break;
        case 'scholar':
          engine = 'google_scholar';
          break;
      }
      
      const searchUrl = `https://serpapi.com/search.json?engine=${engine}&q=${encodeURIComponent(this.params.query)}&api_key=${SERPAPI_KEY}&num=${maxResults}${additionalParams}`;
      
      const response = await fetch(searchUrl, {
        signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`SerpAPI error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const results: SerpAPISearchResult[] = [];
      let answer: string | undefined;
      
      // Extract answer box if available
      if (data.answer_box) {
        if (data.answer_box.answer) {
          answer = data.answer_box.answer;
        } else if (data.answer_box.result) {
          answer = `${data.answer_box.result}${data.answer_box.currency ? ' ' + data.answer_box.currency : ''}`;
        } else if (data.answer_box.snippet) {
          answer = data.answer_box.snippet;
        }
      }
      
      // Extract organic results
      if (data.organic_results && Array.isArray(data.organic_results)) {
        for (const result of data.organic_results) {
          results.push({
            title: result.title || 'No title',
            url: result.link || '',
            snippet: result.snippet || 'No description',
            source: result.source,
            date: result.date
          });
        }
      }
      
      // For news results
      if (data.news_results && Array.isArray(data.news_results)) {
        for (const result of data.news_results) {
          results.push({
            title: result.title || 'No title',
            url: result.link || '',
            snippet: result.snippet || 'No description',
            source: result.source?.name,
            date: result.date
          });
        }
      }
      
      // For scholar results
      if (data.organic_results && engine === 'google_scholar') {
        for (const result of data.organic_results) {
          results.push({
            title: result.title || 'No title',
            url: result.link || '',
            snippet: result.snippet || result.publication_info?.summary || 'No description',
            source: result.publication_info?.authors?.join(', '),
            date: result.publication_info?.citation
          });
        }
      }
      
      // Format results for display
      let formattedResults = '';
      
      if (answer) {
        formattedResults = `📊 **Direct Answer:** ${answer}\n\n`;
      }
      
      if (results.length > 0) {
        formattedResults += '📰 **Search Results:**\n\n';
        results.forEach((result, index) => {
          formattedResults += `${index + 1}. **${result.title}**\n`;
          if (result.date) formattedResults += `   📅 ${result.date}\n`;
          if (result.source) formattedResults += `   📰 Source: ${result.source}\n`;
          formattedResults += `   ${result.snippet}\n`;
          formattedResults += `   🔗 ${result.url}\n\n`;
        });
      }
      
      if (!answer && results.length === 0) {
        return {
          llmContent: `No results found for "${this.params.query}". Try different keywords.`,
          returnDisplay: `No results found.`,
          results: []
        };
      }

      return {
        llmContent: formattedResults || 'No results found',
        returnDisplay: `Found ${results.length} result(s) for "${this.params.query}"${answer ? ' with direct answer' : ''}.`,
        results,
        answer,
        total_results: data.search_information?.total_results
      };

    } catch (error: unknown) {
      const errorMessage = `SerpAPI search error: ${getErrorMessage(error)}`;
      console.error(errorMessage, error);
      
      return {
        llmContent: `❌ Web search failed: ${errorMessage}`,
        returnDisplay: `Search failed.`,
        error: {
          message: errorMessage,
          type: ToolErrorType.WEB_SEARCH_FAILED,
        },
        results: []
      };
    }
  }
}

/**
 * SerpAPI-powered web search tool
 */
export class SerpAPIWebSearchTool extends BaseDeclarativeTool<
  SerpAPIWebSearchParams,
  SerpAPIWebSearchResult
> {
  static readonly Name: string = 'web_search';

  constructor(config: Config) {
    super(
      SerpAPIWebSearchTool.Name,
      'WebSearch',
      'Performs web search using SerpAPI (Google search) and returns real results with snippets, URLs, and direct answers when available.',
      Kind.Search,
      {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query.',
          },
          max_results: {
            type: 'number',
            description: 'Maximum number of results (1-10, default: 5)',
          },
          search_type: {
            type: 'string',
            enum: ['general', 'news', 'images', 'videos', 'scholar'],
            description: 'Type of search (default: general)',
          },
        },
        required: ['query'],
      },
    );
    void config;
  }

  protected override validateToolParamValues(
    params: SerpAPIWebSearchParams,
  ): string | null {
    if (!params.query || params.query.trim() === '') {
      return "The 'query' parameter cannot be empty.";
    }
    if (params.max_results && (params.max_results < 1 || params.max_results > 10)) {
      return "The 'max_results' must be between 1 and 10.";
    }
    return null;
  }

  protected createInvocation(
    params: SerpAPIWebSearchParams,
  ): ToolInvocation<SerpAPIWebSearchParams, SerpAPIWebSearchResult> {
    return new SerpAPIWebSearchInvocation(params);
  }
}