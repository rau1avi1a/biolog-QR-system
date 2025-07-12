// app/files/components/PDFEditor/hooks/state/drawing/drawing.state.js
'use client';

import { useCallback } from 'react';

/**
 * Drawing State Hook
 * Handles drawing-related UI state and conditional rendering logic
 */
export function useDrawing(core, mobileModeActive = false) {
  const compact = mobileModeActive;

  // === DRAWING TOGGLE LOGIC ===
  const handleToggleDrawing = useCallback(() => {
    core.setIsDraw(d => !d);
  }, [core.setIsDraw]);

  // === TOOLBAR CONFIGURATION ===
  const getToolbarConfig = useCallback(() => {
    return {
      showSettings: true,
      showDrawingToggle: core.canDraw(),
      showUndo: core.canDraw() && core.histIdx >= 0,
      showPrint: !compact || (compact && typeof window !== 'undefined' && window.innerWidth >= 640),
      drawingEnabled: core.canDraw(),
      undoEnabled: core.canDraw() && core.histIdx >= 0,
      isDrawing: core.isDraw
    };
  }, [core.canDraw, core.histIdx, core.isDraw, compact]);

  // === DRAWING STATUS INDICATORS ===
  const getDrawingStatusIndicators = useCallback(() => {
    const indicators = [];

    // Read-only indicator for original files
    if (core.isOriginal) {
      indicators.push({
        type: 'read_only',
        className: 'text-xs bg-orange-50 text-orange-700 flex items-center gap-1 shrink-0',
        icon: 'Lock',
        text: compact ? 'Read Only' : 'Read Only',
        title: 'This is an original file. Create a work order to enable drawing.'
      });
    }

    // Drawing mode indicator (when drawing is disabled)
    if (!core.canDraw() && core.isOriginal) {
      indicators.push({
        type: 'no_drawing',
        className: 'text-xs bg-gray-50 text-gray-700 border border-gray-200',
        icon: 'PenOff',
        text: compact ? 'No Draw' : 'Drawing Disabled',
        title: 'Drawing is disabled for this file type'
      });
    }

    return indicators;
  }, [core.isOriginal, core.canDraw, compact]);

  // === DRAWING BUTTON CONFIGURATION ===
  const getDrawingButtonConfig = useCallback(() => {
    if (!core.canDraw()) {
      return null;
    }

    return {
      icon: core.isDraw ? 'Pen' : 'PenOff',
      text: compact ? (core.isDraw ? 'Draw' : 'View') : (core.isDraw ? 'Drawing' : 'Viewing'),
      variant: core.isDraw ? 'default' : 'outline',
      className: core.isDraw ? 'bg-blue-600 text-white' : 'bg-white text-gray-700',
      onClick: handleToggleDrawing,
      title: core.isDraw ? 'Switch to viewing mode' : 'Switch to drawing mode'
    };
  }, [core.canDraw, core.isDraw, compact, handleToggleDrawing]);

  // === UNDO BUTTON CONFIGURATION ===
  const getUndoButtonConfig = useCallback(() => {
    if (!core.canDraw()) {
      return null;
    }

    const canUndo = core.histIdx >= 0;

    return {
      icon: 'Undo',
      text: compact ? 'Undo' : 'Undo',
      variant: 'outline',
      disabled: !canUndo,
      onClick: core.undo,
      title: canUndo ? 'Undo last drawing action' : 'No actions to undo',
      className: canUndo ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'
    };
  }, [core.canDraw, core.histIdx, core.undo, compact]);

  return {
    // === EVENT HANDLERS ===
    handleToggleDrawing,

    // === UI CONFIGURATION ===
    toolbarConfig: getToolbarConfig(),
    drawingStatusIndicators: getDrawingStatusIndicators(),
    drawingButtonConfig: getDrawingButtonConfig(),
    undoButtonConfig: getUndoButtonConfig(),

    // === STATUS ===
    canDraw: core.canDraw(),
    isDrawing: core.isDraw,
    canUndo: core.histIdx >= 0
  };
}