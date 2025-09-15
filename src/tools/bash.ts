/**
 * Bash Tool
 * Execute shell commands with timeout and background support
 */

import { Tool, ToolParams, ToolResult, ParameterSchema } from './base.js';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class BashTool extends Tool {
  name = 'bash';
  description = 'Execute shell commands in bash';

  parameterSchema: ParameterSchema[] = [
    { name: 'command', type: 'string', required: true, description: 'Shell command to execute' },
    { name: 'timeout', type: 'number', required: false, description: 'Timeout in seconds (default: 30s, max: 300s)' },
    { name: 'background', type: 'boolean', required: false, description: 'Run command in background' },
    { name: 'detached', type: 'boolean', required: false, description: 'Run command detached (survives parent process)' }
  ];

  async execute(params: ToolParams): Promise<ToolResult> {
    const command = params.command as string;
    const timeout = Math.min((params.timeout as number) || 30, 300) * 1000; // Convert to ms, max 5 minutes
    const background = params.background as boolean || false;
    const detached = params.detached as boolean || false;

    // Debug logging to track timeout behavior
    if (process.env.DEBUG === 'true') {
      console.log(`🔍 Bash tool execute called with params:`, {
        command: command?.substring(0, 100),
        timeout: params.timeout,
        timeoutMs: timeout,
        background,
        detached
      });
    }

    if (!command) {
      return {
        success: false,
        error: 'Command is required'
      };
    }

    try {
      if (background || detached) {
        // Run in background using spawn with detached option
        return this.runInBackground(command, detached);
      } else {
        // Use Node.js built-in timeout - smart default of 30s
        if (process.env.DEBUG === 'true') {
          console.log(`⏱️ Executing command with timeout: ${timeout}ms (${timeout/1000}s)`);
        }
        const { stdout, stderr } = await execAsync(command, {
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024, // 10MB
          timeout: timeout // Use built-in timeout
        });

        return {
          success: true,
          output: stdout + (stderr ? `\nSTDERR: ${stderr}` : '')
        };
      }
    } catch (error: any) {
      // Check if error is due to timeout
      if (error.killed || error.code === 'ETIMEDOUT' || error.signal === 'SIGTERM') {
        // Instead of guessing from filename, provide intelligent suggestions
        return {
          success: false,
          error: `Command timed out after ${timeout / 1000} seconds.\n\n` +
                 `If this is a long-running process, try:\n` +
                 `• Adding 'timeout: 60' parameter for longer timeout\n` +
                 `• Adding 'background: true' to run in background\n` +
                 `• Using specific arguments if it's a script (e.g., status, help)\n` +
                 `• Breaking the command into smaller steps`,
          output: error.stdout || 'Process was terminated due to timeout'
        };
      }

      return {
        success: false,
        error: error.message,
        output: error.stdout || error.stderr
      };
    }
  }

  private async runInBackground(command: string, detached: boolean = false): Promise<ToolResult> {
    return new Promise((resolve) => {
      const child = spawn('bash', ['-c', command], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Capture initial output for confirmation
      let initialOutput = '';
      let errorOutput = '';
      const outputTimeout = setTimeout(() => {
        // After 2 seconds, consider it started successfully
        child.unref(); // Allow parent to exit without killing child
        resolve({
          success: true,
          output: `Started in background (PID: ${child.pid})\n${initialOutput}`,
          data: { pid: child.pid }
        });
      }, 2000);

      child.stdout?.on('data', (data) => {
        initialOutput += data.toString();
        if (initialOutput.length > 1000) {
          clearTimeout(outputTimeout);
          child.unref();
          resolve({
            success: true,
            output: `Started in background (PID: ${child.pid})\nInitial output:\n${initialOutput.substring(0, 1000)}...`,
            data: { pid: child.pid }
          });
        }
      });

      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('error', (error) => {
        clearTimeout(outputTimeout);
        resolve({
          success: false,
          error: `Failed to start background process: ${error.message}`,
          output: errorOutput
        });
      });

      child.on('exit', (code, signal) => {
        if (code !== null && code !== 0) {
          clearTimeout(outputTimeout);
          resolve({
            success: false,
            error: `Process exited immediately with code ${code}`,
            output: errorOutput || initialOutput
          });
        }
      });
    });
  }

  validate(params: ToolParams): boolean {
    return typeof params.command === 'string';
  }
}