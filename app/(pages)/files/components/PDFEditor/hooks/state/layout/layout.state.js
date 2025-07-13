// app/files/components/PDFEditor/hooks/state/layout/layout.state.js
'use client';

import { useCallback } from 'react';

/**
 * Layout State Hook
 * Handles UI layout, mobile responsiveness, and component configuration
 */
export function useLayout(doc, onToggleDrawer, mobileModeActive = false, onOpenProperties) {
  const compact = mobileModeActive;

  // === MOBILE ACTIONS LOGIC ===
  const getMobileActionsConfig = useCallback((buttonConfig) => {
    if (!buttonConfig) return null;

    const buttons = Array.isArray(buttonConfig) ? buttonConfig : [buttonConfig];
    
    if (compact && typeof window !== 'undefined' && window.innerWidth < 480) {
      const [primaryButton, ...overflowButtons] = buttons;
      
      return {
        primaryButton,
        overflowButtons,
        showOverflow: overflowButtons.length > 0
      };
    }

    return {
      buttons,
      showOverflow: false
    };
  }, [compact]);

  // === HEADER CONFIG ===
  const getHeaderConfig = useCallback(() => {
    return {
      className: `
        border-b bg-white/95 backdrop-blur-sm 
        flex items-center justify-between 
        px-2 sm:px-4 py-2 prevent-horizontal-scroll
        ${mobileModeActive ? 'mobile-fixed-header' : 'sticky top-0 z-10'}
      `,
      showMenu: !!onToggleDrawer,
      showFileName: !compact || (typeof window !== 'undefined' && window.innerWidth >= 1280),
      fileName: doc?.fileName + (doc?.runNumber ? ` (${doc.runNumber})` : ''),
      title: doc?.fileName || 'Document'
    };
  }, [mobileModeActive, onToggleDrawer, compact, doc?.fileName, doc?.runNumber]);

  // === VIEWER CONFIG ===
  const getViewerConfig = useCallback(() => {
    return {
      className: `flex-1 overflow-auto bg-gray-100 flex justify-center smooth-scroll ${
        mobileModeActive ? 'mobile-content-with-header' : ''
      }`,
      containerClassName: 'w-full max-w-4xl mx-auto p-4',
      pdfClassName: 'shadow-lg rounded-lg overflow-hidden bg-white'
    };
  }, [mobileModeActive]);

  // === TOOLBAR LAYOUT CONFIG ===
  const getToolbarLayout = useCallback(() => {
    return {
      leftSection: {
        showMenu: !!onToggleDrawer,
        showFileName: !compact || (typeof window !== 'undefined' && window.innerWidth >= 1280),
        className: 'flex items-center gap-2 flex-1 min-w-0'
      },
      centerSection: {
        showPageNavigation: true,
        className: 'flex items-center gap-2'
      },
      rightSection: {
        showActions: true,
        showSettings: true,
        className: 'flex items-center gap-2'
      }
    };
  }, [onToggleDrawer, compact]);

  // === RESPONSIVE BREAKPOINTS ===
  const getResponsiveConfig = useCallback(() => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
    
    return {
      isMobile: width < 640,
      isTablet: width >= 640 && width < 1024,
      isDesktop: width >= 1024,
      isLargeScreen: width >= 1280,
      showCompactUI: mobileModeActive || width < 768,
      showFullToolbar: !mobileModeActive && width >= 768,
      collapseNavigation: width < 480,
      hideSecondaryActions: width < 640
    };
  }, [mobileModeActive]);

  // === EVENT HANDLERS ===
  const handleFileDeleted = useCallback(() => {
    // This would be passed from parent
    console.log('File deleted - should close editor');
  }, []);

const handleOpenProperties = useCallback(() => {
  console.log('🔧 handleOpenProperties called:', {
    hasOnOpenProperties: !!onOpenProperties,
    hasDoc: !!doc,
    docId: doc?._id,
    docType: doc?.isBatch ? 'batch' : 'original',
    docKeys: doc ? Object.keys(doc) : null
  });
  
  if (onOpenProperties) {
    console.log('✅ Calling onOpenProperties with doc:', doc);
    onOpenProperties(doc);
  } else {
    console.error('❌ onOpenProperties prop is missing!');
  }
}, [onOpenProperties, doc]);

  // === WORKFLOW INDICATORS LAYOUT ===
  const getWorkflowIndicatorsLayout = useCallback((indicators) => {
    if (!indicators || indicators.length === 0) return null;

    // In compact mode, show only the most important indicator
    if (compact && indicators.length > 1) {
      const priorityOrder = ['work_order', 'completed', 'rejected', 'read_only'];
      const priorityIndicator = priorityOrder
        .map(type => indicators.find(ind => ind.type === type))
        .find(ind => ind);
      
      return {
        indicators: priorityIndicator ? [priorityIndicator] : [indicators[0]],
        layout: 'compact',
        className: 'flex items-center gap-1'
      };
    }

    return {
      indicators,
      layout: 'full',
      className: 'flex items-center gap-2 flex-wrap'
    };
  }, [compact]);

  // === SPACING AND LAYOUT UTILITIES ===
  const getSpacingConfig = useCallback(() => {
    return {
      containerPadding: compact ? 'p-2' : 'p-4',
      sectionGap: compact ? 'gap-2' : 'gap-4',
      buttonSpacing: compact ? 'gap-1' : 'gap-2',
      toolbarHeight: compact ? 'h-12' : 'h-14',
      contentMargin: mobileModeActive ? 'mt-12' : 'mt-0'
    };
  }, [compact, mobileModeActive]);

  return {
    // === LAYOUT CONFIGURATION ===
    headerConfig: getHeaderConfig(),
    viewerConfig: getViewerConfig(),
    toolbarLayout: getToolbarLayout(),
    responsiveConfig: getResponsiveConfig(),
    spacingConfig: getSpacingConfig(),

    // === MOBILE SPECIFIC ===
    mobileActionsConfig: getMobileActionsConfig,
    workflowIndicatorsLayout: getWorkflowIndicatorsLayout,

    // === EVENT HANDLERS ===
    handleFileDeleted,
    handleOpenProperties,

    // === STATUS FLAGS ===
    compact,
    isMobile: mobileModeActive,
    isValid: !!doc
  };
}