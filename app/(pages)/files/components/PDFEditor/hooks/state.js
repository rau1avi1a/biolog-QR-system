// app/files/components/PDFEditor/hooks/state.js - FIXED with useEffect import
'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { filesApi } from '../../../lib/api'

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
  
  if (!workOrderInfo && !core.isCreatingWorkOrder && !core.userInitiatedCreation) {
    return null;
  }

  // FIXED: Better status detection and display logic
  const getBadgeColor = () => {
    if (workOrderInfo?.isFailed) return 'bg-red-50 text-red-700 border-red-200';
    
    // ADDED: Green for completed assembly builds
    if (doc?.assemblyBuildCreated || doc?.workOrderCompleted) {
      return 'bg-green-50 text-green-700 border-green-200';
    }
    
    if (workOrderInfo?.isPending || core.isCreatingWorkOrder || core.userInitiatedCreation) {
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    }
    if (workOrderInfo?.isCreated && workOrderInfo?.workOrderNumber) {
      return workOrderInfo.isNetSuite ? 
        'bg-blue-50 text-blue-700 border-blue-200' : 
        'bg-green-50 text-green-700 border-green-200';
    }
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const getDisplayText = () => {
    // PRIORITY 1: Show Assembly Build number if completed
    if (doc?.assemblyBuildCreated && doc?.assemblyBuildTranId) {
      const assemblyBuildNumber = doc.assemblyBuildTranId;
      return compact ? assemblyBuildNumber : `${assemblyBuildNumber}`;
    }
    
    // PRIORITY 2: Show Work Order number if created but not completed
    if (workOrderInfo?.isCreated && workOrderInfo?.workOrderNumber && !workOrderInfo?.isPending) {
      const number = workOrderInfo.workOrderNumber;
      return compact ? number : `${number}`;
    }
    
    // PRIORITY 3: Show creating status
    if (workOrderInfo?.isPending || core.isCreatingWorkOrder || core.userInitiatedCreation || core.workOrderLoading) {
      return compact ? 'Creating...' : 'Creating Work Order';
    }
    
    // PRIORITY 4: Show failed status
    if (workOrderInfo?.isFailed) {
      return compact ? 'WO Failed' : 'Work Order Failed';
    }
    
    // Fallback
    return compact ? 'WO' : 'Work Order';
  };

  const getIcon = () => {
    if (workOrderInfo?.isFailed) return '❌';
    
    // ADDED: Show completed icon for assembly builds
    if (doc?.assemblyBuildCreated || doc?.workOrderCompleted) {
      return '✅';
    }
    
    if (workOrderInfo?.isPending || core.isCreatingWorkOrder || core.userInitiatedCreation || core.workOrderLoading) {
      return '⏳';
    }
    if (workOrderInfo?.isCreated && workOrderInfo?.workOrderNumber) {
      return workOrderInfo.isNetSuite ? '🔗' : '📝';
    }
    return '📋';
  };

  const getTitle = () => {
    if (workOrderInfo?.isFailed) {
      return `Work order creation failed: ${workOrderInfo.error || 'Unknown error'}`;
    }
    
    // ADDED: Enhanced titles for assembly builds
    if (doc?.assemblyBuildCreated && doc?.assemblyBuildTranId) {
      return `Assembly Build Completed: ${doc.assemblyBuildTranId} (from Work Order: ${workOrderInfo?.workOrderNumber || 'Unknown'})`;
    }
    
    if (doc?.workOrderCompleted) {
      return `Work Order Completed: ${workOrderInfo?.workOrderNumber || 'Unknown'}`;
    }
    
    if (workOrderInfo?.isPending || core.isCreatingWorkOrder || core.userInitiatedCreation) {
      return 'Work order is being created in NetSuite...';
    }
    if (workOrderInfo?.isCreated && workOrderInfo?.workOrderNumber) {
      return workOrderInfo.isNetSuite ? 
        `NetSuite Work Order: ${workOrderInfo.workOrderNumber}` : 
        `Local Work Order: ${workOrderInfo.workOrderNumber}`;
    }
    return 'Work Order';
  };

  const isAnimating = workOrderInfo?.isPending || 
                     core.isCreatingWorkOrder || 
                     core.userInitiatedCreation || 
                     core.workOrderLoading;

  return {
    className: `text-xs flex items-center gap-1 shrink-0 ${getBadgeColor()} transition-colors duration-200`,
    title: getTitle(),
    isAnimating: isAnimating,
    icon: getIcon(),
    text: getDisplayText()
  };
}, [
  core.workOrderInfo, 
  core.isCreatingWorkOrder, 
  core.userInitiatedCreation,
  core.workOrderStatus, 
  core.workOrderLoading,
  // ADDED: Include assembly build fields in dependencies
  doc?.assemblyBuildCreated,
  doc?.assemblyBuildTranId,
  doc?.workOrderCompleted,
  compact
]);

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
    
    console.log('🔍 Loading lots for components:', confirmedComponents.length);
    
    await Promise.all(
      confirmedComponents.map(async (comp, index) => {
        // Extract itemId more reliably
        let itemId;
        if (comp.itemId) {
          if (typeof comp.itemId === 'object' && comp.itemId !== null) {
            itemId = comp.itemId._id || comp.itemId.toString();
          } else {
            itemId = comp.itemId.toString();
          }
        }
        
        if (!itemId) {
          console.warn(`❌ Component ${index} missing itemId:`, comp);
          return;
        }
        
        console.log(`🔍 Fetching lots for item ${itemId} (${comp.displayName})`);
        
        try {
          const result = await filesApi.items.getLots(itemId);
          
          console.log(`📦 Lots result for ${itemId}:`, result);
          
          if (!result.error && result.data) {
            const lots = Array.isArray(result.data) ? result.data : [];
            lotsMap[itemId] = lots;
            
            console.log(`✅ Found ${lots.length} lots for ${comp.displayName}:`, lots);
          } else {
            console.warn(`⚠️ No lots found for ${comp.displayName}:`, result.error);
            lotsMap[itemId] = [];
          }
        } catch (error) {
          console.error(`💥 Error fetching lots for ${comp.displayName}:`, error);
          lotsMap[itemId] = [];
        }
      })
    );
    
    console.log('📊 Final lots map:', lotsMap);
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

    console.log('🚀 HANDLE SAVE CALLED:', { action, needsConfirmation: shouldShowConfirmation(action) });

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



// Fixed handleSaveConfirm function for your state hook

const handleSaveConfirm = useCallback(async (confirmationData) => {
  console.log('✅ HANDLE SAVE CONFIRM CALLED:', { saveAction, confirmationData });

  try {
    // Show loading for work order creation when confirm button is clicked
    if (saveAction === 'create_work_order') {
      core.setIsCreatingWorkOrder(true);
      core.setUserInitiatedCreation(true);
    }

    const finalConfirmationData = {
      batchQuantity: parseFloat(batchQuantity) || 1000,
      batchUnit: batchUnit,
      solutionLotNumber: solutionLotNumber.trim(),
      solutionQuantity: parseFloat(solutionQuantity) || parseFloat(batchQuantity) || 1000,
      solutionUnit: solutionUnit,
      components: confirmedComponents,
      scaledComponents: scaledComponents,
      reason: confirmationData?.reason || '',
      ...confirmationData
    };


    // Perform the save and wait for result
    const result = await core.save(saveAction, finalConfirmationData);
    setShowSaveDialog(false);
    
    console.log('💾 Save completed, result:', result);
    
    // FIXED: Handle Work Order creation specially to preserve PDF state
    if (saveAction === 'create_work_order' && result?.data) {
      console.log('🔄 Work Order created - updating document with proper PDF handling');
      
      // FIXED: Better PDF data handling - use the validateAndCleanBase64 function
      let newPdfData = doc.pdf; // Start with current PDF as fallback
      
      if (result.data.signedPdf?.data) {
        console.log('🔧 Processing signedPdf from work order creation result');
        
        // Use the same validation function as in the core hook
        const validateAndCleanBase64 = (data, contentType = 'application/pdf') => {
          if (!data) return null;
          
          try {
            // Handle object format from backend
            if (typeof data === 'object' && data !== null && !Buffer.isBuffer(data)) {
              if (data.data) {
                const objContentType = data.contentType || contentType;
                return validateAndCleanBase64(data.data, objContentType);
              }
              return null;
            }
            
            // Handle data URL
            if (typeof data === 'string' && data.startsWith('data:')) {
              const base64Match = data.match(/^data:([^;]+);base64,(.+)$/);
              if (base64Match) {
                atob(base64Match[2]); // Validate
                return data;
              }
            }
            
            // Handle Buffer
            if (Buffer.isBuffer(data)) {
              const base64String = data.toString('base64');
              atob(base64String); // Validate
              return `data:${contentType};base64,${base64String}`;
            }
            
            // Handle serialized Buffer
            if (typeof data === 'object' && data.type === 'Buffer' && Array.isArray(data.data)) {
              const buffer = Buffer.from(data.data);
              const base64String = buffer.toString('base64');
              atob(base64String); // Validate
              return `data:${contentType};base64,${base64String}`;
            }
            
            // Handle plain base64 string
            if (typeof data === 'string') {
              const cleanBase64 = data.replace(/\s/g, '');
              atob(cleanBase64); // Validate
              return `data:${contentType};base64,${cleanBase64}`;
            }
            
            return null;
          } catch (error) {
            console.error('📄 PDF validation failed:', error);
            return null;
          }
        };
        
        newPdfData = validateAndCleanBase64(
          result.data.signedPdf.data,
          result.data.signedPdf.contentType || 'application/pdf'
        );
        
        if (newPdfData) {
          console.log('✅ Successfully processed PDF from work order creation');
        } else {
          console.error('❌ Failed to process PDF from work order creation, using fallback');
          newPdfData = doc.pdf;
        }
      }
      
      // Create new document data with preserved PDF
      const newBatchData = {
        ...result.data,
        isBatch: true,
        originalFileId: result.data.fileId || doc._id,
        pdf: newPdfData, // Use the properly validated PDF
        overlays: null, // Clear overlays since they'll be baked into the new PDF
        status: 'In Progress',
        workOrderCreated: true,
        workOrderStatus: 'creating'
      };
      
      console.log('📄 Setting new batch document with validated PDF');
      
      // Update document with stable key to prevent complete re-mount
      if (setCurrentDoc) {
        setCurrentDoc(newBatchData);
      }
      
    } else {
      // Handle other actions normally
      const actionsThatBakePDF = ['submit_review', 'complete'];
      const shouldClearOverlays = actionsThatBakePDF.includes(saveAction);
      
      if (shouldClearOverlays) {
        console.log('🔥 Action bakes PDF - clearing overlays');
        
        setTimeout(() => {
          console.log('🧹 Clearing overlays from memory...');
          
          core.overlaysRef.current = {};
          core.historiesRef.current = {};
          // core.setHistIdx(-1);
          // core.setHistory([]);
          // core.setOverlay(null);
          
          const canvas = core.canvasRef.current;
          const ctx = core.ctxRef.current;
          
          if (canvas && ctx) {
            console.log('🧹 Clearing canvas completely...');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
          
          console.log('✅ Overlays cleared - drawings are now baked into PDF');
        }, 100);
        
      } else {
        console.log('💾 Simple save - preserving and redrawing overlays');
        
      }
    }
    
    // Always refresh files to update the UI with new document data
    if (refreshFiles) {
      console.log('🔄 Refreshing file list...');
      setTimeout(() => {
        refreshFiles();
      }, 500); // Increased delay for work order creation
    }
    
  } catch (error) {
    console.error('❌ Save confirm error:', error);
    if (saveAction === 'create_work_order') {
      core.setUserInitiatedCreation(false);
      core.setIsCreatingWorkOrder(false);
    }
  }
}, [saveAction, core, refreshFiles, doc, setCurrentDoc, batchQuantity, batchUnit, solutionLotNumber, solutionQuantity, solutionUnit, confirmedComponents, scaledComponents]);

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
  
    // Work order badge - FIXED: Always show if there's work order info or creation in progress
    const workOrderBadge = getWorkOrderBadgeProps();
    if (workOrderBadge) {
      indicators.push({
        type: 'work_order',
        ...workOrderBadge
      });
    }
  
    // Read-only indicator for original files (only if no work order badge)
    if (core.isOriginal && !workOrderBadge) {
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
  }, [
    getWorkOrderBadgeProps, 
    core.isOriginal, 
    core.isCompleted, 
    core.isArchived, 
    doc.wasRejected, 
    compact
  ]);

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