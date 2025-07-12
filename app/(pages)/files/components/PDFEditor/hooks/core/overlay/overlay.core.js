// app/files/components/PDFEditor/hooks/core/overlay/overlay.core.js
'use client';

import { useState, useRef, useCallback } from 'react';

/**
 * Overlay Core Hook
 * Handles all overlay-related functionality:
 * - Separation between baked overlays (already in PDF) and session overlays (new drawings)
 * - Overlay initialization from documents
 * - State backup and restoration
 * - History management per page
 */
export function useOverlay() {
  // === OVERLAY & HISTORY STATE ===
  const [overlay, setOverlay] = useState(null);
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);

  // === OVERLAY REFS ===
  // ✅ FIXED: Separate baked overlays from session overlays
  const overlaysRef = useRef({}); // Current session overlays (including baked + new)
  const bakedOverlaysRef = useRef({}); // Only the overlays that were baked into PDF
  const sessionOverlaysRef = useRef({}); // Only new overlays from current session
  const historiesRef = useRef({});

  // === STATE BACKUP REFS ===
  const stateBackupRef = useRef(null);
  const postSaveRef = useRef(false);

  // === STATE BACKUP & RESTORATION ===
  const backupState = useCallback((pageNo) => {
    if (Object.keys(overlaysRef.current).length > 0) {
      stateBackupRef.current = {
        overlays: { ...overlaysRef.current },
        histories: { ...historiesRef.current },
        currentPage: pageNo,
        timestamp: Date.now()
      };
      console.log('💾 Backed up overlay state:', Object.keys(stateBackupRef.current.overlays));
    }
  }, []);

  const restoreState = useCallback((setPageNo) => {
    if (stateBackupRef.current && (Date.now() - stateBackupRef.current.timestamp < 5000)) {
      console.log('🔄 Restoring overlay state after reload:', Object.keys(stateBackupRef.current.overlays));
      overlaysRef.current = stateBackupRef.current.overlays;
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
    // ✅ CRITICAL FIX: Initialize baked overlays from document
    if (doc?.pageOverlays && Object.keys(doc.pageOverlays).length > 0) {
      console.log('🎨 Initializing baked overlays from document:', Object.keys(doc.pageOverlays));
      bakedOverlaysRef.current = { ...doc.pageOverlays };
      overlaysRef.current = { ...doc.pageOverlays }; // Start with baked overlays
      sessionOverlaysRef.current = {}; // Clear session overlays
      
      // Set overlay and history for page 1
      if (doc.pageOverlays[1]) {
        setOverlay(doc.pageOverlays[1]);
        historiesRef.current[1] = [doc.pageOverlays[1]];
        setHistory([doc.pageOverlays[1]]);
        setHistIdx(0);
      }
      
      // Initialize histories for all pages with overlays
      Object.keys(doc.pageOverlays).forEach(pageNum => {
        const pageNumber = parseInt(pageNum);
        if (!isNaN(pageNumber)) {
          historiesRef.current[pageNumber] = [doc.pageOverlays[pageNumber]];
        }
      });
      
    } else if (doc?.overlays && Object.keys(doc.overlays).length > 0 && !doc?.signedPdf) {
      console.log('🎨 Restoring overlays from document (legacy format)');
      overlaysRef.current = doc.overlays;
      bakedOverlaysRef.current = {}; // Legacy format doesn't separate baked/session
      sessionOverlaysRef.current = { ...doc.overlays };
      
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
      console.log('🧹 No baked overlays found, clearing all overlay state');
      bakedOverlaysRef.current = {};
      overlaysRef.current = {};
      sessionOverlaysRef.current = {};
      historiesRef.current = {};
      setOverlay(null);
      setHistory([]);
      setHistIdx(-1);
    }
  }, []);

  // === OVERLAY MERGING FOR SAVE OPERATIONS ===
  const getMergedOverlays = useCallback((doc) => {
    console.log('📄 Building merged overlay data...');
    
    // Start with existing overlays from the document (if any)
    let existingOverlays = {};
    if (doc.pageOverlays && typeof doc.pageOverlays === 'object') {
      existingOverlays = { ...doc.pageOverlays };
      console.log('📄 Found existing overlays in document:', Object.keys(existingOverlays));
    } else if (doc.overlays && typeof doc.overlays === 'object') {
      existingOverlays = { ...doc.overlays };
      console.log('📄 Found existing overlays (legacy format):', Object.keys(existingOverlays));
    }
    
    // Merge with current in-memory overlays (these are the fresh edits)
    const currentOverlays = Object.fromEntries(
      Object.entries(overlaysRef.current).filter(([, png]) => png)
    );
    
    // ✅ CRITICAL FIX: Merge existing + current, with current overlays taking precedence
    const mergedOverlays = {
      ...existingOverlays,  // Start with what's already saved
      ...currentOverlays    // Overlay with current edits (this page and any others)
    };
    
    console.log('🔧 Overlay merge details:', {
      existingOverlaysCount: Object.keys(existingOverlays).length,
      existingPages: Object.keys(existingOverlays),
      currentOverlaysCount: Object.keys(currentOverlays).length,
      currentPages: Object.keys(currentOverlays),
      mergedOverlaysCount: Object.keys(mergedOverlays).length,
      mergedPages: Object.keys(mergedOverlays)
    });

    return mergedOverlays;
  }, []);

  // === GET NEW SESSION OVERLAYS (for the updated approach from your paste) ===
  const getNewSessionOverlays = useCallback((doc) => {
    console.log('📄 Building overlay data for save (session overlays only)...');
    
    // Start with existing baked overlays (these are already in the PDF)
    let existingBakedOverlays = {};
    if (doc.pageOverlays && typeof doc.pageOverlays === 'object') {
      existingBakedOverlays = { ...doc.pageOverlays };
      console.log('📄 Found existing baked overlays in document:', Object.keys(existingBakedOverlays));
    }
    
    // Get current session overlays (these are NEW and need to be baked)
    const currentSessionOverlays = Object.fromEntries(
      Object.entries(sessionOverlaysRef.current).filter(([, png]) => png)
    );
    
    // ✅ CRITICAL: Only send overlays that are DIFFERENT from baked ones
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
      existingBakedPages: Object.keys(existingBakedOverlays),
      sessionOverlaysCount: Object.keys(currentSessionOverlays).length,
      sessionPages: Object.keys(currentSessionOverlays),
      newOverlaysToSaveCount: Object.keys(newOverlaysToSave).length,
      newPages: Object.keys(newOverlaysToSave)
    });

    return newOverlaysToSave;
  }, []);

  // === UPDATE BAKED OVERLAYS AFTER SAVE ===
  const updateBakedOverlays = useCallback((newOverlays) => {
    Object.keys(newOverlays).forEach(pageNum => {
      bakedOverlaysRef.current[pageNum] = newOverlays[pageNum];
    });
    console.log('✅ Updated baked overlays:', Object.keys(bakedOverlaysRef.current));
  }, []);

  // === CLEAR OVERLAYS (for actions that bake into PDF) ===
  const clearOverlays = useCallback(() => {
    console.log('🧹 Clearing overlays - drawings are now baked into PDF');
    overlaysRef.current = {};
    historiesRef.current = {};
    sessionOverlaysRef.current = {};
    setOverlay(null);
    setHistory([]);
    setHistIdx(-1);
  }, []);

  // === PRESERVE STATE FOR POST-SAVE ===
  const preserveStateForSave = useCallback((pageNo) => {
    return {
      _preserveOverlays: overlaysRef.current,
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
    getMergedOverlays,
    getNewSessionOverlays,
    updateBakedOverlays,
    clearOverlays,
    preserveStateForSave
  };
}