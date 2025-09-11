# React Ink UI Integration Guide

## Overview

This document explains how the UNIPATH CLI integrates custom approval dialogs with the React Ink terminal UI framework. This integration allows the CLI to show interactive approval prompts that work seamlessly within the terminal interface.

## Architecture

### 1. Event-Driven Communication

The integration uses an event-driven architecture to communicate between different parts of the system:

```
DeepSeek Tool Execution
    ↓
ApprovalManager.requestUIApproval()
    ↓
EventEmitter.emit('approvalNeeded', request)
    ↓
useApprovalSystem Hook (React component)
    ↓
setApprovalConfirmationRequest(request)
    ↓
App.tsx renders approval UI
    ↓
User selects option
    ↓
ApprovalManager.respondToApproval(response)
    ↓
Promise resolves, tool execution continues
```

### 2. Key Components

#### A. ApprovalManager (Core)
- **Location**: `packages/core/src/orchestration/ApprovalManager.ts`
- **Role**: Singleton that manages approval requests and responses
- **Key Methods**:
  - `getInstance()`: Gets the global singleton instance
  - `requestUIApproval()`: Emits events for UI to handle
  - `respondToApproval()`: Resolves pending approval promises

#### B. useApprovalSystem Hook (CLI)
- **Location**: `packages/cli/src/ui/hooks/useApprovalSystem.ts`  
- **Role**: React hook that bridges ApprovalManager events to UI state
- **Responsibilities**:
  - Listens for `approvalNeeded` events from ApprovalManager
  - Converts approval requests into React UI components
  - Handles user responses and sends them back to ApprovalManager

#### C. App.tsx Integration (CLI)
- **Location**: `packages/cli/src/ui/App.tsx`
- **Role**: Main UI component that renders approval dialogs
- **Integration**: Uses conditional rendering to show approval UI when needed

## Implementation Steps

### Step 1: Create the Hook

```typescript
// useApprovalSystem.ts
import React, { useState, useEffect } from 'react';
import { ApprovalManager } from '@unipath/unipath-cli-core';

export function useApprovalSystem() {
  const [approvalConfirmationRequest, setApprovalConfirmationRequest] = useState(null);

  useEffect(() => {
    const setupListener = async () => {
      const approvalManager = ApprovalManager.getInstance();
      
      const handleApprovalNeeded = (request) => {
        // Convert approval request to UI-friendly format
        const confirmationRequest = {
          id: request.id,
          prompt: React.createElement(/* UI components */),
          onConfirm: (response) => {
            // Handle user response and notify ApprovalManager
            approvalManager.respondToApproval(request.id, { 
              approved: response === 'approve',
              reason: `User selected: ${response}`
            });
            setApprovalConfirmationRequest(null);
          }
        };
        
        setApprovalConfirmationRequest(confirmationRequest);
      };

      approvalManager.on('approvalNeeded', handleApprovalNeeded);
    };

    setupListener();
  }, []);

  return { approvalConfirmationRequest };
}
```

### Step 2: Integrate with Main App

```typescript
// App.tsx
import { useApprovalSystem } from './hooks/useApprovalSystem';

const App = () => {
  const { approvalConfirmationRequest } = useApprovalSystem();

  return (
    <Box>
      {/* Other UI components */}
      
      {approvalConfirmationRequest ? (
        <Box flexDirection="column">
          <Box borderStyle="round" borderColor={Colors.AccentYellow}>
            {approvalConfirmationRequest.prompt}
          </Box>
          <RadioButtonSelect
            items={[
              { label: '1️⃣ Approve', value: 'approve' },
              { label: '2️⃣ Skip', value: 'skip' },
              { label: '3️⃣ YOLO', value: 'yolo' },
              { label: '4️⃣ Cancel', value: 'cancel' },
            ]}
            onSelect={approvalConfirmationRequest.onConfirm}
          />
        </Box>
      ) : (
        /* Normal UI */
      )}
    </Box>
  );
};
```

### Step 3: Configure ApprovalManager

```typescript
// ApprovalManager.ts
export class ApprovalManager extends EventEmitter {
  private async requestUIApproval(request) {
    // Wait for UI listeners to be ready
    while (this.listenerCount('approvalNeeded') === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Emit event for UI
    this.emit('approvalNeeded', request);
    
    // Return promise that resolves when UI responds
    return new Promise((resolve) => {
      this.approvalCallbacks.set(request.id, resolve);
    });
  }
}
```

## Key Patterns

### 1. Timing Coordination

**Problem**: ApprovalManager might emit events before React components are ready.

**Solution**: Wait for listeners with timeout and fallback:
```typescript
const maxWaitTime = 5000;
let waitedTime = 0;

while (this.listenerCount('approvalNeeded') === 0 && waitedTime < maxWaitTime) {
  await new Promise(resolve => setTimeout(resolve, 100));
  waitedTime += 100;
}

if (this.listenerCount('approvalNeeded') === 0) {
  // Fallback to console approval
  return this.requestConsoleApproval(request);
}
```

### 2. Component Creation in Hooks

**Problem**: React components can't be created with JSX in hook files.

**Solution**: Use React.createElement:
```typescript
const prompt = React.createElement(Box, { flexDirection: 'column' },
  React.createElement(Text, { color: Colors.AccentYellow }, 'Approval Required'),
  React.createElement(Text, {}, `Operation: ${request.description}`)
);
```

### 3. Multi-Choice Responses

**Problem**: RadioButtonSelect needs to support multiple choice responses, not just boolean.

**Solution**: Use string values and switch statements:
```typescript
onSelect={(value: string) => {
  switch(value) {
    case 'approve': /* handle approve */; break;
    case 'skip': /* handle skip */; break;
    case 'yolo': /* handle yolo mode */; break;
    case 'cancel': /* handle cancel */; break;
  }
}}
```

## Troubleshooting

### Issue: Events Not Received
- **Check**: Are event listeners registered before events are emitted?
- **Solution**: Add waiting mechanism or initialization order fixes

### Issue: UI Not Updating  
- **Check**: Is state being set correctly in the hook?
- **Solution**: Verify `setApprovalConfirmationRequest()` calls

### Issue: Responses Not Working
- **Check**: Is `respondToApproval()` being called with correct request ID?
- **Solution**: Verify request ID matching and callback resolution

## Future Enhancements

1. **Typed Interfaces**: Create proper TypeScript interfaces for all approval types
2. **Animation**: Add smooth transitions for approval dialog appearance
3. **Keyboard Shortcuts**: Add number key shortcuts (1,2,3,4) for quick responses
4. **Theming**: Support different visual themes for approval dialogs
5. **Persistence**: Remember user preferences for similar operations

## Testing

To test the integration:

1. **Unit Tests**: Mock ApprovalManager events and verify hook responses
2. **Integration Tests**: Test full flow from tool execution to UI response
3. **Manual Tests**: Run CLI with approval mode and verify all 4 options work
4. **Timing Tests**: Ensure fallback to console works when UI isn't ready

## Related Files

- `packages/core/src/orchestration/ApprovalManager.ts` - Core approval logic
- `packages/cli/src/ui/hooks/useApprovalSystem.ts` - React integration hook
- `packages/cli/src/ui/App.tsx` - Main UI rendering
- `packages/core/src/core/contentGenerator.ts` - Tool execution integration