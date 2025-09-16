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
 * Parameters for the Advanced WebSearchTool.
 */
export interface AdvancedWebSearchToolParams {
  query: string;
  max_results?: number;
  include_snippets?: boolean;
  search_type?: 'general' | 'news' | 'academic' | 'code' | 'recent';
  time_range?: 'day' | 'week' | 'month' | 'year' | 'all';
}

/**
 * Advanced web search result with rich metadata
 */
export interface AdvancedWebSearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  published_date?: string;
  relevance_score: number;
  content_type: 'article' | 'documentation' | 'forum' | 'news' | 'code' | 'other';
  summary?: string;
}

/**
 * Extends ToolResult to include advanced search metadata.
 */
export interface AdvancedWebSearchToolResult extends ToolResult {
  results: AdvancedWebSearchResult[];
  total_results: number;
  search_time_ms: number;
  query_suggestions?: string[];
}

class AdvancedWebSearchToolInvocation extends BaseToolInvocation<
  AdvancedWebSearchToolParams,
  AdvancedWebSearchToolResult
> {
  constructor(
    params: AdvancedWebSearchToolParams,
  ) {
    super(params);
  }

  override getDescription(): string {
    return `Performing advanced web search for: "${this.params.query}" (${this.params.search_type || 'general'})`;
  }

  async execute(signal: AbortSignal): Promise<AdvancedWebSearchToolResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Advanced web search: "${this.params.query}" (type: ${this.params.search_type || 'general'})`);
      
      const results: AdvancedWebSearchResult[] = [];
      const maxResults = this.params.max_results || 10;
      
      // Multi-source search strategy
      const searchPromises: Promise<AdvancedWebSearchResult[]>[] = [];
      
      // 1. DuckDuckGo for general results
      searchPromises.push(this.searchDuckDuckGo(this.params.query, signal));
      
      // 2. Specialized searches based on type
      switch (this.params.search_type) {
        case 'code':
          searchPromises.push(this.searchGitHubTopics(this.params.query, signal));
          break;
        case 'news':
          searchPromises.push(this.searchNewsAPI(this.params.query, signal));
          break;
        case 'academic':
          searchPromises.push(this.searchArxivAPI(this.params.query, signal));
          break;
        case 'recent':
          searchPromises.push(this.searchRecentContent(this.params.query, signal));
          break;
      }
      
      // Execute all searches in parallel
      const allResults = await Promise.allSettled(searchPromises);
      
      // Aggregate results
      for (const result of allResults) {
        if (result.status === 'fulfilled') {
          results.push(...result.value);
        }
      }
      
      // Remove duplicates and rank by relevance
      const uniqueResults = this.deduplicateAndRank(results, this.params.query);
      const finalResults = uniqueResults.slice(0, maxResults);
      
      // Generate query suggestions
      const suggestions = this.generateQuerySuggestions(this.params.query, finalResults);
      
      const searchTime = Date.now() - startTime;
      
      if (finalResults.length === 0) {
        return {
          llmContent: `🔍 **Advanced Web Search Results for: "${this.params.query}"**\n\n❌ No results found. Try:\n- Using different keywords\n- Checking spelling\n- Using broader search terms\n- Trying a different search_type parameter`,
          returnDisplay: `No results found for "${this.params.query}".`,
          results: [],
          total_results: 0,
          search_time_ms: searchTime,
        };
      }
      
      // Format results for display
      const formattedResults = this.formatResultsForDisplay(finalResults);
      
      return {
        llmContent: `🔍 **Advanced Web Search Results for: "${this.params.query}"**\n\n${formattedResults}\n\n📊 **Search Statistics:**\n- Found: ${finalResults.length} results\n- Search time: ${searchTime}ms\n- Search type: ${this.params.search_type || 'general'}\n\n${suggestions.length > 0 ? `💡 **Related searches:** ${suggestions.join(', ')}` : ''}`,
        returnDisplay: `Found ${finalResults.length} advanced results for "${this.params.query}" in ${searchTime}ms.`,
        results: finalResults,
        total_results: results.length,
        search_time_ms: searchTime,
        query_suggestions: suggestions,
      };

    } catch (error: unknown) {
      const errorMessage = `Advanced web search failed for "${this.params.query}": ${getErrorMessage(error)}`;
      console.error(errorMessage, error);
      
      return {
        llmContent: `❌ **Advanced Web Search Failed**\n\nQuery: "${this.params.query}"\nError: ${errorMessage}\n\n🔧 **Troubleshooting:**\n- Check internet connection\n- Try simpler search terms\n- Use different search_type if specified`,
        returnDisplay: `Advanced web search failed.`,
        error: {
          message: errorMessage,
          type: ToolErrorType.WEB_SEARCH_FAILED,
        },
        results: [],
        total_results: 0,
        search_time_ms: Date.now() - startTime,
      };
    }
  }
  
  private async searchDuckDuckGo(query: string, signal: AbortSignal): Promise<AdvancedWebSearchResult[]> {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
    
    try {
      const response = await fetch(url, { 
        signal, 
        headers: { 'User-Agent': 'UNIPATH CLI Advanced WebSearch 2.0' }
      });
      
      if (!response.ok) throw new Error(`DuckDuckGo API error: ${response.status}`);
      
      const data = await response.json();
      const results: AdvancedWebSearchResult[] = [];
      
      // Process instant answers
      if (data.Answer) {
        results.push({
          title: 'Instant Answer',
          url: data.AnswerURL || 'https://duckduckgo.com',
          snippet: data.Answer,
          domain: new URL(data.AnswerURL || 'https://duckduckgo.com').hostname,
          relevance_score: 0.9,
          content_type: 'other',
        });
      }
      
      // Process abstract
      if (data.Abstract) {
        results.push({
          title: data.AbstractSource || 'Reference',
          url: data.AbstractURL || 'https://duckduckgo.com',
          snippet: data.Abstract,
          domain: new URL(data.AbstractURL || 'https://duckduckgo.com').hostname,
          relevance_score: 0.8,
          content_type: 'article',
        });
      }
      
      // Process related topics
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        data.RelatedTopics.slice(0, 8).forEach((topic: any, index: number) => {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || 'Related Topic',
              url: topic.FirstURL,
              snippet: topic.Text,
              domain: new URL(topic.FirstURL).hostname,
              relevance_score: Math.max(0.1, 0.7 - (index * 0.1)),
              content_type: this.detectContentType(topic.FirstURL, topic.Text),
            });
          }
        });
      }
      
      return results;
    } catch (error) {
      console.warn('DuckDuckGo search failed:', error);
      return [];
    }
  }
  
  private async searchGitHubTopics(query: string, signal: AbortSignal): Promise<AdvancedWebSearchResult[]> {
    // GitHub Search API (public, no auth required for basic search)
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=5`;
    
    try {
      const response = await fetch(url, { 
        signal,
        headers: { 
          'User-Agent': 'UNIPATH CLI Advanced WebSearch 2.0',
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
      
      const data = await response.json();
      const results: AdvancedWebSearchResult[] = [];
      
      if (data.items) {
        data.items.forEach((repo: any, index: number) => {
          results.push({
            title: `${repo.full_name} - ${repo.description || 'GitHub Repository'}`,
            url: repo.html_url,
            snippet: `${repo.description || 'No description'} | ⭐ ${repo.stargazers_count} stars | Language: ${repo.language || 'Unknown'}`,
            domain: 'github.com',
            relevance_score: Math.max(0.2, 0.9 - (index * 0.1)),
            content_type: 'code',
          });
        });
      }
      
      return results;
    } catch (error) {
      console.warn('GitHub search failed:', error);
      return [];
    }
  }
  
  private async searchNewsAPI(query: string, signal: AbortSignal): Promise<AdvancedWebSearchResult[]> {
    // Using a free news aggregation approach
    const searchTerms = encodeURIComponent(`${query} news`);
    const url = `https://api.duckduckgo.com/?q=${searchTerms}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
    
    try {
      const response = await fetch(url, { signal });
      const data = await response.json();
      const results: AdvancedWebSearchResult[] = [];
      
      // Filter for news-like content
      if (data.RelatedTopics) {
        data.RelatedTopics
          .filter((topic: any) => this.isNewsContent(topic.FirstURL, topic.Text))
          .slice(0, 5)
          .forEach((topic: any, index: number) => {
            results.push({
              title: topic.Text.split(' - ')[0] || 'News Article',
              url: topic.FirstURL,
              snippet: topic.Text,
              domain: new URL(topic.FirstURL).hostname,
              relevance_score: Math.max(0.3, 0.8 - (index * 0.1)),
              content_type: 'news',
            });
          });
      }
      
      return results;
    } catch (error) {
      console.warn('News search failed:', error);
      return [];
    }
  }
  
  private async searchArxivAPI(query: string, signal: AbortSignal): Promise<AdvancedWebSearchResult[]> {
    // arXiv API for academic papers
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending`;
    
    try {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`arXiv API error: ${response.status}`);
      
      const xmlText = await response.text();
      const results: AdvancedWebSearchResult[] = [];
      
      // Simple XML parsing for arXiv results
      const entries = xmlText.match(/<entry>[\s\S]*?<\/entry>/g) || [];
      
      entries.forEach((entry, index) => {
        const title = this.extractXMLValue(entry, 'title')?.replace(/\s+/g, ' ').trim();
        const summary = this.extractXMLValue(entry, 'summary')?.replace(/\s+/g, ' ').trim();
        const id = this.extractXMLValue(entry, 'id');
        const published = this.extractXMLValue(entry, 'published');
        
        if (title && id) {
          results.push({
            title: title,
            url: id,
            snippet: summary || 'Academic paper from arXiv',
            domain: 'arxiv.org',
            published_date: published || undefined,
            relevance_score: Math.max(0.4, 0.8 - (index * 0.1)),
            content_type: 'article',
          });
        }
      });
      
      return results;
    } catch (error) {
      console.warn('arXiv search failed:', error);
      return [];
    }
  }
  
  private async searchRecentContent(query: string, signal: AbortSignal): Promise<AdvancedWebSearchResult[]> {
    // Search for recent content by adding time-based keywords
    const recentQuery = `${query} 2025 latest recent`;
    return this.searchDuckDuckGo(recentQuery, signal);
  }
  
  private deduplicateAndRank(results: AdvancedWebSearchResult[], originalQuery: string): AdvancedWebSearchResult[] {
    // Remove duplicates by URL
    const seen = new Set<string>();
    const unique = results.filter(result => {
      if (seen.has(result.url)) return false;
      seen.add(result.url);
      return true;
    });
    
    // Enhance relevance scoring
    return unique
      .map(result => ({
        ...result,
        relevance_score: this.calculateRelevanceScore(result, originalQuery),
      }))
      .sort((a, b) => b.relevance_score - a.relevance_score);
  }
  
  private calculateRelevanceScore(result: AdvancedWebSearchResult, query: string): number {
    let score = result.relevance_score;
    
    const queryLower = query.toLowerCase();
    const titleLower = result.title.toLowerCase();
    const snippetLower = result.snippet.toLowerCase();
    
    // Boost score for query terms in title
    if (titleLower.includes(queryLower)) score += 0.3;
    
    // Boost score for query terms in snippet
    if (snippetLower.includes(queryLower)) score += 0.2;
    
    // Boost score for authoritative domains
    const authoritativeDomains = ['github.com', 'stackoverflow.com', 'arxiv.org', 'wikipedia.org', 'docs.microsoft.com', 'developer.mozilla.org'];
    if (authoritativeDomains.includes(result.domain)) score += 0.2;
    
    // Penalty for very long domains (often spam)
    if (result.domain.length > 30) score -= 0.1;
    
    return Math.max(0, Math.min(1, score));
  }
  
  private formatResultsForDisplay(results: AdvancedWebSearchResult[]): string {
    return results.map((result, index) => {
      const contentTypeEmoji = this.getContentTypeEmoji(result.content_type);
      const scoreIndicator = '★'.repeat(Math.ceil(result.relevance_score * 5));
      
      return `${index + 1}. ${contentTypeEmoji} **${result.title}**\n   ${result.snippet}\n   🔗 ${result.url} (${result.domain})\n   📊 Relevance: ${scoreIndicator} (${(result.relevance_score * 100).toFixed(0)}%)\n`;
    }).join('\n');
  }
  
  private generateQuerySuggestions(originalQuery: string, results: AdvancedWebSearchResult[]): string[] {
    const suggestions: string[] = [];
    
    // Extract common terms from successful results
    const allText = results.map(r => r.title + ' ' + r.snippet).join(' ').toLowerCase();
    const words = allText.match(/\b\w{4,}\b/g) || [];
    
    // Find frequent words not in original query
    const queryWords = originalQuery.toLowerCase().split(/\s+/);
    const wordCounts: Record<string, number> = {};
    
    words.forEach(word => {
      if (!queryWords.includes(word)) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    });
    
    // Get top suggestions
    Object.entries(wordCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .forEach(([word]) => suggestions.push(`${originalQuery} ${word}`));
    
    return suggestions;
  }
  
  private detectContentType(url: string, text: string): AdvancedWebSearchResult['content_type'] {
    if (url.includes('github.com') || url.includes('gitlab.com')) return 'code';
    if (url.includes('stackoverflow.com') || url.includes('reddit.com')) return 'forum';
    if (url.includes('news') || url.includes('blog')) return 'news';
    if (url.includes('docs.') || url.includes('documentation')) return 'documentation';
    if (text.includes('tutorial') || text.includes('guide')) return 'documentation';
    return 'article';
  }
  
  private isNewsContent(url: string, text: string): boolean {
    const newsIndicators = ['news', 'breaking', 'latest', 'today', 'yesterday', '2025', 'update'];
    return newsIndicators.some(indicator => 
      url.toLowerCase().includes(indicator) || text.toLowerCase().includes(indicator)
    );
  }
  
  private getContentTypeEmoji(type: AdvancedWebSearchResult['content_type']): string {
    switch (type) {
      case 'article': return '📄';
      case 'documentation': return '📚';
      case 'forum': return '💬';
      case 'news': return '📰';
      case 'code': return '💻';
      default: return '🔍';
    }
  }
  
  private extractXMLValue(xml: string, tag: string): string | null {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
    return match ? match[1] : null;
  }
}

/**
 * Advanced web search tool that aggregates results from multiple sources
 * and provides rich metadata and ranking.
 */
export class AdvancedWebSearchTool extends BaseDeclarativeTool<
  AdvancedWebSearchToolParams,
  AdvancedWebSearchToolResult
> {
  static readonly Name: string = 'web_search';

  constructor(config: Config) {
    super(
      AdvancedWebSearchTool.Name,
      'AdvancedWebSearch',
      'Performs advanced web search with multiple sources, result ranking, and rich metadata. Supports different search types: general, news, academic, code, recent.',
      Kind.Search,
      {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find information on the web.',
          },
          max_results: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)',
            minimum: 1,
            maximum: 20,
          },
          include_snippets: {
            type: 'boolean',
            description: 'Whether to include content snippets (default: true)',
          },
          search_type: {
            type: 'string',
            enum: ['general', 'news', 'academic', 'code', 'recent'],
            description: 'Type of search to perform: general (default), news, academic, code, or recent',
          },
          time_range: {
            type: 'string',
            enum: ['day', 'week', 'month', 'year', 'all'],
            description: 'Time range for search results (default: all)',
          },
        },
        required: ['query'],
      },
    );
    // Config parameter required by base class but not used here
    void config;
  }

  protected override validateToolParamValues(
    params: AdvancedWebSearchToolParams,
  ): string | null {
    if (!params.query || params.query.trim() === '') {
      return "The 'query' parameter cannot be empty.";
    }
    if (params.max_results && (params.max_results < 1 || params.max_results > 20)) {
      return "The 'max_results' parameter must be between 1 and 20.";
    }
    return null;
  }

  protected createInvocation(
    params: AdvancedWebSearchToolParams,
  ): ToolInvocation<AdvancedWebSearchToolParams, AdvancedWebSearchToolResult> {
    return new AdvancedWebSearchToolInvocation(params);
  }
}