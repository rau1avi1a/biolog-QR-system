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

// === WORK ORDER STATUS POLLING - RESILIENT TO RE-RENDERS ===
const checkWorkOrderStatus = useCallback(async () => {
    if (!doc?._id || !doc?.isBatch) {
      console.log('❌ Skipping work order check: not a batch or missing ID');
      return false; // Return false to indicate no need to continue polling
    }
  
    try {
      console.log('🔍 Checking work order status for batch:', doc._id);
      setWorkOrderLoading(true);
      
      // FIXED: Direct fetch with cache busting and better error handling
      const timestamp = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`/api/batches?id=${doc._id}&action=workorder-status&t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('📊 Work order status API response:', result);
  
      if (result.success && result.data) {
        const statusData = result.data;
        
        console.log('✅ Work order status updated:', {
          created: statusData.created,
          status: statusData.status,
          workOrderNumber: statusData.workOrderNumber,
          workOrderId: statusData.workOrderId,
          error: statusData.error,
          debug: statusData.debug
        });
        
        // Always update the status
        setWorkOrderStatus(statusData);
        setWorkOrderError(null);
        pollCountRef.current = 0;
        
        // Check for completion
        const isComplete = statusData.status === 'created' && statusData.workOrderNumber;
        const isFailed = statusData.status === 'failed';
        const shouldContinue = statusData.status === 'creating' || statusData.status === 'pending';
        
        console.log('🔍 Status analysis:', { isComplete, isFailed, shouldContinue });
        
        if (isComplete) {
          console.log('🎉 Work order created successfully:', statusData.workOrderNumber);
          setLastWorkOrderNumber(statusData.workOrderNumber);
          setIsCreatingWorkOrder(false);
          setUserInitiatedCreation(false);
          return false; // Stop polling
        } else if (isFailed) {
          console.log('❌ Work order creation failed:', statusData.error);
          setIsCreatingWorkOrder(false);
          setUserInitiatedCreation(false);
          return false; // Stop polling
        } else if (shouldContinue) {
          console.log('⏳ Work order still being created, will continue polling...');
          return true; // Continue polling
        } else {
          console.log('🛑 Unknown status, stopping polling:', statusData.status);
          return false; // Stop polling
        }
      } else {
        console.error('❌ Work order status API error:', result.error);
        setWorkOrderError(result.error || 'Failed to get work order status');
        pollCountRef.current++;
        return pollCountRef.current < 10; // Continue polling if under error limit
      }
    } catch (err) {
      console.error('❌ Work order status check failed:', err);
      setWorkOrderError(err.message);
      pollCountRef.current++;
      
      // Continue polling if under error limit
      return pollCountRef.current < 10;
    } finally {
      setWorkOrderLoading(false);
    }
  }, [doc?._id, doc?.isBatch]);
  
  // FIXED: Use a more stable polling approach with useRef
  const pollingActiveRef = useRef(false);
  
  const startWorkOrderPolling = useCallback(() => {
    if (pollingActiveRef.current) {
      console.log('⚠️ Polling already active');
      return;
    }
  
    console.log('🚀 Starting work order status polling...');
    pollingActiveRef.current = true;
    pollCountRef.current = 0;
    
    const poll = async () => {
      // FIXED: Check if polling should still be active
      if (!pollingActiveRef.current) {
        console.log('🛑 Polling stopped externally');
        return;
      }
      
      try {
        const shouldContinue = await checkWorkOrderStatus();
        
        // Continue polling if shouldContinue is true and polling is still active
        if (shouldContinue && pollingActiveRef.current && pollCountRef.current < 30) {
          // Adaptive polling interval
          let delay = 2000; // Start with 2 seconds
          if (pollCountRef.current > 5) delay = 3000;  // 3 seconds after 5 polls
          if (pollCountRef.current > 15) delay = 5000; // 5 seconds after 15 polls
          
          console.log(`🔄 Scheduling next poll in ${delay}ms (attempt ${pollCountRef.current + 1})`);
          pollCountRef.current++;
          
          // Use setTimeout instead of intervalRef for more reliable scheduling
          setTimeout(poll, delay);
        } else {
          console.log('🛑 Polling stopped - shouldContinue:', shouldContinue, 'active:', pollingActiveRef.current, 'count:', pollCountRef.current);
          pollingActiveRef.current = false;
          
          if (pollCountRef.current >= 30) {
            setIsCreatingWorkOrder(false);
            setUserInitiatedCreation(false);
            setWorkOrderError('Work order creation timed out after 5 minutes');
          }
        }
      } catch (error) {
        console.error('❌ Poll iteration failed:', error);
        pollingActiveRef.current = false;
      }
    };
    
    // Start immediately
    poll();
  }, [checkWorkOrderStatus]);
  
  const stopWorkOrderPolling = useCallback(() => {
    if (pollingActiveRef.current) {
      pollingActiveRef.current = false;
      console.log('🛑 Work order polling stopped');
    }
    
    // Also clear the intervalRef if it exists
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);
  
  // === FIXED: POLLING MANAGEMENT - More stable triggers ===
  useEffect(() => {
    // Start polling when work order creation is initiated
    const shouldStartPolling = doc?._id && 
                               doc?.isBatch && 
                               (isCreatingWorkOrder || 
                                userInitiatedCreation || 
                                (doc?.workOrderCreated && doc?.workOrderStatus === 'creating'));
  
    console.log('🤔 Polling decision:', {
      shouldStartPolling,
      docId: doc?._id,
      isBatch: doc?.isBatch,
      isCreatingWorkOrder,
      userInitiatedCreation,
      docWorkOrderCreated: doc?.workOrderCreated,
      docWorkOrderStatus: doc?.workOrderStatus,
      pollingActive: pollingActiveRef.current
    });
  
    if (shouldStartPolling && !pollingActiveRef.current) {
      console.log('🚀 Starting polling - conditions met');
      startWorkOrderPolling();
    } else if (!shouldStartPolling && pollingActiveRef.current) {
      console.log('🛑 Stopping polling - conditions not met');
      stopWorkOrderPolling();
    }
  
    // Cleanup on unmount or doc change
    return () => {
      if (!doc?._id) {
        // Only stop polling if the document actually changed/unmounted
        console.log('📄 Document changed, stopping polling');
        stopWorkOrderPolling();
      }
    };
  }, [
    doc?._id, 
    doc?.isBatch, 
    doc?.workOrderCreated, 
    doc?.workOrderStatus,
    isCreatingWorkOrder, 
    userInitiatedCreation,
    startWorkOrderPolling, 
    stopWorkOrderPolling
  ]);
  
  // === ENHANCED: Work order info computation with better fallbacks ===
  const workOrderInfo = useMemo(() => {
    if (!doc?.isBatch) return null;
    
    console.log('🧮 Computing workOrderInfo:', {
      hasWorkOrderStatus: !!workOrderStatus,
      workOrderStatus,
      docWorkOrderCreated: doc.workOrderCreated,
      docWorkOrderStatus: doc.workOrderStatus,
      docWorkOrderId: doc.workOrderId,
      docNetSuiteTranId: doc.netsuiteWorkOrderData?.tranId,
      lastWorkOrderNumber,
      isCreatingWorkOrder,
      userInitiatedCreation,
      pollingActive: pollingActiveRef.current
    });
    
    // If work order creation is actively in progress, return pending status
    if ((isCreatingWorkOrder || userInitiatedCreation) && !workOrderStatus?.workOrderNumber) {
      return {
        id: 'pending',
        workOrderNumber: null,
        internalId: null,
        status: 'creating',
        isNetSuite: false,
        isLocal: false,
        isPending: true,
        isFailed: false,
        isCreated: false,
        isUpdating: workOrderLoading || pollingActiveRef.current,
        error: workOrderError
      };
    }
    
    // Use real-time status if available, otherwise fall back to doc data
    const currentStatus = workOrderStatus || {
      created: doc.workOrderCreated,
      status: doc.workOrderStatus,
      workOrderId: doc.workOrderId,
      workOrderNumber: doc.netsuiteWorkOrderData?.tranId || lastWorkOrderNumber
    };
    
    if (currentStatus.created || currentStatus.workOrderNumber || currentStatus.workOrderId) {
      const workOrderNumber = currentStatus.workOrderNumber || currentStatus.workOrderId || lastWorkOrderNumber;
      const isNetSuite = !!(workOrderNumber && !workOrderNumber.startsWith('LOCAL-') && !workOrderNumber.startsWith('PENDING-'));
      const isPending = currentStatus.status === 'creating' || 
                       currentStatus.status === 'pending' ||
                       workOrderNumber?.startsWith('PENDING-');
      const isLocal = workOrderNumber?.startsWith('LOCAL-WO-');
      const isFailed = currentStatus.status === 'failed';
      const isCreated = currentStatus.status === 'created' || (workOrderNumber && !isPending && !isFailed);
      
      return {
        id: workOrderNumber || 'Unknown',
        workOrderNumber: currentStatus.workOrderNumber || lastWorkOrderNumber,
        internalId: currentStatus.internalId,
        status: currentStatus.status || 'created',
        isNetSuite,
        isLocal,
        isPending,
        isFailed,
        isCreated,
        isUpdating: workOrderLoading || pollingActiveRef.current,
        error: currentStatus.error || workOrderError
      };
    }
    
    return null;
  }, [
    doc, 
    workOrderStatus, 
    lastWorkOrderNumber, 
    isCreatingWorkOrder, 
    userInitiatedCreation,
    workOrderLoading, 
    workOrderError
  ]);
  
  // === CLEANUP ===
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
      // Don't stop polling on every unmount, let the other effect handle it
      console.log('🔄 Component cleanup - mountedRef set to false');
    };
  }, []);
  
  // Final cleanup on actual unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Final cleanup - stopping all polling');
      pollingActiveRef.current = false;
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
    };
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

    console.log('🔧 CORE.SAVE CALLED:', { action, confirmationData, docFileName: doc?.fileName });

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
        
        // FIXED: Update current document with result
        if (setCurrentDoc && result.data) {
          setCurrentDoc({
            ...doc,
            ...result.data,
            isBatch: true
          });
        }
        
        refreshFiles?.();
        return result; // Return the result
      } catch (err) {
        alert('Error during rejection: ' + (err.message || 'Unknown error'));
        throw err;
      } finally {
        setIsSaving(false);
      }
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
      let result; // Declare result variable
      
      if (isOriginal) {
        // Original file - create new batch using the editor API
        const firstOverlay = overlays[1] || overlays[Object.keys(overlays)[0]];
        
        const editorData = {
          overlayPng: firstOverlay,
          annotations: overlays,
          canvasDimensions: canvasDimensions
        };
  
        // For work order creation, we need to include the scaling data
        if (action === 'create_work_order') {
          editorData.batchQuantity = confirmationData.batchQuantity;
          editorData.batchUnit = confirmationData.batchUnit;
          editorData.scaledComponents = confirmationData.components || confirmationData.scaledComponents;
          editorData.createWorkOrder = true; // Flag to trigger work order creation
        }
  
        result = await filesApi.editor.saveFromEditor(
          doc._id,
          editorData,
          action,
          confirmationData
        );
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        // ENHANCED DEBUG: Check what the save API actually returns
        console.log('🔍 SAVE DEBUG - API Response (Original File):', {
          hasResult: !!result,
          hasResultData: !!(result?.data),
          resultKeys: result?.data ? Object.keys(result.data) : [],
          fileName: result?.data?.fileName,
          runNumber: result?.data?.runNumber,
          status: result?.data?.status,
          overlays: result?.data?.overlays ? Object.keys(result.data.overlays) : [],
          hasSignedPdf: !!(result?.data?.signedPdf),
          action: action
        });
        
        // FIXED: Update current document with new batch data
        if (setCurrentDoc && result.data) {
          const newBatchData = result.data;
          const updatedDoc = {
            ...newBatchData,
            pdf: newBatchData.signedPdf ? 
              `data:application/pdf;base64,${newBatchData.signedPdf.data}` : 
              doc.pdf,
            isBatch: true,
            originalFileId: newBatchData.fileId || doc._id,
            // For work order creation, set initial status
            status: action === 'create_work_order' ? 'In Progress' : (newBatchData.status || 'Draft'),
            workOrderCreated: action === 'create_work_order' ? true : (newBatchData.workOrderCreated || false),
            workOrderStatus: action === 'create_work_order' ? 'creating' : (newBatchData.workOrderStatus || 'not_created')
          };
          
          // ENHANCED DEBUG: Check what we're setting
          console.log('🔍 SAVE DEBUG - Setting Updated Doc (Original File):', {
            fileName: updatedDoc.fileName,
            runNumber: updatedDoc.runNumber,
            status: updatedDoc.status,
            overlays: updatedDoc.overlays ? Object.keys(updatedDoc.overlays) : [],
            hasSignedPdf: !!updatedDoc.signedPdf
          });
          
          setCurrentDoc(updatedDoc);
        }
        
        // Set work order creation flags for UI
        if (action === 'create_work_order') {
          setIsCreatingWorkOrder(true);
          setUserInitiatedCreation(true);
        }
        
      } else {
        // Existing batch - handle different actions
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
          // This shouldn't happen for existing batches, but handle it just in case
          updateData.status = 'In Progress';
          updateData.workOrderCreated = true;
          updateData.workOrderCreatedAt = new Date();
          updateData.batchQuantity = confirmationData.batchQuantity;
          updateData.batchUnit = confirmationData.batchUnit;
          updateData.scaledComponents = confirmationData.components || confirmationData.scaledComponents;
        }
  
        result = await filesApi.batches.update(doc._id, updateData);
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        // ENHANCED DEBUG: Check what the save API actually returns
        console.log('🔍 SAVE DEBUG - API Response (Existing Batch):', {
          hasResult: !!result,
          hasResultData: !!(result?.data),
          resultKeys: result?.data ? Object.keys(result.data) : [],
          fileName: result?.data?.fileName,
          runNumber: result?.data?.runNumber,
          status: result?.data?.status,
          overlays: result?.data?.overlays ? Object.keys(result.data.overlays) : [],
          hasSignedPdf: !!(result?.data?.signedPdf),
          action: action
        });
        
        // ENHANCED DEBUG: Check current document before update
        console.log('🔍 SAVE DEBUG - Current Doc Before Update:', {
          currentFileName: doc?.fileName,
          currentRunNumber: doc?.runNumber,
          currentStatus: doc?.status,
          currentOverlays: doc?.overlays ? Object.keys(doc.overlays) : []
        });
        
        // FIXED: Update current document with updated batch data
        if (setCurrentDoc && result.data) {
          const updatedDoc = {
            ...doc,
            ...result.data,
            pdf: result.data.signedPdf ? 
              `data:application/pdf;base64,${result.data.signedPdf.data}` : 
              doc.pdf,
            isBatch: true
          };
          
          // ENHANCED DEBUG: Check what we're setting
          console.log('🔍 SAVE DEBUG - Setting Updated Doc (Existing Batch):', {
            fileName: updatedDoc.fileName,
            runNumber: updatedDoc.runNumber,
            status: updatedDoc.status,
            overlays: updatedDoc.overlays ? Object.keys(updatedDoc.overlays) : [],
            hasSignedPdf: !!updatedDoc.signedPdf
          });
          
          setCurrentDoc(updatedDoc);
        } else {
          console.warn('⚠️ SAVE DEBUG - No result data to update document with:', {
            hasSetCurrentDoc: !!setCurrentDoc,
            hasResultData: !!(result?.data)
          });
        }
      }
  
      // FIXED: Refresh the file list
      if (refreshFiles) {
        refreshFiles();
      }
      
      // Start polling for work order creation
      if (action === 'create_work_order') {
        setTimeout(() => {
          startWorkOrderPolling();
        }, 1000);
      }
      
      return result; // Return the result
      
    } catch (err) {
      console.error('💥 Save error details:', err);
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