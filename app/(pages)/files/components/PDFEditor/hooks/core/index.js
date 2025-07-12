// app/files/components/PDFEditor/hooks/core/index.js
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// === IMPORT ALL CORE HOOKS ===
import { usePdf } from './pdf/pdf.core.js';
import { useCanvas } from './canvas/canvas.core.js';
import { useOverlay } from './overlay/overlay.core.js';
import { usePageNav } from './pageNav/pageNav.core.js';
import { useSave } from './save/save.core.js';
import { useWorkOrder } from './workOrder/workOrder.core.js';
import { usePrint } from './print/print.core.js';

/**
 * Core Orchestrator Hook (replaces your original useCore)
 * 
 * Combines all the individual core hooks and coordinates them to provide
 * the same interface your component expects. This is the main hook that
 * manages PDF editing functionality.
 */
export function useMain(props) {
  const { doc, refreshFiles, setCurrentDoc, mobileModeActive = false } = props;

  // === BASIC PDF STATE ===
  const [pageReady, setPageReady] = useState(false);

  // === INITIALIZE ALL CORE HOOKS ===
  
  // PDF handling
  const pdfCore = usePdf(doc);
  
  // Overlay management
  const overlayCore = useOverlay();
  
  // Work order management
  const workOrderCore = useWorkOrder(doc);
  
  // Print functionality
  const printCore = usePrint(pdfCore.blobUri);

  // === DRAWING PERMISSIONS ===
  const canDraw = useCallback(() => {
    if (!doc) return false;
    if (!doc.isBatch) return false; // Original files - no drawing until work order is created
    if (doc.status === 'Completed') return false; // Completed batches - no drawing allowed
    if (doc.isArchived) return false; // Archived batches - no drawing allowed
    return true; // Draft, In Progress, and Review batches - drawing allowed
  }, [doc?.isBatch, doc?.status, doc?.isArchived]);

  // Canvas handling (depends on overlay state and page nav)
  const canvasCore = useCanvas(
    pageNavCore.pageNo,
    overlayCore.overlaysRef,
    overlayCore.bakedOverlaysRef,
    overlayCore.sessionOverlaysRef,
    overlayCore.historiesRef,
    overlayCore.setHistory,
    overlayCore.setHistIdx,
    overlayCore.setOverlay,
    setPageReady,
    canDraw,
    overlayCore.histIdx
  );

  // Page navigation (depends on canvas and overlay refs)
    const pageNavCore = usePageNav(
    overlayCore.overlaysRef,
    overlayCore.historiesRef,
    null, // canvasRef - will be set after canvas is initialized
    null, // ctxRef - will be set after canvas is initialized  
    null, // activePointerRef - will be set after canvas is initialized
    null, // strokeStartedRef - will be set after canvas is initialized
    () => {}, // setIsDown placeholder
    overlayCore.setHistory,
    overlayCore.setHistIdx,
    overlayCore.setOverlay,
    setPageReady
    );

  // Update canvas with current page number
  useEffect(() => {
    // We need to reinitialize canvas when page changes
    if (pageNavCore.pageNo) {
      canvasCore.initCanvas();
    }
  }, [pageNavCore.pageNo, canvasCore.initCanvas]);

  // Save operations (depends on multiple hooks)
  const saveCore = useSave(
    doc,
    pageNavCore.pageNo,
    canvasCore.canvasRef,
    canvasCore.ctxRef,
    canvasCore.pageContainerRef,
    overlayCore.overlaysRef,
    overlayCore.historiesRef,
    overlayCore.setHistory,
    overlayCore.setHistIdx,
    overlayCore.setOverlay,
    refreshFiles,
    setCurrentDoc,
    overlayCore.getMergedOverlays,
    overlayCore.preserveStateForSave,
    pdfCore.validateAndCleanBase64
  );

  // === COMPUTED PROPERTIES ===
  const isOriginal = useMemo(() => !doc?.isBatch, [doc?.isBatch]);
  const status = useMemo(() => doc?.status || 'Draft', [doc?.status]);
  const isDraft = useMemo(() => status === 'Draft', [status]);
  const isInProgress = useMemo(() => status === 'In Progress', [status]);
  const isInReview = useMemo(() => status === 'Review', [status]);
  const isCompleted = useMemo(() => status === 'Completed', [status]);
  const isArchived = useMemo(() => doc?.isArchived, [doc?.isArchived]);

  // === DOCUMENT RESET EFFECT ===
  useEffect(() => {
    // Skip reset if this is a save operation
    if (doc?._skipDocumentReset) {
      console.log('📄 Skipping document reset - save operation');
      
      if (setCurrentDoc) {
        setTimeout(() => {
          const { _skipDocumentReset, _preserveOverlays, _preserveHistories, _preservePage, ...cleanDoc } = doc;
          setCurrentDoc(cleanDoc);
        }, 1000);
      }
      return;
    }
    
    if (!doc) return;
    
    console.log('📄 Document changed, resetting PDF editor:', {
      fileName: doc?.fileName,
      isBatch: doc?.isBatch,
      hasSignedPdf: !!doc?.signedPdf,
      hasPageOverlays: !!(doc?.pageOverlays && Object.keys(doc.pageOverlays).length > 0),
      pageOverlaysCount: doc?.pageOverlays ? Object.keys(doc.pageOverlays).length : 0
    });
    
    // Handle post-save state preservation
    const isPostSave = overlayCore.postSaveRef.current || 
                       (overlayCore.stateBackupRef.current && (Date.now() - overlayCore.stateBackupRef.current.timestamp < 3000)) ||
                       doc?._preserveOverlays;

    if (isPostSave) {
      console.log('🔄 Post-save document update - preserving working overlays');
      
      const preservedOverlays = doc?._preserveOverlays || overlayCore.stateBackupRef.current?.overlays || overlayCore.overlaysRef.current;
      const preservedHistories = doc?._preserveHistories || overlayCore.stateBackupRef.current?.histories || overlayCore.historiesRef.current;
      const targetPage = doc?._preservePage || overlayCore.stateBackupRef.current?.currentPage || pageNavCore.pageNo;
      
      overlayCore.overlaysRef.current = preservedOverlays;
      overlayCore.historiesRef.current = preservedHistories;
      
      const pageHistory = overlayCore.historiesRef.current[targetPage] || [];
      const pageOverlay = overlayCore.overlaysRef.current[targetPage] || null;
      
      pageNavCore.setPageNo(targetPage);
      overlayCore.setHistory(pageHistory);
      overlayCore.setHistIdx(pageHistory.length > 0 ? pageHistory.length - 1 : -1);
      overlayCore.setOverlay(pageOverlay);
      
      console.log('✅ Restored overlays for continued editing on page', targetPage);
      
      overlayCore.stateBackupRef.current = null;
      overlayCore.postSaveRef.current = false;
      
      const validPdfData = pdfCore.determinePdfSource(doc);
      if (validPdfData) {
        pdfCore.setBlobUri(validPdfData);
      }
      
      setPageReady(false);
      setTimeout(() => {
        if (canvasCore.canvasRef.current) {
          canvasCore.initCanvas();
        }
      }, 200);
      
      return;
    }
    
    // Normal document change
    const validPdfData = pdfCore.determinePdfSource(doc);
    pdfCore.debugPdfData('Document Reset', validPdfData);
    pdfCore.setBlobUri(validPdfData);
    pageNavCore.setPageNo(1);
    
    // Clear drawing state
    canvasCore.activePointerRef.current = null;
    canvasCore.strokeStartedRef.current = false;
    // canvasCore.setIsDown(false); // This needs to be coordinated
    
    overlayCore.initializeOverlaysFromDocument(doc);
    setPageReady(false);
    
    setTimeout(() => {
      if (canvasCore.canvasRef.current && validPdfData) {
        console.log('🎨 Reinitializing canvas after document change');
        canvasCore.initCanvas();
      }
    }, 200);
  }, [
    doc?._id,
    doc?.fileName,
    doc?.pdf,
    doc?.signedPdf,
    doc?.pageOverlays,
    doc?._skipDocumentReset,
    setCurrentDoc,
    pdfCore,
    overlayCore,
    pageNavCore,
    canvasCore
  ]);

  // === RESIZE OBSERVER EFFECT ===
  useEffect(() => {
    if (!canvasCore.pageContainerRef.current) return;
    const ro = new ResizeObserver(canvasCore.initCanvas);
    ro.observe(canvasCore.pageContainerRef.current);
    return () => ro.disconnect();
  }, [canvasCore.initCanvas, canvasCore.pageContainerRef]);

  // === BACKUP STATE EFFECTS ===
  useEffect(() => {
    overlayCore.backupState(pageNavCore.pageNo);
  }, [overlayCore, pageNavCore.pageNo, overlayCore.overlay]);

  useEffect(() => {
    const timer = setTimeout(() => overlayCore.restoreState(pageNavCore.setPageNo), 100);
    return () => clearTimeout(timer);
  }, [overlayCore, pageNavCore.setPageNo]);

  // === WORK ORDER POLLING MANAGEMENT ===
  useEffect(() => {
    if (workOrderCore.shouldPoll() && !workOrderCore.pollingActiveRef.current) {
      workOrderCore.startWorkOrderPolling();
    } else if (!workOrderCore.shouldPoll() && workOrderCore.pollingActiveRef.current) {
      workOrderCore.stopWorkOrderPolling();
    }
  
    return () => {
      if (!doc?._id) {
        workOrderCore.stopWorkOrderPolling();
      }
    };
  }, [
    doc?._id, 
    doc?.isBatch, 
    doc?.workOrderCreated, 
    doc?.workOrderStatus,
    workOrderCore
  ]);

  // === RETURN UNIFIED INTERFACE (same as your original useCore) ===
  return {
    // === REFS ===
    canvasRef: canvasCore.canvasRef,
    pageContainerRef: canvasCore.pageContainerRef,
    overlaysRef: overlayCore.overlaysRef,
    historiesRef: overlayCore.historiesRef,

    // === STATE ===
    blobUri: pdfCore.blobUri,
    pages: pdfCore.pages,
    pageNo: pageNavCore.pageNo,
    isDraw: canvasCore.isDraw,
    overlay: overlayCore.overlay,
    histIdx: overlayCore.histIdx,
    isSaving: saveCore.isSaving,
    pageReady,

    // === WORK ORDER STATE ===
    workOrderStatus: workOrderCore.workOrderStatus,
    workOrderLoading: workOrderCore.workOrderLoading,
    workOrderError: workOrderCore.workOrderError,
    isCreatingWorkOrder: workOrderCore.isCreatingWorkOrder,
    userInitiatedCreation: workOrderCore.userInitiatedCreation,
    lastWorkOrderNumber: workOrderCore.lastWorkOrderNumber,

    // === COMPUTED ===
    canDraw,
    isOriginal,
    status,
    isDraft,
    isInProgress,
    isInReview,
    isCompleted,
    isArchived,
    workOrderInfo: workOrderCore.workOrderInfo,

    // === ACTIONS ===
    setIsDraw: canvasCore.setIsDraw,
    setPages: pdfCore.setPages,
    pointerDown: canvasCore.pointerDown,
    pointerMove: canvasCore.pointerMove,
    pointerUp: canvasCore.pointerUp,
    pointerCancel: canvasCore.pointerCancel,
    undo: canvasCore.undo,
    save: saveCore.save,
    gotoPage: (next) => pageNavCore.gotoPage(next, pdfCore.pages),
    print: printCore.print,
    initCanvas: canvasCore.initCanvas,

    // === WORK ORDER ACTIONS ===
    checkWorkOrderStatus: workOrderCore.checkWorkOrderStatus,
    startWorkOrderPolling: workOrderCore.startWorkOrderPolling,
    stopWorkOrderPolling: workOrderCore.stopWorkOrderPolling,
    setIsCreatingWorkOrder: workOrderCore.setIsCreatingWorkOrder,
    setUserInitiatedCreation: workOrderCore.setUserInitiatedCreation,
    setLastWorkOrderNumber: workOrderCore.setLastWorkOrderNumber
  };
}

// === EXPORT INDIVIDUAL HOOKS FOR DIRECT ACCESS ===
export { usePdf, useCanvas, useOverlay, usePageNav, useSave, useWorkOrder, usePrint };