// app/files/components/PDFEditor/hooks/core.js
'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { PDFDocument } from 'pdf-lib';
import { filesApi } from '../../../lib/api';

if (typeof window !== 'undefined') {
  const { pdfjs } = await import('react-pdf');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

/**
 * PDFEditor Core Hook
 * 
 * Pure state and data logic for PDF editing including:
 * - PDF rendering and page management
 * - Canvas management and drawing state
 * - Drawing operations with palm rejection
 * - Save operations with workflow support
 * - Work order status management and polling
 * - Print functionality
 */
export function useCore(props) {
  const { doc, refreshFiles, setCurrentDoc, mobileModeActive = false } = props;

  // === CORE PDF STATE ===
  const [blobUri, setBlobUri] = useState(doc?.pdf);
  const [pages, setPages] = useState(1);
  const [pageNo, setPageNo] = useState(1);
  const [pageReady, setPageReady] = useState(false);

  // === DRAWING STATE ===
  const [isDraw, setIsDraw] = useState(true);
  const [isDown, setIsDown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // === OVERLAY & HISTORY STATE ===
  const [overlay, setOverlay] = useState(null);
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);

  // === WORK ORDER STATE ===
  const [workOrderStatus, setWorkOrderStatus] = useState(null);
  const [workOrderLoading, setWorkOrderLoading] = useState(false);
  const [workOrderError, setWorkOrderError] = useState(null);
  const [isCreatingWorkOrder, setIsCreatingWorkOrder] = useState(false);
  const [lastWorkOrderNumber, setLastWorkOrderNumber] = useState(null);
  const [userInitiatedCreation, setUserInitiatedCreation] = useState(false);

  // === REFS ===
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const pageContainerRef = useRef(null);
  const overlaysRef = useRef({});
  const historiesRef = useRef({});
  const activePointerRef = useRef(null);
  const strokeStartedRef = useRef(false);
  const lastMove = useRef(0);
  const intervalRef = useRef(null);
  const mountedRef = useRef(true);
  const pollCountRef = useRef(0);

  // === COMPUTED PROPERTIES ===
  const isOriginal = useMemo(() => !doc?.isBatch, [doc?.isBatch]);
  const status = useMemo(() => doc?.status || 'Draft', [doc?.status]);
  const isDraft = useMemo(() => status === 'Draft', [status]);
  const isInProgress = useMemo(() => status === 'In Progress', [status]);
  const isInReview = useMemo(() => status === 'Review', [status]);
  const isCompleted = useMemo(() => status === 'Completed', [status]);
  const isArchived = useMemo(() => doc?.isArchived, [doc?.isArchived]);

  // === DRAWING PERMISSIONS ===
  const canDraw = useCallback(() => {
    if (!doc) return false;
    if (!doc.isBatch) return false; // Original files - no drawing until work order is created
    if (doc.status === 'Completed') return false; // Completed batches - no drawing allowed
    if (doc.isArchived) return false; // Archived batches - no drawing allowed
    return true; // Draft, In Progress, and Review batches - drawing allowed
  }, [doc?.isBatch, doc?.status, doc?.isArchived]);

  // === WORK ORDER INFO ===
  const workOrderInfo = useMemo(() => {
    if (!doc?.isBatch) return null;
    
    // Use real-time status if available, otherwise fall back to doc data
    const currentStatus = workOrderStatus || {
      created: doc.workOrderCreated,
      status: doc.workOrderStatus,
      workOrderId: doc.workOrderId,
      workOrderNumber: doc.netsuiteWorkOrderData?.tranId
    };
    
    if (currentStatus.created) {
      const workOrderNumber = currentStatus.workOrderNumber || currentStatus.workOrderId;
      const isNetSuite = !!(currentStatus.workOrderNumber && !currentStatus.workOrderNumber.startsWith('LOCAL-'));
      const isPending = currentStatus.status === 'creating' || workOrderNumber?.startsWith('PENDING-');
      const isLocal = workOrderNumber?.startsWith('LOCAL-WO-');
      const isFailed = currentStatus.status === 'failed';
      
      return {
        id: workOrderNumber || 'Unknown',
        workOrderNumber: currentStatus.workOrderNumber,
        internalId: currentStatus.internalId,
        status: currentStatus.status || 'created',
        isNetSuite,
        isLocal,
        isPending,
        isFailed,
        isUpdating: workOrderLoading,
        error: currentStatus.error || workOrderError
      };
    }
    
    return null;
  }, [doc, workOrderStatus, workOrderLoading, workOrderError]);

  // === WORK ORDER STATUS POLLING ===
  const checkWorkOrderStatus = useCallback(async () => {
    if (!doc?._id || !doc?.isBatch || !doc?.workOrderCreated) return;

    try {
      setWorkOrderLoading(true);
      const result = await filesApi.workOrders.getStatus(doc._id);
      
      if (!mountedRef.current) return;

      if (!result.error) {
        setWorkOrderStatus(result.data);
        setWorkOrderError(null);
        pollCountRef.current = 0;
        
        // If work order is now created, stop polling
        if (result.data.status === 'created' || result.data.status === 'failed') {
          console.log('Work order status resolved, stopping polling');
          stopWorkOrderPolling();
        }
      } else {
        setWorkOrderError(result.error);
      }
    } catch (err) {
      if (mountedRef.current) {
        setWorkOrderError(err.message);
        pollCountRef.current++;
        
        // Stop polling after too many failures
        if (pollCountRef.current > 10) {
          console.log('Too many polling failures, stopping');
          stopWorkOrderPolling();
        }
      }
    } finally {
      if (mountedRef.current) {
        setWorkOrderLoading(false);
      }
    }
  }, [doc?._id, doc?.isBatch, doc?.workOrderCreated]);

  const startWorkOrderPolling = useCallback(() => {
    if (intervalRef.current) return; // Already polling

    console.log('Starting work order status polling...');
    
    let pollInterval = 2000; // Start with 2 seconds
    
    const poll = () => {
      checkWorkOrderStatus();
      
      // Gradually increase interval to reduce server load
      if (pollCountRef.current > 5) pollInterval = 5000;  // 5 seconds after 5 polls
      if (pollCountRef.current > 15) pollInterval = 10000; // 10 seconds after 15 polls
      
      intervalRef.current = setTimeout(poll, pollInterval);
    };
    
    poll();
  }, [checkWorkOrderStatus]);

  const stopWorkOrderPolling = useCallback(() => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
      console.log('Work order polling stopped');
    }
  }, []);

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
      cvs.width = Math.round(containerRect.width);
      cvs.height = Math.round(containerRect.height);
      cvs.style.width = `${containerRect.width}px`;
      cvs.style.height = `${containerRect.height}px`;
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

  // === DRAWING HELPERS ===
  const getPos = useCallback((e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const p = e.touches?.[0] || e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  }, []);

  // === DRAWING HANDLERS ===
  const pointerDown = useCallback((e) => {
    if (!isDraw || !pageReady || !canDraw()) return;
    
    // Palm rejection: only allow one active pointer at a time
    if (activePointerRef.current !== null && activePointerRef.current !== e.pointerId) {
      return;
    }
    
    e.preventDefault();
    
    activePointerRef.current = e.pointerId;
    strokeStartedRef.current = true;
    setIsDown(true);
    
    const { x, y } = getPos(e);
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(x, y);
  }, [isDraw, pageReady, canDraw, getPos]);

  const pointerMove = useCallback((e) => {
    if (!isDraw || !isDown || !pageReady || !canDraw()) return;
    
    // Palm rejection: only respond to the active pointer
    if (activePointerRef.current !== e.pointerId) {
      return;
    }
    
    const now = performance.now();
    if (now - lastMove.current < 16) return; // 60 fps throttle
    lastMove.current = now;

    e.preventDefault();
    const { x, y } = getPos(e);
    ctxRef.current.lineTo(x, y);
    ctxRef.current.stroke();
  }, [isDraw, isDown, pageReady, canDraw, getPos]);

  const pointerUp = useCallback((e) => {
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

    // Snapshot with corrected history management
    (window.requestIdleCallback || window.requestAnimationFrame)(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const snap = canvas.toDataURL('image/png');
      
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
    });
  }, [isDraw, pageReady, canDraw, pageNo, histIdx]);

  const pointerCancel = useCallback((e) => {
    if (activePointerRef.current === e.pointerId) {
      activePointerRef.current = null;
      strokeStartedRef.current = false;
      setIsDown(false);
      ctxRef.current.closePath();
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
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (newIdx >= 0 && newIdx < currentHistory.length) {
      // Show the state at newIdx
      const targetState = currentHistory[newIdx];
      
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = targetState;
      
      overlaysRef.current[pageNo] = targetState;
      setOverlay(targetState);
    } else {
      // Clear everything (newIdx is -1)
      delete overlaysRef.current[pageNo];
      setOverlay(null);
    }
  }, [histIdx, pageNo, canDraw]);

  // === PAGE NAVIGATION ===
  const gotoPage = useCallback((next) => {
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
  }, [pages]);

  // === SAVE FUNCTIONALITY ===
  const save = useCallback(async (action = 'save', confirmationData = null) => {
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
        const result = await filesApi.batches.reject(doc._id, confirmationData?.reason || 'No reason provided');
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        setCurrentDoc({
          ...doc,
          ...result.data,
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

        const result = await filesApi.editor.saveFromEditor(
          doc._id,
          editorData,
          action,
          confirmationData
        );
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        // Switch to the new batch
        setCurrentDoc({
          ...result.data,
          pdf: result.data.signedPdf ? 
            `data:application/pdf;base64,${result.data.signedPdf.data}` : 
            doc.pdf,
          isBatch: true,
          originalFileId: result.data.fileId || doc._id
        });
        
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
          
          // Set work order creation flags
          setIsCreatingWorkOrder(true);
          setUserInitiatedCreation(true);
        }

        const result = await filesApi.batches.update(doc._id, updateData);
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        setCurrentDoc({
          ...doc,
          ...result.data,
          pdf: result.data.signedPdf ? 
            `data:application/pdf;base64,${result.data.signedPdf.data}` : 
            doc.pdf,
          isBatch: true
        });
      }

      refreshFiles?.();
      
      // Start polling for work order creation
      if (action === 'create_work_order') {
        setTimeout(() => {
          startWorkOrderPolling();
        }, 1000);
      }
      
    } catch (err) {
      alert('Save error: ' + (err.message || 'Unknown error'));
      // Reset work order creation flags on error
      if (action === 'create_work_order') {
        setIsCreatingWorkOrder(false);
        setUserInitiatedCreation(false);
      }
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [doc, refreshFiles, setCurrentDoc, canDraw, startWorkOrderPolling]);

  // === PRINT FUNCTIONALITY ===
  const buildLetterPdf = useCallback(async (dataUrl) => {
    const [W, H] = [612, 792];
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
    const src = await PDFDocument.load(bytes);
    const out = await PDFDocument.create();
    const pages = await out.embedPages(src.getPages());
    pages.forEach(ep => {
      const s = Math.min(W / ep.width, H / ep.height);
      const x = (W - ep.width * s) / 2;
      const y = (H - ep.height * s) / 2;
      const pg = out.addPage([W, H]);
      pg.drawPage(ep, { x, y, xScale: s, yScale: s });
    });
    return out.save();
  }, []);

  const print = useCallback(async () => {
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
  }, [blobUri, buildLetterPdf]);

  // === DOCUMENT RESET ===
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
      overlaysRef.current = {};
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
  }, [doc, initCanvas]);

  // === WORK ORDER POLLING MANAGEMENT ===
  useEffect(() => {
    if (doc?._id && doc?.isBatch && doc?.workOrderCreated) {
      checkWorkOrderStatus();
    }
  }, [doc?._id, doc?.isBatch, doc?.workOrderCreated, checkWorkOrderStatus]);

  useEffect(() => {
    if (!workOrderStatus) return;

    // Start polling if work order is being created
    if (workOrderStatus.status === 'creating' && workOrderStatus.created) {
      console.log('Work order creating, starting polling...');
      startWorkOrderPolling();
    } 
    // Stop polling if work order is complete, failed, or doesn't exist
    else if (workOrderStatus.status === 'created' || workOrderStatus.status === 'failed' || !workOrderStatus.created) {
      console.log('Work order status final, stopping polling...');
      stopWorkOrderPolling();
    }

    return () => stopWorkOrderPolling();
  }, [workOrderStatus?.status, workOrderStatus?.created, startWorkOrderPolling, stopWorkOrderPolling]);

  // === RESIZE OBSERVER ===
  useEffect(() => {
    if (!pageContainerRef.current) return;
    const ro = new ResizeObserver(initCanvas);
    ro.observe(pageContainerRef.current);
    return () => ro.disconnect();
  }, [initCanvas]);

  // === CLEANUP ===
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopWorkOrderPolling();
    };
  }, [stopWorkOrderPolling]);

  // === RETURN INTERFACE ===
  return {
    // === REFS ===
    canvasRef,
    pageContainerRef,

    // === STATE ===
    blobUri,
    pages,
    pageNo,
    isDraw,
    overlay,
    histIdx,
    isSaving,
    pageReady,

    // === WORK ORDER STATE ===
    workOrderStatus,
    workOrderLoading,
    workOrderError,
    isCreatingWorkOrder,
    userInitiatedCreation,
    lastWorkOrderNumber,

    // === COMPUTED ===
    canDraw,
    isOriginal,
    status,
    isDraft,
    isInProgress,
    isInReview,
    isCompleted,
    isArchived,
    workOrderInfo,

    // === ACTIONS ===
    setIsDraw,
    setPages,
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel,
    undo,
    save,
    gotoPage,
    print,
    initCanvas,

    // === WORK ORDER ACTIONS ===
    checkWorkOrderStatus,
    startWorkOrderPolling,
    stopWorkOrderPolling,
    setIsCreatingWorkOrder,
    setUserInitiatedCreation,
    setLastWorkOrderNumber
  };
}