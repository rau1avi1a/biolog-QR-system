// app/(pages)/files/components/PDFEditor/hooks/state/saveDialog/saveDialog.state.js
'use client';

import { useState, useCallback, useEffect } from 'react';
import { filesApi } from '../../../../../lib/api';

/**
 * Save Dialog State Hook
 * Handles save dialog UI state, form management, and validation logic
 */
export function useSaveDialog(doc, core, refreshFiles, setCurrentDoc) {
  // === DIALOG STATE ===
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveAction, setSaveAction] = useState('save');
  
  // === SAVE DIALOG FORM STATE ===
  const [batchQuantity, setBatchQuantity] = useState('1000');
  const [batchUnit, setBatchUnit] = useState('mL');
  const [solutionLotNumber, setSolutionLotNumber] = useState('');
  const [solutionQuantity, setSolutionQuantity] = useState('');
  const [solutionUnit, setSolutionUnit] = useState('');
  const [confirmedComponents, setConfirmedComponents] = useState([]);
  const [availableLots, setAvailableLots] = useState({});
  const [isLoadingLots, setIsLoadingLots] = useState(false);
  const [scaledComponents, setScaledComponents] = useState([]);

  // EXTRACTED: getActionInfo from your state.js
const getActionInfo = useCallback(() => {
  const isOriginal = !doc?.isBatch;
  const status = doc?.status || 'Draft';
  const hasWorkOrder = doc?.workOrderCreated;
  const hasTransaction = doc?.chemicalsTransacted;
  const hasSolution = doc?.solutionCreated;
  const wasRejected = doc?.wasRejected;
  const hasAssemblyBuild = doc?.assemblyBuildCreated;
  
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
      actions: ['Scale Recipe to Batch Size', 'Create Work Order in Background', 'Set Status to In Progress']
    };
  }
  
  if (saveAction === 'submit_review') {
    // Handle previously rejected files differently
    if (wasRejected) {
      return {
        title: 'Resubmit for Review',
        description: 'This batch was previously rejected and will be moved back to Review status. No additional transactions needed.',
        icon: 'RefreshCw',
        requiresChemicals: false,
        requiresLot: false,
        requiresBatchSize: false,
        wasRejected: true,
        actions: ['Move to Review Status']
      };
    }
    
    if (!hasTransaction) {
      return {
        title: 'Transact Chemicals & Create Assembly Build',
        description: 'This will transact the scaled chemical quantities, create the solution lot, and complete the work order by creating an assembly build in NetSuite.', // 🆕 Enhanced description
        icon: 'Beaker',
        requiresChemicals: true,
        requiresLot: true,
        requiresBatchSize: false,
        actions: [
          'Transact Scaled Chemical Quantities', 
          'Create Solution Lot', 
          'Complete Work Order (Assembly Build)', // 🆕 Enhanced action
          'Move to Review Status'
        ]
      };
    } else {
      return {
        title: 'Complete Work Order & Move to Review',
        description: 'Chemicals already transacted and solution created. This will complete the work order by creating an assembly build and move to Review status.', // 🆕 Enhanced description
        icon: 'FileText',
        requiresChemicals: false,
        requiresLot: false,
        requiresBatchSize: false,
        actions: [
          'Complete Work Order (Assembly Build)', // 🆕 Enhanced action
          'Move to Review Status'
        ]
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
    if (action === 'submit_review') {
      // ✅ NEW: For previously rejected files, you can choose to skip dialog or show simplified version
      // Option 1: Skip dialog entirely for rejected files
      // if (doc?.wasRejected) return false;
      
      // Option 2: Show simplified dialog for rejected files (current implementation)
      return true;
    }
    if (action === 'complete') return true;
    if (action === 'reject') return true;
    return false;
  }, [doc?.wasRejected]);

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

  // EXTRACTED: loadAvailableLots from your state.js
  const loadAvailableLots = useCallback(async () => {
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
  }, [confirmedComponents]);

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
    
    // ✅ NEW: Previously rejected files submitting for review are always valid (no requirements)
    if (actionInfo.wasRejected && saveAction === 'submit_review') return true;
    
    return true;
  }, [getActionInfo, batchQuantity, solutionLotNumber, confirmedComponents, saveAction]);

  // === EVENT HANDLERS ===
  const handleSave = useCallback(async (action = 'save') => {
    console.log('🚀 HANDLE SAVE CALLED:', { action, needsConfirmation: shouldShowConfirmation(action), wasRejected: doc?.wasRejected });

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
  }, [core.save, shouldShowConfirmation, doc?.wasRejected]);

  // EXTRACTED: handleSaveConfirm from your state.js
const handleSaveConfirm = useCallback(async (confirmationData) => {
  console.log('✅ HANDLE SAVE CONFIRM CALLED:', { saveAction, confirmationData, wasRejected: doc?.wasRejected });

  try {
    // Show loading for work order creation when confirm button is clicked
    if (saveAction === 'create_work_order') {
      core.setIsCreatingWorkOrder(true);
      core.setUserInitiatedCreation(true);
    }

    // 🆕 NEW: Show loading for assembly build creation when submitting for review
    if (saveAction === 'submit_review' && !doc?.wasRejected) {
      core.setIsCreatingAssemblyBuild && core.setIsCreatingAssemblyBuild(true);
      core.initializeAssemblyBuildCreation && core.initializeAssemblyBuildCreation();
    }

    // Handle previously rejected files with minimal data
    const finalConfirmationData = doc?.wasRejected && saveAction === 'submit_review' ? {
      // Minimal data for rejected file resubmission
      reason: '',
      wasRejected: true,
      ...confirmationData
    } : {
      // Normal confirmation data for other cases
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
    
    // Handle different save actions
    if (saveAction === 'create_work_order' && result?.data) {
      console.log('🔄 Work Order created - updating document with proper PDF handling');
      
      const newBatchData = {
        ...result.data,
        isBatch: true,
        originalFileId: result.data.fileId || doc._id,
        status: 'In Progress',
        workOrderCreated: true,
        workOrderStatus: 'creating'
      };
      
      console.log('📄 Setting new batch document');
      
      if (setCurrentDoc) {
        setCurrentDoc(newBatchData);
      }
      
    } else if (saveAction === 'submit_review' && result?.data) {
      // 🆕 NEW: Handle submit for review with assembly build creation
      console.log('🔄 Submit for Review completed - may have triggered assembly build creation');
      
      // The backend will handle the async assembly build creation
      // The UI will be updated through polling
      
      // If this wasn't a rejected file resubmission, assembly build polling should start automatically
      if (!doc?.wasRejected) {
        console.log('🏗️ Assembly build creation should be starting in background...');
        
        // The core hook's useEffect will detect the assemblyBuildStatus change and start polling
        // No need to manually start polling here
      }
      
    } else {
      // Handle other actions normally
      const actionsThatBakePDF = ['submit_review', 'complete'];
      const shouldClearOverlays = actionsThatBakePDF.includes(saveAction);
      
      if (shouldClearOverlays) {
        console.log('🔥 Action bakes PDF - overlays will be cleared by core');
      }
    }
    
    // Always refresh files to update the UI with new document data
    if (refreshFiles) {
      console.log('🔄 Refreshing file list...');
      setTimeout(() => {
        refreshFiles();
      }, 500);
    }
    
  } catch (error) {
    console.error('❌ Save confirm error:', error);
    
    // Reset loading states on error
    if (saveAction === 'create_work_order') {
      core.setUserInitiatedCreation(false);
      core.setIsCreatingWorkOrder(false);
    }
    
    // 🆕 NEW: Reset assembly build loading state on error
    if (saveAction === 'submit_review' && !doc?.wasRejected) {
      core.setIsCreatingAssemblyBuild && core.setIsCreatingAssemblyBuild(false);
      core.resetAssemblyBuildCreation && core.resetAssemblyBuildCreation();
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

  

  return {
    // === DIALOG STATE ===
    showSaveDialog,
    setShowSaveDialog,
    saveAction,
    setSaveAction,
    
    // === FORM STATE ===
    batchQuantity,
    setBatchQuantity,
    batchUnit,
    setBatchUnit,
    solutionLotNumber,
    setSolutionLotNumber,
    solutionQuantity,
    setSolutionQuantity,
    solutionUnit,
    setSolutionUnit,
    confirmedComponents,
    setConfirmedComponents,
    availableLots,
    isLoadingLots,
    scaledComponents,
    
    // === COMPUTED PROPS ===
    actionInfo: getActionInfo(),
    isDialogValid: isDialogValid(),
    
    // === EVENT HANDLERS ===
    handleSave,
    handleSaveConfirm,
    handleSaveDialogClose,
    updateComponent,
    loadAvailableLots
  };
}