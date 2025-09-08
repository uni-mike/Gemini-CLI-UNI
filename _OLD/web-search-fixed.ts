/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ToolInvocation, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import { ToolErrorType } from './tool-error.js';
import { getErrorMessage } from '../utils/errors.js';
import { type Config } from '../config/config.js';

/**
 * Parameters for the WebSearchTool.
 */
export interface WebSearchToolParams {
  query: string;
}

/**
 * Simple web search result interface
 */
export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Extends ToolResult to include sources for web search.
 */
export interface WebSearchToolResult extends ToolResult {
  results?: WebSearchResult[];
}

class WebSearchToolInvocation extends BaseToolInvocation<
  WebSearchToolParams,
  WebSearchToolResult
> {
  constructor(
    params: WebSearchToolParams,
  ) {
    super(params);
  }

  override getDescription(): string {
    return `Searching the web for: "${this.params.query}"`;
  }

  async execute(signal: AbortSignal): Promise<WebSearchToolResult> {
    try {
      // Use DuckDuckGo instant answer API (no API key required)
      const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(this.params.query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
      
      console.log(`🔍 Searching web for: "${this.params.query}"`);
      
      const response = await fetch(searchUrl, {
        signal,
        headers: {
          'User-Agent': 'UNIPATH CLI WebSearch Tool 1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Format results from DuckDuckGo API
      const results: WebSearchResult[] = [];
      
      // Add instant answer if available
      if (data.Answer) {
        results.push({
          title: 'Instant Answer',
          url: data.AnswerURL || 'https://duckduckgo.com',
          snippet: data.Answer
        });
      }
      
      // Add abstract if available
      if (data.Abstract) {
        results.push({
          title: data.AbstractSource || 'Reference',
          url: data.AbstractURL || 'https://duckduckgo.com',
          snippet: data.Abstract
        });
      }
      
      // Add related topics
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        data.RelatedTopics.slice(0, 3).forEach((topic: any) => {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || 'Related Topic',
              url: topic.FirstURL,
              snippet: topic.Text
            });
          }
        });
      }

      if (results.length === 0) {
        return {
          llmContent: `No specific results found for "${this.params.query}". This might be a very specific or recent query. Try rephrasing or using different keywords.`,
          returnDisplay: `No results found for "${this.params.query}".`,
          results: []
        };
      }

      // Format results for display
      const formattedResults = results.map((result, index) => 
        `${index + 1}. **${result.title}**\n   ${result.snippet}\n   Source: ${result.url}\n`
      ).join('\n');

      return {
        llmContent: `Web search results for "${this.params.query}":\n\n${formattedResults}`,
        returnDisplay: `Found ${results.length} result(s) for "${this.params.query}".`,
        results
      };

    } catch (error: unknown) {
      const errorMessage = `Error during web search for query "${this.params.query}": ${getErrorMessage(error)}`;
      console.error(errorMessage, error);
      
      return {
        llmContent: `❌ Web search failed: ${errorMessage}\n\nNote: UNIPATH CLI web search uses DuckDuckGo API. If this persists, check your internet connection.`,
        returnDisplay: `Error performing web search.`,
        error: {
          message: errorMessage,
          type: ToolErrorType.WEB_SEARCH_FAILED,
        },
      };
    }
  }
}

/**
 * A fixed web search tool that works with DeepSeek R1 and any model.
 * Uses DuckDuckGo API instead of Google Search (which requires Gemini).
 */
export class WebSearchToolFixed extends BaseDeclarativeTool<
  WebSearchToolParams,
  WebSearchToolResult
> {
  static readonly Name: string = 'web_search';

  constructor(config: Config) {
    super(
      WebSearchToolFixed.Name,
      'WebSearch',
      'Performs a web search using DuckDuckGo API and returns the results. Works with any AI model including DeepSeek R1.',
      Kind.Search,
      {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find information on the web.',
          },
        },
        required: ['query'],
      },
    );
    // Config parameter required by base class but not used here
    void config;
  }

  protected override validateToolParamValues(
    params: WebSearchToolParams,
  ): string | null {
    if (!params.query || params.query.trim() === '') {
      return "The 'query' parameter cannot be empty.";
    }
    return null;
  }

  protected createInvocation(
    params: WebSearchToolParams,
  ): ToolInvocation<WebSearchToolParams, WebSearchToolResult> {
    return new WebSearchToolInvocation(params);
  }
}