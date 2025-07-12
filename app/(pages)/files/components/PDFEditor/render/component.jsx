// app/files/components/PDFEditor/render/component.jsx
'use client';

import React from 'react';
import { useMemo } from 'react';
import { Document, Page } from 'react-pdf';
import { ui } from '@/components/ui';
import { useCore } from '../hooks/core';
import { useComponentState } from '../hooks/state';

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
      {config.buttons.map((buttonConfig, index) => {
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
      })}
    </>
  );
};

/* FIXED Page Navigation Component */
const PageNavigation = ({ config, onNavigate }) => {
  if (!config.showNavigation) return null;

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

/* Workflow Indicators Component */
const WorkflowIndicators = ({ indicators }) => {
  return (
    <>
      {indicators.map((indicator, index) => {
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
    </>);
};

/* Save Confirmation Dialog Component */
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
              {actionInfo.actions.map((actionItem, index) => (
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

  const getItemKey = (component) => {
    if (typeof component.itemId === 'object' && component.itemId !== null) {
      return component.itemId._id || component.itemId.toString();
    }
    return component.itemId;
  };

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
              {actionInfo.actions.map((actionItem, index) => (
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
              {scaledComponents.length > 0 && batchQuantity && Number(batchQuantity) > 0 && (
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
                ) : confirmedComponents.length > 0 ? (
                  <div className="space-y-4">
                    {confirmedComponents.map((component, index) => {
                      const itemKey = getItemKey(component);
                      const componentLots = availableLots[itemKey] || [];
                      
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

/* Main PDFEditor Component */
export default function PDFEditor(props) {
  const core = useCore(props);
  const state = useComponentState(core, props);

  const componentKey = useMemo(() => {
    // Use original file ID as stable key - even when switching to batch
    const baseId = props.doc?.originalFileId || props.doc?.fileId || props.doc?._id;
    return `pdf-editor-${baseId}`;
  }, [props.doc?.originalFileId, props.doc?.fileId, props.doc?._id]);

  // Early return if no PDF data
  if (!state.isValid) {
    return <div className="p-4">No PDF data available.</div>;
  }

  const { doc } = props;

  return (
    <div key={componentKey} className="flex flex-col h-full">
      {/* Enhanced Header */}
      <div className={state.headerConfig.className}>
        <div className="flex items-center gap-1 sm:gap-3 min-w-0 flex-1">
          {/* Menu Button */}
          {state.headerConfig.showMenu && (
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
            {state.headerConfig.showFileName && (
              <span className="font-semibold text-xs sm:text-sm truncate max-w-[20vw] sm:max-w-[30vw] hidden xl:block">
                {state.headerConfig.fileName}
              </span>
            )}

            {/* Page Navigation */}
            <PageNavigation 
              config={state.pageNavConfig} 
              onNavigate={state.handlePageNavigation} 
            />

            {/* Status Badge */}
            <ui.Badge 
              variant="outline" 
              className={state.statusBadgeProps.className}
            >
              {state.statusBadgeProps.text}
            </ui.Badge>

            {/* Workflow Indicators */}
            <WorkflowIndicators indicators={state.workflowIndicators} />
          </div>
        </div>

        {/* Toolbar & Actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Tools */}
          <div className="flex items-center gap-1">
            {/* Settings */}
            {state.toolbarConfig.showSettings && (
              <Tool 
                icon="Settings" 
                label="File properties" 
                onClick={state.handleOpenProperties} 
              />
            )}

            {/* Drawing Toggle */}
            {state.toolbarConfig.showDrawingToggle ? (
              <Tool 
                icon="Pencil" 
                label={core.isDraw ? 'Draw off' : 'Draw on'}
                onClick={state.handleToggleDrawing}
                style={core.isDraw ? { color: 'var(--primary)' } : {}} 
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
              disabled={!state.toolbarConfig.undoEnabled}
              className={!state.toolbarConfig.undoEnabled ? 'opacity-50' : ''} 
            />

            {/* Print */}
            {state.toolbarConfig.showPrint && (
              <Tool icon="Printer" label="Print" onClick={core.print} />
            )}
          </div>

          {/* Dynamic Action Buttons */}
          <MobileActions 
            config={state.mobileActionsConfig}
            handleSave={state.handleSave}
            core={core}
            saveAction={state.saveAction}
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

      {/* PDF Viewer */}
      <div className={state.viewerConfig.className}>
        <div ref={core.pageContainerRef} className="relative bg-white shadow my-4">
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

          {/* Drawing Canvas */}
          <canvas
            ref={core.canvasRef}
            className={`absolute inset-0 ${
              core.isDraw && core.canDraw() ? 'cursor-crosshair' : 'pointer-events-none'
            }`}
            style={{ 
              touchAction: core.isDraw && core.canDraw() ? 'none' : 'auto'
            }}
            onPointerDown={core.pointerDown}
            onPointerMove={core.pointerMove}
            onPointerUp={core.pointerUp}
            onPointerLeave={core.pointerUp}
            onPointerCancel={core.pointerCancel}
          />
        </div>
      </div>

      {/* Save Confirmation Dialog */}
      <SaveConfirmationDialog
        open={state.showSaveDialog}
        onClose={state.handleSaveDialogClose}
        onConfirm={state.handleSaveConfirm}
        currentDoc={doc}
        actionInfo={state.actionInfo}
        isValid={state.isDialogValid}
        // Dialog state
        batchQuantity={state.batchQuantity}
        batchUnit={state.batchUnit}
        solutionLotNumber={state.solutionLotNumber}
        solutionQuantity={state.solutionQuantity}
        solutionUnit={state.solutionUnit}
        confirmedComponents={state.confirmedComponents}
        availableLots={state.availableLots}
        isLoadingLots={state.isLoadingLots}
        scaledComponents={state.scaledComponents}
        // Dialog handlers
        setBatchQuantity={state.setBatchQuantity}
        setBatchUnit={state.setBatchUnit}
        setSolutionLotNumber={state.setSolutionLotNumber}
        setSolutionQuantity={state.setSolutionQuantity}
        setSolutionUnit={state.setSolutionUnit}
        updateComponent={state.updateComponent}
        onOpenProperties={state.handleOpenProperties}
      />
    </div>
  );
}