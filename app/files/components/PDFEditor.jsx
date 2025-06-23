// app/files/components/PDFEditor.jsx - Enhanced with Real-time Work Order Status and Notifications
'use client';

import React, { useState, useEffect } from 'react';
import {
  Menu, Pencil, Undo, Save, CheckCircle, Printer, Settings,
  ChevronLeft, ChevronRight, ArrowRightCircle, XCircle, Package,
  AlertTriangle, FileText, Lock, MoreHorizontal, Clock
} from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { useWorkOrderStatus } from '@/hooks/useWorkOrderStatus';
import { useWorkOrderToast } from '@/hooks/useWorkOrderToast'; // Updated import
import usePdfEditorLogic from '../hooks/usePDFEditor';
import FileMetaDrawer from './FileMetaDrawer';
import SaveConfirmationDialog from './SaveConfirmationDialog';

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

/* tiny icon button */
const Tool = ({ icon: Icon, label, ...rest }) => (
  <Button size="icon" variant="ghost" title={label} {...rest}>
    <Icon size={18} />
  </Button>
);

export default function PDFEditor(props) {
  /* drawer flag inside the component */
  const [metaOpen, setMetaOpen] = useState(false);
  
  /* Save confirmation dialog state */
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveAction, setSaveAction] = useState('save');

  /* Work order creation status - only show when user initiated */
  const [isCreatingWorkOrder, setIsCreatingWorkOrder] = useState(false);
  const [lastWorkOrderNumber, setLastWorkOrderNumber] = useState(null);
  const [userInitiatedCreation, setUserInitiatedCreation] = useState(false); // Track if user started creation

  /* Toast notifications */
  const { workOrderCreated, workOrderFailed, workOrderCreating } = useWorkOrderToast();

  /* logic hook */
  const {
    canvasRef, pageContainerRef,
    blobUri, pages, pageNo, isDraw, overlay, histIdx, isSaving,
    setIsDraw, down, move, up, pointerCancel, undo, save, gotoPage, print, initCanvas, setPages,
    canDraw
  } = usePdfEditorLogic(props);

  /* Real-time work order status polling */
  const { 
    status: workOrderStatus, 
    loading: workOrderLoading, 
    isCreating: workOrderIsCreating,
    workOrderNumber,
    hasWorkOrder,
    error: workOrderError
  } = useWorkOrderStatus(props.doc?._id, props.doc?.isBatch && props.doc?.workOrderCreated);

  if (!blobUri) return <div className="p-4">No PDF data.</div>;
  const { doc, onToggleDrawer, mobileModeActive, refreshFiles, setCurrentDoc } = props;
  const compact = mobileModeActive;

  // Determine file type and status
  const isOriginal = !doc.isBatch;
  const status = doc.status || 'Draft';
  const isDraft = status === 'Draft';
  const isInProgress = status === 'In Progress';
  const isInReview = status === 'Review';
  const isCompleted = status === 'Completed';
  const isArchived = doc.isArchived;

  /* Merge work order status with document data */
  const getWorkOrderInfo = () => {
    if (!doc.isBatch) return null;
    
    // Use real-time status if available, otherwise fall back to doc data
    const currentStatus = workOrderStatus || {
      created: doc.workOrderCreated,
      status: doc.workOrderStatus,
      workOrderId: doc.workOrderId,
      workOrderNumber: doc.netsuiteWorkOrderData?.tranId
    };
    
    if (currentStatus.created) {
      const workOrderNumber = currentStatus.workOrderNumber || currentStatus.workOrderId;
      const isNetSuite = !!(currentStatus.workOrderNumber && !currentStatus.workOrderNumber.startsWith('LOCAL-'));
      const isPending = currentStatus.status === 'creating' || workOrderNumber?.startsWith('PENDING-');
      const isLocal = workOrderNumber?.startsWith('LOCAL-WO-');
      const isFailed = currentStatus.status === 'failed';
      
      return {
        id: workOrderNumber || 'Unknown',
        workOrderNumber: currentStatus.workOrderNumber,
        internalId: currentStatus.internalId,
        status: currentStatus.status || 'created',
        isNetSuite: isNetSuite,
        isLocal: isLocal,
        isPending: isPending,
        isFailed: isFailed,
        isUpdating: workOrderLoading,
        error: currentStatus.error || workOrderError
      };
    }
    
    return null;
  };

  const workOrderInfo = getWorkOrderInfo();

  /* Show notifications when work order status changes - only for user-initiated */
  useEffect(() => {
    // Only show notifications for user-initiated work order creation
    if (!userInitiatedCreation) return;

    // Check for successful completion
    const currentWorkOrderNumber = workOrderNumber || workOrderInfo?.workOrderNumber;
    
    if (currentWorkOrderNumber && 
        currentWorkOrderNumber !== lastWorkOrderNumber &&
        !currentWorkOrderNumber.startsWith('LOCAL-') && 
        !currentWorkOrderNumber.startsWith('PENDING-')) {
      
      console.log('Work order completed, showing success notification:', currentWorkOrderNumber);
      workOrderCreated(currentWorkOrderNumber);
      setLastWorkOrderNumber(currentWorkOrderNumber);
      setUserInitiatedCreation(false); // Reset flag
      setIsCreatingWorkOrder(false); // Stop showing loading
    }
  }, [workOrderNumber, workOrderInfo?.workOrderNumber, lastWorkOrderNumber, workOrderCreated, userInitiatedCreation]);

  /* Show error notification for failed work orders - only for user-initiated */
  useEffect(() => {
    if (workOrderInfo?.isFailed && workOrderInfo.error && userInitiatedCreation) {
      workOrderFailed(workOrderInfo.error);
      setUserInitiatedCreation(false); // Reset flag
      setIsCreatingWorkOrder(false); // Stop showing loading
    }
  }, [workOrderInfo?.isFailed, workOrderInfo?.error, workOrderFailed, userInitiatedCreation]);

  /* Force refresh when work order status changes */
  useEffect(() => {
    // Refresh file data when work order status changes significantly
    const currentWorkOrderNumber = workOrderNumber || workOrderInfo?.workOrderNumber;
    
    if (currentWorkOrderNumber && 
        currentWorkOrderNumber !== lastWorkOrderNumber &&
        !currentWorkOrderNumber.startsWith('LOCAL-') && 
        !currentWorkOrderNumber.startsWith('PENDING-')) {
      
      console.log('Work order completed, refreshing file data...');
      // Force a complete refresh of the document data
      refreshFiles?.();
      
      // Also try to refresh the current document specifically
      if (props.doc?._id) {
        // You might need to add a prop or function to refresh the current document
        console.log('Requesting document refresh for:', props.doc._id);
      }
    }
  }, [workOrderNumber, workOrderInfo?.workOrderNumber, lastWorkOrderNumber, refreshFiles, props.doc?._id]);

  /* Enhanced Work Order Badge component with real-time updates */
  const WorkOrderBadge = ({ workOrderInfo, compact }) => {
    if (!workOrderInfo) return null;

    // Use real-time status from polling hook
    const realTimeStatus = workOrderStatus?.status || workOrderInfo.status;
    const realTimeNumber = workOrderStatus?.workOrderNumber || workOrderNumber || workOrderInfo.workOrderNumber;
    const isRealTimeUpdating = workOrderLoading && workOrderIsCreating; // Updated variable name

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

    return (
      <Badge 
        variant="outline" 
        className={`text-xs flex items-center gap-1 shrink-0 ${getBadgeColor()} transition-colors duration-200`}
        title={workOrderInfo.error || `Work Order: ${realTimeNumber || workOrderInfo.id}`}
      >
        <span className={isRealTimeUpdating ? 'animate-pulse' : ''}>{getIcon()}</span>
        <span>{getDisplayText()}</span>
        {isRealTimeUpdating && (
          <div className="w-2 h-2 bg-current rounded-full animate-ping"></div>
        )}
      </Badge>
    );
  };

  /* Handle save button clicks with NetSuite workflow */
  const handleSave = async (action = 'save') => {
    setSaveAction(action);
    
    // Determine if we need to show confirmation dialog
    const needsConfirmation = shouldShowConfirmation(action);
    
    if (needsConfirmation) {
      setShowSaveDialog(true);
    } else {
      // For simple actions, save directly
      try {
        await save(action);
      } finally {
        // Don't manage loading state here - let the confirmation dialog handle it
      }
    }
  };

  /* Determine if confirmation dialog is needed */
  const shouldShowConfirmation = (action) => {
    if (action === 'create_work_order') return true;
    if (action === 'submit_review') return true;
    if (action === 'complete') return true;
    if (action === 'reject') return true;
    return false;
  };

  /* Handle file deletion */
  const handleFileDeleted = () => {
    setCurrentDoc(null);
    refreshFiles?.();
  };

  const handleSaveConfirm = async (confirmationData) => {
    try {
      // Show loading and toast for work order creation when confirm button is clicked
      if (saveAction === 'create_work_order') {
        setIsCreatingWorkOrder(true);
        setUserInitiatedCreation(true);
        workOrderCreating(); // Show "Creating Work Order..." toast
      }

      await save(saveAction, confirmationData);
      setShowSaveDialog(false);
      refreshFiles?.();
      
      setTimeout(() => {
        if (canvasRef.current) {
          initCanvas();
        }
      }, 200);
    } catch (error) {
      // Error handling
      if (saveAction === 'create_work_order') {
        setUserInitiatedCreation(false);
        setIsCreatingWorkOrder(false);
        workOrderFailed('Failed to create work order');
      }
    } finally {
      // Don't reset loading for work order creation - let polling detect completion
      if (saveAction !== 'create_work_order') {
        setIsCreatingWorkOrder(false);
      }
    }
  };

  /* Open properties drawer */
  const handleOpenProperties = () => {
    setMetaOpen(true);
  };

  /* Get the appropriate button text and action */
  const getButtonConfig = () => {
    if (isOriginal || isDraft) {
      return {
        action: 'create_work_order',
        text: compact ? 'Create WO' : 'Create Work Order',
        icon: Package,
        variant: 'default',
        disabled: isSaving || isCreatingWorkOrder,
        loading: isCreatingWorkOrder
      };
    }
    
    if (isInProgress) {
      return [
        {
          action: 'save',
          text: compact ? 'Save' : 'Save',
          icon: Save,
          variant: 'outline',
          disabled: isSaving
        },
        {
          action: 'submit_review',
          text: compact ? 'Submit' : 'Submit for Review',
          icon: ArrowRightCircle,
          variant: 'outline',
          disabled: isSaving
        }
      ];
    }
    
    if (isInReview) {
      return [
        {
          action: 'save',
          text: compact ? 'Save' : 'Save',
          icon: Save,
          variant: 'outline',
          disabled: isSaving
        },
        {
          action: 'reject',
          text: compact ? 'Reject' : 'Reject',
          icon: XCircle,
          variant: 'outline',
          disabled: isSaving,
          className: 'text-red-600 hover:text-red-700'
        },
        {
          action: 'complete',
          text: compact ? 'Complete' : 'Complete',
          icon: CheckCircle,
          variant: 'outline',
          disabled: isSaving,
          className: 'text-green-600 hover:text-green-700'
        }
      ];
    }
    
    return null;
  };

  const buttonConfig = getButtonConfig();

  /* Mobile overflow menu for smaller screens */
  const renderMobileActions = () => {
    if (!buttonConfig) return null;

    const buttons = Array.isArray(buttonConfig) ? buttonConfig : [buttonConfig];
    
    if (compact && window.innerWidth < 480) {
      const [primaryButton, ...overflowButtons] = buttons;
      
      return (
        <div className="flex items-center gap-1">
          <Button
            variant={primaryButton.variant}
            size="sm"
            disabled={primaryButton.disabled}
            onClick={() => handleSave(primaryButton.action)}
            className={`flex items-center gap-1 text-xs px-2 ${primaryButton.className || ''}`}
          >
            {primaryButton.loading || (isSaving && primaryButton.action === saveAction) ? (
              <primaryButton.icon size={14} className="animate-spin" />
            ) : (
              <primaryButton.icon size={14} />
            )}
            <span className="hidden xs:inline">{primaryButton.text}</span>
          </Button>
          
          {overflowButtons.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="px-2">
                  <MoreHorizontal size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {overflowButtons.map((config, index) => {
                  const IconComponent = config.icon;
                  return (
                    <DropdownMenuItem
                      key={index}
                      disabled={config.disabled}
                      onClick={() => handleSave(config.action)}
                      className={config.className}
                    >
                      <IconComponent size={16} className="mr-2" />
                      {config.text}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      );
    }

    return (
      <>
        {buttons.map((config, index) => {
          const IconComponent = config.icon;
          return (
            <Button
              key={index}
              variant={config.variant}
              size="sm"
              disabled={config.disabled}
              onClick={() => handleSave(config.action)}
              className={`flex items-center gap-1 ${compact ? 'text-xs px-2' : ''} ${config.className || ''}`}
            >
              {config.loading || (isSaving && config.action === saveAction) ? (
                <IconComponent size={compact ? 14 : 16} className="animate-spin" />
              ) : (
                <IconComponent size={compact ? 14 : 16} />
              )}
              {!compact && <span>{config.text}</span>}
              {compact && (
                <span className="hidden sm:inline text-xs">{config.text}</span>
              )}
            </Button>
          );
        })}
      </>
    );
  };

  /* ───────────────────── render ───────────────────── */
  return (
    <div className="flex flex-col h-full">
      {/* Enhanced mobile toolbar with better positioning */}
      <div className={`
        border-b bg-white/95 backdrop-blur-sm 
        flex items-center justify-between 
        px-2 sm:px-4 py-2 prevent-horizontal-scroll
        ${mobileModeActive ? 'mobile-fixed-header' : 'sticky top-0 z-10'}
      `}>
        <div className="flex items-center gap-1 sm:gap-3 min-w-0 flex-1">
          {onToggleDrawer && (
            <Button size="icon" variant="ghost" onClick={onToggleDrawer} title="Menu" className="shrink-0 toolbar-button">
              <Menu size={18}/>
            </Button>
          )}

          {/* file name + page switch - hide filename on tablet/mobile */}
          <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
            <span className="font-semibold text-xs sm:text-sm truncate max-w-[20vw] sm:max-w-[30vw] hidden xl:block">
              {doc.fileName}
              {doc.runNumber && ` (${doc.runNumber})`}
            </span>

            {pages > 1 && (
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-6 w-6"
                        onClick={() => gotoPage(pageNo - 1)} disabled={pageNo <= 1}>
                  <ChevronLeft size={12}/>
                </Button>
                <span className="text-xs w-8 sm:w-10 text-center">{pageNo}/{pages}</span>
                <Button size="icon" variant="ghost" className="h-6 w-6"
                        onClick={() => gotoPage(pageNo + 1)} disabled={pageNo >= pages}>
                  <ChevronRight size={12}/>
                </Button>
              </div>
            )}

            {/* Status badge - better responsive sizing */}
            <Badge variant="outline" className={`text-xs shrink-0 ${
              status === 'Draft' ? 'bg-gray-100 text-gray-800' :
              status === 'In Progress' ? 'bg-amber-100 text-amber-800' :
              status === 'Review' ? 'bg-blue-100 text-blue-800' :
              'bg-green-100 text-green-800'
            }`}>
              {compact && status === 'In Progress' ? 'In Progress' : 
               compact && status === 'Review' ? 'Review' :
               compact ? status.slice(0, 8) : status}
            </Badge>

            {/* Enhanced Work Order Status with real-time updates */}
            {workOrderInfo && (
              <WorkOrderBadge workOrderInfo={workOrderInfo} compact={compact} />
            )}

            {/* Workflow restrictions indicator for original files */}
            {isOriginal && (
              <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 flex items-center gap-1 shrink-0">
                <Lock size={8} />
                {compact ? 'Read Only' : 'Read Only'}
              </Badge>
            )}

            {/* NetSuite workflow indicators - only show rejection status as it's critical */}
            <div className="hidden lg:flex items-center gap-1">
              {doc.wasRejected && (
                <Badge variant="outline" className="text-xs bg-red-50 text-red-700">
                  <AlertTriangle size={12} className="mr-1" />
                  Rejected
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Tools - more compact on mobile */}
          <div className="flex items-center gap-1">
            {/* Settings */}
            <Tool icon={Settings} label="File properties" onClick={() => setMetaOpen(true)} />

            {/* Drawing toggle - only show if drawing is allowed */}
            {canDraw() ? (
              <Tool icon={Pencil} label={isDraw ? 'Draw off' : 'Draw on'}
                    onClick={() => setIsDraw(d => !d)}
                    style={isDraw ? { color: 'var(--primary)' } : {}} />
            ) : (
              <Tool icon={Lock} label="Drawing disabled for this file type/status"
                    disabled={true}
                    className="opacity-50" />
            )}

            {/* Undo - only enabled if drawing is allowed */}
            <Tool icon={Undo} label="Undo" onClick={undo}
                  disabled={histIdx < 0 || !canDraw()}
                  className={histIdx < 0 || !canDraw() ? 'opacity-50' : ''} />

            {/* Print - hide on very small screens */}
            <div className="hidden sm:block">
              <Tool icon={Printer} label="Print" onClick={print} />
            </div>
          </div>

          {/* Dynamic buttons based on workflow state */}
          {renderMobileActions()}

          {(isCompleted || isArchived) && (
            <Badge variant="outline" className="text-green-600 flex items-center gap-1 text-xs">
              <CheckCircle size={12} />
              {compact ? (isArchived ? 'Arc' : 'Done') : (isArchived ? 'Archived' : 'Completed')}
            </Badge>
          )}

          {/* Work Order Creation Loading Indicator */}
          {isCreatingWorkOrder && (
            <div className="flex items-center gap-1 text-xs text-blue-600">
              <Clock size={12} className="animate-spin" />
              <span className="hidden sm:inline">Creating WO...</span>
            </div>
          )}
        </div>
      </div>

      {/* viewer - add top padding on mobile to account for fixed toolbar */}
      <div className={`flex-1 overflow-auto bg-gray-100 flex justify-center smooth-scroll ${
        mobileModeActive ? 'mobile-content-with-header' : ''
      }`}>
        <div ref={pageContainerRef} className="relative bg-white shadow my-4">
          <Document
            file={blobUri}
            onLoadSuccess={({ numPages }) => setPages(numPages)}
            loading={<div className="p-10 text-center">Loading PDF…</div>}
            error={<div className="p-10 text-center text-red-500">Error loading PDF</div>}
          >
            <Page
              pageNumber={pageNo}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              onRenderSuccess={initCanvas}
              loading={<div className="p-10 text-center">Rendering…</div>}
            />
          </Document>

          <canvas
            ref={canvasRef}
            className={`absolute inset-0 ${
              isDraw && canDraw() ? 'cursor-crosshair' : 'pointer-events-none'
            }`}
            style={{ 
              touchAction: isDraw && canDraw() ? 'none' : 'auto'
            }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerLeave={up}
            onPointerCancel={pointerCancel}
          />
        </div>
      </div>

      {/* drawer - different behavior based on status */}
      <FileMetaDrawer
        file={doc}
        open={metaOpen}
        onOpenChange={setMetaOpen}
        onSaved={refreshFiles}
        onFileDeleted={handleFileDeleted}
        readOnly={doc.isBatch || isCompleted || isArchived}
      />

      {/* Save Confirmation Dialog */}
      <SaveConfirmationDialog
        open={showSaveDialog}
        onClose={() => {
          setShowSaveDialog(false);
          if (saveAction === 'create_work_order') {
            setUserInitiatedCreation(false);
          }
          setIsCreatingWorkOrder(false);
        }}
        onConfirm={handleSaveConfirm}
        currentDoc={doc}
        action={saveAction}
        onOpenProperties={handleOpenProperties}
      />
    </div>
  );
}