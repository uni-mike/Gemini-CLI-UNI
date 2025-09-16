import * as fs from 'fs/promises';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

export interface CSVFileSchema {
  filename: string;
  columns: string[];
  sampleData: any[];
  detectedSchema: Record<string, string>;
}

export class CSVProcessor {
  private supportedExtensions = ['.csv', '.tsv', '.txt'];
  private knownSchemas: Map<string, CSVFileSchema> = new Map();

  async discoverFiles(directoryPath: string): Promise<string[]> {
    try {
      const files = await fs.readdir(directoryPath);
      return files
        .filter(file => this.supportedExtensions.some(ext => file.endsWith(ext)))
        .map(file => path.join(directoryPath, file));
    } catch (error) {
      throw new Error(`Failed to discover files in ${directoryPath}: ${error}`);
    }
  }

  async readFile(filePath: string): Promise<any[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const filename = path.basename(filePath);
      
      // Detect delimiter
      const delimiter = this.detectDelimiter(content);
      
      // Parse CSV with dynamic schema handling
      const records = parse(content, {
        columns: true,
        delimiter,
        skip_empty_lines: true,
        trim: true,
        cast: (value, context) => this.castValue(value, context)
      });

      // Analyze schema
      const schema = this.analyzeSchema(filename, records);
      this.knownSchemas.set(filename, schema);

      return records;
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error}`);
    }
  }

  private detectDelimiter(content: string): string {
    const firstLine = content.split('\n')[0];
    const delimiters = [',', ';', '\t', '|'];
    
    for (const delim of delimiters) {
      if (firstLine.includes(delim)) {
        return delim;
      }
    }
    
    return ','; // default
  }

  private castValue(value: string, context: any): any {
    if (value === '') return null;
    
    // Try parsing as number
    if (!isNaN(Number(value)) && value.trim() !== '') {
      return Number(value);
    }
    
    // Try parsing as boolean
    const lowerValue = value.toLowerCase();
    if (lowerValue === 'true' || lowerValue === 'false') {
      return lowerValue === 'true';
    }
    
    // Try parsing as date
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    return value; // return as string
  }

  private analyzeSchema(filename: string, records: any[]): CSVFileSchema {
    if (records.length === 0) {
      return {
        filename,
        columns: [],
        sampleData: [],
        detectedSchema: {}
      };
    }

    const firstRecord = records[0];
    const columns = Object.keys(firstRecord);
    const sampleData = records.slice(0, 5);
    
    const detectedSchema: Record<string, string> = {};
    
    for (const column of columns) {
      const values = records.map(record => record[column]).filter(val => val !== null);
      detectedSchema[column] = this.detectColumnType(values);
    }

    return {
      filename,
      columns,
      sampleData,
      detectedSchema
    };
  }

  private detectColumnType(values: any[]): string {
    if (values.length === 0) return 'unknown';
    
    const firstValue = values[0];
    
    if (typeof firstValue === 'number') return 'number';
    if (typeof firstValue === 'boolean') return 'boolean';
    if (firstValue instanceof Date) return 'date';
    
    // Check if all values are numbers
    if (values.every(val => !isNaN(Number(val)) && val.toString().trim() !== '')) {
      return 'number';
    }
    
    // Check if all values are booleans
    if (values.every(val => 
      typeof val === 'string' && 
      (val.toLowerCase() === 'true' || val.toLowerCase() === 'false')
    )) {
      return 'boolean';
    }
    
    return 'string';
  }

  getSchema(filename: string): CSVFileSchema | undefined {
    return this.knownSchemas.get(filename);
  }

  getAllSchemas(): Map<string, CSVFileSchema> {
    return new Map(this.knownSchemas);
  }
}