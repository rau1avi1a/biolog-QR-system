// app/files/components/SaveConfirmationDialog.jsx - Enhanced with batch quantity input
'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Package,
  Beaker,
  FileText,
  Settings,
  AlertTriangle,
  Calculator
} from 'lucide-react';
import { api } from '../lib/api';

function SaveConfirmationDialog({ 
  open, 
  onClose, 
  onConfirm, 
  currentDoc, 
  action = 'save'
}) {
  const [batchQuantity, setBatchQuantity] = useState('1000'); // Default batch size
  const [batchUnit, setBatchUnit] = useState('mL');
  const [solutionLotNumber, setSolutionLotNumber] = useState('');
  const [solutionQuantity, setSolutionQuantity] = useState('');
  const [solutionUnit, setSolutionUnit] = useState('');
  const [confirmedComponents, setConfirmedComponents] = useState([]);
  const [availableLots, setAvailableLots] = useState({}); // { itemId: [lots] }
  const [isLoadingLots, setIsLoadingLots] = useState(false);
  const [scaledComponents, setScaledComponents] = useState([]);

  // Determine what this action will do
  const getActionInfo = () => {
    const isOriginal = !currentDoc?.isBatch;
    const status = currentDoc?.status || 'Draft';
    const hasWorkOrder = currentDoc?.workOrderCreated;
    const hasTransaction = currentDoc?.chemicalsTransacted;
    const hasSolution = currentDoc?.solutionCreated;
    const wasRejected = currentDoc?.wasRejected;
    
    if (action === 'create_work_order') {
      // Check if file has recipe defined
      const hasRecipe = currentDoc?.snapshot?.components?.length > 0 || 
                       currentDoc?.components?.length > 0;
      
      if (!hasRecipe) {
        return {
          title: 'Setup Required',
          description: 'This file needs recipe properties defined before creating a work order.',
          icon: <Settings className="h-5 w-5 text-amber-500" />,
          requiresSetup: true,
          actions: ['Open File Properties', 'Define Recipe Components', 'Set Solution Details']
        };
      }
      
      return {
        title: 'Create Work Order & Scale Recipe',
        description: 'This will create a work order and scale the recipe to your batch size. Components are shown per 1 mL from NetSuite.',
        icon: <Package className="h-5 w-5 text-blue-500" />,
        requiresChemicals: false,
        requiresLot: false,
        requiresBatchSize: true,
        actions: ['Scale Recipe to Batch Size', 'Create Work Order', 'Set Status to In Progress']
      };
    }
    
    if (action === 'submit_review') {
      if (!hasTransaction || wasRejected) {
        return {
          title: 'Transact Chemicals & Create Solution',
          description: wasRejected 
            ? 'This will create the solution lot using the scaled quantities.'
            : 'This will transact the scaled chemical quantities and create the solution lot.',
          icon: <Beaker className="h-5 w-5 text-green-500" />,
          requiresChemicals: !wasRejected,
          requiresLot: true,
          requiresBatchSize: false, // Batch size already set from work order
          actions: wasRejected 
            ? ['Create Solution Lot', 'Move to Review Status']
            : ['Transact Scaled Chemical Quantities', 'Create Solution Lot', 'Move to Review Status']
        };
      } else {
        return {
          title: 'Move to Review',
          description: 'Chemicals already transacted and solution created. Just moving to Review status.',
          icon: <FileText className="h-5 w-5 text-blue-500" />,
          requiresChemicals: false,
          requiresLot: false,
          requiresBatchSize: false,
          actions: ['Move to Review Status']
        };
      }
    }
    
    if (action === 'complete') {
      return {
        title: 'Complete Work Order & Archive',
        description: 'This will complete the work order and archive this batch.',
        icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
        requiresChemicals: false,
        requiresLot: false,
        requiresBatchSize: false,
        actions: ['Complete Work Order', 'Archive Batch']
      };
    }
    
    if (action === 'reject') {
      return {
        title: 'Reject to In Progress',
        description: 'This will move the batch back to In Progress. Solution and transactions remain unchanged.',
        icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
        requiresChemicals: false,
        requiresLot: false,
        requiresBatchSize: false,
        requiresReason: true,
        actions: ['Move to In Progress Status', 'Keep Solution & Transactions']
      };
    }
    
    // Regular save
    return {
      title: 'Save Progress',
      description: 'Save your current work. You can continue editing later.',
      icon: <Clock className="h-5 w-5 text-amber-500" />,
      requiresChemicals: false,
      requiresLot: false,
      requiresBatchSize: false,
      actions: ['Save Changes']
    };
  };

  const actionInfo = getActionInfo();

  // Scale components based on batch quantity - FIXED to handle multiple data sources
  useEffect(() => {
    console.log('Scaling effect triggered:', {
      requiresBatchSize: actionInfo.requiresBatchSize,
      batchQuantity,
      currentDoc: currentDoc ? 'exists' : 'null',
      snapshotComponents: currentDoc?.snapshot?.components?.length || 0,
      directComponents: currentDoc?.components?.length || 0
    });

    if (actionInfo.requiresBatchSize) {
      const quantity = parseFloat(batchQuantity) || 1000;
      
      // Try multiple sources for components
      let components = currentDoc?.snapshot?.components || 
                      currentDoc?.components || 
                      [];
      
      console.log('Found components:', components);
      
      if (components.length > 0) {
        const scaled = components.map(comp => {
          const scaledAmount = (comp.amount || 0) * quantity;
          console.log(`Component ${comp.itemId?.displayName || comp.displayName}: ${comp.amount} × ${quantity} = ${scaledAmount}`);
          
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
        
        console.log('Scaled components:', scaled);
        setScaledComponents(scaled);
        setConfirmedComponents(scaled);
      } else {
        console.log('No components found in any source');
        setScaledComponents([]);
        setConfirmedComponents([]);
      }
    } else {
      // For other actions, use existing confirmed components or snapshot
      const components = currentDoc?.snapshot?.components || currentDoc?.components || [];
      
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
  }, [batchQuantity, currentDoc?.snapshot?.components, currentDoc?.components, actionInfo.requiresBatchSize]);

  // Auto-set solution quantity when batch quantity changes
  useEffect(() => {
    if (actionInfo.requiresBatchSize && batchQuantity) {
      setSolutionQuantity(batchQuantity);
      setSolutionUnit(batchUnit);
    }
  }, [batchQuantity, batchUnit, actionInfo.requiresBatchSize]);

  // Initialize solution details from document
  useEffect(() => {
    if (!actionInfo.requiresBatchSize) {
      setSolutionQuantity(currentDoc?.snapshot?.recipeQty || currentDoc?.recipeQty || '');
      setSolutionUnit(currentDoc?.snapshot?.recipeUnit || currentDoc?.recipeUnit || 'L');
    }
  }, [currentDoc, actionInfo.requiresBatchSize]);

  // Load available lots for each component when dialog opens
  useEffect(() => {
    if (open && actionInfo.requiresChemicals && confirmedComponents.length > 0) {
      loadAvailableLots();
    }
  }, [open, actionInfo.requiresChemicals, confirmedComponents.length]);

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
          const { lots } = await api.getAvailableLots(itemId);
          lotsMap[itemId] = lots;
          if (typeof comp.itemId === 'object' && comp.itemId !== null) {
            lotsMap[comp.itemId._id] = lots;
            lotsMap[comp.itemId.toString()] = lots;
          }
        } catch (e) {
          lotsMap[itemId] = [];
        }
      })
    );
    
    setAvailableLots(lotsMap);
    setIsLoadingLots(false);
  };

  const getItemKey = (component) => {
    if (typeof component.itemId === 'object' && component.itemId !== null) {
      return component.itemId._id || component.itemId.toString();
    }
    return component.itemId;
  };

  const updateComponent = (index, field, value) => {
    setConfirmedComponents(prev => 
      prev.map((comp, i) => {
        if (i === index) {
          if (field === 'lotNumber') {
            const itemKey = getItemKey(comp);
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
  };

  const handleConfirm = () => {
    const confirmationData = {
      batchQuantity: actionInfo.requiresBatchSize ? Number(batchQuantity) : null,
      batchUnit: actionInfo.requiresBatchSize ? batchUnit : null,
      solutionLotNumber: solutionLotNumber.trim(),
      solutionQuantity: solutionQuantity ? Number(solutionQuantity) : null,
      solutionUnit: solutionUnit.trim() || 'L',
      components: confirmedComponents,
      scaledComponents: actionInfo.requiresBatchSize ? scaledComponents : null,
      action
    };
    
    onConfirm(confirmationData);
    onClose();
  };

  const isValid = () => {
    if (actionInfo.requiresSetup) return false;
    if (actionInfo.requiresBatchSize && (!batchQuantity || Number(batchQuantity) <= 0)) return false;
    if (actionInfo.requiresLot && !solutionLotNumber.trim()) return false;
    if (actionInfo.requiresChemicals && confirmedComponents.some(c => !c.lotNumber)) return false;
    return true;
  };

  // Handle setup requirement
  if (actionInfo.requiresSetup) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {actionInfo.icon}
              <DialogTitle>{actionInfo.title}</DialogTitle>
            </div>
            <DialogDescription>
              {actionInfo.description}
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-medium text-amber-900 mb-2">Setup Required:</h4>
            <ul className="space-y-1">
              {actionInfo.actions.map((actionItem, index) => (
                <li key={index} className="flex items-center gap-2 text-amber-800">
                  <Settings className="h-4 w-4" />
                  <span className="text-sm">{actionItem}</span>
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => {
              onClose();
            }}>
              Open Properties
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-4">
          <div className="flex items-center gap-3">
            {actionInfo.icon}
            <DialogTitle className="text-xl">{actionInfo.title}</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            {actionInfo.description}
          </DialogDescription>
          
          {/* What will happen */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">This action will:</h4>
            <ul className="space-y-1">
              {actionInfo.actions.map((actionItem, index) => (
                <li key={index} className="flex items-center gap-2 text-blue-800">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm">{actionItem}</span>
                </li>
              ))}
            </ul>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Batch Size Configuration */}
          {actionInfo.requiresBatchSize && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-blue-500" />
                  Batch Size & Recipe Scaling
                </h3>
                <Badge variant="outline">
                  NetSuite quantities are per mL
                </Badge>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-amber-800 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Recipe Scaling Information</span>
                </div>
                <p className="text-sm text-amber-700">
                  The recipe quantities from NetSuite are per 1 mL of solution produced. 
                  Enter your desired batch size below to automatically scale all component quantities.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="batchQuantity">Batch Size to Produce *</Label>
                <div className="flex gap-2">
                  <Input
                    id="batchQuantity"
                    type="number"
                    step="1"
                    min="1"
                    value={batchQuantity}
                    onChange={(e) => setBatchQuantity(e.target.value)}
                    placeholder="1000"
                    className="font-mono"
                  />
                  <Select value={batchUnit} onValueChange={setBatchUnit}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mL">mL</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm text-muted-foreground">
                  How much solution do you want to make in this batch?
                </p>
              </div>

              {/* Dynamic Scaled Components Preview - IMPROVED */}
              {scaledComponents.length > 0 && batchQuantity && Number(batchQuantity) > 0 && (
                <div className="space-y-2">
                  <Label>Scaled Component Quantities ({scaledComponents.length} components)</Label>
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
              
              {/* Debug info to see what's happening */}
              {actionInfo.requiresBatchSize && (
                <div className="text-xs text-gray-500 border p-2 rounded">
                  Debug: scaledComponents.length = {scaledComponents.length}, batchQuantity = {batchQuantity}
                  <br />Total snapshot components: {currentDoc?.snapshot?.components?.length || 0}
                  <br />Total direct components: {currentDoc?.components?.length || 0}
                  <br />Current doc keys: {currentDoc ? Object.keys(currentDoc).join(', ') : 'none'}
                  {currentDoc?.snapshot && (
                    <div>Snapshot keys: {Object.keys(currentDoc.snapshot).join(', ')}</div>
                  )}
                  {scaledComponents.length > 0 && (
                    <div className="mt-1">
                      <div>First component: scaledAmount = {scaledComponents[0]?.scaledAmount}, originalAmount = {scaledComponents[0]?.originalAmount}</div>
                      {scaledComponents.length > 1 && (
                        <div>Second component: {scaledComponents[1]?.displayName} = {scaledComponents[1]?.scaledAmount}</div>
                      )}
                    </div>
                  )}
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
                  <Badge variant="outline">
                    Auto-filled from batch size
                  </Badge>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="solutionLotNumber">Solution Lot Number *</Label>
                  <Input
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
                  <Label htmlFor="solutionQuantity">Solution Quantity Produced</Label>
                  <div className="flex gap-2">
                    <Input
                      id="solutionQuantity"
                      type="number"
                      step="0.01"
                      value={solutionQuantity}
                      onChange={(e) => setSolutionQuantity(e.target.value)}
                      placeholder={actionInfo.requiresBatchSize ? batchQuantity : "Auto"}
                      disabled={actionInfo.requiresBatchSize}
                    />
                    <Input
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
              <Separator />
              
              {/* Components Confirmation with Lot Dropdowns */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
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
                            <Badge variant="secondary" className="font-mono">
                              {component.sku || component.itemId?.sku || 'No SKU'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>
                                {actionInfo.requiresBatchSize ? 'Base Amount (per mL)' : 'Planned Amount'}
                              </Label>
                              <div className="flex gap-2">
                                <Input
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
                              <Label>
                                {actionInfo.requiresBatchSize ? `Scaled Amount (${batchQuantity} ${batchUnit})` : 'Actual Amount Used'} *
                              </Label>
                              <div className="flex gap-2">
                                <Input
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
                              <Label>Lot Number *</Label>
                              <Select
                                value={component.lotNumber}
                                onValueChange={(value) => updateComponent(index, 'lotNumber', value)}
                              >
                                <SelectTrigger className="font-mono">
                                  <SelectValue placeholder={componentLots.length > 0 ? "Select lot..." : "No lots available"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {componentLots.length > 0 ? (
                                    componentLots.map((lot) => (
                                      <SelectItem key={lot.id} value={lot.lotNumber} className="font-mono">
                                        <div className="flex items-center justify-between w-full">
                                          <span>{lot.lotNumber}</span>
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground ml-4">
                                            <span>{lot.availableQty} {lot.unit}</span>
                                            {lot.expiryDate && <span>Exp: {lot.expiryDate}</span>}
                                          </div>
                                        </div>
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <SelectItem value="no-lots-available" disabled>No lots available</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
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
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No components defined for this recipe.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Current Status Overview */}
          <div className="bg-gray-50 rounded-lg p-4 border">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
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
                <Badge variant="outline" className="h-5">
                  {currentDoc?.status || 'Draft'}
                </Badge>
              </div>
            </div>
            
            {currentDoc?.wasRejected && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertTriangle className="h-4 w-4" />
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

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!isValid()}
            className="min-w-[140px]"
          >
            {actionInfo.title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SaveConfirmationDialog;