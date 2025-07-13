// app/(pages)/files/components/PDFEditor/hooks/core/overlay/overlay.core.js
'use client';

import { useState, useRef, useCallback } from 'react';

/**
 * FIXED Overlay Core Hook
 * Properly separates baked overlays (permanent) from session overlays (temporary)
 */
export function useOverlay() {
  // === OVERLAY & HISTORY STATE ===
  const [overlay, setOverlay] = useState(null);
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);

  // === OVERLAY REFS ===
  const overlaysRef = useRef({}); // Current session overlays (baked + new combined for display)
  const bakedOverlaysRef = useRef({}); // Only the overlays that were baked into PDF (permanent)
  const sessionOverlaysRef = useRef({}); // Only new overlays from current session (temporary)
  const historiesRef = useRef({});

  // === STATE BACKUP REFS ===
  const stateBackupRef = useRef(null);
  const postSaveRef = useRef(false);

  // === STATE BACKUP & RESTORATION ===
  const backupState = useCallback((pageNo) => {
    if (Object.keys(overlaysRef.current).length > 0) {
      stateBackupRef.current = {
        overlays: { ...overlaysRef.current },
        bakedOverlays: { ...bakedOverlaysRef.current },
        sessionOverlays: { ...sessionOverlaysRef.current },
        histories: { ...historiesRef.current },
        currentPage: pageNo,
        timestamp: Date.now()
      };
      console.log('💾 Backed up overlay state:', {
        overlayPages: Object.keys(stateBackupRef.current.overlays),
        bakedPages: Object.keys(stateBackupRef.current.bakedOverlays),
        sessionPages: Object.keys(stateBackupRef.current.sessionOverlays)
      });
    }
  }, []);

  const restoreState = useCallback((setPageNo) => {
    if (stateBackupRef.current && (Date.now() - stateBackupRef.current.timestamp < 5000)) {
      console.log('🔄 Restoring overlay state after reload:', Object.keys(stateBackupRef.current.overlays));
      overlaysRef.current = stateBackupRef.current.overlays;
      bakedOverlaysRef.current = stateBackupRef.current.bakedOverlays || {};
      sessionOverlaysRef.current = stateBackupRef.current.sessionOverlays || {};
      historiesRef.current = stateBackupRef.current.histories;
      setPageNo?.(stateBackupRef.current.currentPage);
      
      const pageOverlay = overlaysRef.current[stateBackupRef.current.currentPage];
      const pageHistory = historiesRef.current[stateBackupRef.current.currentPage] || [];
      
      if (pageHistory.length > 0) {
        setHistory(pageHistory);
        setHistIdx(pageHistory.length - 1);
        setOverlay(pageOverlay);
      }
      
      stateBackupRef.current = null; // Clear after use
    }
  }, []);

  // === OVERLAY INITIALIZATION FROM DOCUMENT ===
  const initializeOverlaysFromDocument = useCallback((doc) => {
    console.log('🎨 Initializing overlays from document:', {
      hasPageOverlays: !!(doc?.pageOverlays && Object.keys(doc.pageOverlays).length > 0),
      hasLegacyOverlays: !!(doc?.overlays && Object.keys(doc.overlays).length > 0),
      hasSignedPdf: !!doc?.signedPdf
    });

    // ✅ CRITICAL FIX: Initialize baked overlays from document
    if (doc?.pageOverlays && Object.keys(doc.pageOverlays).length > 0) {
      console.log('🎨 Loading baked overlays from pageOverlays:', Object.keys(doc.pageOverlays));
      
      // These are BAKED overlays - permanent and already in the PDF
      bakedOverlaysRef.current = { ...doc.pageOverlays };
      
      // Display overlays start with baked overlays
      overlaysRef.current = { ...doc.pageOverlays };
      
      // No session overlays initially (user hasn't drawn anything new yet)
      sessionOverlaysRef.current = {};
      
      // Set overlay and history for page 1
      if (doc.pageOverlays[1]) {
        setOverlay(doc.pageOverlays[1]);
        historiesRef.current[1] = [doc.pageOverlays[1]];
        setHistory([doc.pageOverlays[1]]);
        setHistIdx(0);
      }
      
      // Initialize histories for all pages with baked overlays
      Object.keys(doc.pageOverlays).forEach(pageNum => {
        const pageNumber = parseInt(pageNum);
        if (!isNaN(pageNumber)) {
          historiesRef.current[pageNumber] = [doc.pageOverlays[pageNumber]];
        }
      });
      
      console.log('✅ Initialized with baked overlays:', {
        bakedPages: Object.keys(bakedOverlaysRef.current),
        displayPages: Object.keys(overlaysRef.current)
      });
      
    } else if (doc?.overlays && Object.keys(doc.overlays).length > 0 && !doc?.signedPdf) {
      console.log('🎨 Loading legacy overlays (no baked separation)');
      
      // Legacy format - treat as session overlays since they're not baked yet
      bakedOverlaysRef.current = {};
      sessionOverlaysRef.current = { ...doc.overlays };
      overlaysRef.current = { ...doc.overlays };
      
      // Set overlay and history for page 1
      if (doc.overlays[1]) {
        setOverlay(doc.overlays[1]);
        historiesRef.current[1] = [doc.overlays[1]];
        setHistory([doc.overlays[1]]);
        setHistIdx(0);
      } else {
        setOverlay(null);
        setHistory([]);
        setHistIdx(-1);
      }
      
      // Initialize histories for all pages with overlays
      Object.keys(doc.overlays).forEach(pageNum => {
        const pageNumber = parseInt(pageNum);
        if (!isNaN(pageNumber)) {
          historiesRef.current[pageNumber] = [doc.overlays[pageNumber]];
        }
      });
      
    } else {
      console.log('🧹 No overlays found, clearing all overlay state');
      bakedOverlaysRef.current = {};
      overlaysRef.current = {};
      sessionOverlaysRef.current = {};
      historiesRef.current = {};
      setOverlay(null);
      setHistory([]);
      setHistIdx(-1);
    }
  }, []);

  // === NEW OVERLAY TRACKING ===
  const addSessionOverlay = useCallback((pageNo, overlayData) => {
    console.log(`🖊️ Adding session overlay for page ${pageNo}`);
    
    // Add to session overlays (new drawings)
    sessionOverlaysRef.current[pageNo] = overlayData;
    
    // Update display overlays (baked + session combined)
    overlaysRef.current[pageNo] = overlayData;
    
    console.log('📊 Overlay state after adding session overlay:', {
      bakedPages: Object.keys(bakedOverlaysRef.current),
      sessionPages: Object.keys(sessionOverlaysRef.current),
      displayPages: Object.keys(overlaysRef.current)
    });
  }, []);

  // === OVERLAY MERGING FOR SAVE OPERATIONS ===
  const getMergedOverlays = useCallback((doc) => {
    console.log('📄 Building merged overlay data for save...');
    
    // ✅ CRITICAL FIX: Start with existing BAKED overlays from the document
    let existingBakedOverlays = {};
    if (doc.pageOverlays && typeof doc.pageOverlays === 'object') {
      existingBakedOverlays = { ...doc.pageOverlays };
      console.log('📄 Found existing baked overlays in document:', Object.keys(existingBakedOverlays));
    } else if (doc.overlays && typeof doc.overlays === 'object') {
      existingBakedOverlays = { ...doc.overlays };
      console.log('📄 Found existing overlays (legacy format):', Object.keys(existingBakedOverlays));
    }
    
    // Get current session overlays (new drawings only)
    const currentSessionOverlays = Object.fromEntries(
      Object.entries(sessionOverlaysRef.current).filter(([, png]) => png)
    );
    
    console.log('🔍 Session overlays for merge:', {
      sessionPages: Object.keys(currentSessionOverlays),
      sessionOverlays: Object.keys(currentSessionOverlays).map(page => ({
        page,
        hasData: !!currentSessionOverlays[page],
        dataLength: currentSessionOverlays[page]?.length
      }))
    });
    
    // ✅ CRITICAL FIX: Merge baked + session, with session taking precedence
    const mergedOverlays = {
      ...existingBakedOverlays,  // Start with what's already baked in PDF
      ...currentSessionOverlays  // Add new session overlays
    };
    
    console.log('🔧 Overlay merge details for save:', {
      existingBakedCount: Object.keys(existingBakedOverlays).length,
      existingBakedPages: Object.keys(existingBakedOverlays),
      sessionOverlaysCount: Object.keys(currentSessionOverlays).length,
      sessionPages: Object.keys(currentSessionOverlays),
      mergedOverlaysCount: Object.keys(mergedOverlays).length,
      mergedPages: Object.keys(mergedOverlays),
      finalMergedData: Object.keys(mergedOverlays).map(page => ({
        page,
        hasData: !!mergedOverlays[page],
        dataLength: mergedOverlays[page]?.length,
        isFromSession: !!currentSessionOverlays[page],
        isFromBaked: !!existingBakedOverlays[page]
      }))
    });

    return mergedOverlays;
  }, []);

  // === GET ONLY NEW SESSION OVERLAYS (for efficient saves) ===
  const getNewSessionOverlays = useCallback((doc) => {
    console.log('📄 Building new session overlays for save...');
    
    // Get existing baked overlays
    let existingBakedOverlays = {};
    if (doc.pageOverlays && typeof doc.pageOverlays === 'object') {
      existingBakedOverlays = { ...doc.pageOverlays };
    }
    
    // Get current session overlays
    const currentSessionOverlays = Object.fromEntries(
      Object.entries(sessionOverlaysRef.current).filter(([, png]) => png)
    );
    
    // ✅ CRITICAL: Only send overlays that are NEW or DIFFERENT from baked ones
    const newOverlaysToSave = {};
    Object.entries(currentSessionOverlays).forEach(([pageNum, sessionOverlay]) => {
      const bakedOverlay = existingBakedOverlays[pageNum];
      
      // Only include if this overlay is different from what's already baked
      if (!bakedOverlay || sessionOverlay !== bakedOverlay) {
        newOverlaysToSave[pageNum] = sessionOverlay;
        console.log(`📄 Page ${pageNum}: New overlay to save (different from baked)`);
      } else {
        console.log(`📄 Page ${pageNum}: Overlay unchanged from baked version, skipping`);
      }
    });
    
    console.log('🔧 New overlay save analysis:', {
      existingBakedCount: Object.keys(existingBakedOverlays).length,
      sessionOverlaysCount: Object.keys(currentSessionOverlays).length,
      newOverlaysToSaveCount: Object.keys(newOverlaysToSave).length,
      newPages: Object.keys(newOverlaysToSave)
    });

    return newOverlaysToSave;
  }, []);

  // === UPDATE BAKED OVERLAYS AFTER SAVE ===
  const updateBakedOverlays = useCallback((newOverlays, currentPage = null) => {
    console.log('✅ Updating baked overlays after save:', Object.keys(newOverlays));
    
    // Add newly saved overlays to baked overlays
    Object.keys(newOverlays).forEach(pageNum => {
      const pageNumber = parseInt(pageNum);
      bakedOverlaysRef.current[pageNumber] = newOverlays[pageNumber];
      
      // ✅ CRITICAL FIX: Reset history for pages that were just baked
      // The baked overlay becomes the new "starting point" - no undo beyond this
      historiesRef.current[pageNumber] = [newOverlays[pageNumber]];
      
      // ✅ CRITICAL FIX: Clear session overlay for this page since it's now baked
      delete sessionOverlaysRef.current[pageNumber];
      
      // ✅ DISPLAY FIX: Update display overlay to show ONLY the baked version
      overlaysRef.current[pageNumber] = newOverlays[pageNumber];
      
      console.log(`🔒 Page ${pageNumber}: Overlay baked, session cleared, display updated to baked version`);
    });
    
    console.log('✅ Overlay state after baking update:', {
      bakedPages: Object.keys(bakedOverlaysRef.current),
      sessionPages: Object.keys(sessionOverlaysRef.current)
    });
    
    // ✅ UPDATE UI STATE: If current page was baked, update the UI state
    const currentPageStr = currentPage?.toString();
    if (currentPageStr && newOverlays[currentPageStr]) {
      const bakedOverlay = newOverlays[currentPageStr];
      setOverlay(bakedOverlay);
      setHistory([bakedOverlay]);
      setHistIdx(0); // Point to the baked overlay (index 0 in the new single-item history)
      
      console.log(`🔒 Updated UI state for current page ${currentPage}: history reset to baked overlay, session cleared`);
    }
    
    // ✅ CANVAS REFRESH: Force canvas to redraw with only the baked overlay
    // This should remove any double-overlay visual artifacts
    console.log('🎨 Requesting canvas refresh to display baked overlay only');
  }, [setOverlay, setHistory, setHistIdx]);

  // === UNDO HANDLING ===
  const handleUndoForPage = useCallback((pageNo) => {
    console.log(`↶ Processing undo for page ${pageNo}`);
    
    // Get current page history
    const pageHistory = historiesRef.current[pageNo] || [];
    const currentHistIdx = histIdx;
    
    if (pageHistory.length === 0) {
      console.log(`↶ No history for page ${pageNo}, nothing to undo`);
      return null;
    }
    
    // Calculate what the overlay should be after undo
    const newIdx = currentHistIdx - 1;
    
    // ✅ CRITICAL FIX: Check if we're trying to undo past the baked overlay
    const bakedOverlay = bakedOverlaysRef.current[pageNo];
    let targetOverlay = null;
    
    if (newIdx >= 0 && newIdx < pageHistory.length) {
      targetOverlay = pageHistory[newIdx];
      
      // ✅ BOUNDARY CHECK: Don't allow undo past the baked overlay
      if (bakedOverlay && targetOverlay === bakedOverlay && newIdx === 0) {
        console.log(`🔒 Page ${pageNo}: Cannot undo past baked overlay (this is the permanent base)`);
        return bakedOverlay; // Stay at the baked overlay
      }
      
    } else if (newIdx === -1) {
      // Trying to undo to completely clear state
      if (bakedOverlay) {
        // ✅ BOUNDARY PROTECTION: Can't go below baked overlay
        console.log(`🔒 Page ${pageNo}: Cannot undo past baked overlay, staying at baked state`);
        targetOverlay = bakedOverlay;
        // Reset index to point to the baked overlay
        setHistIdx(0);
        return bakedOverlay;
      } else {
        targetOverlay = null;
        console.log(`↶ Page ${pageNo}: Undo cleared page completely (no baked overlay)`);
      }
    }
    
    // Update session overlays
    if (targetOverlay) {
      // Check if this matches the baked overlay
      if (targetOverlay === bakedOverlay) {
        // We're back to the baked state, clear session overlay
        delete sessionOverlaysRef.current[pageNo];
        console.log(`↶ Page ${pageNo}: Back to baked state, cleared session overlay`);
      } else {
        // This is a session overlay (something drawn after the last save)
        sessionOverlaysRef.current[pageNo] = targetOverlay;
        console.log(`↶ Page ${pageNo}: Updated session overlay`);
      }
      overlaysRef.current[pageNo] = targetOverlay;
    } else {
      // No overlay at all (only possible if no baked overlay exists)
      delete sessionOverlaysRef.current[pageNo];
      delete overlaysRef.current[pageNo];
      console.log(`↶ Page ${pageNo}: Cleared all overlays`);
    }
    
    return targetOverlay;
  }, [histIdx, setHistIdx]);

  // === CLEAR OVERLAYS (for actions that bake into PDF) ===
  const clearOverlays = useCallback(() => {
    console.log('🧹 Clearing overlays - drawings are now baked into PDF');
    overlaysRef.current = {};
    historiesRef.current = {};
    sessionOverlaysRef.current = {};
    // Keep bakedOverlaysRef.current - those are permanent
    setOverlay(null);
    setHistory([]);
    setHistIdx(-1);
  }, []);

  // === PRESERVE STATE FOR POST-SAVE ===
  const preserveStateForSave = useCallback((pageNo) => {
    return {
      _preserveOverlays: overlaysRef.current,
      _preserveBakedOverlays: bakedOverlaysRef.current,
      _preserveSessionOverlays: sessionOverlaysRef.current,
      _preserveHistories: historiesRef.current,
      _preservePage: pageNo
    };
  }, []);

  return {
    // === STATE ===
    overlay,
    setOverlay,
    history,
    setHistory,
    histIdx,
    setHistIdx,

    // === REFS ===
    overlaysRef,
    bakedOverlaysRef,
    sessionOverlaysRef,
    historiesRef,
    stateBackupRef,
    postSaveRef,

    // === FUNCTIONS ===
    backupState,
    restoreState,
    initializeOverlaysFromDocument,
    addSessionOverlay,                // ✅ CRITICAL: Export this function
    getMergedOverlays,
    getNewSessionOverlays,
    updateBakedOverlays,
    handleUndoForPage,               // ✅ CRITICAL: Export this function
    clearOverlays,
    preserveStateForSave
  };
}