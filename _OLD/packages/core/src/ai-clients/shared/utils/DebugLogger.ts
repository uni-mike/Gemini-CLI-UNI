/**
 * Debug logger for AI clients
 * Provides consistent debug output across all AI integrations
 */

export class DebugLogger {
  private enabled: boolean;
  private verbose: boolean;
  private prefix: string;

  constructor(prefix: string = '🔧') {
    this.prefix = prefix;
    this.enabled = process.env['DEBUG'] === 'true' || process.env['DEBUG'] === '1';
    this.verbose = process.env['VERBOSE'] === 'true' || process.env['VERBOSE'] === '1';
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: any): void {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`${this.prefix} [${timestamp}] ${message}`);
    
    if (data && this.verbose) {
      console.log('  Data:', JSON.stringify(data, null, 2).substring(0, 500));
    }
  }

  /**
   * Log API request
   */
  logRequest(url: string, method: string, body?: any): void {
    if (!this.enabled) return;
    
    this.debug(`API Request: ${method} ${url}`);
    
    if (this.verbose && body) {
      const sanitized = this.sanitizeData(body);
      console.log('  Body:', JSON.stringify(sanitized, null, 2).substring(0, 1000));
    }
  }

  /**
   * Log API response
   */
  logResponse(status: number, statusText: string, body?: any): void {
    if (!this.enabled) return;
    
    this.debug(`API Response: ${status} ${statusText}`);
    
    if (this.verbose && body) {
      const sanitized = this.sanitizeData(body);
      console.log('  Body:', JSON.stringify(sanitized, null, 2).substring(0, 1000));
    }
  }

  /**
   * Log tool execution
   */
  logToolExecution(toolName: string, args: any, result?: any): void {
    if (!this.enabled) return;
    
    this.debug(`Tool Execute: ${toolName}`);
    
    if (this.verbose) {
      console.log('  Args:', JSON.stringify(args, null, 2).substring(0, 500));
      if (result !== undefined) {
        console.log('  Result:', typeof result === 'string' ? 
          result.substring(0, 200) : 
          JSON.stringify(result, null, 2).substring(0, 500));
      }
    }
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation: string, startTime: number): void {
    if (!this.enabled) return;
    
    const duration = Date.now() - startTime;
    this.debug(`Performance: ${operation} took ${duration}ms`);
  }

  /**
   * Sanitize sensitive data
   */
  private sanitizeData(data: any): any {
    if (typeof data === 'string') {
      return data;
    }
    
    const sanitized = { ...data };
    
    // Remove sensitive fields
    const sensitiveFields = ['apiKey', 'api_key', 'authorization', 'token', 'password'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    // Sanitize nested objects
    if (sanitized.headers) {
      sanitized.headers = this.sanitizeData(sanitized.headers);
    }
    
    return sanitized;
  }

  /**
   * Check if debug is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Check if verbose mode is enabled
   */
  isVerbose(): boolean {
    return this.verbose;
  }
}