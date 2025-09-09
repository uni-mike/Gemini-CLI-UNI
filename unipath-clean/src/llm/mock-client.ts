/**
 * Mock LLM Client
 * For testing without API keys
 */

import { EventEmitter } from 'events';
import { Message } from './provider.js';

export class MockLLMClient extends EventEmitter {
  async chat(messages: Message[], tools?: any[]): Promise<string> {
    this.emit('start', { messages, tools });
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const lastMessage = messages[messages.length - 1].content.toLowerCase();
    
    // Simple mock responses
    if (lastMessage.includes('create') && lastMessage.includes('file')) {
      this.emit('tool-calls', [{
        function: {
          name: 'file',
          arguments: JSON.stringify({
            action: 'write',
            path: 'test.txt',
            content: 'Hello from mock LLM!'
          })
        }
      }]);
      return 'I would create a file for you.';
    }
    
    if (lastMessage.includes('list') || lastMessage.includes('ls')) {
      this.emit('tool-calls', [{
        function: {
          name: 'bash',
          arguments: JSON.stringify({
            command: 'ls -la'
          })
        }
      }]);
      return 'I would list files for you.';
    }
    
    if (lastMessage.includes('search')) {
      this.emit('tool-calls', [{
        function: {
          name: 'web',
          arguments: JSON.stringify({
            action: 'search',
            query: 'test search'
          })
        }
      }]);
      return 'I would search the web for you.';
    }
    
    // Math operations
    const mathMatch = lastMessage.match(/\d+\s*[+\-*/]\s*\d+/);
    if (mathMatch) {
      try {
        // Simple math evaluation (safe for basic operations)
        const result = eval(mathMatch[0]);
        this.emit('complete', `The answer is ${result}`);
        return `The answer is ${result}`;
      } catch {
        return 'I can help with math calculations.';
      }
    }
    
    this.emit('complete', 'Mock response: I understand your request.');
    return 'Mock response: I understand your request.';
  }
}