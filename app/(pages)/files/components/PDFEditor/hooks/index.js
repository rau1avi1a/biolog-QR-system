// app/files/components/PDFEditor/hooks/index.js
'use client';

import * as core from './core';
import * as state from './state';

/**
 * PDFEditor Hooks - Main Export
 * 
 * Single import point for all PDFEditor functionality.
 * Provides both the main orchestrator hooks and granular access to individual hooks.
 * 
 * Usage:
 *   import hooks from '../hooks';
 *   const core = hooks.core.useMain(props);
 *   const state = hooks.state.useMain(core, props);
 * 
 * Or for direct access to individual hooks:
 *   const pdfCore = hooks.core.usePdf(doc);
 *   const drawingState = hooks.state.useDrawing(core, mobileModeActive);
 */
const hooks = {
  // === CORE HOOKS (Pure Logic) ===
  core: {
    // Main orchestrator hook (replaces your original useCore)
    useMain: core.useMain,
    
    // Individual core hooks for granular access
    usePdf: core.usePdf,
    useCanvas: core.useCanvas,
    useOverlay: core.useOverlay,
    usePageNav: core.usePageNav,
    useSave: core.useSave,
    useWorkOrder: core.useWorkOrder,
    usePrint: core.usePrint
  },

  // === STATE HOOKS (React UI Logic) ===
  state: {
    // Main orchestrator hook (replaces your original useComponentState)
    useMain: state.useMain,
    
    // Individual state hooks for granular access
    useDrawing: state.useDrawing,
    useWorkOrder: state.useWorkOrder,
    useSaveDialog: state.useSaveDialog,
    usePermissions: state.usePermissions,
    useNavigation: state.useNavigation,
    useLayout: state.useLayout
  }
};

export default hooks;

// === NAMED EXPORTS FOR BACKWARDS COMPATIBILITY ===
// If you want to import specific categories
export const coreHooks = hooks.core;
export const stateHooks = hooks.state;

// === DIRECT EXPORTS FOR ADVANCED USAGE ===
// If you want to import individual hooks directly
export const {
  useMain: useCoreMain,
  usePdf,
  useCanvas,
  useOverlay,
  usePageNav,
  useSave,
  useWorkOrder,
  usePrint
} = core;

export const {
  useMain: useStateMain,
  useDrawing,
  useWorkOrder: useWorkOrderState,
  useSaveDialog,
  usePermissions,
  useNavigation,
  useLayout
} = state;