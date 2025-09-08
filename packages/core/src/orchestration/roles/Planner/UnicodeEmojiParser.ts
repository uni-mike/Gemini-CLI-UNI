/**
 * Handles complex Unicode and Emoji parsing edge cases
 * Properly processes multi-byte characters, emoji sequences, and special symbols
 */

export class UnicodeEmojiParser {
  // Unicode ranges for different character types (preserved for future use)
  /* private static readonly EMOJI_RANGES = [
    [0x1F600, 0x1F64F], // Emoticons
    [0x1F300, 0x1F5FF], // Symbols & Pictographs
    [0x1F680, 0x1F6FF], // Transport & Map
    [0x1F700, 0x1F77F], // Alchemical
    [0x1F780, 0x1F7FF], // Geometric Extended
    [0x1F800, 0x1F8FF], // Supplemental Arrows-C
    [0x1F900, 0x1F9FF], // Supplemental Symbols
    [0x1FA00, 0x1FA6F], // Chess Symbols
    [0x1FA70, 0x1FAFF], // Extended-A
    [0x2600, 0x26FF],   // Miscellaneous Symbols
    [0x2700, 0x27BF],   // Dingbats
    [0xFE00, 0xFE0F],   // Variation Selectors
    [0x1F1E6, 0x1F1FF], // Regional Indicators (flags)
  ]; */

  /**
   * Safely parse text containing complex Unicode and emoji sequences
   */
  parseUnicodeText(text: string): { parsed: string; issues: string[] } {
    const issues: string[] = [];
    let parsed = text;

    try {
      // 1. Normalize Unicode (handle different representations of same character)
      parsed = this.normalizeUnicode(parsed);
      
      // 2. Handle emoji sequences properly
      parsed = this.processEmojiSequences(parsed);
      
      // 3. Clean up problematic characters
      const cleanResult = this.cleanProblematicCharacters(parsed);
      parsed = cleanResult.text;
      issues.push(...cleanResult.issues);
      
      // 4. Validate final result
      const validation = this.validateUnicodeText(parsed);
      if (!validation.valid) {
        issues.push(validation.issue!);
      }
      
    } catch (error) {
      issues.push(`Unicode parsing error: ${error}`);
      // Fallback to basic cleaning
      parsed = this.fallbackClean(text);
    }

    return { parsed, issues };
  }

  private normalizeUnicode(text: string): string {
    // Normalize to NFD (Canonical Decomposition) then to NFC (Canonical Composition)
    // This handles characters that can be represented in multiple ways
    try {
      return text.normalize('NFC');
    } catch (error) {
      console.warn('Unicode normalization failed, using original text');
      return text;
    }
  }

  private processEmojiSequences(text: string): string {
    // Handle complex emoji sequences like skin tone modifiers, ZWJ sequences, etc.
    return text.replace(
      // Match emoji sequences with variation selectors and ZWJ
      /([\u{1F1E6}-\u{1F1FF}][\u{1F1E6}-\u{1F1FF}]|[\u{1F300}-\u{1F9FF}][\u{FE00}-\u{FE0F}]?[\u{200D}]?[\u{1F300}-\u{1F9FF}]?)/gu,
      (match) => {
        // Keep valid emoji sequences as-is, but validate them
        if (this.isValidEmojiSequence(match)) {
          return match;
        }
        // Replace invalid sequences with a generic emoji
        return '🔹';
      }
    );
  }

  private isValidEmojiSequence(sequence: string): boolean {
    // Check if the emoji sequence is valid
    try {
      // Basic validation - check if it's not just modifier characters
      const codePoints = [...sequence].map(char => char.codePointAt(0)!);
      
      // Reject sequences that are only modifiers or selectors
      const onlyModifiers = codePoints.every(cp => 
        (cp >= 0x1F3FB && cp <= 0x1F3FF) || // Skin tone modifiers
        (cp >= 0xFE00 && cp <= 0xFE0F) ||   // Variation selectors
        cp === 0x200D                       // Zero-width joiner
      );
      
      return !onlyModifiers && sequence.length <= 20; // Reasonable length limit
    } catch (error) {
      return false;
    }
  }

  private cleanProblematicCharacters(text: string): { text: string; issues: string[] } {
    const issues: string[] = [];
    let cleaned = text;

    // Remove or replace problematic characters
    const problematicPatterns = [
      {
        pattern: /[\u{FEFF}]/gu, // Byte Order Mark
        replacement: '',
        issue: 'Removed byte order marks'
      },
      {
        pattern: /[\u{200B}-\u{200F}]/gu, // Zero-width characters (except ZWJ for emojis)
        replacement: '',
        issue: 'Removed zero-width characters'
      },
      {
        pattern: /[\u{2028}\u{2029}]/gu, // Line and paragraph separators
        replacement: '\n',
        issue: 'Normalized line separators'
      },
      {
        pattern: /[\u{FFFC}\u{FFFD}]/gu, // Object replacement and replacement characters
        replacement: '?',
        issue: 'Replaced object replacement characters'
      },
      {
        pattern: /[\u{E000}-\u{F8FF}]/gu, // Private use area
        replacement: '',
        issue: 'Removed private use area characters'
      }
    ];

    for (const { pattern, replacement, issue } of problematicPatterns) {
      if (pattern.test(cleaned)) {
        cleaned = cleaned.replace(pattern, replacement);
        issues.push(issue);
      }
    }

    // Handle malformed surrogate pairs
    cleaned = this.fixSurrogatePairs(cleaned);

    // Limit consecutive whitespace
    cleaned = cleaned.replace(/\s{10,}/g, ' '.repeat(5));

    return { text: cleaned, issues };
  }

  private fixSurrogatePairs(text: string): string {
    let fixed = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const codeUnit = char.charCodeAt(0);
      
      // Check for high surrogate
      if (codeUnit >= 0xD800 && codeUnit <= 0xDBFF) {
        // High surrogate - check if followed by low surrogate
        if (i + 1 < text.length) {
          const nextChar = text[i + 1];
          const nextCodeUnit = nextChar.charCodeAt(0);
          
          if (nextCodeUnit >= 0xDC00 && nextCodeUnit <= 0xDFFF) {
            // Valid surrogate pair
            fixed += char + nextChar;
            i++; // Skip next character as it's part of the pair
          } else {
            // Invalid high surrogate - replace with placeholder
            fixed += '�';
          }
        } else {
          // High surrogate at end of string - invalid
          fixed += '�';
        }
      } else if (codeUnit >= 0xDC00 && codeUnit <= 0xDFFF) {
        // Isolated low surrogate - invalid
        fixed += '�';
      } else {
        // Regular character
        fixed += char;
      }
    }
    
    return fixed;
  }

  private validateUnicodeText(text: string): { valid: boolean; issue?: string } {
    try {
      // Check for overall text health
      if (text.length === 0) {
        return { valid: false, issue: 'Text became empty after processing' };
      }
      
      // Check for excessive replacement characters
      const replacementCount = (text.match(/�/g) || []).length;
      if (replacementCount > text.length * 0.1) {
        return { valid: false, issue: `Too many replacement characters (${replacementCount})` };
      }
      
      // Ensure text can be JSON stringified (catches some encoding issues)
      JSON.stringify(text);
      
      // Check for reasonable character distribution
      const totalChars = [...text].length;
      const asciiChars = text.replace(/[^\x00-\x7F]/g, '').length;
      const asciiRatio = asciiChars / totalChars;
      
      // If less than 10% ASCII and more than 1000 chars, might be corrupted
      if (asciiRatio < 0.1 && totalChars > 1000) {
        return { valid: false, issue: 'Suspicious character distribution detected' };
      }
      
      return { valid: true };
      
    } catch (error) {
      return { valid: false, issue: `Text validation failed: ${error}` };
    }
  }

  private fallbackClean(text: string): string {
    // Ultra-conservative fallback - keep only basic characters
    return text
      .replace(/[^\x20-\x7E\s\n\r\t]/g, '') // Keep only printable ASCII + whitespace
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Count actual characters (handling emoji and complex Unicode correctly)
   */
  countCharacters(text: string): { 
    graphemes: number; 
    codePoints: number; 
    bytes: number;
    hasComplexUnicode: boolean;
  } {
    try {
      // Use Intl.Segmenter if available for proper grapheme counting
      const segmenter = new (Intl as any).Segmenter('en', { granularity: 'grapheme' });
      const graphemes = [...segmenter.segment(text)].length;
      
      const codePoints = [...text].length;
      const bytes = new TextEncoder().encode(text).length;
      const hasComplexUnicode = bytes !== text.length;
      
      return { graphemes, codePoints, bytes, hasComplexUnicode };
      
    } catch (error) {
      // Fallback counting
      const codePoints = [...text].length;
      const bytes = new TextEncoder().encode(text).length;
      const hasComplexUnicode = bytes !== text.length;
      
      return { 
        graphemes: codePoints, // Approximation
        codePoints, 
        bytes, 
        hasComplexUnicode 
      };
    }
  }

  /**
   * Extract only text content, removing all emojis and special Unicode
   */
  extractTextOnly(text: string): string {
    return text
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Remove emoticons
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Remove symbols & pictographs
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Remove transport & map
      .replace(/[\u{1F700}-\u{1FAFF}]/gu, '') // Remove other emoji ranges
      .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Remove misc symbols
      .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Remove dingbats
      .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Remove variation selectors
      .replace(/\s+/g, ' ')                   // Normalize whitespace
      .trim();
  }
}