// app/files/components/PDFEditor/hooks/core/pageNav/pageNav.core.js
'use client';

import { useState, useCallback } from 'react';

/**
 * Page Navigation Core Hook
 * Handles all page navigation functionality:
 * - Page switching with state preservation
 * - Canvas state saving before navigation
 * - History and overlay loading for new pages
 * - Boundary checking and validation
 */
export function usePageNav(overlaysRef, historiesRef, canvasRef, ctxRef, activePointerRef, strokeStartedRef, setIsDown, setHistory, setHistIdx, setOverlay, setPageReady) {
  const [pageNo, setPageNo] = useState(1);

  // EXTRACTED: gotoPage function from your core.js
  const gotoPage = useCallback((next, pages) => {
    console.log('📄 Page navigation requested:', { current: pageNo, next, totalPages: pages });
    
    if (next < 1 || next > pages) {
      console.log('📄 Page navigation blocked - out of range:', { next, pages });
      return;
    }
    
    // Reset drawing state when changing pages
    activePointerRef.current = null;
    strokeStartedRef.current = false;
    setIsDown(false);
    
    console.log('📄 Changing from page', pageNo, 'to page', next);
    
    // Save current canvas state before switching pages
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (canvas && ctx) {
      // Only save if there's actual drawing content
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hasContent = imageData.data.some(channel => channel !== 0);
      
      if (hasContent) {
        const currentSnapshot = canvas.toDataURL('image/png');
        overlaysRef.current[pageNo] = currentSnapshot;
        console.log('📄 Saved overlay for page', pageNo, 'before switching');
      }
    }
    
    // Load page history and set proper index for the new page
    const pageHistory = historiesRef.current[next] || [];
    const pageOverlay = overlaysRef.current[next] || null;
    
    console.log('📄 Loading page', next, 'with', pageHistory.length, 'history items and overlay:', !!pageOverlay);
    
    // Set the history index to the last item (most recent state)
    const newIndex = pageHistory.length > 0 ? pageHistory.length - 1 : -1;
    
    setHistIdx(newIndex);
    setHistory(pageHistory);
    setOverlay(pageOverlay);
    setPageNo(next);
    setPageReady(false); // This will trigger canvas reinitialization
    
    console.log('📄 Page change complete - new state:', { 
      page: next, 
      historyLength: pageHistory.length, 
      histIdx: newIndex,
      hasOverlay: !!pageOverlay 
    });
  }, [pageNo, overlaysRef, historiesRef, canvasRef, ctxRef, activePointerRef, strokeStartedRef, setIsDown, setHistory, setHistIdx, setOverlay, setPageReady]);

  // Convenience navigation functions
  const goToNextPage = useCallback((pages) => {
    if (pageNo < pages) {
      gotoPage(pageNo + 1, pages);
    }
  }, [pageNo, gotoPage]);

  const goToPrevPage = useCallback((pages) => {
    if (pageNo > 1) {
      gotoPage(pageNo - 1, pages);
    }
  }, [pageNo, gotoPage]);

  const goToFirstPage = useCallback((pages) => {
    if (pageNo !== 1) {
      gotoPage(1, pages);
    }
  }, [pageNo, gotoPage]);

  const goToLastPage = useCallback((pages) => {
    if (pageNo !== pages) {
      gotoPage(pages, pages);
    }
  }, [pageNo, gotoPage]);

  // Navigation validation helpers
  const canGoNext = useCallback((pages) => {
    return pageNo < pages;
  }, [pageNo]);

  const canGoPrev = useCallback(() => {
    return pageNo > 1;
  }, [pageNo]);

  const isFirstPage = useCallback(() => {
    return pageNo === 1;
  }, [pageNo]);

  const isLastPage = useCallback((pages) => {
    return pageNo === pages;
  }, [pageNo]);

  // Page info getters
  const getPageInfo = useCallback((pages) => {
    return {
      current: pageNo,
      total: pages,
      canGoNext: canGoNext(pages),
      canGoPrev: canGoPrev(),
      isFirst: isFirstPage(),
      isLast: isLastPage(pages),
      progress: pages > 0 ? (pageNo / pages) * 100 : 0
    };
  }, [pageNo, canGoNext, canGoPrev, isFirstPage, isLastPage]);

  return {
    // === STATE ===
    pageNo,
    setPageNo,

    // === NAVIGATION FUNCTIONS ===
    gotoPage,
    goToNextPage,
    goToPrevPage,
    goToFirstPage,
    goToLastPage,

    // === VALIDATION HELPERS ===
    canGoNext,
    canGoPrev,
    isFirstPage,
    isLastPage,
    getPageInfo
  };
}