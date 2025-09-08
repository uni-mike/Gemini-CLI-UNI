import { Progress, Task, TaskStatus } from './types';
import chalk from 'chalk';

export class ProgressTracker {
  private startTime: number;
  private lastUpdate: number;
  private spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private spinnerIndex = 0;
  private updateInterval?: NodeJS.Timeout;

  constructor() {
    this.startTime = Date.now();
    this.lastUpdate = Date.now();
  }

  start(): void {
    this.updateInterval = setInterval(() => {
      this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length;
    }, 100);
  }

  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  displayProgress(progress: Progress): void {
    const elapsed = Date.now() - this.startTime;
    const spinner = this.spinnerFrames[this.spinnerIndex];
    
    // Clear previous lines
    process.stdout.write('\x1B[2K\x1B[1A'.repeat(5));
    
    // Header
    console.log(chalk.bold.cyan('\n🎭 Task Orchestration Progress'));
    console.log(chalk.gray('─'.repeat(50)));
    
    // Progress bar
    const percentage = Math.round((progress.completed / progress.total) * 100);
    const barLength = 30;
    const filled = Math.round((percentage / 100) * barLength);
    const empty = barLength - filled;
    
    const progressBar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    console.log(`Progress: ${progressBar} ${percentage}%`);
    
    // Stats
    console.log(
      chalk.white(`Total: ${progress.total} | `) +
      chalk.green(`✅ Completed: ${progress.completed} | `) +
      chalk.yellow(`${spinner} In Progress: ${progress.inProgress} | `) +
      chalk.red(`❌ Failed: ${progress.failed}`)
    );
    
    // Current tasks
    if (progress.currentTasks.length > 0) {
      console.log(chalk.cyan('\nActive Tasks:'));
      progress.currentTasks.forEach((task, index) => {
        console.log(chalk.gray(`  ${index + 1}. ${task.substring(0, 60)}...`));
      });
    }
    
    // Time info
    const timeElapsed = this.formatTime(elapsed);
    const timeRemaining = this.formatTime(progress.estimatedTimeRemaining);
    console.log(
      chalk.gray(`\nElapsed: ${timeElapsed} | Remaining: ${timeRemaining}`)
    );
    
    // Health status indicator
    const healthIcon = this.getHealthIcon(progress.healthStatus);
    console.log(chalk.gray(`Status: ${healthIcon}`));
  }

  displayTaskUpdate(task: Task, event: 'start' | 'complete' | 'retry' | 'fail'): void {
    const timestamp = new Date().toLocaleTimeString();
    let message = '';
    
    switch (event) {
      case 'start':
        message = chalk.blue(`🔧 [${task.id.substring(0, 8)}] ${task.description}`);
        break;
      case 'complete':
        const duration = task.endTime && task.startTime 
          ? this.formatTime(task.endTime - task.startTime)
          : 'unknown';
        message = chalk.green(`✅ [${task.id.substring(0, 8)}] ${task.description} (${duration})`);
        break;
      case 'retry':
        message = chalk.yellow(`🔄 [${task.id.substring(0, 8)}] Retrying ${task.description} (attempt ${task.retryCount + 1})`);
        break;
      case 'fail':
        message = chalk.red(`❌ [${task.id.substring(0, 8)}] Failed: ${task.description}`);
        if (task.error) {
          message += chalk.red(`\n    Error: ${task.error}`);
        }
        break;
    }
    
    console.log(`[${timestamp}] ${message}`);
  }

  displayPhase(phase: string, message: string): void {
    console.log('\n' + chalk.bold.magenta(`📋 ${phase.toUpperCase()}: ${message}`));
    console.log(chalk.gray('─'.repeat(50)));
  }

  displayPlan(tasks: Task[]): void {
    console.log(chalk.bold.cyan('\n📝 Execution Plan:'));
    console.log(chalk.gray('─'.repeat(50)));
    
    tasks.forEach((task, index) => {
      const deps = task.dependencies.length > 0 
        ? ` (depends on: ${task.dependencies.map(d => d.substring(0, 8)).join(', ')})`
        : '';
      
      console.log(
        chalk.white(`${index + 1}. `) +
        chalk.cyan(task.description) +
        chalk.gray(deps)
      );
    });
    
    console.log(chalk.gray('─'.repeat(50)));
  }

  displaySummary(progress: Progress, duration: number): void {
    console.log('\n' + chalk.bold.green('✨ Orchestration Complete!'));
    console.log(chalk.gray('─'.repeat(50)));
    
    console.log(chalk.white('Summary:'));
    console.log(`  • Total tasks: ${progress.total}`);
    console.log(chalk.green(`  • Completed: ${progress.completed}`));
    console.log(chalk.red(`  • Failed: ${progress.failed}`));
    console.log(`  • Total time: ${this.formatTime(duration)}`);
    
    const successRate = Math.round((progress.completed / progress.total) * 100);
    const rateColor = successRate >= 90 ? chalk.green : successRate >= 70 ? chalk.yellow : chalk.red;
    console.log(`  • Success rate: ${rateColor(successRate + '%')}`);
    
    console.log(chalk.gray('─'.repeat(50)));
  }

  displayError(error: Error): void {
    console.error('\n' + chalk.bold.red('🚨 Orchestration Error!'));
    console.error(chalk.red(error.message));
    if (error.stack) {
      console.error(chalk.gray(error.stack));
    }
  }

  displayHealthAlert(status: string, message: string): void {
    const icon = status === 'stuck' ? '🔴' : status === 'degraded' ? '🟡' : '🟢';
    console.warn(`\n${icon} Health Alert: ${message}`);
  }

  private formatTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  }

  private getHealthIcon(status: 'healthy' | 'degraded' | 'stuck'): string {
    switch (status) {
      case 'healthy':
        return chalk.green('🟢 Healthy');
      case 'degraded':
        return chalk.yellow('🟡 Degraded');
      case 'stuck':
        return chalk.red('🔴 Stuck');
      default:
        return chalk.gray('⚪ Unknown');
    }
  }
}