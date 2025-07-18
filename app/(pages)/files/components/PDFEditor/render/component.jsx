// app/files/components/PDFEditor/render/component.jsx
'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ui } from '@/components/ui';
import { useMain as useCoreMain } from '../hooks/core/index';
import { useMain as useStateMain } from '../hooks/state/index';

// Configure PDF.js worker (matching your old core.js exactly)
if (typeof window !== 'undefined') {
  const { pdfjs } = await import('react-pdf');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

/* Zoom Controls Component */
const ZoomControls = ({ zoom, onZoomChange, onResetZoom, disabled = false }) => {
  const canZoomIn = zoom < 3.0;
  const canZoomOut = zoom > 0.5;

  return (
    <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm border rounded-lg px-2 py-1">
      <ui.Button
        size="icon"
        variant="ghost"
        className="h-6 w-6"
        onClick={() => onZoomChange(Math.max(0.5, zoom - 0.25))}
        disabled={!canZoomOut || disabled}
        title="Zoom out"
      >
        <ui.icons.ZoomOut size={14} />
      </ui.Button>
      
      <span className="text-xs font-mono w-12 text-center">
        {Math.round(zoom * 100)}%
      </span>
      
      <ui.Button
        size="icon"
        variant="ghost"
        className="h-6 w-6"
        onClick={() => onZoomChange(Math.min(3.0, zoom + 0.25))}
        disabled={!canZoomIn || disabled}
        title="Zoom in"
      >
        <ui.icons.ZoomIn size={14} />
      </ui.Button>
      
      <div className="w-px h-4 bg-gray-300 mx-1" />
      
      <ui.Button
        size="icon"
        variant="ghost"
        className="h-6 w-6"
        onClick={onResetZoom}
        disabled={zoom === 1.0 || disabled}
        title="Reset zoom (100%)"
      >
        <ui.icons.RotateCcw size={14} />
      </ui.Button>
    </div>
  );
};

/* Tiny icon button component */
const Tool = ({ icon, label, onClick, disabled, className, style }) => {
  const IconComponent = ui.icons[icon];
  return (
    <ui.Button 
      size="icon" 
      variant="ghost" 
      title={label} 
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={style}
    >
      <IconComponent size={18} />
    </ui.Button>
  );
};

/* Work Order Badge Component */
const WorkOrderBadge = ({ badgeProps }) => {
  if (!badgeProps) return null;

  return (
    <ui.Badge 
      variant="outline" 
      className={badgeProps.className}
      title={badgeProps.title}
    >
      <span className={badgeProps.isAnimating ? 'animate-pulse' : ''}>{badgeProps.icon}</span>
      <span>{badgeProps.text}</span>
      {badgeProps.isAnimating && (
        <div className="w-2 h-2 bg-current rounded-full animate-ping"></div>
      )}
    </ui.Badge>
  );
};

/* Mobile Actions Component */
const MobileActions = ({ config, handleSave, core, saveAction }) => {
  if (!config) return null;

  if (config.showOverflow) {
    const { primaryButton, overflowButtons } = config;
    
    return (
      <div className="flex items-center gap-1">
        <ui.Button
          variant={primaryButton.variant}
          size="sm"
          disabled={primaryButton.disabled}
          onClick={() => handleSave(primaryButton.action)}
          className={`flex items-center gap-1 text-xs px-2 ${primaryButton.className || ''}`}
        >
          {(() => {
            const IconComponent = ui.icons[primaryButton.icon];
            return primaryButton.loading || (core.isSaving && primaryButton.action === saveAction) ? (
              <IconComponent size={14} className="animate-spin" />
            ) : (
              <IconComponent size={14} />
            );
          })()}
          <span className="hidden xs:inline">{primaryButton.text}</span>
        </ui.Button>
        
        {overflowButtons.length > 0 && (
          <ui.DropdownMenu>
            <ui.DropdownMenuTrigger asChild>
              <ui.Button size="sm" variant="outline" className="px-2">
                <ui.icons.MoreHorizontal size={14} />
              </ui.Button>
            </ui.DropdownMenuTrigger>
            <ui.DropdownMenuContent align="end" className="w-48">
              {overflowButtons.map((buttonConfig, index) => {
                const IconComponent = ui.icons[buttonConfig.icon];
                return (
                  <ui.DropdownMenuItem
                    key={index}
                    disabled={buttonConfig.disabled}
                    onClick={() => handleSave(buttonConfig.action)}
                    className={buttonConfig.className}
                  >
                    <IconComponent size={16} className="mr-2" />
                    {buttonConfig.text}
                  </ui.DropdownMenuItem>
                );
              })}
            </ui.DropdownMenuContent>
          </ui.DropdownMenu>
        )}
      </div>
    );
  }

  return (
    <>
      {config.buttons?.map((buttonConfig, index) => {
        const IconComponent = ui.icons[buttonConfig.icon];
        return (
          <ui.Button
            key={index}
            variant={buttonConfig.variant}
            size="sm"
            disabled={buttonConfig.disabled}
            onClick={() => handleSave(buttonConfig.action)}
            className={`flex items-center gap-1 ${config.compact ? 'text-xs px-2' : ''} ${buttonConfig.className || ''}`}
          >
            {buttonConfig.loading || (core.isSaving && buttonConfig.action === saveAction) ? (
              <IconComponent size={config.compact ? 14 : 16} className="animate-spin" />
            ) : (
              <IconComponent size={config.compact ? 14 : 16} />
            )}
            {!config.compact && <span>{buttonConfig.text}</span>}
            {config.compact && (
              <span className="hidden sm:inline text-xs">{buttonConfig.text}</span>
            )}
          </ui.Button>
        );
      }) || null}
    </>
  );
};

/* FIXED Page Navigation Component */
const PageNavigation = ({ config, onNavigate }) => {
  if (!config?.showNavigation) return null;

  return (
    <div className="flex items-center gap-1">
      <ui.Button 
        size="icon" 
        variant="ghost" 
        className="h-6 w-6"
        onClick={() => {
          console.log('📄 Previous page clicked');
          onNavigate('prev');
        }} 
        disabled={!config.canGoBack}
        title={`Go to page ${config.currentPage - 1}`}
      >
        <ui.icons.ChevronLeft size={12} />
      </ui.Button>
      <span className="text-xs w-8 sm:w-10 text-center">
        {config.currentPage}/{config.totalPages}
      </span>
      <ui.Button 
        size="icon" 
        variant="ghost" 
        className="h-6 w-6"
        onClick={() => {
          console.log('📄 Next page clicked');
          onNavigate('next');
        }} 
        disabled={!config.canGoForward}
        title={`Go to page ${config.currentPage + 1}`}
      >
        <ui.icons.ChevronRight size={12} />
      </ui.Button>
    </div>
  );
};

/* FIXED Workflow Indicators Component */
const WorkflowIndicators = ({ indicators }) => {
  // ✅ FIX: Always ensure indicators is an array
  const indicatorArray = Array.isArray(indicators) ? indicators : [];
  
  if (indicatorArray.length === 0) return null;

  return (
    <>
      {indicatorArray.map((indicator, index) => {
        if (indicator.type === 'work_order') {
          return <WorkOrderBadge key={index} badgeProps={indicator} />;
        }
        
        const IconComponent = indicator.icon ? ui.icons[indicator.icon] : null;
        
        return (
          <ui.Badge key={index} variant="outline" className={indicator.className}>
            {IconComponent && <IconComponent size={indicator.type === 'read_only' ? 8 : 12} />}
            <span>{indicator.text}</span>
          </ui.Badge>
        );
      })}
    </>
  );
};

/* Enhanced Canvas Component with Proper Transform Origin Handling */
const DrawingCanvas = ({ 
  canvasRef, 
  core, 
  zoom, 
  isDrawing, 
  containerRef 
}) => {
  const [touchState, setTouchState] = useState({
    drawing: false,
    touchId: null,
    lastPos: null
  });

  // Fixed coordinate calculation that accounts for transform origin
  const getProperPos = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const p = e.touches?.[0] || e;
    
    // Get the PDF container (this is what's being scaled)
    const container = containerRef.current;
    
    if (container) {
      // The container is scaled with transform-origin: 'top center'
      // We need to account for this in our coordinate calculation
      
      const containerRect = container.getBoundingClientRect();
      
      // Get the original (unscaled) container dimensions
      // We can calculate this by dividing the current rect by zoom
      const originalWidth = containerRect.width / zoom;
      const originalHeight = containerRect.height / zoom;
      
      // Calculate where the container would be positioned if not scaled
      // With transform-origin 'top center', the container grows outward from the top center
      const scaleDiff = zoom - 1;
      const widthIncrease = originalWidth * scaleDiff;
      const leftOffset = widthIncrease / 2; // Half the width increase goes to each side
      
      // Calculate the original (unscaled) position
      const originalLeft = containerRect.left + leftOffset;
      const originalTop = containerRect.top; // Top doesn't change with 'top center' origin
      
      // Get position relative to the original container position
      const containerX = p.clientX - originalLeft;
      const containerY = p.clientY - originalTop;
      
      // Since we're now working with the original container dimensions,
      // we don't need to divide by zoom
      const x = containerX;
      const y = containerY;
      
      console.log('🎯 Transform-origin aware positioning:', {
        zoom,
        pagePointer: { x: p.clientX, y: p.clientY },
        containerRect: { 
          left: containerRect.left, 
          top: containerRect.top, 
          width: containerRect.width, 
          height: containerRect.height 
        },
        calculated: {
          originalWidth,
          originalHeight,
          leftOffset,
          originalLeft,
          originalTop
        },
        containerRelative: { x: containerX, y: containerY },
        finalCoords: { x, y }
      });
      
      return { x, y };
    } else {
      // Fallback: try direct canvas calculation
      const rect = canvas.getBoundingClientRect();
      const canvasX = p.clientX - rect.left;
      const canvasY = p.clientY - rect.top;
      
      // Simple division by zoom
      const x = canvasX / zoom;
      const y = canvasY / zoom;
      
      console.log('🎯 Fallback canvas positioning:', {
        zoom,
        pagePointer: { x: p.clientX, y: p.clientY },
        canvasRect: rect,
        canvasRelative: { x: canvasX, y: canvasY },
        finalCoords: { x, y }
      });
      
      return { x, y };
    }
  }, [zoom, containerRef]);

  // Override core's getPos function during drawing operations
  const withProperPos = useCallback((coreFunction) => {
    return (e) => {
      // Store the original getPos
      const originalGetPos = core.getPos;
      
      // Temporarily replace with our proper positioning
      core.getPos = getProperPos;
      
      try {
        // Call the core function
        const result = coreFunction(e);
        return result;
      } finally {
        // Always restore the original getPos
        core.getPos = originalGetPos;
      }
    };
  }, [core, getProperPos]);

  const handlePointerDown = useCallback((e) => {
    if (!isDrawing || !core.canDraw()) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    if (e.pointerType === 'touch') {
      setTouchState({
        drawing: true,
        touchId: e.pointerId,
        lastPos: { x: e.clientX, y: e.clientY }
      });
    }
    
    const properPointerDown = withProperPos(core.pointerDown);
    properPointerDown(e);
  }, [isDrawing, core, withProperPos]);

  const handlePointerMove = useCallback((e) => {
    if (!isDrawing || !core.canDraw()) return;
    
    if (e.pointerType === 'touch' && e.pointerId !== touchState.touchId) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const properPointerMove = withProperPos(core.pointerMove);
    properPointerMove(e);
    
    if (e.pointerType === 'touch') {
      setTouchState(prev => ({
        ...prev,
        lastPos: { x: e.clientX, y: e.clientY }
      }));
    }
  }, [isDrawing, core, touchState.touchId, withProperPos]);

  const handlePointerUp = useCallback((e) => {
    if (e.pointerType === 'touch' && e.pointerId === touchState.touchId) {
      setTouchState({
        drawing: false,
        touchId: null,
        lastPos: null
      });
    }
    
    const properPointerUp = withProperPos(core.pointerUp);
    properPointerUp(e);
  }, [core, touchState.touchId, withProperPos]);

  const handlePointerCancel = useCallback((e) => {
    if (e.pointerType === 'touch' && e.pointerId === touchState.touchId) {
      setTouchState({
        drawing: false,
        touchId: null,
        lastPos: null
      });
    }
    
    const properPointerCancel = withProperPos(core.pointerCancel);
    properPointerCancel(e);
  }, [core, touchState.touchId, withProperPos]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 ${
        isDrawing && core.canDraw() ? 'cursor-crosshair' : 'pointer-events-none'
      }`}
      style={{ 
        touchAction: isDrawing && core.canDraw() ? 'none' : 'auto'
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    />
  );
};

/* Save Confirmation Dialog Component - Updated for rejected files (PRESERVED FROM ORIGINAL) */
const SaveConfirmationDialog = ({ 
  open, 
  onClose, 
  onConfirm, 
  currentDoc, 
  actionInfo,
  isValid,
  // Dialog state
  batchQuantity,
  batchUnit,
  solutionLotNumber,
  solutionQuantity,
  solutionUnit,
  confirmedComponents,
  availableLots,
  isLoadingLots,
  scaledComponents,
  // Dialog handlers
  setBatchQuantity,
  setBatchUnit,
  setSolutionLotNumber,
  setSolutionQuantity,
  setSolutionUnit,
  updateComponent,
  onOpenProperties
}) => {
  // ✅ FIX: Guard against missing actionInfo
  if (!actionInfo) return null;

  // Handle setup requirement
  if (actionInfo.requiresSetup) {
    return (
      <ui.Dialog open={open} onOpenChange={onClose}>
        <ui.DialogContent className="sm:max-w-md">
          <ui.DialogHeader>
            <div className="flex items-center gap-3">
              {(() => {
                const IconComponent = ui.icons[actionInfo.icon];
                return <IconComponent className="h-5 w-5 text-amber-500" />;
              })()}
              <ui.DialogTitle>{actionInfo.title}</ui.DialogTitle>
            </div>
            <ui.DialogDescription>
              {actionInfo.description}
            </ui.DialogDescription>
          </ui.DialogHeader>
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-medium text-amber-900 mb-2">Setup Required:</h4>
            <ul className="space-y-1">
              {(actionInfo.actions || []).map((actionItem, index) => (
                <li key={index} className="flex items-center gap-2 text-amber-800">
                  <ui.icons.Settings className="h-4 w-4" />
                  <span className="text-sm">{actionItem}</span>
                </li>
              ))}
            </ul>
          </div>

          <ui.DialogFooter>
            <ui.Button variant="outline" onClick={onClose}>Cancel</ui.Button>
            <ui.Button onClick={() => {
              onClose();
              if (onOpenProperties) {
                onOpenProperties();
              }
            }}>
              Open Properties
            </ui.Button>
          </ui.DialogFooter>
        </ui.DialogContent>
      </ui.Dialog>
    );
  }

  // ✅ NEW: Handle previously rejected files with simplified dialog
  if (actionInfo.wasRejected) {
    return (
      <ui.Dialog open={open} onOpenChange={onClose}>
        <ui.DialogContent className="sm:max-w-2xl">
          <ui.DialogHeader className="space-y-4">
            <div className="flex items-center gap-3">
              {(() => {
                const IconComponent = ui.icons[actionInfo.icon];
                return <IconComponent className="h-5 w-5 text-blue-500" />;
              })()}
              <ui.DialogTitle className="text-xl">{actionInfo.title}</ui.DialogTitle>
            </div>
            <ui.DialogDescription className="text-base">
              {actionInfo.description}
            </ui.DialogDescription>
            
            {/* What will happen */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">This action will:</h4>
              <ul className="space-y-1">
                {(actionInfo.actions || []).map((actionItem, index) => (
                  <li key={index} className="flex items-center gap-2 text-blue-800">
                    <ui.icons.CheckCircle className="h-4 w-4" />
                    <span className="text-sm">{actionItem}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Previously Rejected Notice */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-orange-800 mb-2">
                <ui.icons.AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Previously Rejected</span>
              </div>
              <p className="text-sm text-orange-700">
                This batch was previously rejected and returned to In Progress. Since chemicals have already been transacted and the solution created, resubmitting will simply move it back to Review status without any additional transactions.
              </p>
            </div>
          </ui.DialogHeader>

          <div className="space-y-6 py-4">
            {/* Current Status Overview */}
            <div className="bg-gray-50 rounded-lg p-4 border">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <ui.icons.FileText className="h-4 w-4" />
                Current Batch Status
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Work Order:</span>
                  <span className="font-medium">
                    {currentDoc?.workOrderCreated ? (
                      currentDoc?.assemblyBuildCreated && currentDoc?.assemblyBuildTranId ? (
                        <span className="text-green-600">Built ({currentDoc.assemblyBuildTranId})</span>
                      ) : (
                        <span className="text-blue-600">Created ({currentDoc?.workOrderId || currentDoc?.netsuiteWorkOrderData?.tranId || 'Unknown'})</span>
                      )
                    ) : (
                      <span className="text-gray-500">Not Created</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chemicals:</span>
                  <span className="font-medium">
                    {currentDoc?.chemicalsTransacted ? (
                      <span className="text-green-600">Transacted</span>
                    ) : (
                      <span className="text-gray-500">Not Transacted</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Solution:</span>
                  <span className="font-medium">
                    {currentDoc?.solutionCreated ? (
                      <span className="text-green-600">Created ({currentDoc?.solutionLotNumber})</span>
                    ) : (
                      <span className="text-gray-500">Not Created</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <ui.Badge variant="outline" className="h-5">
                    {currentDoc?.status || 'Draft'}
                  </ui.Badge>
                </div>
              </div>
              
              {/* Show rejection info without asking for reason */}
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <div className="flex items-center gap-2 text-yellow-800">
                  <ui.icons.AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Previously Rejected</span>
                </div>
                <p className="text-sm text-yellow-700 mt-1">
                  This batch was previously moved back to In Progress from Review status. All transactions and solution creation remain intact.
                </p>
              </div>
            </div>
          </div>

          <ui.DialogFooter className="gap-2">
            <ui.Button variant="outline" onClick={onClose}>
              Cancel
            </ui.Button>
            <ui.Button 
              onClick={onConfirm}
              disabled={!isValid}
              className="min-w-[140px]"
            >
              {actionInfo.title}
            </ui.Button>
          </ui.DialogFooter>
        </ui.DialogContent>
      </ui.Dialog>
    );
  }

  const getItemKey = (component) => {
    if (typeof component.itemId === 'object' && component.itemId !== null) {
      return component.itemId._id || component.itemId.toString();
    }
    return component.itemId;
  };

  // Regular dialog for non-rejected files (existing code)
  return (
    <ui.Dialog open={open} onOpenChange={onClose}>
      <ui.DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <ui.DialogHeader className="space-y-4">
          <div className="flex items-center gap-3">
            {(() => {
              const IconComponent = ui.icons[actionInfo.icon];
              return <IconComponent className="h-5 w-5 text-blue-500" />;
            })()}
            <ui.DialogTitle className="text-xl">{actionInfo.title}</ui.DialogTitle>
          </div>
          <ui.DialogDescription className="text-base">
            {actionInfo.description}
          </ui.DialogDescription>
          
          {/* What will happen */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">This action will:</h4>
            <ul className="space-y-1">
              {(actionInfo.actions || []).map((actionItem, index) => (
                <li key={index} className="flex items-center gap-2 text-blue-800">
                  <ui.icons.CheckCircle className="h-4 w-4" />
                  <span className="text-sm">{actionItem}</span>
                </li>
              ))}
            </ul>
          </div>
        </ui.DialogHeader>

        <div className="space-y-6 py-4">
          {/* Batch Size Configuration */}
          {actionInfo.requiresBatchSize && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <ui.icons.Calculator className="h-5 w-5 text-blue-500" />
                  Batch Size & Recipe Scaling
                </h3>
                <ui.Badge variant="outline">
                  NetSuite quantities are per mL
                </ui.Badge>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-amber-800 mb-2">
                  <ui.icons.AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Recipe Scaling Information</span>
                </div>
                <p className="text-sm text-amber-700">
                  The recipe quantities from NetSuite are per 1 mL of solution produced. 
                  Enter your desired batch size below to automatically scale all component quantities.
                </p>
              </div>
              
              <div className="space-y-2">
                <ui.Label htmlFor="batchQuantity">Batch Size to Produce *</ui.Label>
                <div className="flex gap-2">
                  <ui.Input
                    id="batchQuantity"
                    type="number"
                    step="1"
                    min="1"
                    value={batchQuantity}
                    onChange={(e) => setBatchQuantity(e.target.value)}
                    placeholder="1000"
                    className="font-mono"
                  />
                  <ui.Select value={batchUnit} onValueChange={setBatchUnit}>
                    <ui.SelectTrigger className="w-20">
                      <ui.SelectValue />
                    </ui.SelectTrigger>
                    <ui.SelectContent>
                      <ui.SelectItem value="mL">mL</ui.SelectItem>
                      <ui.SelectItem value="L">L</ui.SelectItem>
                    </ui.SelectContent>
                  </ui.Select>
                </div>
                <p className="text-sm text-muted-foreground">
                  How much solution do you want to make in this batch?
                </p>
              </div>

              {/* Scaled Components Preview */}
              {(scaledComponents || []).length > 0 && batchQuantity && Number(batchQuantity) > 0 && (
                <div className="space-y-2">
                  <ui.Label>Scaled Component Quantities ({scaledComponents.length} components)</ui.Label>
                  <div className="border rounded-lg p-1">
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {scaledComponents.map((component, index) => (
                        <div key={index} className="flex justify-between items-center text-sm p-2 bg-white rounded border">
                          <span className="font-medium flex-1 truncate pr-2">
                            {component.displayName || `Component ${index + 1}`}
                          </span>
                          <div className="flex items-center gap-2 text-right">
                            <span className="text-muted-foreground text-xs">
                              {(component.originalAmount || 0).toFixed(3)} {component.unit} →
                            </span>
                            <span className="font-bold text-primary bg-blue-50 px-2 py-1 rounded text-xs">
                              {(component.scaledAmount || 0).toFixed(2)} {component.unit}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-blue-600">
                    Quantities automatically scale with batch size (base recipe is per 1 mL)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Solution Details */}
          {actionInfo.requiresLot && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Solution Details</h3>
                {actionInfo.requiresBatchSize && (
                  <ui.Badge variant="outline">Auto-filled from batch size</ui.Badge>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <ui.Label htmlFor="solutionLotNumber">Solution Lot Number *</ui.Label>
                  <ui.Input
                    id="solutionLotNumber"
                    value={solutionLotNumber}
                    onChange={(e) => setSolutionLotNumber(e.target.value)}
                    placeholder="Enter solution lot number (e.g., JD240101)"
                    className="font-mono"
                  />
                  <p className="text-sm text-muted-foreground">
                    Usually operator initials + date (YYMMDD format)
                  </p>
                </div>
                
                <div className="space-y-2">
                  <ui.Label htmlFor="solutionQuantity">Solution Quantity Produced</ui.Label>
                  <div className="flex gap-2">
                    <ui.Input
                      id="solutionQuantity"
                      type="number"
                      step="0.01"
                      value={solutionQuantity}
                      onChange={(e) => setSolutionQuantity(e.target.value)}
                      placeholder={actionInfo.requiresBatchSize ? batchQuantity : "Auto"}
                      disabled={actionInfo.requiresBatchSize}
                    />
                    <ui.Input
                      className="w-20"
                      value={solutionUnit}
                      onChange={(e) => setSolutionUnit(e.target.value)}
                      placeholder="Unit"
                      disabled={actionInfo.requiresBatchSize}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {actionInfo.requiresBatchSize 
                      ? 'Automatically set to match batch size'
                      : 'Actual quantity produced (leave blank to use recipe quantity)'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {actionInfo.requiresChemicals && (
            <>
              <ui.Separator />
              
              {/* Components Confirmation */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ui.icons.AlertCircle className="h-5 w-5 text-amber-500" />
                  <h3 className="text-lg font-medium">Confirm Chemical Lots & Quantities</h3>
                </div>
                
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    <strong>Important:</strong> This will permanently transact these chemicals from inventory. 
                    {actionInfo.requiresBatchSize 
                      ? 'Quantities shown are scaled to your batch size.'
                      : 'Verify lots and quantities are correct.'
                    }
                  </p>
                </div>
                
                {isLoadingLots ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                      <span>Loading available lots...</span>
                    </div>
                  </div>
                ) : (confirmedComponents || []).length > 0 ? (
                  <div className="space-y-4">
                    {confirmedComponents.map((component, index) => {
                      const itemKey = getItemKey(component);
                      const componentLots = (availableLots && availableLots[itemKey]) || [];
                      
                      return (
                        <div key={index} className="border rounded-lg p-4 space-y-4 bg-white">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">
                              {component.displayName || component.itemId?.displayName || `Component ${index + 1}`}
                            </h4>
                            <ui.Badge variant="secondary" className="font-mono">
                              {component.sku || component.itemId?.sku || 'No SKU'}
                            </ui.Badge>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <ui.Label>
                                {actionInfo.requiresBatchSize ? 'Base Amount (per mL)' : 'Planned Amount'}
                              </ui.Label>
                              <div className="flex gap-2">
                                <ui.Input
                                  type="number"
                                  value={component.originalAmount || component.plannedAmount}
                                  readOnly
                                  className="bg-gray-50"
                                />
                                <span className="flex items-center px-3 text-sm text-muted-foreground bg-gray-50 border rounded">
                                  {component.unit || 'g'}
                                </span>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <ui.Label>
                                {actionInfo.requiresBatchSize ? `Scaled Amount (${batchQuantity} ${batchUnit})` : 'Actual Amount Used'} *
                              </ui.Label>
                              <div className="flex gap-2">
                                <ui.Input
                                  type="number"
                                  step="0.01"
                                  value={component.actualAmount}
                                  onChange={(e) => updateComponent(index, 'actualAmount', parseFloat(e.target.value) || 0)}
                                />
                                <span className="flex items-center px-3 text-sm text-muted-foreground bg-white border rounded">
                                  {component.unit || 'g'}
                                </span>
                              </div>
                              {actionInfo.requiresBatchSize && (
                                <p className="text-xs text-blue-600">
                                  Scaled from {component.originalAmount} × {batchQuantity}
                                </p>
                              )}
                            </div>
                            
                            <div className="space-y-2">
                              <ui.Label>Lot Number *</ui.Label>
                              <ui.Select
                                value={component.lotNumber}
                                onValueChange={(value) => updateComponent(index, 'lotNumber', value)}
                              >
                                <ui.SelectTrigger className="font-mono">
                                  <ui.SelectValue placeholder={componentLots.length > 0 ? "Select lot..." : "No lots available"} />
                                </ui.SelectTrigger>
                                <ui.SelectContent>
                                  {componentLots.length > 0 ? (
                                    componentLots.map((lot) => (
                                      <ui.SelectItem key={lot.id} value={lot.lotNumber} className="font-mono">
                                        <div className="flex items-center justify-between w-full">
                                          <span>{lot.lotNumber}</span>
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground ml-4">
                                            <span>{lot.availableQty} {lot.unit}</span>
                                            {lot.expiryDate && <span>Exp: {lot.expiryDate}</span>}
                                          </div>
                                        </div>
                                      </ui.SelectItem>
                                    ))
                                  ) : (
                                    <ui.SelectItem value="no-lots-available" disabled>No lots available</ui.SelectItem>
                                  )}
                                </ui.SelectContent>
                              </ui.Select>
                              {componentLots.length === 0 && (
                                <p className="text-xs text-red-500">No lots found for this item</p>
                              )}
                            </div>
                          </div>
                          
                          {/* Show selected lot details */}
                          {component.lotNumber && (
                            <div className="bg-gray-50 rounded p-3 text-sm">
                              {(() => {
                                const selectedLot = componentLots.find(lot => lot.lotNumber === component.lotNumber);
                                return selectedLot ? (
                                  <div className="flex items-center justify-between">
                                    <span>Selected: <strong>{selectedLot.lotNumber}</strong></span>
                                    <div className="flex items-center gap-4 text-muted-foreground">
                                      <span>Available: {selectedLot.availableQty} {selectedLot.unit}</span>
                                      {selectedLot.expiryDate && <span>Expires: {selectedLot.expiryDate}</span>}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-red-500">Selected lot not found in available lots</span>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center p-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    <ui.icons.Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No components defined for this recipe.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Current Status Overview */}
          <div className="bg-gray-50 rounded-lg p-4 border">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <ui.icons.FileText className="h-4 w-4" />
              Current Batch Status
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Work Order:</span>
                <span className="font-medium">
                  {currentDoc?.workOrderCreated ? (
                    <span className="text-green-600">Created ({currentDoc?.workOrderId})</span>
                  ) : (
                    <span className="text-gray-500">Not Created</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Chemicals:</span>
                <span className="font-medium">
                  {currentDoc?.chemicalsTransacted ? (
                    <span className="text-green-600">Transacted ({currentDoc?.transactionDate})</span>
                  ) : (
                    <span className="text-gray-500">Not Transacted</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Solution:</span>
                <span className="font-medium">
                  {currentDoc?.solutionCreated ? (
                    <span className="text-green-600">Created ({currentDoc?.solutionLotNumber})</span>
                  ) : (
                    <span className="text-gray-500">Not Created</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <ui.Badge variant="outline" className="h-5">
                  {currentDoc?.status || 'Draft'}
                </ui.Badge>
              </div>
            </div>
            
            {currentDoc?.wasRejected && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <div className="flex items-center gap-2 text-yellow-800">
                  <ui.icons.AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Previously Rejected</span>
                </div>
                {currentDoc.rejectionReason && (
                  <p className="text-sm text-yellow-700 mt-1">
                    Reason: {currentDoc.rejectionReason}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <ui.DialogFooter className="gap-2">
          <ui.Button variant="outline" onClick={onClose}>
            Cancel
          </ui.Button>
          <ui.Button 
            onClick={onConfirm}
            disabled={!isValid}
            className="min-w-[140px]"
          >
            {actionInfo.title}
          </ui.Button>
        </ui.DialogFooter>
      </ui.DialogContent>
    </ui.Dialog>
  );
};

/* Main PDFEditor Component with Enhanced Zoom and Fixed Toolbar */
export default function PDFEditor(props) {
  const core = useCoreMain(props);
  const state = useStateMain(core, props);
  
  // Zoom state
  const [zoom, setZoom] = useState(1.0);
  const [isDrawing, setIsDrawing] = useState(core.isDraw);
  const viewerRef = useRef(null);
  const contentRef = useRef(null);

  // Sync drawing state
  useEffect(() => {
    setIsDrawing(core.isDraw);
  }, [core.isDraw]);

  // Handle zoom changes
  const handleZoomChange = useCallback((newZoom) => {
    setZoom(Math.max(0.5, Math.min(3.0, newZoom)));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1.0);
    // Reset scroll position
    if (viewerRef.current) {
      viewerRef.current.scrollTo(0, 0);
    }
  }, []);

  // Handle drawing toggle with haptic feedback
  const handleToggleDrawing = useCallback(() => {
    if (!core.canDraw()) return;
    
    // Haptic feedback for supported devices
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    const newDrawingState = !isDrawing;
    setIsDrawing(newDrawingState);
    core.setIsDraw(newDrawingState);
  }, [core, isDrawing]);

  // Prevent pinch-to-zoom on the entire page when drawing
  useEffect(() => {
    const preventZoom = (e) => {
      if (isDrawing && e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchmove', preventZoom, { passive: false });
    document.addEventListener('gesturestart', preventZoom, { passive: false });
    document.addEventListener('gesturechange', preventZoom, { passive: false });

    return () => {
      document.removeEventListener('touchmove', preventZoom);
      document.removeEventListener('gesturestart', preventZoom);
      document.removeEventListener('gesturechange', preventZoom);
    };
  }, [isDrawing]);

  const componentKey = useMemo(() => {
    const baseId = props.doc?.originalFileId || props.doc?.fileId || props.doc?._id;
    return `pdf-editor-${baseId}`;
  }, [props.doc?.originalFileId, props.doc?.fileId, props.doc?._id]);

  // Early return if no PDF data
  if (!state.isValid) {
    return <div className="p-4">No PDF data available.</div>;
  }

  const { doc } = props;

  // ✅ FIX: Provide fallback values for all state properties
  const safeState = {
    // Provide defaults for any potentially undefined values
    headerConfig: state.headerConfig || {},
    pageNavConfig: state.pageNavConfig || { showNavigation: false },
    statusBadgeProps: state.statusBadgeProps || { className: '', text: 'Unknown' },
    workflowIndicators: Array.isArray(state.workflowIndicators) ? state.workflowIndicators : [],
    toolbarConfig: state.toolbarConfig || {},
    mobileActionsConfig: state.mobileActionsConfig || null,
    viewerConfig: state.viewerConfig || {},
    showSaveDialog: state.showSaveDialog || false,
    actionInfo: state.actionInfo || null,
    isDialogValid: state.isDialogValid || false,
    ...state // Spread all other state properties
  };

  return (
    <div key={componentKey} className="flex flex-col h-full">
      {/* Enhanced Fixed Header with Zoom Controls */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b shadow-sm">
        <div className="flex items-center justify-between px-2 sm:px-4 py-2">
          {/* Left Section */}
          <div className="flex items-center gap-1 sm:gap-3 min-w-0 flex-1">
            {/* Menu Button */}
            {safeState.headerConfig.showMenu && (
              <ui.Button 
                size="icon" 
                variant="ghost" 
                onClick={props.onToggleDrawer} 
                title="Menu" 
                className="shrink-0 toolbar-button"
              >
                <ui.icons.Menu size={18} />
              </ui.Button>
            )}

            {/* File Info & Navigation */}
            <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
              {/* File Name */}
              {safeState.headerConfig.showFileName && (
                <span className="font-semibold text-xs sm:text-sm truncate max-w-[20vw] sm:max-w-[30vw] hidden xl:block">
                  {safeState.headerConfig.fileName}
                </span>
              )}

              {/* Page Navigation */}
              <PageNavigation 
                config={safeState.pageNavConfig} 
                onNavigate={safeState.handlePageNavigation} 
              />

              {/* Status Badge */}
              <ui.Badge 
                variant="outline" 
                className={safeState.statusBadgeProps.className}
              >
                {safeState.statusBadgeProps.text}
              </ui.Badge>

              {/* Workflow Indicators */}
              <WorkflowIndicators indicators={safeState.workflowIndicators} />
            </div>
          </div>

          {/* Right Section - Tools & Actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Zoom Controls */}
            <ZoomControls
              zoom={zoom}
              onZoomChange={handleZoomChange}
              onResetZoom={handleResetZoom}
              disabled={!core.blobUri}
            />

            {/* Tools */}
            <div className="flex items-center gap-1">
              {/* Settings */}
              {safeState.toolbarConfig.showSettings && (
                <Tool 
                  icon="Settings" 
                  label="File properties" 
                  onClick={safeState.handleOpenProperties} 
                />
              )}

              {/* Drawing Toggle */}
              {safeState.toolbarConfig.showDrawingToggle ? (
                <Tool 
                  icon="Pencil" 
                  label={isDrawing ? 'Draw off' : 'Draw on'}
                  onClick={handleToggleDrawing}
                  style={isDrawing ? { color: 'var(--primary)' } : {}} 
                />
              ) : (
                <Tool 
                  icon="Lock" 
                  label="Drawing disabled for this file type/status"
                  disabled={true}
                  className="opacity-50" 
                />
              )}

              {/* Undo */}
              <Tool 
                icon="Undo" 
                label="Undo" 
                onClick={core.undo}
                disabled={!safeState.toolbarConfig.undoEnabled}
                className={!safeState.toolbarConfig.undoEnabled ? 'opacity-50' : ''} 
              />

              {/* Print - Only show on desktop, not mobile/tablet */}
              {!safeState.compact && (typeof window === 'undefined' || window.innerWidth >= 1024) && (
                <Tool icon="Printer" label="Print" onClick={core.print} />
              )}
            </div>

            {/* Dynamic Action Buttons */}
            <MobileActions 
              config={safeState.mobileActionsConfig}
              handleSave={safeState.handleSave}
              core={core}
              saveAction={safeState.saveAction}
            />

            {/* Work Order Creation Loading Indicator */}
            {core.isCreatingWorkOrder && (
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <ui.icons.Clock size={12} className="animate-spin" />
                <span className="hidden sm:inline">Creating WO...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PDF Viewer with Toolbar Offset and Zoom */}
      <div 
        ref={viewerRef}
        className="flex-1 overflow-auto bg-gray-100"
        style={{ 
          paddingTop: '60px', // Offset for fixed toolbar
          scrollBehavior: 'smooth'
        }}
      >
        <div className="flex justify-center p-4">
          <div 
            ref={contentRef}
            className="relative bg-white shadow-lg rounded-lg overflow-hidden"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              transition: 'transform 0.2s ease-out'
            }}
          >
            {/* PDF Container */}
            <div ref={core.pageContainerRef} className="relative">
              <Document
                file={core.blobUri}
                onLoadSuccess={({ numPages }) => core.setPages(numPages)}
                loading={<div className="p-10 text-center">Loading PDF…</div>}
                error={<div className="p-10 text-center text-red-500">Error loading PDF</div>}
              >
                <Page
                  pageNumber={core.pageNo}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                  onRenderSuccess={core.initCanvas}
                  loading={<div className="p-10 text-center">Rendering…</div>}
                />
              </Document>

              {/* Enhanced Drawing Canvas */}
              <DrawingCanvas
                canvasRef={core.canvasRef}
                core={core}
                zoom={zoom}
                isDrawing={isDrawing}
                containerRef={contentRef}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Drawing Mode Indicator */}
      {isDrawing && core.canDraw() && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40">
          <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2 shadow-lg">
            <ui.icons.Pen size={14} />
            Drawing Mode - Tap to draw
          </div>
        </div>
      )}

      {/* Zoom Level Indicator */}
      {zoom !== 1.0 && (
        <div className="fixed bottom-4 right-4 z-40">
          <div className="bg-black/70 text-white px-2 py-1 rounded text-xs">
            {Math.round(zoom * 100)}%
          </div>
        </div>
      )}

      {/* Save Confirmation Dialog */}
      <SaveConfirmationDialog
        open={safeState.showSaveDialog}
        onClose={safeState.handleSaveDialogClose}
        onConfirm={safeState.handleSaveConfirm}
        currentDoc={doc}
        actionInfo={safeState.actionInfo}
        isValid={safeState.isDialogValid}
        // Dialog state
        batchQuantity={safeState.batchQuantity}
        batchUnit={safeState.batchUnit}
        solutionLotNumber={safeState.solutionLotNumber}
        solutionQuantity={safeState.solutionQuantity}
        solutionUnit={safeState.solutionUnit}
        confirmedComponents={safeState.confirmedComponents}
        availableLots={safeState.availableLots}
        isLoadingLots={safeState.isLoadingLots}
        scaledComponents={safeState.scaledComponents}
        // Dialog handlers
        setBatchQuantity={safeState.setBatchQuantity}
        setBatchUnit={safeState.setBatchUnit}
        setSolutionLotNumber={safeState.setSolutionLotNumber}
        setSolutionQuantity={safeState.setSolutionQuantity}
        setSolutionUnit={safeState.setSolutionUnit}
        updateComponent={safeState.updateComponent}
        onOpenProperties={safeState.handleOpenProperties}
      />
    </div>
  );
}