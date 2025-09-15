#!/usr/bin/env node

// Test mode detection logic directly
const modeDetector = {
  detectMode: function(prompt) {
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
};

// Test cases
const testCases = [
  // Simple/Concise
  "Create test file",
  "Run npm install",
  "Simple task",

  // Direct
  "Create a React component with state management and props validation",
  "Build a REST API with authentication and database integration",
  "First create the database schema, then implement the API endpoints",

  // Deep
  "Research and analyze the codebase to understand the architecture and create comprehensive documentation",
  "Build a comprehensive full-stack e-commerce platform with React frontend, Node.js backend, database design, authentication, payment integration, and complete documentation including API specs and deployment guides",
];

console.log('🧪 Mode Detection Test Results:\n');
console.log('='.repeat(60));

testCases.forEach(prompt => {
  const mode = modeDetector.detectMode(prompt);
  const wordCount = prompt.split(/\s+/).length;
  console.log(`\nPrompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);
  console.log(`Words: ${wordCount}, Mode: ${mode.toUpperCase()}`);
});

console.log('\n' + '='.repeat(60));
console.log('✅ Mode detection test complete');