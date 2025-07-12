// app/files/components/PDFEditor/hooks/state/navigation/navigation.state.js
'use client';

import { useCallback } from 'react';

/**
 * Navigation State Hook
 * Handles page navigation UI logic and event handlers
 */
export function useNavigation(core, mobileModeActive = false) {
  const compact = mobileModeActive;

  // === PAGE NAVIGATION EVENT HANDLERS ===
  const handlePageNavigation = useCallback((direction) => {
    if (direction === 'prev') {
      core.gotoPage(core.pageNo - 1);
    } else {
      core.gotoPage(core.pageNo + 1);
    }
  }, [core.gotoPage, core.pageNo]);

  const handleGoToPage = useCallback((pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= core.pages) {
      core.gotoPage(pageNumber);
    }
  }, [core.gotoPage, core.pages]);

  const handleFirstPage = useCallback(() => {
    if (core.pageNo !== 1) {
      core.gotoPage(1);
    }
  }, [core.gotoPage, core.pageNo]);

  const handleLastPage = useCallback(() => {
    if (core.pageNo !== core.pages) {
      core.gotoPage(core.pages);
    }
  }, [core.gotoPage, core.pageNo, core.pages]);

  // === PAGE NAVIGATION CONFIG ===
  const getPageNavConfig = useCallback(() => {
    return {
      showNavigation: core.pages > 1,
      canGoBack: core.pageNo > 1,
      canGoForward: core.pageNo < core.pages,
      currentPage: core.pageNo,
      totalPages: core.pages,
      progress: core.pages > 0 ? (core.pageNo / core.pages) * 100 : 0
    };
  }, [core.pages, core.pageNo]);

  // === NAVIGATION BUTTON CONFIGURATIONS ===
  const getPrevButtonConfig = useCallback(() => {
    const canGoPrev = core.pageNo > 1;
    
    return {
      icon: 'ChevronLeft',
      text: compact ? '' : 'Previous',
      variant: 'outline',
      disabled: !canGoPrev,
      onClick: () => handlePageNavigation('prev'),
      title: canGoPrev ? `Go to page ${core.pageNo - 1}` : 'Already at first page',
      className: canGoPrev ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'
    };
  }, [core.pageNo, compact, handlePageNavigation]);

  const getNextButtonConfig = useCallback(() => {
    const canGoNext = core.pageNo < core.pages;
    
    return {
      icon: 'ChevronRight',
      text: compact ? '' : 'Next', 
      variant: 'outline',
      disabled: !canGoNext,
      onClick: () => handlePageNavigation('next'),
      title: canGoNext ? `Go to page ${core.pageNo + 1}` : 'Already at last page',
      className: canGoNext ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'
    };
  }, [core.pageNo, core.pages, compact, handlePageNavigation]);

  const getFirstButtonConfig = useCallback(() => {
    const canGoFirst = core.pageNo > 1;
    
    return {
      icon: 'ChevronsLeft',
      text: compact ? '' : 'First',
      variant: 'outline', 
      disabled: !canGoFirst,
      onClick: handleFirstPage,
      title: canGoFirst ? 'Go to first page' : 'Already at first page',
      className: canGoFirst ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'
    };
  }, [core.pageNo, compact, handleFirstPage]);

  const getLastButtonConfig = useCallback(() => {
    const canGoLast = core.pageNo < core.pages;
    
    return {
      icon: 'ChevronsRight',
      text: compact ? '' : 'Last',
      variant: 'outline',
      disabled: !canGoLast, 
      onClick: handleLastPage,
      title: canGoLast ? 'Go to last page' : 'Already at last page',
      className: canGoLast ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'
    };
  }, [core.pageNo, core.pages, compact, handleLastPage]);

  // === PAGE INDICATOR CONFIG ===
  const getPageIndicatorConfig = useCallback(() => {
    return {
      text: compact ? `${core.pageNo}/${core.pages}` : `Page ${core.pageNo} of ${core.pages}`,
      className: 'text-sm text-gray-600 flex items-center gap-1',
      showProgress: !compact && core.pages > 1,
      progressPercent: core.pages > 0 ? (core.pageNo / core.pages) * 100 : 0,
      currentPage: core.pageNo,
      totalPages: core.pages
    };
  }, [core.pageNo, core.pages, compact]);

  // === PAGE INPUT CONFIG (for direct page navigation) ===
  const getPageInputConfig = useCallback(() => {
    return {
      min: 1,
      max: core.pages,
      value: core.pageNo,
      onChange: handleGoToPage,
      placeholder: core.pageNo.toString(),
      className: 'w-16 text-center text-sm border rounded px-2 py-1',
      title: `Enter page number (1-${core.pages})`
    };
  }, [core.pageNo, core.pages, handleGoToPage]);

  // === KEYBOARD NAVIGATION ===
  const handleKeyboardNavigation = useCallback((event) => {
    // Handle keyboard shortcuts for navigation
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      return; // Don't interfere with input fields
    }

    switch (event.key) {
      case 'ArrowLeft':
      case 'PageUp':
        event.preventDefault();
        if (core.pageNo > 1) {
          handlePageNavigation('prev');
        }
        break;
      case 'ArrowRight':
      case 'PageDown':
        event.preventDefault();
        if (core.pageNo < core.pages) {
          handlePageNavigation('next');
        }
        break;
      case 'Home':
        event.preventDefault();
        handleFirstPage();
        break;
      case 'End':
        event.preventDefault();
        handleLastPage();
        break;
    }
  }, [core.pageNo, core.pages, handlePageNavigation, handleFirstPage, handleLastPage]);

  // === NAVIGATION STATUS ===
  const getNavigationStatus = useCallback(() => {
    return {
      isFirstPage: core.pageNo === 1,
      isLastPage: core.pageNo === core.pages,
      hasMultiplePages: core.pages > 1,
      canNavigate: core.pages > 1,
      currentPage: core.pageNo,
      totalPages: core.pages,
      remainingPages: core.pages - core.pageNo,
      completionPercent: core.pages > 0 ? Math.round((core.pageNo / core.pages) * 100) : 0
    };
  }, [core.pageNo, core.pages]);

  return {
    // === EVENT HANDLERS ===
    handlePageNavigation,
    handleGoToPage,
    handleFirstPage,
    handleLastPage,
    handleKeyboardNavigation,

    // === UI CONFIGURATION ===
    pageNavConfig: getPageNavConfig(),
    prevButtonConfig: getPrevButtonConfig(),
    nextButtonConfig: getNextButtonConfig(),
    firstButtonConfig: getFirstButtonConfig(),
    lastButtonConfig: getLastButtonConfig(),
    pageIndicatorConfig: getPageIndicatorConfig(),
    pageInputConfig: getPageInputConfig(),

    // === STATUS ===
    navigationStatus: getNavigationStatus()
  };
}