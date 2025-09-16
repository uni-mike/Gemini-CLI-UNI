export interface ValidationRule {
  name: string;
  validate: (value: any, context?: any) => boolean;
  errorMessage: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class DataValidator {
  private rules: ValidationRule[] = [];
  private customValidators: Map<string, (value: any) => boolean> = new Map();

  constructor() {
    this.initializeStandardRules();
  }

  private initializeStandardRules() {
    this.rules = [
      {
        name: 'required',
        validate: (value: any) => value !== null && value !== undefined && value !== '',
        errorMessage: 'Field is required'
      },
      {
        name: 'numeric',
        validate: (value: any) => typeof value === 'number' || !isNaN(Number(value)),
        errorMessage: 'Must be a valid number'
      },
      {
        name: 'min',
        validate: (value: any, min: number) => typeof value === 'number' && value >= min,
        errorMessage: `Value must be at least {min}`
      },
      {
        name: 'max',
        validate: (value: any, max: number) => typeof value === 'number' && value <= max,
        errorMessage: `Value must be at most {max}`
      },
      {
        name: 'email',
        validate: (value: any) => 
          typeof value === 'string' && 
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        errorMessage: 'Must be a valid email address'
      },
      {
        name: 'date',
        validate: (value: any) => 
          value instanceof Date && !isNaN(value.getTime()),
        errorMessage: 'Must be a valid date'
      }
    ];
  }

  async validate(data: any[]): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!Array.isArray(data)) {
      return {
        isValid: false,
        errors: ['Input data must be an array'],
        warnings: []
      };
    }

    if (data.length === 0) {
      warnings.push('No data to validate');
      return {
        isValid: true,
        errors: [],
        warnings
      };
    }

    // Validate each record
    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      const recordErrors = this.validateRecord(record, i);
      errors.push(...recordErrors);
    }

    // Schema consistency check
    const schemaWarnings = this.checkSchemaConsistency(data);
    warnings.push(...schemaWarnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateRecord(record: any, index: number): string[] {
    const errors: string[] = [];
    
    if (typeof record !== 'object' || record === null) {
      return [`Record ${index}: Must be an object`];
    }

    // Check for required fields
    for (const rule of this.rules.filter(r => r.name === 'required')) {
      for (const [key, value] of Object.entries(record)) {
        if (!rule.validate(value)) {
          errors.push(`Record ${index}, Field ${key}: ${rule.errorMessage}`);
        }
      }
    }

    // Validate each field based on inferred type
    for (const [key, value] of Object.entries(record)) {
      if (value === null || value === undefined) continue;

      const type = typeof value;
      const applicableRules = this.rules.filter(rule => 
        rule.name !== 'required' && 
        this.isRuleApplicable(rule.name, type, value)
      );

      for (const rule of applicableRules) {
        if (!rule.validate(value)) {
          errors.push(`Record ${index}, Field ${key}: ${rule.errorMessage}`);
        }
      }

      // Custom validators
      if (this.customValidators.has(key)) {
        const validator = this.customValidators.get(key)!;
        if (!validator(value)) {
          errors.push(`Record ${index}, Field ${key}: Custom validation failed`);
        }
      }
    }

    return errors;
  }

  private isRuleApplicable(ruleName: string, type: string, value: any): boolean {
    switch (ruleName) {
      case 'numeric':
        return type === 'number' || !isNaN(Number(value));
      case 'email':
        return type === 'string';
      case 'date':
        return value instanceof Date;
      default:
        return true;
    }
  }

  private checkSchemaConsistency(data: any[]): string[] {
    const warnings: string[] = [];
    
    if (data.length < 2) return warnings;

    const firstRecordKeys = Object.keys(data[0]);
    
    for (let i = 1; i < data.length; i++) {
      const currentKeys = Object.keys(data[i]);
      
      const missingKeys = firstRecordKeys.filter(key => !currentKeys.includes(key));
      const extraKeys = currentKeys.filter(key => !firstRecordKeys.includes(key));
      
      if (missingKeys.length > 0) {
        warnings.push(`Record ${i}: Missing fields: ${missingKeys.join(', ')}`);
      }
      
      if (extraKeys.length > 0) {
        warnings.push(`Record ${i}: Extra fields: ${extraKeys.join(', ')}`);
      }
    }

    return warnings;
  }

  addCustomValidator(fieldName: string, validator: (value: any) => boolean): void {
    this.customValidators.set(fieldName, validator);
  }

  addValidationRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  getValidationRules(): ValidationRule[] {
    return [...this.rules];
  }
}