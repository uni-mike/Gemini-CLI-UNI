/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { ToolResult } from '../tools/tools.js';
import type { UnipathClient } from '../core/client.js';
/**
 * A function that summarizes the result of a tool execution.
 *
 * @param result The result of the tool execution.
 * @returns The summary of the result.
 */
export type Summarizer = (result: ToolResult, unipathClient: UnipathClient, abortSignal: AbortSignal) => Promise<string>;
/**
 * The default summarizer for tool results.
 *
 * @param result The result of the tool execution.
 * @param unipathClient The Gemini client to use for summarization.
 * @param abortSignal The abort signal to use for summarization.
 * @returns The summary of the result.
 */
export declare const defaultSummarizer: Summarizer;
export declare const llmSummarizer: Summarizer;
export declare function summarizeToolOutput(textToSummarize: string, unipathClient: UnipathClient, abortSignal: AbortSignal, maxOutputTokens?: number): Promise<string>;
