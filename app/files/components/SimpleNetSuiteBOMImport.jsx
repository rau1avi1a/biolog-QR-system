// app/files/components/SimpleNetSuiteBOMImport.jsx - Direct BOM import for selected solution
'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Download,
  Zap,
  AlertCircle,
  CheckCircle2,
  Beaker
} from 'lucide-react';

// Unit mapping utility - Fixed unit mapping
const mapNetSuiteUnit = (netsuiteUnitId) => {
  const unitMapping = {
    '33': 'g',    // grams
    '34': 'kg',   // kilograms  
    '35': 'mL',   // milliliters (FIXED: was 'L')
    '36': 'L',    // liters (FIXED: swapped with 35)
    '37': 'ea',   // each
  };
  return unitMapping[netsuiteUnitId] || 'g';
};

// Simple NetSuite BOM Import Component
export default function SimpleNetSuiteBOMImport({ open, onClose, onImport, solution }) {
  const [loading, setLoading] = useState(false);
  const [bomData, setBomData] = useState(null);
  const [error, setError] = useState(null);

  // Fetch BOM when dialog opens
  React.useEffect(() => {
    if (open && solution?.netsuiteInternalId) {
      fetchBOM();
    }
  }, [open, solution]);

  const fetchBOM = async () => {
    if (!solution?.netsuiteInternalId) {
      setError('Solution does not have a NetSuite Internal ID');
      return;
    }

    setLoading(true);
    setError(null);
    setBomData(null);
    
    try {
      const response = await fetch(`/api/netsuite/bom?action=getBOM&assemblyItemId=${solution.netsuiteInternalId}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch BOM from NetSuite');
      }
      
      setBomData(data);
      
    } catch (error) {
      console.error('Error loading BOM:', error);
      setError('Error loading BOM: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    if (!bomData?.recipe || !solution) return;

    // Convert NetSuite recipe to match your File model's components schema
    const importedComponents = bomData.recipe.map(component => ({
      item: null, // Will need to be manually mapped in the form
      qty: component.quantity.toString(),
      unit: mapNetSuiteUnit(component.units),
      // Store NetSuite data for reference but don't include in the main component structure
      netsuiteData: {
        itemId: component.itemId,
        itemRefName: component.itemRefName,
        ingredient: component.ingredient,
        bomQuantity: component.bomQuantity,
        componentYield: component.componentYield,
        units: component.units,
        lineId: component.lineId,
        bomComponentId: component.bomComponentId,
        itemSource: component.itemSource
      }
    }));

    // Import data that matches your File model structure
    const importData = {
      solution: solution,
      solutionRef: solution._id, // This will be saved to file.solutionRef
      components: importedComponents, // This will be saved to file.components[]
      bom: bomData.bom,
      // Set recipe quantity to 1 since BOM quantities are per unit produced
      recipeQty: 1,
      recipeUnit: 'ea', // Unit for the solution being produced
      // Additional metadata
      netsuiteImportData: {
        bomId: bomData.bom?.bomId,
        bomName: bomData.bom?.bomName,
        revisionId: bomData.bom?.revisionId,
        revisionName: bomData.bom?.revisionName,
        importedAt: new Date().toISOString(),
        solutionNetsuiteId: solution.netsuiteInternalId
      }
    };

    onImport(importData);
    onClose();
  };

  const handleClose = () => {
    setBomData(null);
    setError(null);
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            Import BOM from NetSuite
          </DialogTitle>
          <DialogDescription>
            Importing BOM components for "{solution?.displayName}" from NetSuite.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Solution Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Beaker className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-800">Selected Solution</span>
            </div>
            <div className="text-sm text-blue-700">
              <div><strong>Name:</strong> {solution?.displayName}</div>
              <div><strong>SKU:</strong> {solution?.sku}</div>
              <div><strong>NetSuite ID:</strong> {solution?.netsuiteInternalId}</div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Error</span>
              </div>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={fetchBOM}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading BOM from NetSuite...</span>
              </div>
            </div>
          )}

          {/* BOM Data Display */}
          {bomData && !loading && (
            <div className="space-y-4">
              {/* BOM Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-2">BOM Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="font-medium">BOM Name:</span> {bomData.bom?.bomName}</div>
                  <div><span className="font-medium">Revision:</span> {bomData.bom?.revisionName}</div>
                  <div><span className="font-medium">Effective Date:</span> {bomData.bom?.effectiveStartDate}</div>
                  <div><span className="font-medium">Components:</span> {bomData.recipe?.length || 0}</div>
                </div>
              </div>

              {/* Components Preview */}
              {bomData.recipe && bomData.recipe.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Components to Import:</h4>
                  <ScrollArea className="max-h-64 border rounded-lg">
                    <div className="p-2 space-y-2">
                      {bomData.recipe.map((component, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-white border rounded">
                          <div className="flex-1">
                            <div className="font-medium">{component.ingredient}</div>
                            <div className="text-xs text-muted-foreground">
                              NetSuite ID: {component.itemId} • {component.itemRefName}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{component.quantity} {mapNetSuiteUnit(component.units)}</div>
                            <div className="text-xs text-muted-foreground">
                              BOM Qty: {component.bomQuantity} • Yield: {component.componentYield}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Ready to Import */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">Ready to Import</span>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  {bomData.recipe?.length || 0} components will be imported to the recipe. 
                  You can map them to local chemicals after import.
                </p>
                <p className="text-xs text-green-600 mt-2">
                  Note: BOM quantities are per unit of solution produced.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          
          {bomData && bomData.recipe && (
            <Button onClick={handleImport} className="gap-2">
              <Download className="h-4 w-4" />
              Import {bomData.recipe.length} Components
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}