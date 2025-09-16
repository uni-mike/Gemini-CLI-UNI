export interface Transformation {
  name: string;
  transform: (data: any[]) => Promise<any[]> | any[];
  description: string;
}

export interface TransformationContext {
  stage: string;
  timestamp: Date;
  recordsProcessed: number;
  metadata: Record<string, any>;
}

export class TransformationEngine {
  private transformations: Transformation[] = [];
  private transformationHistory: TransformationContext[] = [];

  constructor() {
    this.initializeStandardTransformations();
  }

  private initializeStandardTransformations() {
    this.transformations = [
      {
        name: 'clean_whitespace',
        transform: (data: any[]) => 
          data.map(record => 
            Object.fromEntries(
              Object.entries(record).map(([key, value]) => [
                key,
                typeof value === 'string' ? value.trim() : value
              ])
            )
          ),
        description: 'Trim whitespace from string fields'
      },
      {
        name: 'normalize_case',
        transform: (data: any[]) =>
          data.map(record =>
            Object.fromEntries(
              Object.entries(record).map(([key, value]) => [
                key.toLowerCase(),
                typeof value === 'string' ? value.toLowerCase() : value
              ])
            )
          ),
        description: 'Normalize field names and string values to lowercase'
      },
      {
        name: 'handle_null_values',
        transform: (data: any[]) =>
          data.map(record =>
            Object.fromEntries(
              Object.entries(record).map(([key, value]) => [
                key,
                value === null || value === '' ? null : value
              ])
            )
          ),
        description: 'Standardize null and empty string values'
      },
      {
        name: 'derive_new_fields',
        transform: (data: any[]) =>
          data.map(record => ({
            ...record,
            processed_date: new Date(),
            record_hash: this.generateHash(record)
          })),
        description: 'Add derived fields like processing date and record hash'
      }
    ];
  }

  async transform(data: any[]): Promise<any[]> {
    if (!Array.isArray(data)) {
      throw new Error('Input data must be an array');
    }

    let transformedData = [...data];
    
    for (const transformation of this.transformations) {
      const startTime = Date.now();
      
      try {
        const result = transformation.transform(transformedData);
        transformedData = result instanceof Promise ? await result : result;
        
        this.transformationHistory.push({
          stage: transformation.name,
          timestamp: new Date(),
          recordsProcessed: transformedData.length,
          metadata: {
            duration: Date.now() - startTime,
            description: transformation.description
          }
        });
        
      } catch (error) {
        console.warn(`Transformation ${transformation.name} failed:`, error);
        // Continue with next transformation
      }
    }

    return transformedData;
  }

  private generateHash(record: any): string {
    const str = JSON.stringify(record);
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(16);
  }

  addTransformation(transformation: Transformation): void {
    this.transformations.push(transformation);
  }

  insertTransformation(transformation: Transformation, index: number): void {
    this.transformations.splice(index, 0, transformation);
  }

  getTransformations(): Transformation[] {
    return [...this.transformations];
  }

  getTransformationHistory(): TransformationContext[] {
    return [...this.transformationHistory];
  }

  clearTransformations(): void {
    this.transformations = [];
    this.initializeStandardTransformations();
  }

  // Advanced transformation methods
  async transformWithSchema(data: any[], schema: Record<string, string>): Promise<any[]> {
    return data.map(record => {
      const transformed: any = {};
      
      for (const [key, value] of Object.entries(record)) {
        const targetType = schema[key];
        
        if (targetType) {
          transformed[key] = this.castToType(value, targetType);
        } else {
          transformed[key] = value;
        }
      }
      
      return transformed;
    });
  }

  private castToType(value: any, targetType: string): any {
    if (value === null || value === undefined) return null;
    
    switch (targetType.toLowerCase()) {
      case 'number':
        return typeof value === 'number' ? value : Number(value);
      case 'boolean':
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true' || value === '1';
        }
        return Boolean(value);
      case 'date':
        if (value instanceof Date) return value;
        return new Date(value);
      case 'string':
        return String(value);
      default:
        return value;
    }
  }

  // Batch processing for large datasets
  async transformInBatches(
    data: any[], 
    batchSize: number = 1000,
    onBatchComplete?: (batch: any[], index: number) => void
  ): Promise<any[]> {
    const results: any[] = [];
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const transformedBatch = await this.transform(batch);
      results.push(...transformedBatch);
      
      onBatchComplete?.(transformedBatch, Math.floor(i / batchSize));
    }
    
    return results;
  }
}