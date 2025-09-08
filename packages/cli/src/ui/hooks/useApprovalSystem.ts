/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import type { ApprovalRequest } from '@unipath/unipath-cli-core';

// Define the structure for approval confirmation requests
interface ApprovalConfirmationRequest {
  id: string;
  prompt: React.ReactNode;
  onConfirm: (confirmed: boolean) => void;
}

/**
 * Hook to integrate ApprovalManager with the CLI's React Ink UI system
 * Listens for approval events and creates confirmation requests for the UI
 */
export function useApprovalSystem() {
  const [approvalConfirmationRequest, setApprovalConfirmationRequest] = 
    useState<ApprovalConfirmationRequest | null>(null);

  useEffect(() => {
    let approvalManager: any = null;

    const setupApprovalListener = async () => {
      try {
        // Import and get the singleton ApprovalManager
        const { ApprovalManager } = await import('@unipath/unipath-cli-core');
        approvalManager = ApprovalManager.getInstance();
        console.log('🔗 Approval system hook: ApprovalManager loaded and listening for events');

        // Listen for approval needed events
        const handleApprovalNeeded = (request: ApprovalRequest) => {
          console.log('🔗 Approval system hook: Received approval request:', request.id);
          // Create a prompt for the CLI UI using React.createElement
          const prompt = React.createElement(Box, { flexDirection: 'column' },
            React.createElement(Text, { color: Colors.AccentYellow }, '🔐 Approval Required'),
            React.createElement(Text, {}, `Operation: ${request.description}`),
            React.createElement(Text, {}, `Risk Level: ${request.riskLevel.toUpperCase()}`),
            request.details.filePath ? React.createElement(Text, {}, `File: ${request.details.filePath}`) : null,
            request.details.command ? React.createElement(Text, {}, `Command: ${request.details.command}`) : null
          );

          // Create the confirmation request for the UI
          const confirmationRequest: ApprovalConfirmationRequest = {
            id: request.id,
            prompt,
            onConfirm: (confirmed: boolean) => {
              // Respond to the approval request
              console.log('🔗 Approval system hook: User responded with:', confirmed);
              approvalManager.respondToApproval(request.id, {
                approved: confirmed,
                reason: confirmed ? 'Approved via CLI' : 'Denied via CLI'
              });
              
              // Clear the confirmation request from UI
              setApprovalConfirmationRequest(null);
            }
          };

          // Show the confirmation request in the UI
          setApprovalConfirmationRequest(confirmationRequest);
        };

        approvalManager.on('approvalNeeded', handleApprovalNeeded);
        console.log('🔗 Approval system hook: Event listener registered, total listeners:', approvalManager.listenerCount('approvalNeeded'));

        return () => {
          if (approvalManager) {
            approvalManager.off('approvalNeeded', handleApprovalNeeded);
          }
        };
      } catch (error) {
        console.error('Failed to setup approval system:', error);
        return () => {};
      }
    };

    setupApprovalListener();

    // Cleanup function is returned from setupApprovalListener
    return () => {};
  }, []);

  // Function to manually clear approval request (e.g., for cleanup)
  const clearApprovalRequest = useCallback(() => {
    setApprovalConfirmationRequest(null);
  }, []);

  return {
    approvalConfirmationRequest,
    clearApprovalRequest
  };
}