// app/files/components/PDFEditor.jsx - NetSuite Workflow Version
'use client';

import React, { useState } from 'react';
import {
  Menu, Pencil, Undo, Save, CheckCircle, Printer, Settings,
  ChevronLeft, ChevronRight, ArrowRightCircle, XCircle, Package,
  AlertTriangle, FileText
} from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';

import { Button } from '@/components/ui/button';
import { Badge  } from '@/components/ui/badge';

import usePdfEditorLogic from '../hooks/usePDFEditor';
import FileMetaDrawer   from './FileMetaDrawer';
import SaveConfirmationDialog from './SaveConfirmationDialog';

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

/* tiny icon button */
const Tool = ({ icon:Icon, label, ...rest }) => (
  <Button size="icon" variant="ghost" title={label} {...rest}>
    <Icon size={18}/>
  </Button>
);

export default function PDFEditor(props) {
  /* drawer flag inside the component */
  const [metaOpen, setMetaOpen] = useState(false);
  
  /* Save confirmation dialog state */
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveAction, setSaveAction] = useState('save');

  /* logic hook */
  const {
    canvasRef, pageContainerRef,
    blobUri, pages, pageNo, isDraw, overlay, histIdx, isSaving,
    setIsDraw, down, move, up, undo, save, gotoPage, print, initCanvas, setPages
  } = usePdfEditorLogic(props);

  if (!blobUri) return <div className="p-4">No PDF data.</div>;
  const { doc, onToggleDrawer, mobileModeActive, refreshFiles } = props;
  const compact = mobileModeActive;

  // Determine file type and status
  const isOriginal = !doc.isBatch;
  const status = doc.status || 'Draft';
  const isDraft = status === 'Draft';
  const isInProgress = status === 'In Progress';
  const isInReview = status === 'Review';
  const isCompleted = status === 'Completed';

  /* Handle save button clicks with NetSuite workflow */
  const handleSave = (action = 'save') => {
    setSaveAction(action);
    
    // Determine if we need to show confirmation dialog
    const needsConfirmation = shouldShowConfirmation(action);
    
    if (needsConfirmation) {
      setShowSaveDialog(true);
    } else {
      // For simple actions, save directly
      save(action);
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

  /* Handle confirmation from dialog */
  const handleSaveConfirm = async (confirmationData) => {
    try {
      await save(saveAction, confirmationData);
      setShowSaveDialog(false);
      refreshFiles?.();
    } catch (error) {
      console.error('Save failed:', error);
      // You might want to show an error toast here
    }
  };

  /* Get the appropriate button text and action */
  const getButtonConfig = () => {
    if (isOriginal || isDraft) {
      return {
        action: 'create_work_order',
        text: compact ? 'Create WO' : 'Create Work Order',
        icon: Package,
        variant: 'default',
        disabled: isSaving
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
    
    // Completed - no actions
    return null;
  };

  const buttonConfig = getButtonConfig();

  /* ───────────────────── render ───────────────────── */
  return (
    <div className="flex flex-col h-full">
      {/* top bar */}
      <div className="border-b bg-white flex items-center justify-between px-4 py-2 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {onToggleDrawer && (
            <Button size="icon" variant="ghost" onClick={onToggleDrawer} title="Menu">
              <Menu size={18}/>
            </Button>
          )}

          {/* file name + page switch */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate max-w-[30vw]">
              {doc.fileName}
              {doc.runNumber && ` (Run ${doc.runNumber})`}
            </span>

            {pages>1 && (
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-6 w-6"
                        onClick={()=>gotoPage(pageNo-1)} disabled={pageNo<=1}>
                  <ChevronLeft size={14}/>
                </Button>
                <span className="text-xs w-10 text-center">{pageNo}/{pages}</span>
                <Button size="icon" variant="ghost" className="h-6 w-6"
                        onClick={()=>gotoPage(pageNo+1)} disabled={pageNo>=pages}>
                  <ChevronRight size={14}/>
                </Button>
              </div>
            )}

            {/* Status badge */}
            <Badge variant="outline" className={`text-xs ${
              status === 'Draft' ? 'bg-gray-100 text-gray-800' :
              status === 'In Progress' ? 'bg-amber-100 text-amber-800' :
              status === 'Review' ? 'bg-blue-100 text-blue-800' :
              'bg-green-100 text-green-800'
            }`}>{status}</Badge>

            {/* NetSuite workflow indicators */}
            <div className="flex items-center gap-1">
              {doc.workOrderCreated && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                  WO: {doc.workOrderId || 'Created'}
                </Badge>
              )}
              {doc.chemicalsTransacted && (
                <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">
                  Chemicals ✓
                </Badge>
              )}
              {doc.solutionCreated && (
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                  Solution: {doc.solutionLotNumber}
                </Badge>
              )}
              {doc.wasRejected && (
                <Badge variant="outline" className="text-xs bg-red-50 text-red-700">
                  <AlertTriangle size={12} className="mr-1" />
                  Rejected
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* file-properties drawer */}
          <Tool icon={Settings} label="File properties" onClick={()=>setMetaOpen(true)}/>

          <Tool icon={Pencil} label={isDraw?'Draw off':'Draw on'}
                onClick={()=>setIsDraw(d=>!d)}
                style={isDraw?{color:'var(--primary)'}:{}}/>

          <Tool icon={Undo} label="Undo" onClick={undo}
                disabled={histIdx<0}
                className={histIdx<0?'opacity-50':''}/>

          {/* Dynamic buttons based on workflow state */}
          {buttonConfig && (
            <>
              {Array.isArray(buttonConfig) ? (
                // Multiple buttons (In Progress or Review state)
                buttonConfig.map((config, index) => {
                  const IconComponent = config.icon;
                  return (
                    <Button
                      key={index}
                      variant={config.variant}
                      size="sm"
                      disabled={config.disabled}
                      onClick={() => handleSave(config.action)}
                      className={`flex items-center gap-1 ${config.className || ''}`}
                    >
                      {isSaving && config.action === saveAction ? (
                        <IconComponent size={16} className="animate-spin" />
                      ) : (
                        <IconComponent size={16} />
                      )}
                      {!compact && <span>{config.text}</span>}
                    </Button>
                  );
                })
              ) : (
                // Single button (Draft state)
                <Button
                  variant={buttonConfig.variant}
                  size="sm"
                  disabled={buttonConfig.disabled}
                  onClick={() => handleSave(buttonConfig.action)}
                  className="flex items-center gap-1"
                >
                  {isSaving ? (
                    <buttonConfig.icon size={16} className="animate-spin" />
                  ) : (
                    <buttonConfig.icon size={16} />
                  )}
                  {!compact && <span>{buttonConfig.text}</span>}
                </Button>
              )}
            </>
          )}

          {isCompleted && (
            // Completed batch - read only
            <Badge variant="outline" className="text-green-600 flex items-center gap-1">
              <CheckCircle size={14} />
              Completed & Archived
            </Badge>
          )}

          <Tool icon={Printer} label="Print" onClick={print}/>
        </div>
      </div>

      {/* viewer */}
      <div className="flex-1 overflow-auto bg-gray-100 flex justify-center">
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
            className={`absolute inset-0 ${isDraw?'cursor-crosshair':'pointer-events-none'}`}
            style={{ touchAction:isDraw?'none':'auto' }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerLeave={up}
          />
        </div>
      </div>

      {/* drawer - different behavior based on status */}
      <FileMetaDrawer
        file={doc}
        open={metaOpen}
        onOpenChange={setMetaOpen}
        onSaved={refreshFiles}
        readOnly={isInReview || isCompleted} // Read-only in review and completed states
      />

      {/* Save Confirmation Dialog */}
      <SaveConfirmationDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onConfirm={handleSaveConfirm}
        currentDoc={doc}
        action={saveAction}
      />
    </div>
  );
}