/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import util from 'node:util';
import type { ConsoleMessageItem } from '../types.js';

interface ConsolePatcherParams {
  onNewMessage?: (message: Omit<ConsoleMessageItem, 'id'>) => void;
  onOrchestrationEvent?: (event: { type: string; message: string; timestamp: number }) => void;
  debugMode: boolean;
  stderr?: boolean;
}

export class ConsolePatcher {
  private originalConsoleLog = console.log;
  private originalConsoleWarn = console.warn;
  private originalConsoleError = console.error;
  private originalConsoleDebug = console.debug;
  private originalConsoleInfo = console.info;

  private params: ConsolePatcherParams;

  constructor(params: ConsolePatcherParams) {
    this.params = params;
  }

  patch() {
    console.log = this.patchConsoleMethod('log', this.originalConsoleLog);
    console.warn = this.patchConsoleMethod('warn', this.originalConsoleWarn);
    console.error = this.patchConsoleMethod('error', this.originalConsoleError);
    console.debug = this.patchConsoleMethod('debug', this.originalConsoleDebug);
    console.info = this.patchConsoleMethod('info', this.originalConsoleInfo);
  }

  cleanup = () => {
    console.log = this.originalConsoleLog;
    console.warn = this.originalConsoleWarn;
    console.error = this.originalConsoleError;
    console.debug = this.originalConsoleDebug;
    console.info = this.originalConsoleInfo;
  };

  private formatArgs = (args: unknown[]): string => util.format(...args);

  private patchConsoleMethod =
    (
      type: 'log' | 'warn' | 'error' | 'debug' | 'info',
      originalMethod: (...args: unknown[]) => void,
    ) =>
    (...args: unknown[]) => {
      const content = this.formatArgs(args);
      
      // Check for orchestration events in the console output
      if (content.includes('🎭ORCHESTRATION_EVENT:')) {
        try {
          const eventStartIndex = content.indexOf('🎭ORCHESTRATION_EVENT:') + '🎭ORCHESTRATION_EVENT:'.length;
          const eventJson = content.substring(eventStartIndex).trim();
          
          // Debug logging to see what we're trying to parse
          console.log('🔧 ConsolePatcher found orchestration event, parsing:', eventJson.substring(0, 100));
          
          const event = JSON.parse(eventJson);
          
          console.log('🎯 ConsolePatcher successfully parsed event:', event);
          
          // Emit orchestration event separately
          this.params.onOrchestrationEvent?.(event);
          
          // Also log normally but without the JSON part
          const cleanContent = content.substring(0, content.indexOf('🎭ORCHESTRATION_EVENT:'));
          if (cleanContent.trim()) {
            originalMethod.apply(console, [cleanContent]);
          }
          return;
        } catch (error) {
          console.log('❌ ConsolePatcher failed to parse orchestration event:', error);
          // If parsing fails, fall through to normal logging
        }
      }
      
      if (this.params.stderr) {
        if (type !== 'debug' || this.params.debugMode) {
          this.originalConsoleError(content);
        }
      } else {
        if (this.params.debugMode) {
          originalMethod.apply(console, args);
        }

        if (type !== 'debug' || this.params.debugMode) {
          this.params.onNewMessage?.({
            type,
            content: content,
            count: 1,
          });
        }
      }
    };
}
