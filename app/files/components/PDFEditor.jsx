// app/files/components/PDFEditor.jsx - Enhanced with Properties Opening and Work Order Status
'use client';

import React, { useState } from 'react';
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

  /* Work order creation status */
  const [isCreatingWorkOrder, setIsCreatingWorkOrder] = useState(false);

  /* logic hook */
  const {
    canvasRef, pageContainerRef,
    blobUri, pages, pageNo, isDraw, overlay, histIdx, isSaving,
    setIsDraw, down, move, up, pointerCancel, undo, save, gotoPage, print, initCanvas, setPages,
    canDraw // Get the canDraw function from the hook
  } = usePdfEditorLogic(props);

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

  /* Get work order display information */
  const getWorkOrderInfo = () => {
    if (!doc.isBatch) return null;
    
    if (doc.workOrderCreated) {
      // Prioritize NetSuite work order ID over local ID
      const displayId = doc.netsuiteWorkOrderData?.tranId || 
                       doc.netsuiteWorkOrderData?.workOrderId || 
                       doc.workOrderId || 'Unknown';
      
      return {
        id: displayId,
        status: doc.workOrderStatus || 'created',
        createdAt: doc.workOrderCreatedAt,
        netsuiteId: doc.netsuiteWorkOrderData?.tranId || doc.netsuiteWorkOrderData?.workOrderId,
        isNetSuite: !!(doc.netsuiteWorkOrderData?.tranId || doc.netsuiteWorkOrderData?.workOrderId),
        isLocal: displayId.startsWith('LOCAL-WO-') || displayId.startsWith('PENDING-')
      };
    }
    
    return null;
  };

  const workOrderInfo = getWorkOrderInfo();

  /* Handle save button clicks with NetSuite workflow */
  const handleSave = async (action = 'save') => {
    setSaveAction(action);
    
    // Special handling for work order creation to show loading state
    if (action === 'create_work_order') {
      setIsCreatingWorkOrder(true);
    }
    
    // Determine if we need to show confirmation dialog
    const needsConfirmation = shouldShowConfirmation(action);
    
    if (needsConfirmation) {
      setShowSaveDialog(true);
    } else {
      // For simple actions, save directly
      try {
        await save(action);
      } finally {
        setIsCreatingWorkOrder(false);
      }
    }
  };

  /* Determine if confirmation dialog is needed */
  const shouldShowConfirmation = (action) => {
    if (action === 'create_work_order') {
      // Always show confirmation for work order creation
      return true;
    }
    if (action === 'submit_review') {
      // Always show confirmation for review submission (chemical transaction)
      return true;
    }
    if (action === 'complete') {
      // Show confirmation for completion
      return true;
    }
    if (action === 'reject') {
      // Show confirmation for rejection
      return true;
    }
    // Regular save doesn't need confirmation
    return false;
  };

  /* Handle file deletion */
  const handleFileDeleted = () => {
    // Clear the current document since it was deleted
    setCurrentDoc(null);
    // Refresh the file list
    refreshFiles?.();
  };

  const handleSaveConfirm = async (confirmationData) => {
    try {
      await save(saveAction, confirmationData);
      setShowSaveDialog(false);
      refreshFiles?.();
      
      // Small delay to ensure state has updated, then refresh canvas
      setTimeout(() => {
        if (canvasRef.current) {
          initCanvas();
        }
      }, 200);
    } catch (error) {
      // You might want to show an error toast here
    } finally {
      setIsCreatingWorkOrder(false);
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
    
    // Completed or archived - no actions
    return null;
  };

  const buttonConfig = getButtonConfig();

  /* Mobile overflow menu for smaller screens */
  const renderMobileActions = () => {
    if (!buttonConfig) return null;

    const buttons = Array.isArray(buttonConfig) ? buttonConfig : [buttonConfig];
    
    // On very small screens (phones), show first button + overflow menu
    if (compact && window.innerWidth < 480) {
      const [primaryButton, ...overflowButtons] = buttons;
      
      return (
        <div className="flex items-center gap-1">
          {/* Primary action button */}
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
          
          {/* Overflow menu for additional buttons */}
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

    // Regular tablet/desktop rendering
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

            {/* Work Order Status - show for batches with work orders */}
            {workOrderInfo && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 flex items-center gap-1 shrink-0">
                <Package size={8} />
                {compact ? 'WO' : 'Work Order'}
                {!workOrderInfo.isLocal && (
                  <span className="text-xs">({workOrderInfo.id})</span>
                )}
                {workOrderInfo.isLocal && (
                  <span className="text-xs text-amber-600">(Local)</span>
                )}
              </Badge>
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
            // Completed/archived batch - read only
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
        readOnly={doc.isBatch || isCompleted || isArchived} // Read-only for all batches, completed, and archived files
      />

      {/* Save Confirmation Dialog */}
      <SaveConfirmationDialog
        open={showSaveDialog}
        onClose={() => {
          setShowSaveDialog(false);
          setIsCreatingWorkOrder(false);
        }}
        onConfirm={handleSaveConfirm}
        currentDoc={doc}
        action={saveAction}
        onOpenProperties={handleOpenProperties} // Pass the function to open properties
      />
    </div>
  );
}