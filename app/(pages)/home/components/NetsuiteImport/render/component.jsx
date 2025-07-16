// =============================================================================
// app/(pages)/home/components/NetsuiteImport/render/component.jsx
// Complete NetSuite Import Component with Full Import and Scan New Items
// =============================================================================

'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/shadcn/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/shadcn/components/card';
import { Badge } from '@/components/ui/shadcn/components/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/shadcn/components/dialog';
import { ScrollArea } from '@/components/ui/shadcn/components/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/shadcn/components/alert';
import { Progress } from '@/components/ui/shadcn/components/progress';
import { Separator } from '@/components/ui/shadcn/components/separator';
import { 
  Download, 
  Search, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Package,
  TestTube,
  Beaker,
  ExternalLink,
  Printer,
  Eye,
  X,
  Zap,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Check,
  Square,
  CheckSquare
} from 'lucide-react';

// Import your home API
import homeApi from '../../../lib/api';

export default function NetSuiteImportComponent({ onImportComplete }) {
  // Core state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [currentOperation, setCurrentOperation] = useState('');
  const [importResults, setImportResults] = useState(null);
  const [error, setError] = useState(null);
  
  // Preview state
  const [previewItems, setPreviewItems] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  
  // Connection state
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  
  // Refs for cleanup
  const abortControllerRef = useRef(null);
  const progressIntervalRef = useRef(null);

  // Test NetSuite connection on mount
  useEffect(() => {
    testConnection();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // =============================================================================
  // CONNECTION FUNCTIONS
  // =============================================================================

  const testConnection = async () => {
    setIsTestingConnection(true);
    try {
      const result = await homeApi.netsuite.validateConnection();
      setConnectionStatus(result);
    } catch (err) {
      setConnectionStatus({
        connected: false,
        message: err.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // =============================================================================
  // PROGRESS TRACKING
  // =============================================================================

  const startProgressSimulation = (duration = 30000) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(90, (elapsed / duration) * 100);
      setImportProgress(progress);
    }, 1000);
  };

  const stopProgressSimulation = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const completeProgress = (message = 'Completed') => {
    stopProgressSimulation();
    setImportProgress(100);
    setCurrentOperation(message);
  };

  // =============================================================================
  // IMPORT FUNCTIONS
  // =============================================================================

  const handleFullImport = async () => {
    try {
      setIsImporting(true);
      setError(null);
      setImportResults(null);
      setImportProgress(0);
      setCurrentOperation('Initializing NetSuite connection...');
      
      abortControllerRef.current = new AbortController();
      
      // Test connection first
      setCurrentOperation('Testing NetSuite connection...');
      setImportProgress(10);
      
      const connectionTest = await homeApi.netsuite.testConnection();
      if (!connectionTest.success) {
        throw new Error('NetSuite connection failed: ' + connectionTest.message);
      }
      
      // Start progress simulation
      startProgressSimulation(45000); // 45 seconds
      setCurrentOperation('Fetching inventory data from NetSuite...');
      
      // Perform the import
      const result = await homeApi.netsuite.fullImport();
      
      // Complete progress
      completeProgress('Import completed successfully!');
      
      setImportResults(result);
      
      if (onImportComplete) {
        onImportComplete(result);
      }
      
    } catch (err) {
      console.error('Full import error:', err);
      setError(err.message);
      setCurrentOperation('Import failed');
      stopProgressSimulation();
    } finally {
      setIsImporting(false);
    }
  };

  const handleScanNewItems = async () => {
    try {
      setIsImporting(true);
      setError(null);
      setPreviewItems([]);
      setImportProgress(0);
      setCurrentOperation('Scanning for new items...');
      
      abortControllerRef.current = new AbortController();
      
      // Start progress simulation
      startProgressSimulation(30000); // 30 seconds
      setCurrentOperation('Comparing NetSuite data with local inventory...');
      
      // Perform the scan
      const result = await homeApi.netsuite.scanNewItems();
      
      // Complete progress
      completeProgress(`Found ${result.newItems?.length || 0} new items`);
      
      setPreviewItems(result.newItems || []);
      
      if (result.newItems && result.newItems.length > 0) {
        setShowPreview(true);
        setCurrentPreviewIndex(0);
        setSelectedItems([]);
      }
      
    } catch (err) {
      console.error('Scan new items error:', err);
      setError(err.message);
      setCurrentOperation('Scan failed');
      stopProgressSimulation();
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportSelected = async () => {
    try {
      setIsImporting(true);
      setError(null);
      setCurrentOperation('Importing selected items...');
      
      const itemsToImport = selectedItems.map(index => previewItems[index]);
      
      // Start progress simulation
      startProgressSimulation(20000); // 20 seconds
      setCurrentOperation('Processing selected items...');
      
      const result = await homeApi.netsuite.importSelected(itemsToImport);
      
      // Complete progress
      completeProgress('Selected items imported successfully!');
      
      setImportResults(result);
      setShowPreview(false);
      setPreviewItems([]);
      setSelectedItems([]);
      
      if (onImportComplete) {
        onImportComplete(result);
      }
      
    } catch (err) {
      console.error('Import selected items error:', err);
      setError(err.message);
      setCurrentOperation('Import failed');
      stopProgressSimulation();
    } finally {
      setIsImporting(false);
    }
  };

  const cancelImport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    stopProgressSimulation();
    setIsImporting(false);
    setCurrentOperation('Import cancelled');
  };

  // =============================================================================
  // PREVIEW FUNCTIONS
  // =============================================================================

  const toggleItemSelection = (index) => {
    setSelectedItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const selectAllItems = () => {
    setSelectedItems(previewItems.map((_, index) => index));
  };

  const deselectAllItems = () => {
    setSelectedItems([]);
  };

  const closePreview = () => {
    setShowPreview(false);
    setPreviewItems([]);
    setSelectedItems([]);
    setCurrentPreviewIndex(0);
  };

  const navigatePreview = (direction) => {
    if (direction === 'next') {
      setCurrentPreviewIndex(Math.min(previewItems.length - 1, currentPreviewIndex + 1));
    } else {
      setCurrentPreviewIndex(Math.max(0, currentPreviewIndex - 1));
    }
  };

  // =============================================================================
  // UTILITY FUNCTIONS
  // =============================================================================

  const getItemIcon = (type) => {
    switch (type) {
      case 'chemical': return <TestTube className="h-4 w-4" />;
      case 'solution': return <Beaker className="h-4 w-4" />;
      case 'product': return <Package className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const getConnectionStatusColor = () => {
    if (!connectionStatus) return 'text-gray-500';
    return connectionStatus.connected ? 'text-green-600' : 'text-red-600';
  };

  const getConnectionStatusIcon = () => {
    if (isTestingConnection) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (!connectionStatus) return <AlertCircle className="h-4 w-4" />;
    return connectionStatus.connected ? 
      <CheckCircle className="h-4 w-4" /> : 
      <AlertCircle className="h-4 w-4" />;
  };

  // =============================================================================
  // RENDER COMPONENTS
  // =============================================================================

  const renderConnectionStatus = () => (
    <div className="flex items-center justify-between p-3 bg-muted rounded-lg mb-4">
      <div className="flex items-center gap-2">
        <span className={getConnectionStatusColor()}>
          {getConnectionStatusIcon()}
        </span>
        <span className="text-sm font-medium">
          NetSuite Connection
        </span>
        <span className={`text-sm ${getConnectionStatusColor()}`}>
          {isTestingConnection ? 'Testing...' : 
           connectionStatus?.connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={testConnection}
        disabled={isTestingConnection}
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Test
      </Button>
    </div>
  );

  const renderProgress = () => (
    <div className="mb-4 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Import Progress</span>
        <span>{Math.round(importProgress)}%</span>
      </div>
      <Progress value={importProgress} className="h-2" />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{currentOperation}</span>
      </div>
    </div>
  );

  const renderResults = () => (
    <Alert className="mb-4">
      <CheckCircle className="h-4 w-4" />
      <AlertDescription>
        <strong>Import completed!</strong>
        {importResults.processedItems && (
          <div className="mt-2 text-sm">
            • Processed: {importResults.processedItems} items<br/>
            • Created: {importResults.createdItems} items<br/>
            • Updated: {importResults.updatedItems} items<br/>
            • Lots processed: {importResults.lotsProcessed}<br/>
            • Lots created: {importResults.lotsCreated}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );

  const renderError = () => (
    <Alert className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );

  const renderActionButtons = () => (
    <div className="flex flex-wrap gap-3">
      <Button
        onClick={handleFullImport}
        disabled={isImporting || !connectionStatus?.connected}
        className="flex items-center gap-2"
      >
        {isImporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Full Import
      </Button>
      
      <Button
        onClick={handleScanNewItems}
        disabled={isImporting || !connectionStatus?.connected}
        variant="outline"
        className="flex items-center gap-2"
      >
        {isImporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
        Scan New Items
      </Button>
      
      {isImporting && (
        <Button
          onClick={cancelImport}
          variant="destructive"
          className="flex items-center gap-2"
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
      )}
    </div>
  );

  const renderPreviewDialog = () => {
    const currentItem = previewItems[currentPreviewIndex];
    
    return (
      <Dialog open={showPreview} onOpenChange={closePreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              New Items Found ({previewItems.length})
            </DialogTitle>
          </DialogHeader>

          {previewItems.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-medium mb-2">No New Items Found</h3>
              <p className="text-muted-foreground">
                All items from NetSuite are already in your local database.
              </p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Selection Controls */}
              <div className="flex items-center justify-between py-3 border-b">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectAllItems}
                    disabled={selectedItems.length === previewItems.length}
                  >
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Select All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={deselectAllItems}
                    disabled={selectedItems.length === 0}
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Deselect All
                  </Button>
                  <Badge variant="outline">
                    {selectedItems.length} of {previewItems.length} selected
                  </Badge>
                </div>
                
                {/* Item Navigation */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigatePreview('prev')}
                    disabled={currentPreviewIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {currentPreviewIndex + 1} of {previewItems.length}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigatePreview('next')}
                    disabled={currentPreviewIndex === previewItems.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Current Item Detail */}
              {currentItem && (
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-[400px] p-4">
                    <Card className="mb-4">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                              {getItemIcon(currentItem.itemType)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">
                                {currentItem.displayName}
                              </h3>
                              <p className="text-sm text-muted-foreground font-mono">
                                {currentItem.sku}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={currentItem.isNew ? "default" : "secondary"}>
                              {currentItem.isNew ? "New Item" : "New Lots"}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleItemSelection(currentPreviewIndex)}
                            >
                              {selectedItems.includes(currentPreviewIndex) ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">NetSuite ID:</span>
                            <p className="font-mono">{currentItem.netsuiteInternalId}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total Quantity:</span>
                            <p className="font-medium">{currentItem.totalQuantity}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Item Type:</span>
                            <p className="capitalize">{currentItem.itemType}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Lot Count:</span>
                            <p>{currentItem.lots?.length || 0}</p>
                          </div>
                        </div>

                        {/* Lots Display */}
                        {currentItem.lots && currentItem.lots.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Lots</h4>
                            <div className="space-y-2">
                              {currentItem.lots.map((lot, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                                  <span className="font-mono text-sm">{lot.lotNumber}</span>
                                  <Badge variant="outline">{lot.quantity} units</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-4 border-t">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex items-center gap-2"
                            onClick={() => {
                              // This would open the item page after import
                              console.log('Will open item page after import');
                            }}
                          >
                            <Eye className="h-4 w-4" />
                            Preview Page
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex items-center gap-2"
                            onClick={() => {
                              // This would trigger QR code printing
                              console.log('Will print QR code after import');
                            }}
                          >
                            <Printer className="h-4 w-4" />
                            Print QR Code
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closePreview}>
              Close
            </Button>
            {previewItems.length > 0 && (
              <Button
                onClick={handleImportSelected}
                disabled={selectedItems.length === 0 || isImporting}
                className="flex items-center gap-2"
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Import Selected ({selectedItems.length})
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <>
      {/* Main Integration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            NetSuite Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Connection Status */}
          {renderConnectionStatus()}

          {/* Progress Display */}
          {isImporting && renderProgress()}

          {/* Error Display */}
          {error && renderError()}

          {/* Results Display */}
          {importResults && renderResults()}

          {/* Action Buttons */}
          {renderActionButtons()}

          {/* Quick Info */}
          <div className="mt-4 text-sm text-muted-foreground">
            <p><strong>Full Import:</strong> Updates all item quantities from NetSuite</p>
            <p><strong>Scan New Items:</strong> Preview new items before importing</p>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      {renderPreviewDialog()}
    </>
  );
}