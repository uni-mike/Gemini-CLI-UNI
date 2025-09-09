/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import type { Operation } from '../components/OperationDisplay.js';

interface OperationUpdate {
  id: string;
  status?: Operation['status'];
  details?: string;
  content?: string[];
  filePath?: string;
  lineNumber?: number;
  additions?: number;
  deletions?: number;
}

export function useOperationTracker() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [expandedOperations, setExpandedOperations] = useState<Set<string>>(new Set());

  const addOperation = useCallback((operation: Omit<Operation, 'id' | 'timestamp'>) => {
    const id = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newOperation: Operation = {
      ...operation,
      id,
      timestamp: new Date(),
    };
    
    setOperations(prev => [...prev, newOperation]);
    return id;
  }, []);

  const updateOperation = useCallback((update: OperationUpdate) => {
    setOperations(prev => prev.map(op => 
      op.id === update.id 
        ? { ...op, ...update }
        : op
    ));
  }, []);

  const toggleExpanded = useCallback((operationId: string) => {
    setExpandedOperations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(operationId)) {
        newSet.delete(operationId);
      } else {
        newSet.add(operationId);
      }
      return newSet;
    });
  }, []);

  const clearOperations = useCallback(() => {
    setOperations([]);
    setExpandedOperations(new Set());
  }, []);

  // Convenience methods for common operations
  const addBashOperation = useCallback((command: string) => {
    return addOperation({
      type: 'bash',
      title: command.length > 50 ? command.substring(0, 47) + '...' : command,
      status: 'running',
      details: `Executing: ${command}`,
    });
  }, [addOperation]);

  const addFileUpdateOperation = useCallback((filePath: string, additions: number = 0) => {
    return addOperation({
      type: 'update',
      title: filePath,
      status: 'completed',
      filePath,
      additions,
      details: `Updated ${filePath} with ${additions} addition${additions !== 1 ? 's' : ''}`,
    });
  }, [addOperation]);

  const addReadOperation = useCallback((filePath: string, lineCount: number) => {
    return addOperation({
      type: 'read',
      title: filePath,
      status: 'completed',
      filePath,
      details: `Read ${lineCount} lines`,
    });
  }, [addOperation]);

  const addApprovalOperation = useCallback((description: string) => {
    return addOperation({
      type: 'approval',
      title: description,
      status: 'pending',
      details: `Approval required: ${description}`,
    });
  }, [addOperation]);

  return {
    operations,
    expandedOperations,
    addOperation,
    updateOperation,
    toggleExpanded,
    clearOperations,
    // Convenience methods
    addBashOperation,
    addFileUpdateOperation,
    addReadOperation,
    addApprovalOperation,
  };
}