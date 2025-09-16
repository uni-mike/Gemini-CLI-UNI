import { PromptTemplates } from './src/prompts/prompts.js';

const testPrompt = "Create design documentation for plant watering app with Mermaid diagram";
const mockTools = [
  { name: 'write_file', description: 'Write files', parameterSchema: [
    { name: 'file_path', type: 'string', required: true, description: 'Path to file' },
    { name: 'content', type: 'string', required: true, description: 'File content' }
  ]},
  { name: 'bash', description: 'Run bash commands', parameterSchema: [
    { name: 'command', type: 'string', required: true, description: 'Command to run' }
  ]}
];

const fullPrompt = PromptTemplates.taskDecomposition(testPrompt, mockTools);
console.log('=== FULL PROMPT SENT TO DEEPSEEK ===');
console.log(fullPrompt);
console.log('=== END PROMPT ===');