export type OperatingMode = 'concise' | 'direct' | 'deep';

/**
 * Detects the appropriate operating mode based on prompt complexity
 */
export class ModeDetector {
  /**
   * Analyze prompt to determine operating mode
   */
  static detectMode(prompt: string): OperatingMode {
    const wordCount = prompt.split(/\s+/).length;
    const hasMultipleSteps = /\d+\)|step \d+|first|second|then|finally/i.test(prompt);
    const hasComplexRequirements = /comprehensive|detailed|complex|advanced|full.?stack/i.test(prompt);
    const hasResearchKeywords = /research|analyze|investigate|explore|understand/i.test(prompt);
    const hasSimpleKeywords = /simple|basic|quick|trivial|just|only/i.test(prompt);

    // Deep mode: Complex research or analysis tasks
    if (hasResearchKeywords && wordCount > 50) {
      return 'deep';
    }

    // Deep mode: Very complex requirements
    if (hasComplexRequirements && (wordCount > 100 || hasMultipleSteps)) {
      return 'deep';
    }

    // Direct mode: Medium complexity with multiple steps
    if (hasMultipleSteps || (wordCount > 30 && wordCount <= 100)) {
      return 'direct';
    }

    // Concise mode: Simple tasks or explicit simple keywords
    if (hasSimpleKeywords || wordCount <= 30) {
      return 'concise';
    }

    // Default to direct for moderate complexity
    return 'direct';
  }

  /**
   * Get token budget limits for a given mode
   */
  static getTokenLimits(mode: OperatingMode) {
    switch (mode) {
      case 'deep':
        return {
          retrieval: { limit: 24000 },
          planning: { limit: 16000 },
          execution: { limit: 32000 }
        };
      case 'direct':
        return {
          retrieval: { limit: 12000 },
          planning: { limit: 8000 },
          execution: { limit: 16000 }
        };
      case 'concise':
      default:
        return {
          retrieval: { limit: 6000 },
          planning: { limit: 4000 },
          execution: { limit: 8000 }
        };
    }
  }
}