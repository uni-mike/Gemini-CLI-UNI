import { DataPipeline } from './DataPipeline';
import { CSVProcessor } from './processors/CSVProcessor';
import { DataValidator } from './validators/DataValidator';
import { TransformationEngine } from './transformations/TransformationEngine';
import { ReportGenerator } from './reporting/ReportGenerator';
import { MonitoringService } from './monitoring/MonitoringService';
import { ErrorHandler } from './error/ErrorHandler';

const pipeline = new DataPipeline({
  processors: [new CSVProcessor()],
  validators: [new DataValidator()],
  transformers: [new TransformationEngine()],
  reporters: [new ReportGenerator()],
  monitoring: new MonitoringService(),
  errorHandler: new ErrorHandler()
});

// Example usage
async function main() {
  try {
    const results = await pipeline.processDirectory('./data/input');
    console.log('Pipeline completed successfully');
    console.log(`Processed ${results.totalRecords} records`);
    console.log(`Generated ${results.reports.length} reports`);
  } catch (error) {
    console.error('Pipeline failed:', error);
    process.exit(1);
  }
}

main();