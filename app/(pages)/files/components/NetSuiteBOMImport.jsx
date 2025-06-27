// // app/files/components/NetSuiteBOMImport.jsx - Fixed and Enhanced
// 'use client';

// import React, { useState, useEffect } from 'react';
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogDescription,
//   DialogFooter
// } from '@/components/ui/dialog';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { ScrollArea } from '@/components/ui/scroll-area';
// import { Card, CardContent } from '@/components/ui/card';
// import { Badge } from '@/components/ui/badge';
// import { 
//   Loader2, 
//   Search, 
//   Download,
//   ExternalLink,
//   Zap,
//   AlertCircle,
//   CheckCircle2,
//   ArrowRight,
//   X
// } from 'lucide-react';

// // NetSuite API helper - Enhanced with BOM fetching
// const netsuiteApi = {
//   async checkConfiguration() {
//     try {
//       const response = await fetch('/api/netsuite/setup');
//       return await response.json();
//     } catch (error) {
//       return { success: false, configured: false, message: error.message };
//     }
//   },

//   async searchLocalSolutions(searchTerm) {
//     try {
//       const response = await fetch(`/api/items?type=solution&search=${encodeURIComponent(searchTerm)}`);
//       const data = await response.json();
//       return { success: true, items: data.items || [] };
//     } catch (error) {
//       return { success: false, message: error.message, items: [] };
//     }
//   },

//   async getBOM(solutionItem) {
//     try {
//       // Use the netsuiteInternalId from the solution item to fetch BOM
//       const response = await fetch(`/api/netsuite/bom?action=getBOM&assemblyItemId=${solutionItem.netsuiteInternalId}`);
//       const data = await response.json();
      
//       if (!data.success) {
//         throw new Error(data.message || 'Failed to fetch BOM from NetSuite');
//       }
      
//       return {
//         success: true,
//         bom: data.bom,
//         recipe: data.recipe,
//         solutionItem: solutionItem
//       };
//     } catch (error) {
//       return { success: false, message: error.message };
//     }
//   },

//   async findLocalMatches(netsuiteComponents) {
//     try {
//       const response = await fetch('/api/netsuite/mapping', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ components: netsuiteComponents })
//       });
//       return await response.json();
//     } catch (error) {
//       return { success: false, message: error.message };
//     }
//   }
// };

// // Unit mapping utility
// const mapNetSuiteUnit = (netsuiteUnitId) => {
//   const unitMapping = {
//     '33': 'g',    // grams
//     '34': 'kg',   // kilograms  
//     '35': 'L',    // liters
//     '36': 'mL',   // milliliters
//     '37': 'ea',   // each
//   };
//   return unitMapping[netsuiteUnitId] || 'g';
// };

// // Main NetSuite BOM Import Component
// export default function NetSuiteBOMImport({ open, onClose, onImport }) {
//   const [step, setStep] = useState('search'); // 'search', 'bom', 'mapping'
//   const [searchTerm, setSearchTerm] = useState('');
//   const [localSolutions, setLocalSolutions] = useState([]); // FIXED: was causing the error
//   const [loading, setLoading] = useState(false);
//   const [selectedSolution, setSelectedSolution] = useState(null);
//   const [bomData, setBomData] = useState(null);
//   const [loadingBom, setLoadingBom] = useState(false);
//   const [mappingData, setMappingData] = useState(null);
//   const [loadingMapping, setLoadingMapping] = useState(false);
//   const [configured, setConfigured] = useState(false);
//   const [checkingConfig, setCheckingConfig] = useState(true);
//   const [error, setError] = useState(null);

//   // Check NetSuite configuration on mount
//   useEffect(() => {
//     if (open) {
//       checkConfiguration();
//     }
//   }, [open]);

//   const checkConfiguration = async () => {
//     setCheckingConfig(true);
//     setError(null);
//     const config = await netsuiteApi.checkConfiguration();
//     setConfigured(config.configured);
//     setCheckingConfig(false);
    
//     if (!config.configured) {
//       console.warn('NetSuite not configured:', config.message);
//       setError('NetSuite not configured. Please set up your NetSuite credentials first.');
//     }
//   };

//   // Debounced search for local solutions
//   useEffect(() => {
//     if (!searchTerm.trim() || !configured) {
//       setLocalSolutions([]);
//       return;
//     }

//     if (searchTerm.length < 2) {
//       setLocalSolutions([]);
//       return;
//     }

//     const timer = setTimeout(async () => {
//       setLoading(true);
//       setError(null);
//       try {
//         const result = await netsuiteApi.searchLocalSolutions(searchTerm);
//         if (result.success) {
//           // Filter to only show solutions that have NetSuite internal IDs
//           const solutionsWithNetSuite = (result.items || []).filter(item => 
//             item.netsuiteInternalId && item.netsuiteInternalId.trim()
//           );
//           setLocalSolutions(solutionsWithNetSuite);
          
//           if (solutionsWithNetSuite.length === 0 && result.items?.length > 0) {
//             setError('No solutions found with NetSuite Internal IDs. Please configure NetSuite IDs for your solutions.');
//           }
//         } else {
//           console.error('Local search failed:', result.message);
//           setLocalSolutions([]);
//           setError(result.message || 'Failed to search local solutions');
//         }
//       } catch (error) {
//         console.error('Local search error:', error);
//         setLocalSolutions([]);
//         setError('Error searching local solutions');
//       } finally {
//         setLoading(false);
//       }
//     }, 300);

//     return () => clearTimeout(timer);
//   }, [searchTerm, configured]);

//   // Load BOM for selected local solution (using its NetSuite ID)
//   const loadBOM = async (localSolution) => {
//     if (!localSolution.netsuiteInternalId) {
//       setError('This solution does not have a NetSuite Internal ID configured');
//       return;
//     }

//     setSelectedSolution(localSolution);
//     setLoadingBom(true);
//     setError(null);
    
//     try {
//       const result = await netsuiteApi.getBOM(localSolution);
//       if (result.success) {
//         setBomData(result);
//         setStep('bom');
//       } else {
//         setError('Failed to load BOM from NetSuite: ' + result.message);
//       }
//     } catch (error) {
//       console.error('Error loading BOM:', error);
//       setError('Error loading BOM: ' + error.message);
//     } finally {
//       setLoadingBom(false);
//     }
//   };

//   // Find local matches for NetSuite components
//   const findLocalMatches = async () => {
//     if (!bomData?.recipe) return;
    
//     setLoadingMapping(true);
//     setError(null);
//     try {
//       const result = await netsuiteApi.findLocalMatches(bomData.recipe);
//       if (result.success) {
//         setMappingData(result);
//         setStep('mapping');
//       } else {
//         // Continue without mapping if it fails
//         setStep('mapping');
//         setMappingData({ mappingResults: [] });
//         console.warn('Mapping failed:', result.message);
//       }
//     } catch (error) {
//       console.error('Error finding local matches:', error);
//       // Continue without mapping
//       setStep('mapping');
//       setMappingData({ mappingResults: [] });
//     } finally {
//       setLoadingMapping(false);
//     }
//   };

//   // Import the BOM
//   const handleImport = () => {
//     if (!bomData?.recipe || !selectedSolution) return;

//     // Convert NetSuite recipe to local format
//     const importedComponents = bomData.recipe.map(component => ({
//       item: null, // Will need to be manually mapped in the form
//       qty: component.quantity.toString(),
//       unit: mapNetSuiteUnit(component.units),
//       netsuiteData: {
//         itemId: component.itemId,
//         itemRefName: component.itemRefName,
//         ingredient: component.ingredient,
//         bomQuantity: component.bomQuantity,
//         componentYield: component.componentYield,
//         units: component.units,
//         lineId: component.lineId,
//         bomComponentId: component.bomComponentId,
//         itemSource: component.itemSource
//       }
//     }));

//     // Also set the solution reference and recipe quantity
//     const importData = {
//       solution: selectedSolution,
//       solutionRef: selectedSolution._id, // Set the solution reference
//       bom: bomData.bom,
//       components: importedComponents,
//       mappingData: mappingData,
//       // Extract recipe quantity from BOM if available
//       recipeQty: bomData.bom?.plannedQuantity || bomData.recipe?.reduce((sum, comp) => sum + (comp.quantity || 0), 0) || '',
//       recipeUnit: 'L' // Default unit, user can change this
//     };

//     onImport(importData);

//     // Reset state
//     resetState();
//     onClose();
//   };

//   const resetState = () => {
//     setStep('search');
//     setSearchTerm('');
//     setLocalSolutions([]);
//     setSelectedSolution(null);
//     setBomData(null);
//     setMappingData(null);
//     setError(null);
//   };

//   // Reset when dialog closes
//   const handleClose = () => {
//     resetState();
//     onClose();
//   };

//   if (!open) return null;

//   // Configuration check loading
//   if (checkingConfig) {
//     return (
//       <Dialog open={true} onOpenChange={handleClose}>
//         <DialogContent className="sm:max-w-md">
//           <DialogHeader>
//             <DialogTitle className="flex items-center gap-2">
//               <Zap className="h-5 w-5 text-blue-500" />
//               NetSuite BOM Import
//             </DialogTitle>
//           </DialogHeader>
//           <div className="flex items-center justify-center py-8">
//             <div className="flex items-center gap-2">
//               <Loader2 className="h-4 w-4 animate-spin" />
//               <span>Checking NetSuite configuration...</span>
//             </div>
//           </div>
//         </DialogContent>
//       </Dialog>
//     );
//   }

//   // Not configured
//   if (!configured) {
//     return (
//       <Dialog open={true} onOpenChange={handleClose}>
//         <DialogContent className="sm:max-w-md">
//           <DialogHeader>
//             <DialogTitle className="flex items-center gap-2">
//               <AlertCircle className="h-5 w-5 text-amber-500" />
//               NetSuite Not Configured
//             </DialogTitle>
//             <DialogDescription>
//               NetSuite integration needs to be set up before you can import BOMs.
//             </DialogDescription>
//           </DialogHeader>
          
//           <div className="py-4">
//             <p className="text-sm text-muted-foreground mb-4">
//               To use NetSuite BOM import, you need to configure your NetSuite credentials first.
//             </p>
//             <Button 
//               onClick={() => window.open('/api/netsuite/setup', '_blank')}
//               className="w-full"
//             >
//               Configure NetSuite
//             </Button>
//           </div>
          
//           <DialogFooter>
//             <Button variant="outline" onClick={handleClose}>
//               Cancel
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     );
//   }

//   return (
//     <Dialog open={true} onOpenChange={handleClose}>
//       <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
//         <DialogHeader>
//           <DialogTitle className="flex items-center gap-2">
//             <Zap className="h-5 w-5 text-blue-500" />
//             Import BOM from NetSuite
//           </DialogTitle>
//           <DialogDescription>
//             Search for a solution and import its BOM components from NetSuite.
//           </DialogDescription>
//         </DialogHeader>

//         {/* Error Display */}
//         {error && (
//           <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
//             <div className="flex items-center gap-2 text-red-800">
//               <AlertCircle className="h-4 w-4" />
//               <span className="font-medium">Error</span>
//             </div>
//             <p className="text-sm text-red-700 mt-1">{error}</p>
//           </div>
//         )}

//         {/* Step Indicator */}
//         <div className="flex items-center gap-2 text-sm mb-4">
//           <div className={`flex items-center gap-1 ${step === 'search' ? 'text-blue-600 font-medium' : 'text-muted-foreground'}`}>
//             <div className={`w-2 h-2 rounded-full ${step === 'search' ? 'bg-blue-600' : 'bg-muted-foreground'}`} />
//             Search
//           </div>
//           <ArrowRight className="h-3 w-3 text-muted-foreground" />
//           <div className={`flex items-center gap-1 ${step === 'bom' ? 'text-blue-600 font-medium' : 'text-muted-foreground'}`}>
//             <div className={`w-2 h-2 rounded-full ${step === 'bom' ? 'bg-blue-600' : 'bg-muted-foreground'}`} />
//             BOM
//           </div>
//           <ArrowRight className="h-3 w-3 text-muted-foreground" />
//           <div className={`flex items-center gap-1 ${step === 'mapping' ? 'text-blue-600 font-medium' : 'text-muted-foreground'}`}>
//             <div className={`w-2 h-2 rounded-full ${step === 'mapping' ? 'bg-blue-600' : 'bg-muted-foreground'}`} />
//             Import
//           </div>
//         </div>

//         <div className="space-y-6">
//           {/* Step 1: Search Solutions */}
//           {step === 'search' && (
//             <>
//               <div className="space-y-2">
//                 <label className="text-sm font-medium">Search Local Solutions</label>
//                 <div className="relative">
//                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
//                   <Input
//                     value={searchTerm}
//                     onChange={(e) => setSearchTerm(e.target.value)}
//                     placeholder="Search by solution name..."
//                     className="pl-10"
//                   />
//                   {loading && (
//                     <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
//                   )}
//                 </div>
//                 <p className="text-xs text-muted-foreground">
//                   Only solutions with NetSuite Internal IDs will be shown.
//                 </p>
//               </div>

//               {localSolutions.length > 0 && (
//                 <div className="space-y-2">
//                   <label className="text-sm font-medium">Available Solutions ({localSolutions.length})</label>
//                   <ScrollArea className="max-h-64 border rounded-lg">
//                     <div className="p-2 space-y-2">
//                       {localSolutions.map((solution) => (
//                         <Card 
//                           key={solution._id} 
//                           className="cursor-pointer hover:bg-gray-50 transition-colors"
//                           onClick={() => loadBOM(solution)}
//                         >
//                           <CardContent className="p-3">
//                             <div className="flex items-center justify-between">
//                               <div className="flex-1">
//                                 <div className="font-medium">{solution.displayName}</div>
//                                 <div className="text-xs text-muted-foreground">
//                                   SKU: {solution.sku} • NetSuite ID: {solution.netsuiteInternalId}
//                                 </div>
//                               </div>
//                               <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
//                             </div>
//                           </CardContent>
//                         </Card>
//                       ))}
//                     </div>
//                   </ScrollArea>
//                 </div>
//               )}

//               {searchTerm.length >= 2 && !loading && localSolutions.length === 0 && !error && (
//                 <div className="text-center p-8 text-muted-foreground border-2 border-dashed rounded-lg">
//                   <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
//                   <p>No solutions found with NetSuite Internal IDs.</p>
//                   <p className="text-xs mt-1">Make sure your solutions have NetSuite Internal IDs configured.</p>
//                 </div>
//               )}
//             </>
//           )}

//           {/* Step 2: Show BOM */}
//           {step === 'bom' && bomData && (
//             <div className="space-y-4">
//               <div className="flex items-center justify-between">
//                 <h3 className="text-lg font-medium">
//                   BOM: {bomData.bom?.bomName || 'NetSuite BOM'}
//                 </h3>
//                 <Button variant="outline" size="sm" onClick={() => setStep('search')}>
//                   Back to Search
//                 </Button>
//               </div>

//               {/* BOM Info */}
//               <div className="bg-gray-50 rounded-lg p-4">
//                 <div className="grid grid-cols-2 gap-4 text-sm">
//                   <div><span className="font-medium">Solution:</span> {selectedSolution?.displayName}</div>
//                   <div><span className="font-medium">SKU:</span> {selectedSolution?.sku}</div>
//                   <div><span className="font-medium">NetSuite ID:</span> {selectedSolution?.netsuiteInternalId}</div>
//                   {bomData.bom?.revisionName && (
//                     <div><span className="font-medium">BOM Revision:</span> {bomData.bom.revisionName}</div>
//                   )}
//                   {bomData.bom?.effectiveStartDate && (
//                     <div><span className="font-medium">Effective:</span> {bomData.bom.effectiveStartDate}</div>
//                   )}
//                   <div><span className="font-medium">Components:</span> {bomData.recipe?.length || 0}</div>
//                 </div>
//               </div>

//               {/* Components Preview */}
//               {bomData.recipe && bomData.recipe.length > 0 && (
//                 <div className="space-y-2">
//                   <h4 className="font-medium">Components to Import:</h4>
//                   <ScrollArea className="max-h-64 border rounded-lg">
//                     <div className="p-2 space-y-2">
//                       {bomData.recipe.map((component, index) => (
//                         <div key={index} className="flex items-center justify-between p-3 bg-white border rounded">
//                           <div className="flex-1">
//                             <div className="font-medium">{component.ingredient}</div>
//                             <div className="text-xs text-muted-foreground">
//                               NetSuite ID: {component.itemId} • {component.itemRefName}
//                             </div>
//                           </div>
//                           <div className="text-right">
//                             <div className="font-medium">{component.quantity}</div>
//                             <div className="text-xs text-muted-foreground">
//                               Unit: {mapNetSuiteUnit(component.units)} • Yield: {component.componentYield}%
//                             </div>
//                           </div>
//                         </div>
//                       ))}
//                     </div>
//                   </ScrollArea>
//                 </div>
//               )}
//             </div>
//           )}

//           {/* Step 3: Mapping/Import */}
//           {step === 'mapping' && (
//             <div className="space-y-4">
//               <div className="flex items-center justify-between">
//                 <h3 className="text-lg font-medium">Component Mapping & Import</h3>
//                 <Button variant="outline" size="sm" onClick={() => setStep('bom')}>
//                   Back to BOM
//                 </Button>
//               </div>

//               {/* Mapping Results Display */}
//               {mappingData?.mappingResults && (
//                 <div className="space-y-4">
//                   <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
//                     <div className="flex items-center gap-2 text-blue-800 mb-2">
//                       <CheckCircle2 className="h-4 w-4" />
//                       <span className="font-medium">Component Mapping Results</span>
//                     </div>
//                     {mappingData.summary && (
//                       <div className="text-sm text-blue-700">
//                         <p>{mappingData.summary.exactMatches} exact matches found</p>
//                         <p>{mappingData.summary.componentsWithMatches} of {mappingData.summary.totalComponents} components have potential matches</p>
//                       </div>
//                     )}
//                   </div>

//                   {/* Component Mapping Details */}
//                   <div className="space-y-3">
//                     <h4 className="font-medium text-sm">Component Matches:</h4>
//                     <ScrollArea className="max-h-48 border rounded-lg">
//                       <div className="p-3 space-y-3">
//                         {mappingData.mappingResults.map((result, index) => (
//                           <div key={index} className="bg-white border rounded p-3">
//                             <div className="flex items-center justify-between mb-2">
//                               <div className="font-medium text-sm">
//                                 {result.netsuiteComponent.ingredient}
//                               </div>
//                               <Badge variant="outline" className="text-xs">
//                                 {result.matches.length} match{result.matches.length !== 1 ? 'es' : ''}
//                               </Badge>
//                             </div>
                            
//                             {result.matches.length > 0 ? (
//                               <div className="space-y-1">
//                                 {result.matches.slice(0, 2).map((match, matchIndex) => (
//                                   <div key={matchIndex} className="flex items-center justify-between text-xs">
//                                     <span className="text-gray-600">
//                                       {match.chemical.displayName} ({match.chemical.sku})
//                                     </span>
//                                     <div className="flex items-center gap-2">
//                                       <Badge 
//                                         variant={match.matchType === 'netsuite_id' ? 'default' : 'secondary'}
//                                         className="text-xs"
//                                       >
//                                         {match.matchType === 'netsuite_id' ? 'Exact' : 
//                                          `${Math.round(match.confidence * 100)}%`}
//                                       </Badge>
//                                     </div>
//                                   </div>
//                                 ))}
//                                 {result.matches.length > 2 && (
//                                   <div className="text-xs text-gray-500">
//                                     +{result.matches.length - 2} more matches
//                                   </div>
//                                 )}
//                               </div>
//                             ) : (
//                               <div className="text-xs text-gray-500">
//                                 No local matches found - will need manual mapping
//                               </div>
//                             )}
//                           </div>
//                         ))}
//                       </div>
//                     </ScrollArea>
//                   </div>
//                 </div>
//               )}

//               {/* Final Import Summary */}
//               <div className="bg-green-50 border border-green-200 rounded-lg p-4">
//                 <div className="flex items-center gap-2 text-green-800">
//                   <CheckCircle2 className="h-4 w-4" />
//                   <span className="font-medium">Ready to Import</span>
//                 </div>
//                 <p className="text-sm text-green-700 mt-1">
//                   {bomData?.recipe?.length || 0} components from NetSuite BOM will be imported. 
//                   {mappingData?.summary?.exactMatches > 0 && (
//                     <span> {mappingData.summary.exactMatches} components have exact matches.</span>
//                   )}
//                 </p>
//                 <p className="text-xs text-green-600 mt-2">
//                   The solution "{selectedSolution?.displayName}" will also be set as the solution reference.
//                 </p>
//               </div>
//             </div>
//           )}

//           {loadingBom && (
//             <div className="flex items-center justify-center py-8">
//               <div className="flex items-center gap-2">
//                 <Loader2 className="h-4 w-4 animate-spin" />
//                 <span>Loading BOM data from NetSuite...</span>
//               </div>
//             </div>
//           )}

//           {loadingMapping && (
//             <div className="flex items-center justify-center py-8">
//               <div className="flex items-center gap-2">
//                 <Loader2 className="h-4 w-4 animate-spin" />
//                 <span>Finding local component matches...</span>
//               </div>
//             </div>
//           )}
//         </div>

//         <DialogFooter>
//           <Button variant="outline" onClick={handleClose}>
//             Cancel
//           </Button>
          
//           {step === 'bom' && bomData && (
//             <Button onClick={findLocalMatches} disabled={loadingMapping}>
//               Continue to Import
//             </Button>
//           )}
          
//           {step === 'mapping' && (
//             <Button onClick={handleImport} className="gap-2">
//               <Download className="h-4 w-4" />
//               Import {bomData?.recipe?.length || 0} Components
//             </Button>
//           )}
//         </DialogFooter>
//       </DialogContent>
//     </Dialog>
//   );
// }