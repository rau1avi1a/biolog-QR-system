// app/files/components/SimpleNetSuiteBOMImport.jsx - Enhanced with auto-mapping
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
  Beaker,
  MapPin,
  AlertTriangle
} from 'lucide-react';

// Unit mapping utility - Fixed unit mapping
const mapNetSuiteUnit = (netsuiteUnitId) => {
  const unitMapping = {
    '33': 'g',    // grams
    '34': 'kg',   // kilograms  
    '35': 'mL',   // milliliters
    '36': 'L',    // liters
    '37': 'ea',   // each
  };
  return unitMapping[netsuiteUnitId] || 'g';
};

// Enhanced NetSuite BOM Import Component with Auto-Mapping
export default function SimpleNetSuiteBOMImport({ open, onClose, onImport, solution }) {
  const [loading, setLoading] = useState(false);
  const [bomData, setBomData] = useState(null);
  const [mappingResults, setMappingResults] = useState(null);
  const [error, setError] = useState(null);

  // Fetch BOM and auto-map components when dialog opens
  React.useEffect(() => {
    if (open && solution?.netsuiteInternalId) {
      fetchBOMAndMap();
    }
  }, [open, solution]);

  const fetchBOMAndMap = async () => {
    if (!solution?.netsuiteInternalId) {
      setError('Solution does not have a NetSuite Internal ID');
      return;
    }

    setLoading(true);
    setError(null);
    setBomData(null);
    setMappingResults(null);
    
    try {
      // Step 1: Fetch BOM from NetSuite
      console.log('Fetching BOM for NetSuite ID:', solution.netsuiteInternalId);
      const response = await fetch(`/api/netsuite/bom?action=getBOM&assemblyItemId=${solution.netsuiteInternalId}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch BOM from NetSuite');
      }
      
      setBomData(data);
      
      // Step 2: Auto-map components to local chemicals
      if (data.recipe && data.recipe.length > 0) {
        console.log('Auto-mapping components to local chemicals...');
        await autoMapComponents(data.recipe);
      }
      
    } catch (error) {
      console.error('Error loading BOM:', error);
      setError('Error loading BOM: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-map NetSuite components to local chemicals using enhanced service
  const autoMapComponents = async (netsuiteComponents) => {
    try {
      console.log('Auto-mapping components using enhanced service...');
      
      // Use the enhanced mapping API endpoint
      const response = await fetch('/api/netsuite/mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ components: netsuiteComponents })
      });
      
      if (!response.ok) {
        throw new Error('Failed to map components');
      }
      
      const mappingData = await response.json();
      
      if (!mappingData.success) {
        throw new Error(mappingData.message || 'Mapping failed');
      }
      
      // Convert mapping results to our expected format
      const mappingResults = mappingData.mappingResults.map(result => ({
        netsuiteComponent: result.netsuiteComponent,
        localChemical: result.matches && result.matches.length > 0 ? result.matches[0].chemical : null,
        mappedSuccessfully: result.mappedSuccessfully || (result.matches && result.matches.length > 0 && result.matches[0].confidence >= 0.8),
        mappingType: result.matches && result.matches.length > 0 ? result.matches[0].matchType : 'none',
        confidence: result.matches && result.matches.length > 0 ? result.matches[0].confidence : 0,
        allMatches: result.matches || []
      }));
      
      setMappingResults(mappingResults);
      console.log('Enhanced mapping completed:', mappingResults);
      
    } catch (error) {
      console.error('Error mapping components:', error);
      
      // Fallback to simple mapping if enhanced service fails
      console.log('Falling back to simple mapping...');
      await autoMapComponentsSimple(netsuiteComponents);
    }
  };

  // Fallback simple mapping method
  const autoMapComponentsSimple = async (netsuiteComponents) => {
    try {
      const mappingResults = [];
      
      for (const component of netsuiteComponents) {
        console.log('Mapping component:', component.ingredient, 'NetSuite ID:', component.itemId);
        
        // Search for local chemical by NetSuite Internal ID
        const response = await fetch(`/api/items?type=chemical&netsuiteId=${component.itemId}`);
        const searchData = await response.json();
        
        let localChemical = null;
        
        // First try to find exact match by netsuiteInternalId
        if (searchData.items && searchData.items.length > 0) {
          localChemical = searchData.items.find(item => 
            item.netsuiteInternalId === component.itemId
          );
          
          // If no exact NetSuite ID match, try name-based matching as fallback
          if (!localChemical) {
            localChemical = searchData.items.find(item =>
              item.displayName.toLowerCase().includes(component.ingredient.toLowerCase()) ||
              component.ingredient.toLowerCase().includes(item.displayName.toLowerCase())
            );
          }
        }
        
        mappingResults.push({
          netsuiteComponent: component,
          localChemical: localChemical,
          mappedSuccessfully: !!localChemical,
          mappingType: localChemical?.netsuiteInternalId === component.itemId ? 'exact' : 'name',
          confidence: localChemical?.netsuiteInternalId === component.itemId ? 1.0 : 0.7,
          allMatches: localChemical ? [{ chemical: localChemical, confidence: localChemical?.netsuiteInternalId === component.itemId ? 1.0 : 0.7 }] : []
        });
      }
      
      setMappingResults(mappingResults);
      console.log('Simple mapping completed:', mappingResults);
      
    } catch (error) {
      console.error('Error in simple mapping:', error);
      setError('Error mapping components: ' + error.message);
    }
  };

  const handleImport = () => {
    if (!bomData?.recipe || !mappingResults) return;

    // Convert mapped components to your File model format
    const importedComponents = mappingResults.map(result => ({
      item: result.localChemical, // Full chemical object with _id
      qty: result.netsuiteComponent.quantity.toString(),
      unit: mapNetSuiteUnit(result.netsuiteComponent.units),
      // Store NetSuite data for reference
      netsuiteData: {
        itemId: result.netsuiteComponent.itemId,
        itemRefName: result.netsuiteComponent.itemRefName,
        ingredient: result.netsuiteComponent.ingredient,
        bomQuantity: result.netsuiteComponent.bomQuantity,
        componentYield: result.netsuiteComponent.componentYield,
        units: result.netsuiteComponent.units,
        lineId: result.netsuiteComponent.lineId,
        bomComponentId: result.netsuiteComponent.bomComponentId,
        itemSource: result.netsuiteComponent.itemSource,
        mappedSuccessfully: result.mappedSuccessfully,
        mappingType: result.mappingType
      }
    }));

    // Import data that matches your File model structure
    const importData = {
      solution: solution,
      solutionRef: solution._id,
      components: importedComponents,
      bom: bomData.bom,
      // Set recipe quantity to 1 since BOM quantities are per unit produced
      recipeQty: 1,
      recipeUnit: 'ea',
      // Additional metadata
      netsuiteImportData: {
        bomId: bomData.bom?.bomId,
        bomName: bomData.bom?.bomName,
        revisionId: bomData.bom?.revisionId,
        revisionName: bomData.bom?.revisionName,
        importedAt: new Date().toISOString(),
        solutionNetsuiteId: solution.netsuiteInternalId,
        totalComponents: importedComponents.length,
        mappedComponents: importedComponents.filter(c => c.item).length,
        unmappedComponents: importedComponents.filter(c => !c.item).length
      }
    };

    console.log('Importing data:', importData);
    onImport(importData);
    onClose();
  };

  const handleClose = () => {
    setBomData(null);
    setMappingResults(null);
    setError(null);
    onClose();
  };

  if (!open) return null;

  const successfulMappings = mappingResults?.filter(r => r.mappedSuccessfully).length || 0;
  const totalComponents = mappingResults?.length || 0;

  return (
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            Import BOM from NetSuite
          </DialogTitle>
          <DialogDescription>
            Importing and mapping BOM components for "{solution?.displayName}" from NetSuite.
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
                onClick={fetchBOMAndMap}
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
                <span>Loading BOM and mapping components...</span>
              </div>
            </div>
          )}

          {/* Mapping Results Summary */}
          {mappingResults && !loading && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800 mb-2">
                <MapPin className="h-4 w-4" />
                <span className="font-medium">Component Mapping Results</span>
              </div>
              <div className="text-sm text-green-700">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="font-semibold">{totalComponents}</span> Total Components
                  </div>
                  <div>
                    <span className="font-semibold text-green-600">{successfulMappings}</span> Successfully Mapped
                  </div>
                  <div>
                    <span className="font-semibold text-amber-600">{totalComponents - successfulMappings}</span> Need Manual Mapping
                  </div>
                </div>
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

              {/* Components with Enhanced Mapping Status */}
              {mappingResults && mappingResults.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Components to Import:</h4>
                  <ScrollArea className="max-h-64 border rounded-lg">
                    <div className="p-2 space-y-2">
                      {mappingResults.map((result, index) => (
                        <div key={index} className="p-3 bg-white border rounded">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{result.netsuiteComponent.ingredient}</span>
                              {result.mappedSuccessfully ? (
                                <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  {result.confidence >= 1.0 ? 'Exact' : 
                                   result.confidence >= 0.8 ? 'High' : 
                                   result.confidence >= 0.6 ? 'Medium' : 'Low'}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  No Match
                                </Badge>
                              )}
                              {result.confidence && result.confidence < 1.0 && result.confidence >= 0.6 && (
                                <span className="text-xs text-gray-500">
                                  {Math.round(result.confidence * 100)}% confidence
                                </span>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="font-medium">
                                {result.netsuiteComponent.quantity} {mapNetSuiteUnit(result.netsuiteComponent.units)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                BOM Qty: {result.netsuiteComponent.bomQuantity}
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-xs text-muted-foreground">
                            <div>NetSuite ID: {result.netsuiteComponent.itemId}</div>
                            {result.localChemical && (
                              <div className="text-green-600 mt-1">
                                ✓ Mapped to: {result.localChemical.displayName} ({result.localChemical.sku})
                                {result.localChemical.qtyOnHand !== undefined && (
                                  <span className="ml-2 text-blue-600">
                                    Stock: {result.localChemical.qtyOnHand} {result.localChemical.uom}
                                  </span>
                                )}
                              </div>
                            )}
                            {!result.localChemical && (
                              <div className="text-amber-600 mt-1">
                                ⚠ Will need manual mapping after import
                              </div>
                            )}
                            {result.allMatches && result.allMatches.length > 1 && (
                              <div className="text-blue-600 mt-1">
                                💡 {result.allMatches.length - 1} alternative match(es) available
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Ready to Import */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-800">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">Ready to Import</span>
                </div>
                <p className="text-sm text-blue-700 mt-1">
                  {successfulMappings} of {totalComponents} components automatically mapped. 
                  {totalComponents - successfulMappings > 0 && (
                    <span className="text-amber-700">
                      {' '}{totalComponents - successfulMappings} component(s) will need manual mapping after import.
                    </span>
                  )}
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  Components are mapped using NetSuite Internal IDs for accuracy.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          
          {bomData && bomData.recipe && mappingResults && (
            <Button onClick={handleImport} className="gap-2">
              <Download className="h-4 w-4" />
              Import {successfulMappings}/{totalComponents} Components
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}