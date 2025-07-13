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
 * FIXED: Removed circular dependency by reordering hook initialization
 * FIXED: Added proper function connections between hooks
 */
export function useMain(props) {
  console.log('🔧 Core useMain called with props:', !!props);
  
  const { doc, refreshFiles, setCurrentDoc, mobileModeActive = false } = props;

  // === BASIC PDF STATE ===
  const [pageReady, setPageReady] = useState(false);

  // === DRAWING PERMISSIONS ===
  const canDraw = useCallback(() => {
    if (!doc) return false;
    if (!doc.isBatch) return false;
    if (doc.status === 'Completed') return false;
    if (doc.isArchived) return false;
    return true;
  }, [doc?.isBatch, doc?.status, doc?.isArchived]);

  // === INITIALIZE CORE HOOKS IN DEPENDENCY ORDER ===
  
  // 1. PDF handling (independent)
  const pdfCore = usePdf(doc);
  
  // 2. Overlay management (independent)
  const overlayCore = useOverlay();
  
  // 3. Work order management (independent) 
  const workOrderCore = useWorkOrder(doc);
  
  // 4. Print functionality (depends only on PDF)
  const printCore = usePrint(pdfCore.blobUri);

  // 5. Page navigation - initialize with minimal dependencies first
  const [currentPageNo, setCurrentPageNo] = useState(1);
  
  // 6. Canvas handling - now with proper overlay integration
  const canvasCore = useCanvas(
    currentPageNo,
    overlayCore.overlaysRef,
    overlayCore.bakedOverlaysRef,
    overlayCore.sessionOverlaysRef,
    overlayCore.historiesRef,
    overlayCore.setHistory,
    overlayCore.setHistIdx,
    overlayCore.setOverlay,
    setPageReady,
    canDraw,
    overlayCore.histIdx,
    overlayCore.addSessionOverlay,    // ✅ CRITICAL: Add this parameter
    overlayCore.handleUndoForPage     // ✅ CRITICAL: Add this parameter
  );

  // 7. Page navigation - now initialize with proper refs
  const pageNavCore = usePageNav(
    overlayCore.overlaysRef,
    overlayCore.historiesRef,
    canvasCore.canvasRef,
    canvasCore.ctxRef,
    canvasCore.activePointerRef,
    canvasCore.strokeStartedRef,
    canvasCore.setIsDown || (() => {}), // Fallback if setIsDown doesn't exist
    overlayCore.setHistory,
    overlayCore.setHistIdx,
    overlayCore.setOverlay,
    setPageReady
  );

  // 8. Sync page navigation state with our local state
  useEffect(() => {
    if (pageNavCore.pageNo !== currentPageNo) {
      setCurrentPageNo(pageNavCore.pageNo);
    }
  }, [pageNavCore.pageNo, currentPageNo]);

  // 9. Save operations (depends on multiple hooks) - now with proper overlay integration
  const saveCore = useSave(
    doc,
    currentPageNo,
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
    overlayCore.getMergedOverlays,        // ✅ CRITICAL: Pass overlay merging function
    overlayCore.preserveStateForSave,
    pdfCore.validateAndCleanBase64,
    overlayCore.getNewSessionOverlays,    // ✅ CRITICAL: Add this parameter
    overlayCore.updateBakedOverlays       // ✅ CRITICAL: Add this parameter
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
    
    console.log('📄 Document changed, resetting PDF editor');
    
    // Handle post-save state preservation
    const isPostSave = overlayCore.postSaveRef.current || 
                       (overlayCore.stateBackupRef.current && (Date.now() - overlayCore.stateBackupRef.current.timestamp < 3000)) ||
                       doc?._preserveOverlays;

    if (isPostSave) {
      console.log('🔄 Post-save document update - preserving working overlays');
      
      const preservedOverlays = doc?._preserveOverlays || overlayCore.stateBackupRef.current?.overlays || overlayCore.overlaysRef.current;
      const preservedHistories = doc?._preserveHistories || overlayCore.stateBackupRef.current?.histories || overlayCore.historiesRef.current;
      const targetPage = doc?._preservePage || overlayCore.stateBackupRef.current?.currentPage || currentPageNo;
      
      overlayCore.overlaysRef.current = preservedOverlays;
      overlayCore.historiesRef.current = preservedHistories;
      
      const pageHistory = overlayCore.historiesRef.current[targetPage] || [];
      const pageOverlay = overlayCore.overlaysRef.current[targetPage] || null;
      
      setCurrentPageNo(targetPage);
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
    setCurrentPageNo(1);
    pageNavCore.setPageNo(1);
    
    // Clear drawing state
    if (canvasCore.activePointerRef) {
      canvasCore.activePointerRef.current = null;
    }
    if (canvasCore.strokeStartedRef) {
      canvasCore.strokeStartedRef.current = false;
    }
    
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
    setCurrentDoc
  ]);

  // === OTHER EFFECTS ===
  
  // Resize Observer
  useEffect(() => {
    if (!canvasCore.pageContainerRef.current) return;
    const ro = new ResizeObserver(canvasCore.initCanvas);
    ro.observe(canvasCore.pageContainerRef.current);
    return () => ro.disconnect();
  }, [canvasCore.initCanvas]);

  // Backup State
  useEffect(() => {
    overlayCore.backupState(currentPageNo);
  }, [overlayCore.overlay, currentPageNo]);

  // Restore State
  useEffect(() => {
    const timer = setTimeout(() => overlayCore.restoreState(pageNavCore.setPageNo), 100);
    return () => clearTimeout(timer);
  }, []);

  // Work Order Polling
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
    workOrderCore.isCreatingWorkOrder,
    workOrderCore.userInitiatedCreation
  ]);

  console.log('🔧 Core useMain returning interface');

  // === RETURN UNIFIED INTERFACE ===
  return {
    // === REFS ===
    canvasRef: canvasCore.canvasRef,
    pageContainerRef: canvasCore.pageContainerRef,
    overlaysRef: overlayCore.overlaysRef,
    historiesRef: overlayCore.historiesRef,

    // === STATE ===
    blobUri: pdfCore.blobUri,
    pages: pdfCore.pages,
    pageNo: currentPageNo, // ✅ FIXED: Return our managed page number
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
    gotoPage: (next) => {
      pageNavCore.gotoPage(next, pdfCore.pages);
      setCurrentPageNo(next);
    },
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