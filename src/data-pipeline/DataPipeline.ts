import { EventEmitter } from 'events';

export interface PipelineConfig {
  processors: any[];
  validators: any[];
  transformers: any[];
  reporters: any[];
  monitoring: any;
  errorHandler: any;
}

export interface PipelineResult {
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  reports: any[];
  errors: any[];
  processingTime: number;
}

export class DataPipeline extends EventEmitter {
  private config: PipelineConfig;
  private isMonitoring: boolean = false;

  constructor(config: PipelineConfig) {
    super();
    this.config = config;
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.on('processing_start', (file: string) => {
      this.config.monitoring.logEvent('processing_start', { file });
    });

    this.on('processing_complete', (stats: any) => {
      this.config.monitoring.logEvent('processing_complete', stats);
    });

    this.on('error', (error: any) => {
      this.config.errorHandler.handle(error);
      this.config.monitoring.logEvent('error', error);
    });
  }

  async processDirectory(directoryPath: string): Promise<PipelineResult> {
    const startTime = Date.now();
    let totalRecords = 0;
    let successfulRecords = 0;
    let failedRecords = 0;
    const reports: any[] = [];
    const errors: any[] = [];

    try {
      // Start monitoring
      this.startMonitoring();

      // Process each file in directory
      for (const processor of this.config.processors) {
        const files = await processor.discoverFiles(directoryPath);
        
        for (const file of files) {
          this.emit('processing_start', file);
          
          try {
            // Read and parse
            const rawData = await processor.readFile(file);
            
            // Validate
            for (const validator of this.config.validators) {
              await validator.validate(rawData);
            }
            
            // Transform
            let transformedData = rawData;
            for (const transformer of this.config.transformers) {
              transformedData = await transformer.transform(transformedData);
            }
            
            // Generate reports
            for (const reporter of this.config.reporters) {
              const report = await reporter.generateReport(transformedData);
              reports.push(report);
            }
            
            successfulRecords += transformedData.length;
            totalRecords += transformedData.length;
            
          } catch (error) {
            failedRecords++;
            this.emit('error', { file, error });
            errors.push({ file, error });
          }
        }
      }

      const processingTime = Date.now() - startTime;
      
      this.emit('processing_complete', {
        totalRecords,
        successfulRecords,
        failedRecords,
        processingTime,
        reportsCount: reports.length
      });

      return {
        totalRecords,
        successfulRecords,
        failedRecords,
        reports,
        errors,
        processingTime
      };

    } finally {
      this.stopMonitoring();
    }
  }

  private startMonitoring() {
    if (!this.isMonitoring) {
      this.config.monitoring.start();
      this.isMonitoring = true;
    }
  }

  private stopMonitoring() {
    if (this.isMonitoring) {
      this.config.monitoring.stop();
      this.isMonitoring = false;
    }
  }
}