// app/files/components/PDFEditor/hooks/state/index.js
'use client';

// === IMPORT ALL STATE HOOKS ===
import { useDrawing } from './drawing/drawing.state.js';
import { useWorkOrder } from './workOrder/workOrder.state.js';
import { useSaveDialog } from './saveDialog/saveDialog.state.js';
import { usePermissions } from './permissions/permissions.state.js';
import { useNavigation } from './navigation/navigation.state.js';
import { useLayout } from './layout/layout.state.js';

/**
 * State Orchestrator Hook (replaces your original useComponentState)
 * 
 * Combines all the individual state hooks and coordinates them to provide
 * the same interface your component expects. This manages all UI logic,
 * event handlers, and conditional rendering.
 */
export function useMain(core, props) {
  const { doc, onToggleDrawer, mobileModeActive, refreshFiles, setCurrentDoc, onOpenProperties } = props;

  // === INITIALIZE ALL STATE HOOKS ===
  
  // Drawing UI state
  const drawingState = useDrawing(core, mobileModeActive);
  
  // Work order UI state  
  const workOrderState = useWorkOrder(core, doc, mobileModeActive);
  
  // Save dialog state
  const saveDialogState = useSaveDialog(doc, core, refreshFiles, setCurrentDoc);
  
  // Permissions state
  const permissionsState = usePermissions(core, doc, mobileModeActive);
  
  // Navigation state
  const navigationState = useNavigation(core, mobileModeActive);
  
  // Layout state
  const layoutState = useLayout(doc, onToggleDrawer, mobileModeActive, onOpenProperties);

  // === COMBINED WORKFLOW INDICATORS ===
  const getWorkflowIndicators = () => {
    const indicators = [
      ...workOrderState.workOrderStatusIndicators,
      ...drawingState.drawingStatusIndicators,
      ...permissionsState.completionIndicators
    ];

    // ✅ FIXED: Return the indicators array directly, not the layout object
    return indicators;
  };

  // === GET WORKFLOW INDICATORS LAYOUT ===
  const getWorkflowIndicatorsLayout = () => {
    const indicators = getWorkflowIndicators();
    return layoutState.workflowIndicatorsLayout(indicators);
  };

  // === COMBINED MOBILE ACTIONS ===
  const getMobileActionsConfig = () => {
    const buttonConfig = permissionsState.buttonConfig;
    return layoutState.mobileActionsConfig(buttonConfig);
  };

  // === COMBINED TOOLBAR CONFIGURATION ===
  const getToolbarConfig = () => {
    const layoutConfig = layoutState.toolbarLayout;
    
    return {
      ...drawingState.toolbarConfig,
      showPageNavigation: navigationState.pageNavConfig.showNavigation,
      showPrint: layoutConfig.rightSection.showPrint, // ✅ PASS through print visibility
      pageNavigation: navigationState.pageNavConfig
    };
  };

  // === PRINT CONFIGURATION ===
  const getPrintConfig = () => {
    return {
      canPrint: !!core.blobUri,
      onPrint: core.print,
      showPrint: layoutState.responsiveConfig.showFullToolbar
    };
  };

  // === RETURN UNIFIED INTERFACE (same as your original useComponentState) ===
  return {
    // === UI-ONLY STATE ===
    showSaveDialog: saveDialogState.showSaveDialog,
    saveAction: saveDialogState.saveAction,
    
    // === SAVE DIALOG STATE ===
    batchQuantity: saveDialogState.batchQuantity,
    batchUnit: saveDialogState.batchUnit,
    solutionLotNumber: saveDialogState.solutionLotNumber,
    solutionQuantity: saveDialogState.solutionQuantity,
    solutionUnit: saveDialogState.solutionUnit,
    confirmedComponents: saveDialogState.confirmedComponents,
    availableLots: saveDialogState.availableLots,
    isLoadingLots: saveDialogState.isLoadingLots,
    scaledComponents: saveDialogState.scaledComponents,
    
    // === EVENT HANDLERS ===
    handleSave: saveDialogState.handleSave,
    handleSaveConfirm: saveDialogState.handleSaveConfirm,
    handleSaveDialogClose: saveDialogState.handleSaveDialogClose,
    handleFileDeleted: layoutState.handleFileDeleted,
    handleOpenProperties: layoutState.handleOpenProperties,
    handleToggleDrawing: drawingState.handleToggleDrawing,
    handlePageNavigation: navigationState.handlePageNavigation,
    setBatchQuantity: saveDialogState.setBatchQuantity,
    setBatchUnit: saveDialogState.setBatchUnit,
    setSolutionLotNumber: saveDialogState.setSolutionLotNumber,
    setSolutionQuantity: saveDialogState.setSolutionQuantity,
    setSolutionUnit: saveDialogState.setSolutionUnit,
    updateComponent: saveDialogState.updateComponent,

    // === COMPUTED UI PROPS ===
    buttonConfig: permissionsState.buttonConfig,
    workOrderBadgeProps: workOrderState.workOrderBadgeProps,
    statusBadgeProps: permissionsState.statusBadgeProps,
    toolbarConfig: getToolbarConfig(),
    pageNavConfig: navigationState.pageNavConfig,
    mobileActionsConfig: getMobileActionsConfig(),
    workflowIndicators: getWorkflowIndicators(),           // ✅ FIXED: Return indicators array
    workflowIndicatorsLayout: getWorkflowIndicatorsLayout(), // ✅ NEW: Layout object if needed
    headerConfig: layoutState.headerConfig,
    viewerConfig: layoutState.viewerConfig,
    printConfig: getPrintConfig(),
    
    // === DIALOG PROPS ===
    actionInfo: saveDialogState.actionInfo,
    isDialogValid: saveDialogState.isDialogValid,

    // === HELPER FLAGS ===
    compact: layoutState.compact,
    isValid: layoutState.isValid,

    // === DRAWING STATE ===
    drawingButtonConfig: drawingState.drawingButtonConfig,
    undoButtonConfig: drawingState.undoButtonConfig,
    canDraw: drawingState.canDraw,
    isDrawing: drawingState.isDrawing,
    canUndo: drawingState.canUndo,

    // === NAVIGATION STATE ===
    prevButtonConfig: navigationState.prevButtonConfig,
    nextButtonConfig: navigationState.nextButtonConfig,
    firstButtonConfig: navigationState.firstButtonConfig,
    lastButtonConfig: navigationState.lastButtonConfig,
    pageIndicatorConfig: navigationState.pageIndicatorConfig,
    pageInputConfig: navigationState.pageInputConfig,
    navigationStatus: navigationState.navigationStatus,

    // === PERMISSIONS STATE ===
    accessControl: permissionsState.accessControl,
    workflowValidation: permissionsState.workflowValidation,
    permissionMessages: permissionsState.permissionMessages,
    isReadOnly: permissionsState.isReadOnly,
    canEdit: permissionsState.canEdit,
    showWorkflowButtons: permissionsState.showWorkflowButtons,

    // === LAYOUT STATE ===
    responsiveConfig: layoutState.responsiveConfig,
    spacingConfig: layoutState.spacingConfig
  };
}

// === EXPORT INDIVIDUAL HOOKS FOR DIRECT ACCESS ===
export { useDrawing, useWorkOrder, useSaveDialog, usePermissions, useNavigation, useLayout };