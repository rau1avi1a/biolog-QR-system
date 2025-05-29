// app/files/components/SaveConfirmationDialog.jsx - NetSuite Workflow Version
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
  AlertTriangle
} from 'lucide-react';
import { api } from '../lib/api';

function SaveConfirmationDialog({ 
  open, 
  onClose, 
  onConfirm, 
  currentDoc, 
  action = 'save'
}) {
  const [solutionLotNumber, setSolutionLotNumber] = useState('');
  const [solutionQuantity, setSolutionQuantity] = useState('');
  const [solutionUnit, setSolutionUnit] = useState('');
  const [confirmedComponents, setConfirmedComponents] = useState([]);
  const [availableLots, setAvailableLots] = useState({}); // { itemId: [lots] }
  const [isLoadingLots, setIsLoadingLots] = useState(false);

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
        title: 'Create NetSuite Work Order',
        description: 'This will create a work order in NetSuite with the recipe as BOM. File status will change to In Progress.',
        icon: <Package className="h-5 w-5 text-blue-500" />,
        requiresChemicals: false,
        requiresLot: false,
        actions: ['Create Work Order in NetSuite', 'Set Status to In Progress']
      };
    }
    
    if (action === 'submit_review') {
      if (!hasTransaction || wasRejected) {
        return {
          title: 'Transact Chemicals & Create Solution',
          description: wasRejected 
            ? 'This will create the solution lot. Chemicals were already transacted when first submitted.'
            : 'This will transact chemicals from inventory and create the solution lot in NetSuite.',
          icon: <Beaker className="h-5 w-5 text-green-500" />,
          requiresChemicals: !wasRejected, // Only need chemical confirmation if not previously rejected
          requiresLot: true,
          actions: wasRejected 
            ? ['Create Solution Lot', 'Move to Review Status']
            : ['Transact Chemicals from Inventory', 'Create Solution Lot', 'Move to Review Status']
        };
      } else {
        return {
          title: 'Move to Review',
          description: 'Chemicals already transacted and solution created. Just moving to Review status.',
          icon: <FileText className="h-5 w-5 text-blue-500" />,
          requiresChemicals: false,
          requiresLot: false,
          actions: ['Move to Review Status']
        };
      }
    }
    
    if (action === 'complete') {
      return {
        title: 'Complete Work Order & Archive',
        description: 'This will complete the NetSuite work order and archive this batch.',
        icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
        requiresChemicals: false,
        requiresLot: false,
        actions: ['Complete NetSuite Work Order', 'Archive Batch']
      };
    }
    
    if (action === 'reject') {
      return {
        title: 'Reject to In Progress',
        description: 'This will move the batch back to In Progress. Solution and transactions remain unchanged.',
        icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
        requiresChemicals: false,
        requiresLot: false,
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
      actions: ['Save Changes']
    };
  };

  const actionInfo = getActionInfo();

  // Initialize components and solution details from the current document
  useEffect(() => {
    if (currentDoc?.snapshot?.components) {
      setConfirmedComponents(
        currentDoc.snapshot.components.map(comp => ({
          ...comp,
          plannedAmount: comp.amount || 0,
          actualAmount: comp.amount || 0,
          lotNumber: '',
          lotId: null,
          // Ensure we have component info for display
          displayName: comp.itemId?.displayName || comp.displayName || 'Unknown Component',
          sku: comp.itemId?.sku || comp.sku || 'No SKU'
        }))
      );
    } else if (currentDoc?.components) {
      setConfirmedComponents(
        currentDoc.components.map(comp => ({
          ...comp,
          plannedAmount: comp.amount || 0,
          actualAmount: comp.amount || 0,
          lotNumber: '',
          lotId: null,
          // Ensure we have component info for display
          displayName: comp.itemId?.displayName || comp.displayName || 'Unknown Component',
          sku: comp.itemId?.sku || comp.sku || 'No SKU'
        }))
      );
    }
    
    // Initialize solution details from document
    setSolutionQuantity(currentDoc?.snapshot?.recipeQty || currentDoc?.recipeQty || '');
    setSolutionUnit(currentDoc?.snapshot?.recipeUnit || currentDoc?.recipeUnit || 'L');
  }, [currentDoc]);

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
        // Extract ID more reliably
        let itemId;
        if (typeof comp.itemId === 'object' && comp.itemId !== null) {
          itemId = comp.itemId._id || comp.itemId.toString();
        } else {
          itemId = comp.itemId;
        }
        
        if (!itemId) {
          return;
        }
        
        try {
          const { lots } = await api.getAvailableLots(itemId);
          
          // Store lots using both possible key formats to ensure access works
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

  // Helper function to get item key consistently
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
            // Find the selected lot to get its ID using the item key
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
      solutionLotNumber: solutionLotNumber.trim(),
      solutionQuantity: solutionQuantity ? Number(solutionQuantity) : null,
      solutionUnit: solutionUnit.trim() || 'L',
      components: confirmedComponents,
      action
    };
    
    onConfirm(confirmationData);
    onClose();
  };

  const isValid = () => {
    if (actionInfo.requiresSetup) return false; // Can't proceed without setup
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
              // TODO: Open file properties dialog
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
          {/* Solution Details with Quantity Input */}
          {actionInfo.requiresLot && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Solution Details</h3>
                <Badge variant="outline">
                  Recipe: {currentDoc?.snapshot?.recipeQty || currentDoc?.recipeQty || 0} {currentDoc?.snapshot?.recipeUnit || currentDoc?.recipeUnit || 'L'}
                </Badge>
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
                  <Label htmlFor="solutionQuantity">Actual Solution Quantity</Label>
                  <div className="flex gap-2">
                    <Input
                      id="solutionQuantity"
                      type="number"
                      step="0.01"
                      value={solutionQuantity}
                      onChange={(e) => setSolutionQuantity(e.target.value)}
                      placeholder={`${currentDoc?.snapshot?.recipeQty || currentDoc?.recipeQty || 'Auto'}`}
                    />
                    <Input
                      className="w-20"
                      value={solutionUnit}
                      onChange={(e) => setSolutionUnit(e.target.value)}
                      placeholder="Unit"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Actual quantity produced (leave blank to use recipe quantity)
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
                    <strong>Important:</strong> This will permanently transact these chemicals from NetSuite inventory. 
                    Verify lots and quantities are correct.
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
                      // Extract itemId consistently
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
                              <Label>Planned Amount</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  value={component.plannedAmount}
                                  readOnly
                                  className="bg-gray-50"
                                />
                                <span className="flex items-center px-3 text-sm text-muted-foreground bg-gray-50 border rounded">
                                  {component.unit || 'g'}
                                </span>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <Label>Actual Amount Used *</Label>
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
                                            <span>Exp: {lot.expiryDate}</span>
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
                                      <span>Expires: {selectedLot.expiryDate}</span>
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