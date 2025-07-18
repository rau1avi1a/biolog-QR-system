// app/(pages)/files/components/PDFEditor/hooks/core/index.js - Enhanced with Assembly Build polling
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// === IMPORT ALL CORE HOOKS ===
import { usePdf } from './pdf/pdf.core.js';
import { useCanvas } from './canvas/canvas.core.js';
import { useOverlay } from './overlay/overlay.core.js';
import { usePageNav } from './pageNav/pageNav.core.js';
import { useSave } from './save/save.core.js';
import { useWorkOrder } from './workOrder/workOrder.core.js'; // 🆕 Enhanced with assembly builds
import { usePrint } from './print/print.core.js';

/**
 * Core Orchestrator Hook - Enhanced with Assembly Build polling
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
  
  // 3. Work order management (enhanced with assembly build support)
  const workOrderCore = useWorkOrder(doc, refreshFiles, setCurrentDoc);
  
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
    overlayCore.addSessionOverlay,
    overlayCore.handleUndoForPage
  );

  // 7. Page navigation - now initialize with proper refs
  const pageNavCore = usePageNav(
    overlayCore.overlaysRef,
    overlayCore.historiesRef,
    canvasCore.canvasRef,
    canvasCore.ctxRef,
    canvasCore.activePointerRef,
    canvasCore.strokeStartedRef,
    canvasCore.setIsDown || (() => {}),
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
// 9. Save operations (depends on multiple hooks) - now with proper overlay integration
const saveCore = useSave(
  doc,
  currentPageNo,                     // ✅ CORRECT: pageNo should be here
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
  pdfCore.validateAndCleanBase64,
  overlayCore.getNewSessionOverlays,
  overlayCore.updateBakedOverlays
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
  // 🔥 CRITICAL FIX: Better detection of when to skip reset
  const shouldSkipReset = doc?._skipDocumentReset || 
                         doc?._bomImportCompleted || 
                         doc?._regularSaveCompleted ||  // 🆕 ADD THIS
                         doc?._preservePage ||
                         doc?._preserveOverlays;

  if (shouldSkipReset) {
    console.log('📄 Skipping document reset - preservation flags detected:', {
      _skipDocumentReset: doc._skipDocumentReset,
      _bomImportCompleted: doc._bomImportCompleted,
      _regularSaveCompleted: doc._regularSaveCompleted,  // 🆕 ADD THIS
      _preservePage: doc._preservePage,
      _preserveOverlays: doc._preserveOverlays
    });
    
    // Clean up the flags after preserving state
    if (setCurrentDoc) {
      setTimeout(() => {
        const { 
          _skipDocumentReset, 
          _preserveOverlays, 
          _preserveHistories, 
          _preservePage,
          _bomImportCompleted,
          _regularSaveCompleted,  // 🆕 ADD THIS
          ...cleanDoc 
        } = doc;
        setCurrentDoc(cleanDoc);
      }, 1500); // Longer delay for BOM import
    }
    return;
  }
  
  if (!doc) return;
  
  console.log('📄 Document changed, resetting PDF editor');
  
  // Handle post-save state preservation (existing logic)
  const isPostSave = overlayCore.postSaveRef.current || 
                     (overlayCore.stateBackupRef.current && (Date.now() - overlayCore.stateBackupRef.current.timestamp < 3000));

  if (isPostSave) {
    console.log('🔄 Post-save document update - preserving working overlays');
    
    const preservedOverlays = overlayCore.stateBackupRef.current?.overlays || overlayCore.overlaysRef.current;
    const preservedHistories = overlayCore.stateBackupRef.current?.histories || overlayCore.historiesRef.current;
    const targetPage = overlayCore.stateBackupRef.current?.currentPage || currentPageNo;
    
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
  
  // Normal document change (existing logic continues...)
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
  doc?._bomImportCompleted,    // 🆕 ADD THIS
  doc?._regularSaveCompleted,     // 🆕 ADD THIS
  doc?._preservePage,          // 🆕 ADD THIS
  doc?._preserveOverlays,      // 🆕 ADD THIS
  setCurrentDoc
]);

useEffect(() => {
  // FIXED: Handle assembly build completion
  if (doc?.assemblyBuildCreated && doc?.assemblyBuildTranId && doc?.status === 'Review') {
    console.log('🔄 Assembly build completed - refreshing PDF data for Review status');
    
    const validPdfData = pdfCore.determinePdfSource(doc);
    if (validPdfData) {
      pdfCore.setBlobUri(validPdfData);
      
      // FIXED: Force canvas reinitialization with longer delay for assembly build
      setPageReady(false);
      setTimeout(() => {
        if (canvasCore.canvasRef.current) {
          console.log('🎨 Reinitializing canvas after assembly build completion');
          canvasCore.initCanvas();
        }
      }, 800); // Longer delay for assembly build state changes
    }
  }
}, [doc?.assemblyBuildCreated, doc?.assemblyBuildTranId, doc?.status]);

// Handle work order creation PDF refresh (keep existing)
useEffect(() => {
  if (doc?.workOrderCreated && doc?.signedPdf?.data && !doc?._skipDocumentReset) {
    console.log('🔄 Work order created - refreshing PDF data');
    
    const validPdfData = pdfCore.determinePdfSource(doc);
    if (validPdfData) {
      pdfCore.setBlobUri(validPdfData);
      
      setPageReady(false);
      setTimeout(() => {
        if (canvasCore.canvasRef.current) {
          console.log('🎨 Reinitializing canvas after work order creation');
          canvasCore.initCanvas();
        }
      }, 500);
    }
  }
}, [doc?.workOrderCreated, doc?.signedPdf?.data]);


  useEffect(() => {
  // Handle post-work order creation PDF refresh
  if (doc?.workOrderCreated && doc?.signedPdf?.data && !doc?._skipDocumentReset) {
    console.log('🔄 Work order created - refreshing PDF data');
    
    const validPdfData = pdfCore.determinePdfSource(doc);
    if (validPdfData) {
      pdfCore.setBlobUri(validPdfData);
      
      // Force canvas reinitialization
      setPageReady(false);
      setTimeout(() => {
        if (canvasCore.canvasRef.current) {
          console.log('🎨 Reinitializing canvas after work order creation');
          canvasCore.initCanvas();
        }
      }, 500); // Longer delay for work order creation
    }
  }
}, [doc?.workOrderCreated, doc?.signedPdf?.data]);

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

  // === 🆕 ENHANCED: WORK ORDER + ASSEMBLY BUILD POLLING ===
useEffect(() => {
  const { shouldPollWorkOrder, shouldPollAssemblyBuild } = workOrderCore.shouldPoll();
  
  console.log('🔍 Enhanced Polling decision:', {
    shouldPollWorkOrder,
    shouldPollAssemblyBuild,
    workOrderPollingActive: workOrderCore.pollingActiveRef.current,
    assemblyBuildPollingActive: workOrderCore.assemblyBuildPollingActiveRef.current,
    // Enhanced debugging for assembly build
    assemblyBuildDebug: {
      isCreatingAssemblyBuild: workOrderCore.isCreatingAssemblyBuild,
      assemblyBuildStatus: doc?.assemblyBuildStatus,
      assemblyBuildCreated: doc?.assemblyBuildCreated,
      assemblyBuildTranId: doc?.assemblyBuildTranId
    }
  });
  
  // Work Order Polling
  if (shouldPollWorkOrder && !workOrderCore.pollingActiveRef.current) {
    console.log('🔄 Starting work order polling...');
    workOrderCore.startWorkOrderPolling();
  } else if (!shouldPollWorkOrder && workOrderCore.pollingActiveRef.current) {
    console.log('🛑 Stopping work order polling...');
    workOrderCore.stopWorkOrderPolling();
  }
  
  // FIXED: Assembly Build Polling with better detection
  if (shouldPollAssemblyBuild && !workOrderCore.assemblyBuildPollingActiveRef.current) {
    console.log('🔄 Starting assembly build polling...');
    workOrderCore.startAssemblyBuildPolling();
  } else if (!shouldPollAssemblyBuild && workOrderCore.assemblyBuildPollingActiveRef.current) {
    console.log('🛑 Stopping assembly build polling...');
    workOrderCore.stopAssemblyBuildPolling();
  }

  return () => {
    if (!doc?._id) {
      workOrderCore.stopWorkOrderPolling();
      workOrderCore.stopAssemblyBuildPolling();
    }
  };
}, [
  doc?._id, 
  doc?.isBatch, 
  doc?.workOrderCreated, 
  doc?.workOrderStatus,
  doc?.assemblyBuildStatus,    // Key for assembly build polling
  doc?.assemblyBuildCreated,   // Also important
  workOrderCore.isCreatingWorkOrder,
  workOrderCore.userInitiatedCreation,
  workOrderCore.isCreatingAssemblyBuild  // Key for triggering polling
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
    pageNo: currentPageNo,
    isDraw: canvasCore.isDraw,
    overlay: overlayCore.overlay,
    histIdx: overlayCore.histIdx,
    isSaving: saveCore.isSaving,
    pageReady,

    // === WORK ORDER STATE (existing) ===
    workOrderStatus: workOrderCore.workOrderStatus,
    workOrderLoading: workOrderCore.workOrderLoading,
    workOrderError: workOrderCore.workOrderError,
    isCreatingWorkOrder: workOrderCore.isCreatingWorkOrder,
    userInitiatedCreation: workOrderCore.userInitiatedCreation,
    lastWorkOrderNumber: workOrderCore.lastWorkOrderNumber,

    // === 🆕 NEW: ASSEMBLY BUILD STATE ===
    assemblyBuildStatus: workOrderCore.assemblyBuildStatus,
    assemblyBuildLoading: workOrderCore.assemblyBuildLoading,
    assemblyBuildError: workOrderCore.assemblyBuildError,
    isCreatingAssemblyBuild: workOrderCore.isCreatingAssemblyBuild,
    lastAssemblyBuildNumber: workOrderCore.lastAssemblyBuildNumber,

    // === COMPUTED ===
    canDraw,
    isOriginal,
    status,
    isDraft,
    isInProgress,
    isInReview,
    isCompleted,
    isArchived,
    workOrderInfo: workOrderCore.workOrderInfo, // 🆕 Enhanced with assembly build info

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

    // === WORK ORDER ACTIONS (existing) ===
    checkWorkOrderStatus: workOrderCore.checkWorkOrderStatus,
    startWorkOrderPolling: workOrderCore.startWorkOrderPolling,
    stopWorkOrderPolling: workOrderCore.stopWorkOrderPolling,
    setIsCreatingWorkOrder: workOrderCore.setIsCreatingWorkOrder,
    setUserInitiatedCreation: workOrderCore.setUserInitiatedCreation,
    setLastWorkOrderNumber: workOrderCore.setLastWorkOrderNumber,

    // === 🆕 NEW: ASSEMBLY BUILD ACTIONS ===
    checkAssemblyBuildStatus: workOrderCore.checkAssemblyBuildStatus,
    startAssemblyBuildPolling: workOrderCore.startAssemblyBuildPolling,
    stopAssemblyBuildPolling: workOrderCore.stopAssemblyBuildPolling,
    setIsCreatingAssemblyBuild: workOrderCore.setIsCreatingAssemblyBuild,
    setLastAssemblyBuildNumber: workOrderCore.setLastAssemblyBuildNumber,
    resetAssemblyBuildCreation: workOrderCore.resetAssemblyBuildCreation,
    initializeAssemblyBuildCreation: workOrderCore.initializeAssemblyBuildCreation
  };
}

// === EXPORT INDIVIDUAL HOOKS FOR DIRECT ACCESS ===
export { usePdf, useCanvas, useOverlay, usePageNav, useSave, useWorkOrder, usePrint };