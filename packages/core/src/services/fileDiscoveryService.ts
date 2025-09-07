/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GitIgnoreFilter } from '../utils/gitIgnoreParser.js';
import { GitIgnoreParser } from '../utils/gitIgnoreParser.js';
import { isGitRepository } from '../utils/gitUtils.js';
import * as path from 'node:path';

const UNIPATH_IGNORE_FILE_NAME = '.unipathignore';
const GEMINI_IGNORE_FILE_NAME = '.geminiignore'; // Backward compatibility

export interface FilterFilesOptions {
  respectGitIgnore?: boolean;
  respectUnipathIgnore?: boolean;
  respectGeminiIgnore?: boolean; // Backward compatibility
}

export class FileDiscoveryService {
  private gitIgnoreFilter: GitIgnoreFilter | null = null;
  private geminiIgnoreFilter: GitIgnoreFilter | null = null;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
    if (isGitRepository(this.projectRoot)) {
      const parser = new GitIgnoreParser(this.projectRoot);
      try {
        parser.loadGitRepoPatterns();
      } catch (_error) {
        // ignore file not found
      }
      this.gitIgnoreFilter = parser;
    }
    const gParser = new GitIgnoreParser(this.projectRoot);
    try {
      // Try loading .unipathignore first
      gParser.loadPatterns(UNIPATH_IGNORE_FILE_NAME);
    } catch (_error) {
      // If .unipathignore not found, try .geminiignore for backward compatibility
      try {
        gParser.loadPatterns(GEMINI_IGNORE_FILE_NAME);
      } catch (_error2) {
        // Neither ignore file found
      }
    }
    this.geminiIgnoreFilter = gParser;
  }

  /**
   * Filters a list of file paths based on git ignore rules
   */
  filterFiles(
    filePaths: string[],
    options: FilterFilesOptions = {
      respectGitIgnore: true,
      respectUnipathIgnore: true,
      respectGeminiIgnore: true, // Backward compatibility
    },
  ): string[] {
    return filePaths.filter((filePath) => {
      if (options.respectGitIgnore && this.shouldGitIgnoreFile(filePath)) {
        return false;
      }
      // Check both for backward compatibility
      const shouldCheckIgnore = options.respectUnipathIgnore || options.respectGeminiIgnore;
      if (
        shouldCheckIgnore &&
        this.shouldGeminiIgnoreFile(filePath)
      ) {
        return false;
      }
      return true;
    });
  }

  /**
   * Checks if a single file should be git-ignored
   */
  shouldGitIgnoreFile(filePath: string): boolean {
    if (this.gitIgnoreFilter) {
      return this.gitIgnoreFilter.isIgnored(filePath);
    }
    return false;
  }

  /**
   * Checks if a single file should be gemini-ignored
   */
  shouldGeminiIgnoreFile(filePath: string): boolean {
    if (this.geminiIgnoreFilter) {
      return this.geminiIgnoreFilter.isIgnored(filePath);
    }
    return false;
  }

  /**
   * Unified method to check if a file should be ignored based on filtering options
   */
  shouldIgnoreFile(
    filePath: string,
    options: FilterFilesOptions = {},
  ): boolean {
    const { respectGitIgnore = true, respectUnipathIgnore = true, respectGeminiIgnore = true } = options;

    if (respectGitIgnore && this.shouldGitIgnoreFile(filePath)) {
      return true;
    }
    // Check both for backward compatibility
    const shouldCheckIgnore = respectUnipathIgnore || respectGeminiIgnore;
    if (shouldCheckIgnore && this.shouldGeminiIgnoreFile(filePath)) {
      return true;
    }
    return false;
  }

  /**
   * Returns loaded patterns from .unipathignore (or .geminiignore for backward compatibility)
   */
  getGeminiIgnorePatterns(): string[] {
    return this.geminiIgnoreFilter?.getPatterns() ?? [];
  }
}
