/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import type { Operation } from '../components/OperationDisplay.js';

export interface OrchestrationEvent {
  type: 'task_start' | 'task_complete' | 'task_failed' | 'task_progress' | 'plan_created';
  taskId?: string;
  taskDescription?: string;
  progress?: {
    total: number;
    completed: number;
    failed: number;
    inProgress: number;
  };
  message?: string;
  details?: string;
}

export class OrchestrationUIBridge extends EventEmitter {
  private operations: Map<string, string> = new Map(); // taskId -> operationId

  /**
   * Store mapping between task ID and operation ID
   */
  setOperationMapping(taskId: string, operationId: string): void {
    this.operations.set(taskId, operationId);
  }

  /**
   * Get operation ID for a task ID
   */
  getOperationId(taskId: string): string | undefined {
    return this.operations.get(taskId);
  }

  /**
   * Handle progress messages from the orchestration system
   */
  handleProgressMessage(message: string): void {
    console.log(`🎭 UI Bridge: ${message}`); // Keep console log for now
    
    // Parse different types of progress messages
    if (message.includes('📋 Planning tasks')) {
      this.emit('orchestration', {
        type: 'plan_created',
        message,
      });
    } else if (message.includes('⏳') && message.includes('task')) {
      // Extract task info from messages like "⏳ Search the web for..."
      const taskMatch = message.match(/⏳\s+(.+)/);
      if (taskMatch) {
        const taskDescription = taskMatch[1];
        const taskId = this.generateTaskId(taskDescription);
        
        this.emit('orchestration', {
          type: 'task_start',
          taskId,
          taskDescription,
          message,
        });
      }
    } else if (message.includes('✅ Completed:')) {
      // Extract completion info from messages like "✅ Completed: Search the web..."
      const taskMatch = message.match(/✅\s+Completed:\s+(.+)/);
      if (taskMatch) {
        const taskDescription = taskMatch[1];
        const taskId = this.generateTaskId(taskDescription);
        
        this.emit('orchestration', {
          type: 'task_complete',
          taskId,
          taskDescription,
          message,
        });
      }
    } else if (message.includes('❌') && message.includes('failed')) {
      // Handle failures
      const taskMatch = message.match(/❌.*?(.+?)(?:\s+failed|$)/);
      if (taskMatch) {
        const taskDescription = taskMatch[1];
        const taskId = this.generateTaskId(taskDescription);
        
        this.emit('orchestration', {
          type: 'task_failed',
          taskId,
          taskDescription,
          message,
        });
      }
    } else if (message.includes('📊 Execution Summary')) {
      // Handle summary - could extract stats here
      this.emit('orchestration', {
        type: 'task_progress',
        message,
      });
    }
  }

  /**
   * Convert orchestration events to Operation objects for the UI
   */
  createOperationFromEvent(event: OrchestrationEvent): Omit<Operation, 'id' | 'timestamp'> | null {
    switch (event.type) {
      case 'task_start':
        return {
          type: 'build', // Use 'build' as a generic task type
          title: this.truncateTitle(event.taskDescription || 'Task'),
          status: 'running',
          details: event.message || event.taskDescription,
        };
        
      case 'task_complete':
        return {
          type: 'build',
          title: this.truncateTitle(event.taskDescription || 'Task'),
          status: 'completed',
          details: `✅ ${event.taskDescription}`,
        };
        
      case 'task_failed':
        return {
          type: 'build',
          title: this.truncateTitle(event.taskDescription || 'Task'),
          status: 'failed',
          details: `❌ ${event.message || 'Task failed'}`,
        };
        
      default:
        return null;
    }
  }

  private generateTaskId(description: string): string {
    // Simple ID generation based on description hash
    return `task-${description.substring(0, 20).replace(/\s+/g, '-').toLowerCase()}`;
  }

  private truncateTitle(title: string): string {
    return title.length > 50 ? title.substring(0, 47) + '...' : title;
  }

}