# Frontend Architecture Pattern

## Overview

This document defines the standardized frontend architecture pattern used throughout this application. Every component follows the same three-layer modular structure for consistency, maintainability, and future automation capabilities.

## Core Principles

### 1. **Three-Layer Separation**
- **Core Layer**: Pure state and data logic (useState, useEffect, data operations)
- **State Layer**: UI logic, event handlers, conditional rendering logic  
- **Render Layer**: Pure JSX - ONLY return JSX, no logic whatsoever

### 2. **Complete Logic Separation**
- Components should only contain JSX structure
- All conditionals, calculations, and event handling go in state hooks
- All state management and data operations go in core hooks

### 3. **Generic Structure**
- Same folder structure for every component
- Same function names (`useCore`, `useComponentState`) 
- Same file names (`component.jsx`)
- Enables automation and tooling

## File Structure

```
ComponentName/
├── hooks/
│   ├── core.js         # useCore(props) - Pure state/data logic
│   ├── state.js        # useComponentState(core, props) - UI logic/event handlers
│   └── index.js        # Export both hooks
├── render/
│   └── component.jsx   # ComponentName(props) - Pure render component
└── index.js            # Export from render/component
```

## Implementation Pattern

### 1. **hooks/core.js**
```javascript
// Pure state and data logic only
'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';

export function useCore(props) {
  // === STATE (data only) ===
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // === REFS ===
  const someRef = useRef(null);
  
  // === COMPUTED VALUES ===
  const computedValue = useMemo(() => {
    return data ? processData(data) : null;
  }, [data]);
  
  // === DATA OPERATIONS ===
  const loadData = useCallback(async () => {
    setLoading(true);
    const result = await api.getData();
    if (!result.error) {
      setData(result.data);
    }
    setLoading(false);
  }, []);
  
  const saveData = useCallback(async (payload) => {
    return await api.saveData(payload);
  }, []);
  
  // Return only data and functions, no UI logic
  return {
    // State
    data, 
    loading,
    // Refs
    someRef,
    // Computed
    computedValue,
    // Operations
    loadData, 
    saveData
  };
}
```

### 2. **hooks/state.js**
```javascript
// UI logic, event handlers, conditional rendering logic
'use client';

import { useState, useCallback, useMemo } from 'react';

export function useComponentState(core, props) {
  // === UI-ONLY STATE ===
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  
  // === EVENT HANDLERS ===
  const handleSave = useCallback(async () => {
    const result = await core.saveData(selectedItem);
    if (!result.error) {
      setDialogOpen(false);
    }
  }, [core.saveData, selectedItem]);
  
  const handleItemClick = useCallback((item) => {
    setSelectedItem(item);
    setDialogOpen(true);
  }, []);
  
  // === CONDITIONAL LOGIC ===
  const getButtonConfig = useCallback(() => {
    if (core.loading) {
      return { disabled: true, text: 'Loading...' };
    }
    return { disabled: false, text: 'Save' };
  }, [core.loading]);
  
  const getTableRows = useCallback(() => {
    return core.data?.map(item => ({
      id: item.id,
      name: item.name,
      onClick: () => handleItemClick(item)
    })) || [];
  }, [core.data, handleItemClick]);
  
  // === COMPUTED UI PROPS ===
  const dialogProps = useMemo(() => ({
    open: dialogOpen,
    onClose: () => setDialogOpen(false),
    data: selectedItem
  }), [dialogOpen, selectedItem]);
  
  // Return everything component needs to render
  return {
    // UI State
    dialogOpen, 
    selectedItem,
    // Event Handlers
    handleSave, 
    handleItemClick,
    // Computed UI Data
    buttonConfig: getButtonConfig(),
    tableRows: getTableRows(),
    // Props for sub-components
    dialogProps
  };
}
```

### 3. **render/component.jsx**
```javascript
// Pure JSX rendering only
'use client';

import React from 'react';
import { ui } from '@/components/ui';
import { useCore } from '../hooks/core';
import { useComponentState } from '../hooks/state';

export default function ComponentName(props) {
  const core = useCore(props);
  const state = useComponentState(core, props);
  
  if (core.loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <ui.icons.Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1>Component Title</h1>
        <ui.Button 
          disabled={state.buttonConfig.disabled}
          onClick={state.handleSave}
        >
          {state.buttonConfig.text}
        </ui.Button>
      </div>
      
      <ui.Table>
        <ui.TableBody>
          {state.tableRows.map(row => (
            <ui.TableRow key={row.id} onClick={row.onClick}>
              <ui.TableCell>{row.name}</ui.TableCell>
            </ui.TableRow>
          ))}
        </ui.TableBody>
      </ui.Table>
      
      <SomeDialog {...state.dialogProps} />
    </div>
  );
}
```

### 4. **index.js** (Main export)
```javascript
// Export the main component
export { default } from './render/component';
```

### 5. **hooks/index.js** (Hook exports)
```javascript
// Export hooks for advanced usage
export { useCore } from './core';
export { useComponentState } from './state';
```

## Key Dependencies

### **Unified UI System:**
```javascript
import { ui } from '@/components/ui'
// Provides: ui.Button, ui.Table, ui.icons.Search, etc.
```

### **Unified API Client:**
```javascript
import { api } from '@/app/apiClient'
// Provides: api.list.items(), api.create.item(), etc.
```

## Usage Examples

### **Basic Component Usage:**
```javascript
import ComponentName from './components/ComponentName';

function ParentComponent() {
  return <ComponentName someProp="value" />;
}
```

### **Advanced Hook Usage:**
```javascript
import { useCore, useComponentState } from './components/ComponentName/hooks';

function CustomWrapper(props) {
  const core = useCore(props);
  const state = useComponentState(core, props);
  
  // Custom logic here
  return <CustomRender core={core} state={state} />;
}
```

## Error Handling

### **Core Layer (Data)**
- Handle all API errors
- Expose error state for UI layer
- Log errors for development (dev-only, concise)

```javascript
const [error, setError] = useState(null);

const loadData = useCallback(async () => {
  try {
    setError(null);
    const result = await api.getData();
    // handle success
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.log('❌ loadData failed:', err.message);
    }
    setError(err.message);
  }
}, []);
```

### **State Layer (UI)**
- Handle UI errors and validation
- Display error messages
- Reset error states

```javascript
const getErrorProps = useCallback(() => {
  if (core.error) {
    return {
      variant: 'destructive',
      message: core.error
    };
  }
  return null;
}, [core.error]);
```

## Benefits

1. **Pure Components**: JSX-only components are easy to read and test
2. **Clear Separation**: Logic vs UI logic vs rendering
3. **Reusable Hooks**: Can reuse core hooks across components
4. **Easy Testing**: Each layer can be tested independently
5. **Maintainable**: Logic changes don't affect rendering and vice versa
6. **Consistent Patterns**: Same structure across all components
7. **Automation Ready**: Predictable structure enables tooling

## Future Automation Possibilities

With this consistent structure, you can build:

### **Component Generator:**
```bash
npm run create-component MyNewComponent
# Auto-generates the complete folder structure
```

### **Component Analysis:**
```javascript
function analyzeComponent(componentName) {
  return {
    coreLines: getLineCount(`${componentName}/hooks/core.js`),
    stateLines: getLineCount(`${componentName}/hooks/state.js`),
    renderLines: getLineCount(`${componentName}/render/component.jsx`)
  };
}
```

### **Automated Testing:**
```javascript
// Auto-generate test suites for each layer
generateComponentTests(componentName, {
  testCore: true,
  testState: true,
  testRender: true
});
```

## Migration Guide

### **From Old Pattern:**
```javascript
// OLD - Everything mixed together
function Component() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const handleClick = () => { /* logic */ };
  const loadData = async () => { /* logic */ };
  
  return <div>{/* JSX */}</div>;
}
```

### **To New Pattern:**
```javascript
// NEW - Separated layers
function Component(props) {
  const core = useCore(props);           // Data logic
  const state = useComponentState(core, props); // UI logic
  return <div>{/* Pure JSX */}</div>;    // Render only
}
```

## Best Practices

1. **Keep core.js pure** - No UI concerns, only data and state
2. **Keep state.js focused** - Only UI logic, no data fetching
3. **Keep component.jsx simple** - Only JSX structure, no logic
4. **Use descriptive names** - Clear function and variable names
5. **Consistent exports** - Always export from the same locations
6. **Document complex logic** - Add comments for complex computations

## Example Components

- **FileNavigator**: Complete implementation following this pattern
- Location: `app/files/components/FileNavigator/`

This pattern ensures every component follows the same structure, making the codebase highly predictable, maintainable, and ready for future automation.