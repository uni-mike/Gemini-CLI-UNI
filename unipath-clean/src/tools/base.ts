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

export interface ParameterSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  required: boolean;
  description?: string;
  enum?: string[];
  default?: any;
}

export abstract class Tool {
  abstract name: string;
  abstract description: string;
  
  // Optional: Define parameter schema for dynamic prompt building
  parameterSchema?: ParameterSchema[];
  
  abstract execute(params: ToolParams): Promise<ToolResult>;
  
  validate(params: ToolParams): boolean {
    return true;
  }
  
  // Get formatted parameter info for AI prompts
  getParameterInfo(): string {
    if (!this.parameterSchema || this.parameterSchema.length === 0) {
      return '';
    }
    
    const required = this.parameterSchema.filter(p => p.required);
    const optional = this.parameterSchema.filter(p => !p.required);
    
    let info = '  Parameters:';
    if (required.length > 0) {
      info += '\n    Required: ' + required.map(p => 
        `${p.name}: ${p.type}${p.enum ? ` (${p.enum.join('|')})` : ''}${p.description ? ` - ${p.description}` : ''}`
      ).join(', ');
    }
    if (optional.length > 0) {
      info += '\n    Optional: ' + optional.map(p => 
        `${p.name}: ${p.type}${p.default !== undefined ? ` (default: ${p.default})` : ''}${p.description ? ` - ${p.description}` : ''}`
      ).join(', ');
    }
    return info;
  }
}