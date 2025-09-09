/**
 * Base Tool System
 * Simple, clean tool abstraction
 */

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface ToolParams {
  [key: string]: any;
}

export abstract class Tool {
  abstract name: string;
  abstract description: string;
  
  abstract execute(params: ToolParams): Promise<ToolResult>;
  
  validate(params: ToolParams): boolean {
    return true;
  }
}