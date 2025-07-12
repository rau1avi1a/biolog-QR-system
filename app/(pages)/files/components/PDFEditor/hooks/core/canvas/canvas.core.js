// app/files/components/PDFEditor/hooks/core/canvas/canvas.core.js
'use client';

import { useState, useRef, useCallback } from 'react';

/**
 * Canvas Core Hook
 * Handles all canvas-related functionality:
 * - Canvas initialization, sizing, DPI handling
 * - Drawing events and pointer handling
 * - Drawing state management
 * - Palm rejection
 */
export function useCanvas(pageNo, overlaysRef, bakedOverlaysRef, sessionOverlaysRef, historiesRef, setHistory, setHistIdx, setOverlay, setPageReady, canDraw, histIdx) {
  // === DRAWING STATE ===
  const [isDraw, setIsDraw] = useState(true);
  const [isDown, setIsDown] = useState(false);

  // === REFS ===
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const pageContainerRef = useRef(null);
  const activePointerRef = useRef(null);
  const strokeStartedRef = useRef(false);
  const lastMove = useRef(0);

  // === CANVAS INITIALIZATION ===
  const initCanvas = useCallback(() => {
    const ctn = pageContainerRef.current;
    const cvs = canvasRef.current;
    if (!ctn || !cvs) return;

    // Get container size
    const containerRect = ctn.getBoundingClientRect();
    
    // Find the actual PDF canvas to get the real PDF rendering dimensions
    const pdfCanvas = ctn.querySelector('.react-pdf__Page__canvas');
    if (pdfCanvas) {
      const pdfRect = pdfCanvas.getBoundingClientRect();
      
      // ✅ QUALITY FIX: Use device pixel ratio for high-DPI displays
      const devicePixelRatio = window.devicePixelRatio || 1;
      
      // Calculate PDF canvas dimensions
      const pdfWidth = Math.round(pdfRect.width);
      const pdfHeight = Math.round(pdfRect.height);
      const pdfLeft = Math.round(pdfRect.left - containerRect.left);
      const pdfTop = Math.round(pdfRect.top - containerRect.top);
      
      // ✅ QUALITY FIX: Set canvas size with pixel ratio consideration
      const canvasWidth = pdfWidth * devicePixelRatio;
      const canvasHeight = pdfHeight * devicePixelRatio;
      
      // Set internal canvas dimensions (actual drawing area)
      cvs.width = canvasWidth;
      cvs.height = canvasHeight;
      
      // Set CSS dimensions (display size)
      cvs.style.width = `${pdfWidth}px`;
      cvs.style.height = `${pdfHeight}px`;
      cvs.style.position = 'absolute';
      cvs.style.left = `${pdfLeft}px`;
      cvs.style.top = `${pdfTop}px`;
      
      console.log(`🎨 Canvas initialized for page ${pageNo}:`, {
        displaySize: `${pdfWidth}x${pdfHeight}`,
        actualSize: `${canvasWidth}x${canvasHeight}`,
        devicePixelRatio,
        position: `${pdfLeft},${pdfTop}`
      });
      
    } else {
      // Fallback: use full container
      const devicePixelRatio = window.devicePixelRatio || 1;
      const displayWidth = Math.round(containerRect.width);
      const displayHeight = Math.round(containerRect.height);
      
      cvs.width = displayWidth * devicePixelRatio;
      cvs.height = displayHeight * devicePixelRatio;
      cvs.style.width = `${displayWidth}px`;
      cvs.style.height = `${displayHeight}px`;
      cvs.style.position = 'absolute';
      cvs.style.left = '0px';
      cvs.style.top = '0px';
    }

    const ctx = cvs.getContext('2d');
    
    // ✅ QUALITY FIX: Scale the drawing context for high-DPI
    const devicePixelRatio = window.devicePixelRatio || 1;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    
    // Reset transform and set drawing properties
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctxRef.current = ctx;

    // Clear canvas first before drawing overlay
    ctx.clearRect(0, 0, cvs.width / devicePixelRatio, cvs.height / devicePixelRatio);

    const bakedOverlay = bakedOverlaysRef.current[pageNo];
    const sessionOverlay = sessionOverlaysRef.current[pageNo];
    
    console.log(`🎨 Initializing canvas for page ${pageNo}:`, {
      hasBakedOverlay: !!bakedOverlay,
      hasSessionOverlay: !!sessionOverlay,
      combinedOverlay: overlaysRef.current[pageNo] ? 'exists' : 'none'
    });

    // Paint existing overlay for this page
    const o = overlaysRef.current[pageNo];
    if (o) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, cvs.width / devicePixelRatio, cvs.height / devicePixelRatio);
        
        // ✅ QUALITY FIX: Draw with proper scaling
        ctx.drawImage(img, 0, 0, cvs.width / devicePixelRatio, cvs.height / devicePixelRatio);
      };
      img.onerror = () => {
        console.error('🎨 Failed to load overlay for page:', pageNo);
      };
      img.src = o;
    }
    
    // Load page-specific history and overlay state
    const pageHistory = historiesRef.current[pageNo] || [];
    const pageOverlay = overlaysRef.current[pageNo] || null;
    
    if (pageHistory.length > 0) {
      setHistory(pageHistory);
      setHistIdx(pageHistory.length - 1);
      setOverlay(pageOverlay);
      console.log('🎨 Restored page', pageNo, 'history with', pageHistory.length, 'items');
    } else {
      setHistory([]);
      setHistIdx(-1);
      setOverlay(null);
    }
    
    setPageReady(true);
  }, [pageNo, overlaysRef, bakedOverlaysRef, sessionOverlaysRef, historiesRef, setHistory, setHistIdx, setOverlay, setPageReady]);

  // === DRAWING UTILITIES ===
  const getPos = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const p = e.touches?.[0] || e;
    
    return { 
      x: (p.clientX - rect.left), // Keep in display coordinates
      y: (p.clientY - rect.top)   // Canvas scaling handles DPI
    };
  }, []);

  // === DRAWING EVENTS ===
  const pointerDown = useCallback((e) => {
    if (!isDraw || !setPageReady || !canDraw()) return;
    
    // Palm rejection: only allow one active pointer at a time
    if (activePointerRef.current !== null && activePointerRef.current !== e.pointerId) {
      return;
    }
    
    e.preventDefault();
    
    activePointerRef.current = e.pointerId;
    strokeStartedRef.current = true;
    setIsDown(true);
    
    const { x, y } = getPos(e);
    const ctx = ctxRef.current;
    
    // ✅ QUALITY FIX: Better stroke initialization
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    // ✅ NEW: Add a small dot for single clicks/taps
    ctx.arc(x, y, ctx.lineWidth / 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    console.log(`🖊️ Started stroke at (${x.toFixed(1)}, ${y.toFixed(1)}) on page ${pageNo}`);
  }, [isDraw, setPageReady, canDraw, getPos, pageNo]);

  const pointerMove = useCallback((e) => {
    if (!isDraw || !isDown || !setPageReady || !canDraw()) return;
    
    // Palm rejection: only respond to the active pointer
    if (activePointerRef.current !== e.pointerId) {
      return;
    }
    
    const now = performance.now();
    if (now - lastMove.current < 16) return; // 60 fps throttle
    lastMove.current = now;

    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = ctxRef.current;
    
    // ✅ QUALITY FIX: Smoother line drawing
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDraw, isDown, setPageReady, canDraw, getPos]);

  const pointerUp = useCallback((e) => {
    if (!isDraw || !setPageReady || !canDraw()) return;
    
    // Only respond to the active pointer
    if (e && activePointerRef.current !== null && activePointerRef.current !== e.pointerId) {
      return;
    }
    
    const ctx = ctxRef.current;
    ctx.closePath();
    setIsDown(false);
    
    // Reset the active pointer when the stroke ends
    activePointerRef.current = null;
    strokeStartedRef.current = false;

    // ✅ IMPROVED: High-quality snapshot with proper timing
    (window.requestIdleCallback || window.requestAnimationFrame)(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // ✅ QUALITY FIX: Use maximum quality for the snapshot
      const snap = canvas.toDataURL('image/png', 1.0); // Maximum quality
      
      // Update the overlay for this page
      overlaysRef.current[pageNo] = snap;

      // Get current history
      let currentHistory = historiesRef.current[pageNo] || [];
      
      // If we're not at the end of history (we've undone some strokes),
      // truncate the history at the current position before adding the new stroke
      if (histIdx < currentHistory.length - 1) {
        currentHistory = currentHistory.slice(0, histIdx + 1);
      }
      
      // Add the new snapshot to history
      const newHistory = [...currentHistory, snap];
      historiesRef.current[pageNo] = newHistory;
      
      // Set index to point to the current state (last item)
      const newIndex = newHistory.length - 1;
      setHistIdx(newIndex);
      setHistory(newHistory);
      setOverlay(snap);
      
      console.log(`📸 High-quality snapshot saved for page ${pageNo} (history: ${newHistory.length} items)`);
    });
  }, [isDraw, setPageReady, canDraw, pageNo, histIdx]);

  const pointerCancel = useCallback((e) => {
    if (activePointerRef.current === e.pointerId) {
      activePointerRef.current = null;
      strokeStartedRef.current = false;
      setIsDown(false);
      ctxRef.current?.closePath();
    }
  }, []);

  // === UNDO FUNCTIONALITY ===
  const undo = useCallback(() => {
    if (!canDraw()) return;
    
    const currentHistory = historiesRef.current[pageNo] || [];
    if (currentHistory.length === 0) return;
    
    let newIdx = histIdx - 1;
    
    // Ensure we don't go below -1 (completely clear state)
    if (newIdx < -1) return;
    
    // Update the index
    setHistIdx(newIdx);
    
    // Clear the canvas
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    
    const devicePixelRatio = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / devicePixelRatio, canvas.height / devicePixelRatio);

    if (newIdx >= 0 && newIdx < currentHistory.length) {
      // Show the state at newIdx
      const targetState = currentHistory[newIdx];
      
      const img = new Image();
      img.onload = () => {
        // ✅ QUALITY FIX: Restore with proper scaling
        ctx.drawImage(img, 0, 0, canvas.width / devicePixelRatio, canvas.height / devicePixelRatio);
      };
      img.onerror = () => {
        console.error('🎨 Failed to restore overlay state for page:', pageNo);
      };
      img.src = targetState;
      
      overlaysRef.current[pageNo] = targetState;
      setOverlay(targetState);
    } else {
      // Clear everything (newIdx is -1)
      delete overlaysRef.current[pageNo];
      setOverlay(null);
    }
    
    console.log(`↶ Undo on page ${pageNo}: restored to state ${newIdx + 1}/${currentHistory.length}`);
  }, [histIdx, pageNo, canDraw]);

  return {
    // === STATE ===
    isDraw,
    setIsDraw,
    isDown,

    // === REFS ===
    canvasRef,
    ctxRef,
    pageContainerRef,
    activePointerRef,
    strokeStartedRef,
    lastMove,

    // === FUNCTIONS ===
    initCanvas,
    getPos,
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel,
    undo
  };
}