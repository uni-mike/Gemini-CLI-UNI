// Test orchestration detection in isolation

const testCases = [
  // Should NOT trigger orchestration
  { input: "What is 2 + 2?", expected: false, reason: "Simple arithmetic" },
  { input: "create test.txt", expected: false, reason: "Single file operation" },
  { input: "Bitcoin price", expected: false, reason: "Single web search" },
  { input: "list files", expected: false, reason: "Simple command" },
  { input: "What is the weather?", expected: false, reason: "Single search" },
  
  // SHOULD trigger orchestration
  { input: "create file then add content", expected: true, reason: "Contains 'then'" },
  { input: "search Bitcoin price and then create report.md", expected: true, reason: "Contains 'then'" },
  { input: "first create file.txt, after that add content", expected: true, reason: "Contains 'after'" },
  { input: "research BTC, LTC, ETH prices and create report", expected: true, reason: "Multiple research + create" },
  { input: "analyze code and fix bugs and run tests", expected: true, reason: "Multiple 'and' operations" },
  { input: "step 1: create file, step 2: add content", expected: true, reason: "Explicit steps" },
];

function detectOrchestration(message) {
  const lowerMsg = message.toLowerCase();
  
  // Check for sequential markers
  if (lowerMsg.includes(' then ') || 
      lowerMsg.includes(' after ') ||
      lowerMsg.includes('step 1') ||
      lowerMsg.includes('first ') && lowerMsg.includes('second')) {
    return true;
  }
  
  // Check for multiple operations with 'and'
  const andCount = (lowerMsg.match(/ and /g) || []).length;
  if (andCount >= 2) {
    return true;
  }
  
  // Check for research + create pattern
  if ((lowerMsg.includes('research') || lowerMsg.includes('search')) && 
      lowerMsg.includes('create')) {
    return true;
  }
  
  return false;
}

console.log('='.repeat(80));
console.log('ORCHESTRATION DETECTION TESTS');
console.log('='.repeat(80));

let passed = 0;
let failed = 0;

for (const test of testCases) {
  const result = detectOrchestration(test.input);
  const status = result === test.expected ? '✅' : '❌';
  
  if (result === test.expected) {
    passed++;
  } else {
    failed++;
  }
  
  console.log(`${status} "${test.input}"`);
  console.log(`   Expected: ${test.expected ? 'ORCHESTRATE' : 'SIMPLE'}, Got: ${result ? 'ORCHESTRATE' : 'SIMPLE'}`);
  console.log(`   Reason: ${test.reason}\n`);
}

console.log('='.repeat(80));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(80));