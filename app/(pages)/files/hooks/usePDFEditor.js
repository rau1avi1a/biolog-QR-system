// app/files/hooks/usePDFEditor.js - Enhanced with Palm Rejection & Better Undo
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { api } from '../lib/api';

export default function usePdfEditorLogic({
  doc,
  refreshFiles,
  setCurrentDoc,
  externalDraw,
  externalSetDraw,
  externalUndo,
  externalSave,
}) {
/* ── draw-mode flag (local or lifted) with workflow restrictions ────────── */
  const [localDraw, setLocalDraw] = useState(true);
  
  // Determine if drawing should be allowed based on document state
  const canDraw = useCallback(() => {
    if (!doc) return false;
    
    // Original files (File model) - no drawing until work order is created
    if (!doc.isBatch) return false;
    
    // Completed batches - no drawing allowed
    if (doc.status === 'Completed') return false;
    
    // Archived batches - no drawing allowed
    if (doc.isArchived) return false;
    
    // Draft, In Progress, and Review batches - drawing allowed
    return true;
  }, [doc?.isBatch, doc?.status, doc?.isArchived]);
  
  const isDraw = canDraw() && (externalDraw ?? localDraw);
  const setIsDraw = (value) => {
    if (!canDraw()) return; // Prevent setting draw mode if not allowed
    if (externalSetDraw) {
      externalSetDraw(value);
    } else {
      setLocalDraw(value);
    }
  };

/* ── PDF + page state ───────────────────────────────────────────── */
  const [blobUri, setBlobUri]     = useState(doc?.pdf);
  const [pages,   setPages]       = useState(1);
  const [pageNo,  setPageNo]      = useState(1);
  const [pageReady, setPageReady] = useState(false);

/* ── overlay / history refs with better undo tracking ────────────────────── */
  const overlaysRef  = useRef({});      // { 1: dataUrl, 2: … }
  const historiesRef = useRef({});      // { 1: [dataUrl,…] }

  const [overlay, setOverlay] = useState(null);
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);

/* ── canvas refs ───────────────────────────────────────────────── */
  const canvasRef        = useRef(null);
  const ctxRef           = useRef(null);
  const pageContainerRef = useRef(null);

/* ── drawing state for palm rejection ────────────────────────────── */
  const [isDown, setIsDown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const activePointerRef = useRef(null); // Track the active pointer ID
  const strokeStartedRef = useRef(false); // Track if we're in the middle of a stroke

/* ───────────────────── initialise canvas on each page ─────────── */
  const initCanvas = useCallback(() => {
    const ctn = pageContainerRef.current;
    const cvs = canvasRef.current;
    if (!ctn || !cvs) return;

    // Get container size
    const containerRect = ctn.getBoundingClientRect();
    const { width: containerWidth, height: containerHeight } = containerRect;
    
    // Find the actual PDF canvas to get the real PDF rendering dimensions
    const pdfCanvas = ctn.querySelector('.react-pdf__Page__canvas');
    if (pdfCanvas) {
      const pdfRect = pdfCanvas.getBoundingClientRect();
      
      // Set our overlay canvas to exactly match the PDF canvas
      const pdfWidth = Math.round(pdfRect.width);
      const pdfHeight = Math.round(pdfRect.height);
      const pdfLeft = Math.round(pdfRect.left - containerRect.left);
      const pdfTop = Math.round(pdfRect.top - containerRect.top);
      
      cvs.width = pdfWidth;
      cvs.height = pdfHeight;
      cvs.style.width = `${pdfWidth}px`;
      cvs.style.height = `${pdfHeight}px`;
      cvs.style.position = 'absolute';
      cvs.style.left = `${pdfLeft}px`;
      cvs.style.top = `${pdfTop}px`;
      
    } else {
      // Fallback: use full container
      cvs.width = Math.round(containerWidth);
      cvs.height = Math.round(containerHeight);
      cvs.style.width = `${containerWidth}px`;
      cvs.style.height = `${containerHeight}px`;
      cvs.style.position = 'absolute';
      cvs.style.left = '0px';
      cvs.style.top = '0px';
    }

    const ctx = cvs.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctxRef.current = ctx;

    // Paint existing overlay
    const o = overlaysRef.current[pageNo];
    if (o) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
      img.src = o;
    }
    setPageReady(true);
  }, [pageNo]);

  /* resize observer keeps canvas crisp on window resize */
  useEffect(() => {
    if (!pageContainerRef.current) return;
    const ro = new ResizeObserver(initCanvas);
    ro.observe(pageContainerRef.current);
    return () => ro.disconnect();
  }, [initCanvas]);

  /* reset when user opens another File OR when document state changes */
  useEffect(() => {
    setBlobUri(doc?.pdf || null);
    setPageNo(1);
    
    // Reset drawing state
    activePointerRef.current = null;
    strokeStartedRef.current = false;
    setIsDown(false);
    
    // For batches with baked PDFs, don't restore overlays since they're already in the PDF
    // Only restore overlays if this is an original file or a batch without a signed PDF
    if (doc?.overlays && !doc?.signedPdf) {
      overlaysRef.current = doc.overlays;
      // Set the overlay for page 1 if it exists
      if (doc.overlays[1]) {
        setOverlay(doc.overlays[1]);
        // Initialize history with the saved overlay
        historiesRef.current[1] = [doc.overlays[1]];
        setHistory([doc.overlays[1]]);
        setHistIdx(0); // Point to the existing overlay
      } else {
        setOverlay(null);
        setHistory([]);
        setHistIdx(-1); // No history, start at -1
      }
    } else {
      // Clear overlays for new documents or baked PDFs
      overlaysRef.current  = {};
      historiesRef.current = {};
      setOverlay(null);
      setHistory([]);
      setHistIdx(-1); // Start at -1 (no strokes)
    }
    
    setPageReady(false);
    
    // Force re-render of canvas to update drawing state
    if (canvasRef.current) {
      setTimeout(() => {
        initCanvas();
      }, 100);
    }
    
    console.log('Document loaded, initial histIdx:', doc?.overlays?.[1] ? 0 : -1);
  }, [doc, initCanvas]);

/* ─────────────────── enhanced drawing helpers with palm rejection ──────────────────────────── */
  const getPos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const p = e.touches?.[0] || e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  };

  const down = (e) => {
    if (!isDraw || !pageReady || !canDraw()) return;
    
    // Palm rejection: only allow one active pointer at a time
    if (activePointerRef.current !== null && activePointerRef.current !== e.pointerId) {
      return; // Ignore additional pointers when one is already active
    }
    
    e.preventDefault();
    
    // Set this as the active pointer
    activePointerRef.current = e.pointerId;
    strokeStartedRef.current = true;
    setIsDown(true);
    
    const { x, y } = getPos(e);
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(x, y);
  };

  /* 60 fps throttle with palm rejection */
  const lastMove = useRef(0);
  const move = (e) => {
    if (!isDraw || !isDown || !pageReady || !canDraw()) return;
    
    // Palm rejection: only respond to the active pointer
    if (activePointerRef.current !== e.pointerId) {
      return;
    }
    
    const now = performance.now();
    if (now - lastMove.current < 16) return;
    lastMove.current = now;

    e.preventDefault();
    const { x, y } = getPos(e);
    ctxRef.current.lineTo(x, y);
    ctxRef.current.stroke();
  };

  const up = (e) => {
    if (!isDraw || !pageReady || !canDraw()) return;
    
    // Only respond to the active pointer
    if (e && activePointerRef.current !== null && activePointerRef.current !== e.pointerId) {
      return;
    }
    
    ctxRef.current.closePath();
    setIsDown(false);
    
    // Reset the active pointer when the stroke ends
    activePointerRef.current = null;
    strokeStartedRef.current = false;

    /* snapshot with corrected history management */
    (window.requestIdleCallback || window.requestAnimationFrame)(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const snap = canvas.toDataURL('image/png');
      
      // Update the overlay for this page
      overlaysRef.current[pageNo] = snap;

      // Get current history
      let currentHistory = historiesRef.current[pageNo] || [];
      
      // IMPORTANT FIX: If we're not at the end of history (we've undone some strokes),
      // truncate the history at the current position before adding the new stroke
      if (histIdx < currentHistory.length - 1) {
        // Truncate history to current position
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
      
      console.log(`Stroke completed. History: [${newHistory.length} items], Current index: ${newIndex}`);
    });
  };

  // Enhanced pointer cancel handler for better palm rejection
  const pointerCancel = (e) => {
    if (activePointerRef.current === e.pointerId) {
      activePointerRef.current = null;
      strokeStartedRef.current = false;
      setIsDown(false);
      ctxRef.current.closePath();
    }
  };

/* ───────────────────── fixed undo (single click, proper behavior) ────────────────────────── */
  const undo = useCallback(() => {
    if (!canDraw()) return;
    
    const currentHistory = historiesRef.current[pageNo] || [];
    if (currentHistory.length === 0) return;
    
    let newIdx = histIdx - 1;
    
    // Ensure we don't go below -1 (completely clear state)
    if (newIdx < -1) {
      console.log('Already at minimum undo state');
      return;
    }
    
    console.log(`Undo: Current index ${histIdx} -> New index ${newIdx} (History length: ${currentHistory.length})`);
    
    // Update the index
    setHistIdx(newIdx);
    
    // Clear the canvas
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (newIdx >= 0 && newIdx < currentHistory.length) {
      // Show the state at newIdx
      const targetState = currentHistory[newIdx];
      console.log(`Restoring state at index ${newIdx}`);
      
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = targetState;
      
      overlaysRef.current[pageNo] = targetState;
      setOverlay(targetState);
    } else {
      // Clear everything (newIdx is -1)
      console.log('Clearing all strokes');
      delete overlaysRef.current[pageNo];
      setOverlay(null);
    }
  }, [histIdx, pageNo, canDraw]);

/* ─────────────────────── SAVE WITH CONFIRMATION SUPPORT ─────────── */
const save = useCallback(
  async (action = 'save', confirmationData = null) => {
    // Check if saving is allowed
    if (!doc) return;
    if (doc.isArchived || doc.status === 'Completed') {
      alert('Cannot save changes to completed or archived files.');
      return;
    }
    
    const overlays = Object.fromEntries(
      Object.entries(overlaysRef.current).filter(([, png]) => png)
    );
    
    // Handle rejection without overlays
    if (action === 'reject') {
      setIsSaving(true);
      try {
        const updateData = { 
          status: 'In Progress',
          wasRejected: true,
          rejectedAt: new Date(),
          rejectionReason: confirmationData?.reason || 'No reason provided'
        };
        
        const { batch } = await api.updateBatch(doc._id, updateData);
        
        setCurrentDoc({
          ...doc,
          ...batch,
          isBatch: true
        });
        
        refreshFiles?.();
      } catch (err) {
        alert('Error during rejection: ' + (err.message || 'Unknown error'));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Get canvas dimensions for proper scaling
    const canvas = canvasRef.current;
    const container = pageContainerRef.current;
    const containerRect = container?.getBoundingClientRect();
    
    const canvasDimensions = canvas ? {
      width: canvas.width,
      height: canvas.height,
      displayWidth: containerRect?.width || canvas.offsetWidth,
      displayHeight: containerRect?.height || canvas.offsetHeight,
      containerRect: containerRect
    } : null;

    setIsSaving(true);
    try {
      const isOriginal = !doc.isBatch && !doc.originalFileId;
      
      if (isOriginal) {
        // Original file - create new batch using the editor API
        const firstOverlay = overlays[1] || overlays[Object.keys(overlays)[0]];
        
        const editorData = {
          overlayPng: firstOverlay,
          annotations: overlays,
          canvasDimensions: canvasDimensions
        };

        const { batch } = await api.saveBatchFromEditor(
          doc._id,
          editorData,
          action,
          confirmationData
        );
        
        // Switch to the new batch
        setCurrentDoc({
          ...batch,
          pdf: batch.signedPdf ? 
            `data:application/pdf;base64,${batch.signedPdf.data}` : 
            doc.pdf,
          isBatch: true,
          originalFileId: batch.fileId || doc._id
        });
        
        // Force a re-render to update drawing capabilities
        setTimeout(() => {
          if (canvasRef.current) {
            initCanvas();
          }
        }, 100);
        
      } else {
        // Existing batch - use updateBatch for all actions
        const firstOverlay = overlays[1] || overlays[Object.keys(overlays)[0]];
        const updateData = {
          overlayPng: firstOverlay,
          annotations: overlays,
          canvasDimensions: canvasDimensions
        };

        if (action === 'submit_review' && confirmationData) {
          updateData.status = 'Review';
          updateData.submittedForReviewAt = new Date();
          
          // Handle chemical transactions
          if (confirmationData.components?.length > 0) {
            updateData.chemicalsTransacted = true;
            updateData.transactionDate = new Date();
            updateData.confirmedComponents = confirmationData.components;
          }
          
          // Handle solution creation
          if (confirmationData.solutionLotNumber) {
            updateData.solutionCreated = true;
            updateData.solutionLotNumber = confirmationData.solutionLotNumber;
            updateData.solutionCreatedDate = new Date();
            
            // Include solution quantity if provided
            if (confirmationData.solutionQuantity) {
              updateData.solutionQuantity = confirmationData.solutionQuantity;
            }
            if (confirmationData.solutionUnit) {
              updateData.solutionUnit = confirmationData.solutionUnit;
            }
          }
          
        } else if (action === 'complete') {
          updateData.status = 'Completed';
          updateData.completedAt = new Date();
        } else if (action === 'create_work_order') {
          updateData.status = 'In Progress';
          updateData.workOrderCreated = true;
          updateData.workOrderId = `WO-${Date.now()}`;
          updateData.workOrderCreatedAt = new Date();
        }

        const { batch } = await api.updateBatch(doc._id, updateData);
        
        setCurrentDoc({
          ...doc,
          ...batch,
          pdf: batch.signedPdf ? 
            `data:application/pdf;base64,${batch.signedPdf.data}` : 
            doc.pdf,
          isBatch: true
        });
        
        // Force a re-render to update drawing capabilities
        setTimeout(() => {
          if (canvasRef.current) {
            initCanvas();
          }
        }, 100);
      }

      refreshFiles?.();
      
    } catch (err) {
      alert('Save error: ' + (err.message || 'Unknown error'));
      throw err;
    } finally {
      setIsSaving(false);
    }
  },
  [doc, refreshFiles, setCurrentDoc, canDraw, initCanvas]
);

/* expose undo / save to toolbar refs (if parent passed them) */
  useEffect(() => {
    if (externalUndo)  externalUndo.current  = undo;
    if (externalSave)  externalSave.current  = () => save('save');
  }, [externalUndo, externalSave, undo, save]);

/* ───────────────────── page navigation with proper state management ────────────────────────── */
  const gotoPage = (next) => {
    if (next < 1 || next > pages) return;
    
    // Reset drawing state when changing pages
    activePointerRef.current = null;
    strokeStartedRef.current = false;
    setIsDown(false);
    
    // Load page history and set proper index
    const pageHistory = historiesRef.current[next] || [];
    const pageOverlay = overlaysRef.current[next] || null;
    
    // Set the history index to the last item (most recent state)
    const newIndex = pageHistory.length > 0 ? pageHistory.length - 1 : -1;
    
    setHistIdx(newIndex);
    setHistory(pageHistory);
    setOverlay(pageOverlay);
    setPageNo(next);
    setPageReady(false);
    
    console.log(`Switched to page ${next}. History length: ${pageHistory.length}, Index: ${newIndex}`);
  };

/* ───────────────────── "print letter" helper (unchanged) ─────── */
  const buildLetterPdf = async (dataUrl) => {
    const [W, H] = [612, 792];
    const bytes  = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
    const src    = await PDFDocument.load(bytes);
    const out    = await PDFDocument.create();
    const pages  = await out.embedPages(src.getPages());
    pages.forEach(ep => {
      const s = Math.min(W / ep.width, H / ep.height);
      const x = (W - ep.width  * s) / 2;
      const y = (H - ep.height * s) / 2;
      const pg = out.addPage([W, H]);
      pg.drawPage(ep, { x, y, xScale: s, yScale: s });
    });
    return out.save();
  };

  const print = async () => {
    const url = URL.createObjectURL(
      new Blob([await buildLetterPdf(blobUri)], { type: 'application/pdf' })
    );
    const w = window.open(url, '_blank');
    if (!w) return;
    const ready = () => {
      w.removeEventListener('load', ready);
      w.print();
      URL.revokeObjectURL(url);
    };
    w.addEventListener('load', ready);
  };

/* ───────────────────── exports ────────────────────────────────── */
  return {
    /* refs for the component */
    canvasRef,
    pageContainerRef,

    /* state for the UI */
    blobUri,
    pages,
    pageNo,
    isDraw,
    overlay,
    histIdx,
    isSaving,
    pageReady,
    canDraw, // Export the canDraw function for UI logic

    /* callbacks for the UI */
    setIsDraw,
    down,
    move,
    up,
    pointerCancel, // Export the pointer cancel handler
    undo,
    save, // Now supports confirmationData parameter
    gotoPage,
    print,
    initCanvas,
    setPages,
  };
}