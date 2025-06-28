// app/files/components/PDFEditor/hooks/state.js
'use client';

import { useState, useCallback, useMemo } from 'react';

/**
 * PDFEditor State Hook
 * 
 * UI logic, event handlers, and conditional rendering logic for PDF editor:
 * - Toolbar state management
 * - Dialog state management  
 * - Event handlers for UI interactions
 * - Button configurations and conditional logic
 * - Work order badge display logic
 * - Mobile responsive behavior
 */
export function useComponentState(core, props) {
  const { doc, onToggleDrawer, mobileModeActive, refreshFiles, setCurrentDoc } = props;

  // === UI-ONLY STATE ===
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveAction, setSaveAction] = useState('save');
  
  // === SAVE DIALOG STATE ===
  const [batchQuantity, setBatchQuantity] = useState('1000');
  const [batchUnit, setBatchUnit] = useState('mL');
  const [solutionLotNumber, setSolutionLotNumber] = useState('');
  const [solutionQuantity, setSolutionQuantity] = useState('');
  const [solutionUnit, setSolutionUnit] = useState('');
  const [confirmedComponents, setConfirmedComponents] = useState([]);
  const [availableLots, setAvailableLots] = useState({});
  const [isLoadingLots, setIsLoadingLots] = useState(false);
  const [scaledComponents, setScaledComponents] = useState([]);

  // === TOOLBAR COMPACT MODE ===
  const compact = mobileModeActive;

  // === WORK ORDER BADGE LOGIC ===
  const getWorkOrderBadgeProps = useCallback(() => {
    const workOrderInfo = core.workOrderInfo;
    if (!workOrderInfo) return null;

    // Use real-time status from core
    const realTimeStatus = core.workOrderStatus?.status || workOrderInfo.status;
    const realTimeNumber = core.workOrderStatus?.workOrderNumber || workOrderInfo.workOrderNumber;
    const isRealTimeUpdating = core.workOrderLoading && core.workOrderStatus?.status === 'creating';

    const getBadgeColor = () => {
      if (workOrderInfo.isFailed) return 'bg-red-50 text-red-700 border-red-200';
      if (realTimeStatus === 'creating' || isRealTimeUpdating) return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      if (realTimeStatus === 'completed') return 'bg-green-50 text-green-700 border-green-200';
      if (realTimeNumber && !realTimeNumber.startsWith('LOCAL-')) return 'bg-blue-50 text-blue-700 border-blue-200';
      return 'bg-gray-50 text-gray-700 border-gray-200';
    };

    const getDisplayText = () => {
      if (workOrderInfo.isFailed) return compact ? 'WO Failed' : 'Work Order Failed';
      if (realTimeStatus === 'creating' || isRealTimeUpdating) {
        return compact ? 'Creating...' : 'Creating Work Order...';
      }
      if (realTimeNumber && !realTimeNumber.startsWith('PENDING-') && !realTimeNumber.startsWith('LOCAL-')) {
        return compact ? realTimeNumber : `WO: ${realTimeNumber}`;
      }
      return compact ? 'WO' : 'Work Order';
    };

    const getIcon = () => {
      if (workOrderInfo.isFailed) return '❌';
      if (realTimeStatus === 'creating' || isRealTimeUpdating) return '⏳';
      if (realTimeNumber && !realTimeNumber.startsWith('LOCAL-') && !realTimeNumber.startsWith('PENDING-')) return '🔗';
      if (realTimeNumber?.startsWith('LOCAL-')) return '📝';
      return '📋';
    };

    return {
      className: `text-xs flex items-center gap-1 shrink-0 ${getBadgeColor()} transition-colors duration-200`,
      title: workOrderInfo.error || `Work Order: ${realTimeNumber || workOrderInfo.id}`,
      isAnimating: isRealTimeUpdating,
      icon: getIcon(),
      text: getDisplayText()
    };
  }, [core.workOrderInfo, core.workOrderStatus, core.workOrderLoading, compact]);

  // === BUTTON CONFIGURATION LOGIC ===
  const getButtonConfig = useCallback(() => {
    if (core.isOriginal || core.isDraft) {
      return {
        action: 'create_work_order',
        text: compact ? 'Create WO' : 'Create Work Order',
        icon: 'Package',
        variant: 'default',
        disabled: core.isSaving || core.isCreatingWorkOrder,
        loading: core.isCreatingWorkOrder
      };
    }
    
    if (core.isInProgress) {
      return [
        {
          action: 'save',
          text: compact ? 'Save' : 'Save',
          icon: 'Save',
          variant: 'outline',
          disabled: core.isSaving
        },
        {
          action: 'submit_review',
          text: compact ? 'Submit' : 'Submit for Review',
          icon: 'ArrowRightCircle',
          variant: 'outline',
          disabled: core.isSaving
        }
      ];
    }
    
    if (core.isInReview) {
      return [
        {
          action: 'save',
          text: compact ? 'Save' : 'Save',
          icon: 'Save',
          variant: 'outline',
          disabled: core.isSaving
        },
        {
          action: 'reject',
          text: compact ? 'Reject' : 'Reject',
          icon: 'XCircle',
          variant: 'outline',
          disabled: core.isSaving,
          className: 'text-red-600 hover:text-red-700'
        },
        {
          action: 'complete',
          text: compact ? 'Complete' : 'Complete',
          icon: 'CheckCircle',
          variant: 'outline',
          disabled: core.isSaving,
          className: 'text-green-600 hover:text-green-700'
        }
      ];
    }
    
    return null;
  }, [core.isOriginal, core.isDraft, core.isInProgress, core.isInReview, core.isSaving, core.isCreatingWorkOrder, compact]);

  // === SAVE DIALOG LOGIC ===
  // === SAVE DIALOG LOGIC ===
  const getActionInfo = useCallback(() => {
    const isOriginal = !doc?.isBatch;
    const status = doc?.status || 'Draft';
    const hasWorkOrder = doc?.workOrderCreated;
    const hasTransaction = doc?.chemicalsTransacted;
    const hasSolution = doc?.solutionCreated;
    const wasRejected = doc?.wasRejected;
    
    if (saveAction === 'create_work_order') {
      // Check if file has recipe defined
      const hasRecipe = doc?.snapshot?.components?.length > 0 || 
                       doc?.components?.length > 0;
      
      if (!hasRecipe) {
        return {
          title: 'Setup Required',
          description: 'This file needs recipe properties defined before creating a work order.',
          icon: 'Settings',
          requiresSetup: true,
          actions: ['Open File Properties', 'Define Recipe Components', 'Set Solution Details']
        };
      }
      
      return {
        title: 'Create Work Order & Scale Recipe',
        description: 'This will create a work order and scale the recipe to your batch size. Components are shown per 1 mL from NetSuite.',
        icon: 'Package',
        requiresChemicals: false,
        requiresLot: false,
        requiresBatchSize: true,
        actions: ['Scale Recipe to Batch Size', 'Create Work Order', 'Set Status to In Progress']
      };
    }
    
    if (saveAction === 'submit_review') {
      if (!hasTransaction || wasRejected) {
        return {
          title: 'Transact Chemicals & Create Solution',
          description: wasRejected 
            ? 'This will create the solution lot using the scaled quantities.'
            : 'This will transact the scaled chemical quantities and create the solution lot.',
          icon: 'Beaker',
          requiresChemicals: !wasRejected,
          requiresLot: true,
          requiresBatchSize: false,
          actions: wasRejected 
            ? ['Create Solution Lot', 'Move to Review Status']
            : ['Transact Scaled Chemical Quantities', 'Create Solution Lot', 'Move to Review Status']
        };
      } else {
        return {
          title: 'Move to Review',
          description: 'Chemicals already transacted and solution created. Just moving to Review status.',
          icon: 'FileText',
          requiresChemicals: false,
          requiresLot: false,
          requiresBatchSize: false,
          actions: ['Move to Review Status']
        };
      }
    }
    
    if (saveAction === 'complete') {
      return {
        title: 'Complete Work Order & Archive',
        description: 'This will complete the work order and archive this batch.',
        icon: 'CheckCircle',
        requiresChemicals: false,
        requiresLot: false,
        requiresBatchSize: false,
        actions: ['Complete Work Order', 'Archive Batch']
      };
    }
    
    if (saveAction === 'reject') {
      return {
        title: 'Reject to In Progress',
        description: 'This will move the batch back to In Progress. Solution and transactions remain unchanged.',
        icon: 'AlertTriangle',
        requiresChemicals: false,
        requiresLot: false,
        requiresBatchSize: false,
        requiresReason: true,
        actions: ['Move to In Progress Status', 'Keep Solution & Transactions']
      };
    }
    
    return {
      title: 'Save Progress',
      description: 'Save your current work. You can continue editing later.',
      icon: 'Clock',
      requiresChemicals: false,
      requiresLot: false,
      requiresBatchSize: false,
      actions: ['Save Changes']
    };
  }, [saveAction, doc]);

  const shouldShowConfirmation = useCallback((action) => {
    if (action === 'create_work_order') return true;
    if (action === 'submit_review') return true;
    if (action === 'complete') return true;
    if (action === 'reject') return true;
    return false;
  }, []);

  // Scale components based on batch quantity
  useEffect(() => {
    const actionInfo = getActionInfo();
    
    if (actionInfo.requiresBatchSize) {
      const quantity = parseFloat(batchQuantity) || 1000;
      
      let components = doc?.snapshot?.components || 
                      doc?.components || 
                      [];
      
      if (components.length > 0) {
        const scaled = components.map(comp => {
          const scaledAmount = (comp.amount || 0) * quantity;
          
          return {
            ...comp,
            scaledAmount: scaledAmount,
            originalAmount: comp.amount,
            plannedAmount: scaledAmount,
            actualAmount: scaledAmount,
            lotNumber: '',
            lotId: null,
            displayName: comp.itemId?.displayName || comp.displayName || 'Unknown Component',
            sku: comp.itemId?.sku || comp.sku || 'No SKU'
          };
        });
        
        setScaledComponents(scaled);
        setConfirmedComponents(scaled);
      } else {
        setScaledComponents([]);
        setConfirmedComponents([]);
      }
    } else {
      const components = doc?.snapshot?.components || doc?.components || [];
      
      if (components.length > 0) {
        setConfirmedComponents(
          components.map(comp => ({
            ...comp,
            plannedAmount: comp.amount || 0,
            actualAmount: comp.amount || 0,
            lotNumber: '',
            lotId: null,
            displayName: comp.itemId?.displayName || comp.displayName || 'Unknown Component',
            sku: comp.itemId?.sku || comp.sku || 'No SKU'
          }))
        );
      }
    }
  }, [batchQuantity, doc?.snapshot?.components, doc?.components, getActionInfo, saveAction]);

  // Auto-set solution quantity when batch quantity changes
  useEffect(() => {
    const actionInfo = getActionInfo();
    if (actionInfo.requiresBatchSize && batchQuantity) {
      setSolutionQuantity(batchQuantity);
      setSolutionUnit(batchUnit);
    }
  }, [batchQuantity, batchUnit, getActionInfo]);

  // Initialize solution details from document
  useEffect(() => {
    const actionInfo = getActionInfo();
    if (!actionInfo.requiresBatchSize) {
      setSolutionQuantity(doc?.snapshot?.recipeQty || doc?.recipeQty || '');
      setSolutionUnit(doc?.snapshot?.recipeUnit || doc?.recipeUnit || 'L');
    }
  }, [doc, getActionInfo]);

  // Load available lots when dialog opens
  useEffect(() => {
    const actionInfo = getActionInfo();
    if (showSaveDialog && actionInfo.requiresChemicals && confirmedComponents.length > 0) {
      loadAvailableLots();
    }
  }, [showSaveDialog, confirmedComponents.length, getActionInfo]);

  const loadAvailableLots = async () => {
    setIsLoadingLots(true);
    const lotsMap = {};
    
    await Promise.all(
      confirmedComponents.map(async comp => {
        let itemId;
        if (typeof comp.itemId === 'object' && comp.itemId !== null) {
          itemId = comp.itemId._id || comp.itemId.toString();
        } else {
          itemId = comp.itemId;
        }
        
        if (!itemId) return;
        
        try {
          const result = await filesApi.items.getLots(itemId);
          if (!result.error) {
            lotsMap[itemId] = result.data;
            if (typeof comp.itemId === 'object' && comp.itemId !== null) {
              lotsMap[comp.itemId._id] = result.data;
              lotsMap[comp.itemId.toString()] = result.data;
            }
          }
        } catch (e) {
          lotsMap[itemId] = [];
        }
      })
    );
    
    setAvailableLots(lotsMap);
    setIsLoadingLots(false);
  };

  const updateComponent = useCallback((index, field, value) => {
    setConfirmedComponents(prev => 
      prev.map((comp, i) => {
        if (i === index) {
          if (field === 'lotNumber') {
            const itemKey = typeof comp.itemId === 'object' && comp.itemId !== null
              ? comp.itemId._id || comp.itemId.toString()
              : comp.itemId;
            const availableLotsForItem = availableLots[itemKey] || [];
            const selectedLot = availableLotsForItem.find(lot => lot.lotNumber === value);
            return {
              ...comp,
              lotNumber: value,
              lotId: selectedLot?.id || null
            };
          }
          return { ...comp, [field]: value };
        }
        return comp;
      })
    );
  }, [availableLots]);

  const isDialogValid = useCallback(() => {
    const actionInfo = getActionInfo();
    if (actionInfo.requiresSetup) return false;
    if (actionInfo.requiresBatchSize && (!batchQuantity || Number(batchQuantity) <= 0)) return false;
    if (actionInfo.requiresLot && !solutionLotNumber.trim()) return false;
    if (actionInfo.requiresChemicals && confirmedComponents.some(c => !c.lotNumber)) return false;
    return true;
  }, [getActionInfo, batchQuantity, solutionLotNumber, confirmedComponents]);

  // === EVENT HANDLERS ===
  const handleSave = useCallback(async (action = 'save') => {
    setSaveAction(action);
    
    const needsConfirmation = shouldShowConfirmation(action);
    
    if (needsConfirmation) {
      setShowSaveDialog(true);
    } else {
      try {
        await core.save(action);
      } catch (error) {
        // Error handling is done in core
      }
    }
  }, [core.save, shouldShowConfirmation]);

  const handleSaveConfirm = useCallback(async (confirmationData) => {
    try {
      // Show loading for work order creation when confirm button is clicked
      if (saveAction === 'create_work_order') {
        core.setIsCreatingWorkOrder(true);
        core.setUserInitiatedCreation(true);
      }

      const finalConfirmationData = {
        batchQuantity: Number(batchQuantity),
        batchUnit: batchUnit,
        solutionLotNumber: solutionLotNumber.trim(),
        solutionQuantity: solutionQuantity ? Number(solutionQuantity) : null,
        solutionUnit: solutionUnit.trim() || 'L',
        components: confirmedComponents,
        scaledComponents: scaledComponents,
        action: saveAction,
        ...confirmationData
      };

      await core.save(saveAction, finalConfirmationData);
      setShowSaveDialog(false);
      refreshFiles?.();
      
      setTimeout(() => {
        if (core.canvasRef.current) {
          core.initCanvas();
        }
      }, 200);
    } catch (error) {
      // Error handling
      if (saveAction === 'create_work_order') {
        core.setUserInitiatedCreation(false);
        core.setIsCreatingWorkOrder(false);
      }
    }
  }, [saveAction, core, refreshFiles, batchQuantity, batchUnit, solutionLotNumber, solutionQuantity, solutionUnit, confirmedComponents, scaledComponents]);

  const handleSaveDialogClose = useCallback(() => {
    setShowSaveDialog(false);
    if (saveAction === 'create_work_order') {
      core.setUserInitiatedCreation(false);
    }
    core.setIsCreatingWorkOrder(false);
  }, [saveAction, core]);

  const handleFileDeleted = useCallback(() => {
    setCurrentDoc(null);
    refreshFiles?.();
  }, [setCurrentDoc, refreshFiles]);

  const handleOpenProperties = useCallback(() => {
    // Emit event to parent instead of managing drawer directly
    props.onOpenProperties?.(doc);
  }, [props.onOpenProperties, doc]);

  const handleToggleDrawing = useCallback(() => {
    core.setIsDraw(d => !d);
  }, [core.setIsDraw]);

  const handlePageNavigation = useCallback((direction) => {
    if (direction === 'prev') {
      core.gotoPage(core.pageNo - 1);
    } else {
      core.gotoPage(core.pageNo + 1);
    }
  }, [core.gotoPage, core.pageNo]);

  // === MOBILE ACTIONS LOGIC ===
  const getMobileActionsConfig = useCallback(() => {
    const buttonConfig = getButtonConfig();
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
  }, [getButtonConfig, compact]);

  // === STATUS BADGE LOGIC ===
  const getStatusBadgeProps = useCallback(() => {
    const status = core.status;
    
    const getStatusColor = () => {
      switch (status) {
        case 'Draft': return 'bg-gray-100 text-gray-800';
        case 'In Progress': return 'bg-amber-100 text-amber-800';
        case 'Review': return 'bg-blue-100 text-blue-800';
        case 'Completed': return 'bg-green-100 text-green-800';
        default: return 'bg-gray-100 text-gray-800';
      }
    };

    const getDisplayText = () => {
      if (compact) {
        switch (status) {
          case 'In Progress': return 'In Progress';
          case 'Review': return 'Review';
          default: return status.slice(0, 8);
        }
      }
      return status;
    };

    return {
      className: `text-xs shrink-0 ${getStatusColor()}`,
      text: getDisplayText()
    };
  }, [core.status, compact]);

  // === TOOLBAR VISIBILITY LOGIC ===
  const getToolbarConfig = useCallback(() => {
    return {
      showSettings: true,
      showDrawingToggle: core.canDraw(),
      showUndo: core.canDraw() && core.histIdx >= 0,
      showPrint: !compact || (compact && typeof window !== 'undefined' && window.innerWidth >= 640),
      drawingEnabled: core.canDraw(),
      undoEnabled: core.canDraw() && core.histIdx >= 0
    };
  }, [core.canDraw, core.histIdx, compact]);

  // === PAGE NAVIGATION CONFIG ===
  const getPageNavConfig = useCallback(() => {
    return {
      showNavigation: core.pages > 1,
      canGoBack: core.pageNo > 1,
      canGoForward: core.pageNo < core.pages,
      currentPage: core.pageNo,
      totalPages: core.pages
    };
  }, [core.pages, core.pageNo]);

  // === WORKFLOW INDICATORS ===
  const getWorkflowIndicators = useCallback(() => {
    const indicators = [];

    // Work order badge
    const workOrderBadge = getWorkOrderBadgeProps();
    if (workOrderBadge) {
      indicators.push({
        type: 'work_order',
        ...workOrderBadge
      });
    }

    // Read-only indicator for original files
    if (core.isOriginal) {
      indicators.push({
        type: 'read_only',
        className: 'text-xs bg-orange-50 text-orange-700 flex items-center gap-1 shrink-0',
        icon: 'Lock',
        text: compact ? 'Read Only' : 'Read Only'
      });
    }

    // Rejection indicator
    if (doc.wasRejected && !compact) {
      indicators.push({
        type: 'rejected',
        className: 'text-xs bg-red-50 text-red-700',
        icon: 'AlertTriangle',
        text: 'Rejected'
      });
    }

    // Completion indicator
    if (core.isCompleted || core.isArchived) {
      indicators.push({
        type: 'completed',
        className: 'text-green-600 flex items-center gap-1 text-xs',
        icon: 'CheckCircle',
        text: compact ? (core.isArchived ? 'Arc' : 'Done') : (core.isArchived ? 'Archived' : 'Completed')
      });
    }

    return indicators;
  }, [getWorkOrderBadgeProps, core.isOriginal, core.isCompleted, core.isArchived, doc.wasRejected, compact]);

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
      fileName: doc.fileName + (doc.runNumber ? ` (${doc.runNumber})` : '')
    };
  }, [mobileModeActive, onToggleDrawer, compact, doc.fileName, doc.runNumber]);

  // === VIEWER CONFIG ===
  const getViewerConfig = useCallback(() => {
    return {
      className: `flex-1 overflow-auto bg-gray-100 flex justify-center smooth-scroll ${
        mobileModeActive ? 'mobile-content-with-header' : ''
      }`
    };
  }, [mobileModeActive]);

  // === RETURN INTERFACE ===
  return {
    // === UI STATE ===
    showSaveDialog,
    saveAction,
    
    // === SAVE DIALOG STATE ===
    batchQuantity,
    batchUnit,
    solutionLotNumber,
    solutionQuantity,
    solutionUnit,
    confirmedComponents,
    availableLots,
    isLoadingLots,
    scaledComponents,
    
    // === EVENT HANDLERS ===
    handleSave,
    handleSaveConfirm,
    handleSaveDialogClose,
    handleFileDeleted,
    handleOpenProperties,
    handleToggleDrawing,
    handlePageNavigation,
    setBatchQuantity,
    setBatchUnit,
    setSolutionLotNumber,
    setSolutionQuantity,
    setSolutionUnit,
    updateComponent,

    // === COMPUTED UI PROPS ===
    buttonConfig: getButtonConfig(),
    workOrderBadgeProps: getWorkOrderBadgeProps(),
    statusBadgeProps: getStatusBadgeProps(),
    toolbarConfig: getToolbarConfig(),
    pageNavConfig: getPageNavConfig(),
    mobileActionsConfig: getMobileActionsConfig(),
    workflowIndicators: getWorkflowIndicators(),
    headerConfig: getHeaderConfig(),
    viewerConfig: getViewerConfig(),
    
    // === DIALOG PROPS ===
    actionInfo: getActionInfo(),
    isDialogValid: isDialogValid(),

    // === HELPER FLAGS ===
    compact,
    isValid: core.blobUri !== null
  };
}