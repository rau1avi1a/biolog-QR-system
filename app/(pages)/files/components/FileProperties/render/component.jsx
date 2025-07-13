// app/files/components/FileProperties/render/component.jsx
'use client';

import React from 'react';
import { ui } from '@/components/ui';
import { useCore } from '../hooks/core';
import { useComponentState } from '../hooks/state';

/* Enhanced NetSuite BOM Import Component with Real-time Progress */
const NetSuiteBOMImport = ({ 
  open, 
  onClose, 
  onImport, 
  solution,
  isImporting 
}) => {
  const [importStep, setImportStep] = React.useState('idle'); // idle, fetching, mapping, saving, complete
  const [progress, setProgress] = React.useState(0);
  const [currentOperation, setCurrentOperation] = React.useState('');
  const [error, setError] = React.useState(null);

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (open && !isImporting) {
      setImportStep('idle');
      setProgress(0);
      setCurrentOperation('');
      setError(null);
    }
  }, [open, isImporting]);

  // Simulate progress updates during import
  React.useEffect(() => {
    if (!isImporting) return;

    const simulateProgress = () => {
      setImportStep('fetching');
      setCurrentOperation('Connecting to NetSuite...');
      setProgress(10);

      setTimeout(() => {
        setCurrentOperation('Fetching BOM data...');
        setProgress(30);
      }, 500);

      setTimeout(() => {
        setImportStep('mapping');
        setCurrentOperation('Mapping components to local items...');
        setProgress(60);
      }, 1500);

      setTimeout(() => {
        setImportStep('saving');
        setCurrentOperation('Saving updated recipe...');
        setProgress(90);
      }, 2500);
    };

    simulateProgress();
  }, [isImporting]);

  // Handle import completion
  React.useEffect(() => {
    if (importStep === 'saving' && !isImporting) {
      setImportStep('complete');
      setProgress(100);
      setCurrentOperation('Import completed successfully!');
      
      // Auto-close after showing success for 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  }, [importStep, isImporting, onClose]);

  const handleImport = async () => {
    try {
      setError(null);
      await onImport();
    } catch (err) {
      setError(err.message || 'Import failed');
      setImportStep('idle');
      setProgress(0);
      setCurrentOperation('');
    }
  };

  const getStepIcon = (step) => {
    switch (step) {
      case 'fetching':
        return <ui.icons.Download className="h-4 w-4 animate-pulse text-blue-500" />;
      case 'mapping':
        return <ui.icons.GitMerge className="h-4 w-4 animate-pulse text-orange-500" />;
      case 'saving':
        return <ui.icons.Save className="h-4 w-4 animate-pulse text-purple-500" />;
      case 'complete':
        return <ui.icons.CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <ui.icons.Zap className="h-4 w-4 text-blue-500" />;
    }
  };

  const getProgressColor = () => {
    if (error) return 'bg-red-500';
    if (importStep === 'complete') return 'bg-green-500';
    return 'bg-blue-500';
  };

  return (
    <ui.Dialog open={open} onOpenChange={onClose}>
      <ui.DialogContent className="sm:max-w-lg">
        <ui.DialogHeader>
          <ui.DialogTitle className="flex items-center gap-2">
            {getStepIcon(importStep)}
            Import BOM from NetSuite
          </ui.DialogTitle>
          <ui.DialogDescription>
            {solution?.displayName ? (
              <>Importing BOM components for "<strong>{solution.displayName}</strong>" from NetSuite.</>
            ) : (
              "Import BOM components from NetSuite."
            )}
          </ui.DialogDescription>
        </ui.DialogHeader>
        
        <div className="space-y-4">
          {/* Solution Info */}
          {solution && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm">
                <div><span className="font-medium">Solution:</span> {solution.displayName}</div>
                <div><span className="font-medium">SKU:</span> {solution.sku}</div>
                {solution.netsuiteInternalId && (
                  <div><span className="font-medium">NetSuite ID:</span> {solution.netsuiteInternalId}</div>
                )}
              </div>
            </div>
          )}

          {/* Progress Section */}
          {(isImporting || importStep !== 'idle') && (
            <div className="space-y-3">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Import Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Current Operation */}
              {currentOperation && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {isImporting && <ui.icons.Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{currentOperation}</span>
                </div>
              )}

              {/* Import Steps */}
              <div className="space-y-2">
                {[
                  { id: 'fetching', label: 'Fetch BOM Data' },
                  { id: 'mapping', label: 'Map Components' },
                  { id: 'saving', label: 'Save Recipe' }
                ].map((step, index) => {
                  const isComplete = ['fetching', 'mapping', 'saving', 'complete'].indexOf(importStep) > index;
                  const isCurrent = importStep === step.id;
                  
                  return (
                    <div key={step.id} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isComplete ? 'bg-green-100 border-green-500' :
                        isCurrent ? 'bg-blue-100 border-blue-500' :
                        'bg-gray-100 border-gray-300'
                      }`}>
                        {isComplete ? (
                          <ui.icons.Check className="h-3 w-3 text-green-600" />
                        ) : isCurrent ? (
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        ) : (
                          <div className="w-2 h-2 bg-gray-400 rounded-full" />
                        )}
                      </div>
                      <span className={`text-sm ${
                        isComplete ? 'text-green-700 font-medium' :
                        isCurrent ? 'text-blue-700 font-medium' :
                        'text-gray-500'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-800">
                <ui.icons.AlertCircle className="h-4 w-4" />
                <span className="font-medium">Import Failed</span>
              </div>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {importStep === 'complete' && !error && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <ui.icons.CheckCircle className="h-4 w-4" />
                <span className="font-medium">Import Successful!</span>
              </div>
              <p className="text-sm text-green-700 mt-1">
                BOM components have been imported and mapped to your recipe.
              </p>
            </div>
          )}

          {/* Initial Info */}
          {importStep === 'idle' && !error && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="space-y-2 text-sm text-blue-700">
                <p><strong>This will:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Fetch the current BOM from NetSuite</li>
                  <li>Map NetSuite items to your local inventory</li>
                  <li>Update your recipe with the mapped components</li>
                  <li>Preserve existing component customizations where possible</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <ui.DialogFooter>
          <ui.Button 
            variant="outline" 
            onClick={onClose}
            disabled={isImporting}
          >
            {isImporting ? 'Importing...' : 'Cancel'}
          </ui.Button>
          
          {importStep === 'idle' && (
            <ui.Button 
              onClick={handleImport}
              disabled={isImporting || !solution?.netsuiteInternalId}
              className="flex items-center gap-2"
            >
              <ui.icons.Zap className="h-4 w-4" />
              Start Import
            </ui.Button>
          )}
          
          {importStep === 'complete' && (
            <ui.Button onClick={onClose} variant="default">
              <ui.icons.CheckCircle className="h-4 w-4 mr-2" />
              Done
            </ui.Button>
          )}
        </ui.DialogFooter>
      </ui.DialogContent>
    </ui.Dialog>
  );
};

/* Component Form Modal */
const ComponentFormModal = ({
  open,
  onClose,
  component,
  onSave,
  searchResults,
  searchQuery,
  onSearchChange,
  isSearching,
  onSelectResult,
  getDisplayError
}) => {
  const [formData, setFormData] = React.useState({
    item: component?.item || null,
    qty: component?.qty || '',
    unit: component?.unit || 'g'
  });

  React.useEffect(() => {
    if (component) {
      setFormData({
        item: component.item || null,
        qty: component.qty || '',
        unit: component.unit || 'g'
      });
    }
  }, [component]);

  const handleSave = () => {
    if (formData.item && formData.qty) {
      onSave(component?.id || component?.itemId, formData);
      onClose();
    }
  };

  return (
    <ui.Dialog open={open} onOpenChange={onClose}>
      <ui.DialogContent className="sm:max-w-lg">
        <ui.DialogHeader>
          <ui.DialogTitle>
            {component ? 'Edit Component' : 'Add Component'}
          </ui.DialogTitle>
        </ui.DialogHeader>

        <div className="space-y-4">
          {/* Item Selection */}
          <div className="space-y-2">
            <ui.Label>Chemical/Solution *</ui.Label>
            {formData.item ? (
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div>
                  <div className="font-medium">{formData.item.displayName}</div>
                  <div className="text-sm text-muted-foreground">
                    {formData.item.sku} • {formData.item.itemCategory}
                  </div>
                </div>
                <ui.Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFormData(prev => ({ ...prev, item: null }))}
                >
                  Change
                </ui.Button>
              </div>
            ) : (
              <div className="space-y-2">
                <ui.Input
                  placeholder="Search chemicals and solutions..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
                {isSearching && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ui.icons.Loader2 className="h-4 w-4 animate-spin" />
                    Searching...
                  </div>
                )}
                {searchResults.length > 0 && (
                  <div className="border rounded-lg max-h-40 overflow-y-auto">
                    {searchResults.map((result) => (
                      <div
                        key={result._id}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, item: result }));
                          onSelectResult(result);
                        }}
                      >
                        <div className="font-medium">{result.displayName}</div>
                        <div className="text-sm text-muted-foreground">
                          {result.sku} • {result.itemCategory} • Stock: {result.qtyOnHand || 0} {result.uom || ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <ui.Label>Quantity *</ui.Label>
            <div className="flex gap-2">
              <ui.Input
                type="number"
                step="0.001"
                placeholder="0.000"
                value={formData.qty}
                onChange={(e) => setFormData(prev => ({ ...prev, qty: e.target.value }))}
                className="flex-1"
              />
              <ui.Select 
                value={formData.unit} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}
              >
                <ui.SelectTrigger className="w-20">
                  <ui.SelectValue />
                </ui.SelectTrigger>
                <ui.SelectContent>
                  <ui.SelectItem value="g">g</ui.SelectItem>
                  <ui.SelectItem value="kg">kg</ui.SelectItem>
                  <ui.SelectItem value="mL">mL</ui.SelectItem>
                  <ui.SelectItem value="L">L</ui.SelectItem>
                  <ui.SelectItem value="ea">ea</ui.SelectItem>
                </ui.SelectContent>
              </ui.Select>
            </div>
            {getDisplayError('componentQty') && (
              <p className="text-sm text-red-600">{getDisplayError('componentQty')}</p>
            )}
          </div>
        </div>

        <ui.DialogFooter>
          <ui.Button variant="outline" onClick={onClose}>
            Cancel
          </ui.Button>
          <ui.Button 
            onClick={handleSave}
            disabled={!formData.item || !formData.qty || parseFloat(formData.qty) <= 0}
          >
            {component ? 'Update' : 'Add'} Component
          </ui.Button>
        </ui.DialogFooter>
      </ui.DialogContent>
    </ui.Dialog>
  );
};

/* Delete Confirmation Dialog */
const DeleteConfirmDialog = ({ open, onClose, onConfirm, fileName, isDeleting }) => (
  <ui.AlertDialog open={open} onOpenChange={onClose}>
    <ui.AlertDialogContent>
      <ui.AlertDialogHeader>
        <ui.AlertDialogTitle>Delete File</ui.AlertDialogTitle>
        <ui.AlertDialogDescription>
          Are you sure you want to delete "{fileName}"? This action cannot be undone.
        </ui.AlertDialogDescription>
      </ui.AlertDialogHeader>
      <ui.AlertDialogFooter>
        <ui.AlertDialogCancel onClick={onClose}>Cancel</ui.AlertDialogCancel>
        <ui.AlertDialogAction 
          onClick={onConfirm}
          disabled={isDeleting}
          className="bg-red-600 hover:bg-red-700"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </ui.AlertDialogAction>
      </ui.AlertDialogFooter>
    </ui.AlertDialogContent>
  </ui.AlertDialog>
);

/* Enhanced Details Tab with Batch Information */
const DetailsTab = ({ core, state, batchContext }) => {
  const isBatchFile = core.file?.isBatch;
  const isReadOnly = !core.canEdit;
  const isFromBatch = core.file?.isFromBatch;
  
  // Use the batch context passed from the page
  const batchData = batchContext;

  return (
    <div className="space-y-6">
      {/* Read-only notice for batch files */}
      {isReadOnly && (isBatchFile || isFromBatch) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-800">
            <ui.icons.Info className="h-4 w-4" />
            <span className="font-medium">Batch File - Read Only</span>
          </div>
          <p className="text-sm text-amber-700 mt-1">
            This is a working batch file. To edit the recipe, open the original file.
          </p>
        </div>
      )}

      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Basic Information</h3>
        
        <div className="space-y-2">
          <ui.Label htmlFor="fileName">File Name *</ui.Label>
          <ui.Input
            id="fileName"
            value={core.fileName}
            onChange={(e) => state.handleFieldChange('fileName', e.target.value)}
            onBlur={(e) => state.handleFieldBlur('fileName', e.target.value)}
            disabled={!core.canEdit}
            placeholder="Enter file name"
          />
          {state.getDisplayError('fileName') && (
            <p className="text-sm text-red-600">{state.getDisplayError('fileName')}</p>
          )}
        </div>

        <div className="space-y-2">
          <ui.Label htmlFor="description">Description</ui.Label>
          <ui.Textarea
            id="description"
            value={core.description}
            onChange={(e) => state.handleFieldChange('description', e.target.value)}
            disabled={!core.canEdit}
            placeholder="Enter file description"
            rows={3}
          />
        </div>
      </div>

      {/* Recipe Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Recipe Information</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <ui.Label htmlFor="recipeQty">Recipe Quantity</ui.Label>
            <ui.Input
              id="recipeQty"
              type="number"
              step="0.001"
              value={core.recipeQty}
              onChange={(e) => state.handleFieldChange('recipeQty', e.target.value)}
              onBlur={(e) => state.handleFieldBlur('recipeQty', e.target.value)}
              disabled={!core.canEdit}
              placeholder="0.000"
            />
            {state.getDisplayError('recipeQty') && (
              <p className="text-sm text-red-600">{state.getDisplayError('recipeQty')}</p>
            )}
          </div>

          <div className="space-y-2">
            <ui.Label htmlFor="recipeUnit">Unit</ui.Label>
            <ui.Select 
              value={core.recipeUnit} 
              onValueChange={(value) => state.handleFieldChange('recipeUnit', value)}
              disabled={!core.canEdit}
            >
              <ui.SelectTrigger>
                <ui.SelectValue />
              </ui.SelectTrigger>
              <ui.SelectContent>
                <ui.SelectItem value="L">Liters (L)</ui.SelectItem>
                <ui.SelectItem value="mL">Milliliters (mL)</ui.SelectItem>
                <ui.SelectItem value="kg">Kilograms (kg)</ui.SelectItem>
                <ui.SelectItem value="g">Grams (g)</ui.SelectItem>
                <ui.SelectItem value="ea">Each (ea)</ui.SelectItem>
              </ui.SelectContent>
            </ui.Select>
          </div>
        </div>
      </div>

      {/* File Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">File Information</h3>
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          
          {/* Basic File Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Type:</span>
              <div className="flex items-center gap-2 mt-1">
                {isBatchFile ? (
                  <>
                    <ui.Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      <ui.icons.GitBranch className="h-3 w-3 mr-1" />
                      Batch
                    </ui.Badge>
                    <span className="text-gray-600">Working Copy</span>
                  </>
                ) : (
                  <>
                    <ui.Badge variant="default" className="bg-green-100 text-green-800">
                      <ui.icons.FileText className="h-3 w-3 mr-1" />
                      Original
                    </ui.Badge>
                    <span className="text-gray-600">Master Recipe</span>
                  </>
                )}
              </div>
            </div>
            
            <div>
              <span className="font-medium text-gray-700">Status:</span>
              <div className="mt-1">
                <ui.Badge variant="outline" className={
                  core.file?.status === 'active' ? 'bg-green-50 text-green-700' :
                  core.file?.status === 'draft' ? 'bg-gray-50 text-gray-700' :
                  core.file?.status === 'archived' ? 'bg-red-50 text-red-700' :
                  'bg-gray-50 text-gray-700'
                }>
                  {core.file?.status || 'Draft'}
                </ui.Badge>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t border-gray-200">
            <div>
              <span className="font-medium text-gray-700">Created:</span>
              <div className="text-gray-600 mt-1">
                {core.file?.createdAt ? new Date(core.file.createdAt).toLocaleString() : 'Unknown'}
              </div>
            </div>
            <div>
              <span className="font-medium text-gray-700">Modified:</span>
              <div className="text-gray-600 mt-1">
                {core.file?.updatedAt ? new Date(core.file.updatedAt).toLocaleString() : 'Unknown'}
              </div>
            </div>
          </div>

          {/* Current Batch Information when opened from batch */}
          {isFromBatch && batchData && (
            <>
              <div className="pt-3 border-t border-gray-200">
                <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <ui.icons.GitBranch className="h-4 w-4" />
                  Current Batch Information
                </h4>
                
                <div className="grid grid-cols-1 gap-3 text-sm">
                  {/* Batch Status */}
                  <div>
                    <span className="font-medium text-gray-700">Status:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <ui.Badge variant={
                        batchData.status === 'Completed' ? 'default' :
                        batchData.status === 'Review' ? 'secondary' :
                        batchData.status === 'In Progress' ? 'outline' :
                        'outline'
                      } className={
                        batchData.status === 'Completed' ? 'bg-green-100 text-green-800' :
                        batchData.status === 'Review' ? 'bg-blue-100 text-blue-800' :
                        batchData.status === 'In Progress' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }>
                        {batchData.status || 'Unknown'}
                      </ui.Badge>
                      {batchData.runNumber && (
                        <span className="text-gray-600">Run #{batchData.runNumber}</span>
                      )}
                    </div>
                  </div>

                  {/* Batch ID */}
                  <div>
                    <span className="font-medium text-gray-700">Batch ID:</span>
                    <div className="text-gray-600 mt-1 font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                      {batchData._id || 'Unknown'}
                    </div>
                  </div>

                  {/* Last Updated */}
                  <div>
                    <span className="font-medium text-gray-700">Last Updated:</span>
                    <div className="text-gray-600 mt-1">
                      {batchData.updatedAt ? new Date(batchData.updatedAt).toLocaleString() : 'Unknown'}
                    </div>
                  </div>

                  {/* Updated By */}
                  {batchData.user && (
                    <div>
                      <span className="font-medium text-gray-700">Modified By:</span>
                      <div className="flex items-center gap-2 mt-1">
                        <ui.icons.User className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600">
                          {batchData.user.name || batchData.user.email || 'Unknown User'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Work Order Information */}
                  {(batchData.workOrderId || batchData.workOrderCreated) && (
                    <div>
                      <span className="font-medium text-gray-700">Work Order:</span>
                      <div className="space-y-1 mt-1">
                        <div className="flex items-center gap-2">
                          <ui.icons.Clipboard className="h-4 w-4 text-blue-500" />
                          <span className="text-gray-600">
                            {batchData.workOrderId || 'N/A'}
                          </span>
                          <ui.Badge variant={
                            batchData.workOrderStatus === 'completed' ? 'default' :
                            batchData.workOrderStatus === 'pending' ? 'secondary' :
                            batchData.workOrderCreated ? 'outline' :
                            'outline'
                          } className={
                            batchData.workOrderStatus === 'completed' ? 'bg-green-100 text-green-800' :
                            batchData.workOrderStatus === 'pending' ? 'bg-orange-100 text-orange-800' :
                            batchData.workOrderCreated ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }>
                            {batchData.workOrderStatus || (batchData.workOrderCreated ? 'created' : 'not created')}
                          </ui.Badge>
                        </div>
                        {batchData.workOrderCreatedAt && (
                          <div className="text-xs text-gray-500 ml-6">
                            Created: {new Date(batchData.workOrderCreatedAt).toLocaleString()}
                          </div>
                        )}
                        {batchData.workOrderCompletedAt && (
                          <div className="text-xs text-gray-500 ml-6">
                            Completed: {new Date(batchData.workOrderCompletedAt).toLocaleString()}
                          </div>
                        )}
                        {batchData.workOrderError && (
                          <div className="text-xs text-red-600 ml-6">
                            Error: {batchData.workOrderError}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Assembly Build Information */}
                  {(batchData.assemblyBuildId || batchData.assemblyBuildCreated || batchData.assemblyBuildTranId) && (
                    <div>
                      <span className="font-medium text-gray-700">Assembly Build:</span>
                      <div className="space-y-1 mt-1">
                        <div className="flex items-center gap-2">
                          <ui.icons.Package className="h-4 w-4 text-purple-500" />
                          <span className="text-gray-600">
                            {batchData.assemblyBuildId || batchData.assemblyBuildTranId || 'N/A'}
                          </span>
                          <ui.Badge variant={
                            batchData.assemblyBuildStatus === 'created' ? 'default' :
                            batchData.assemblyBuildStatus === 'pending' ? 'secondary' :
                            batchData.assemblyBuildCreated ? 'outline' :
                            'outline'
                          } className={
                            batchData.assemblyBuildStatus === 'created' ? 'bg-green-100 text-green-800' :
                            batchData.assemblyBuildStatus === 'pending' ? 'bg-orange-100 text-orange-800' :
                            batchData.assemblyBuildCreated ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }>
                            {batchData.assemblyBuildStatus || (batchData.assemblyBuildCreated ? 'created' : 'not created')}
                          </ui.Badge>
                        </div>
                        {batchData.assemblyBuildCreatedAt && (
                          <div className="text-xs text-gray-500 ml-6">
                            Created: {new Date(batchData.assemblyBuildCreatedAt).toLocaleString()}
                          </div>
                        )}
                        {batchData.assemblyBuildTranId && batchData.assemblyBuildId && (
                          <div className="text-xs text-gray-500 ml-6">
                            Transaction ID: {batchData.assemblyBuildTranId}
                          </div>
                        )}
                        {batchData.assemblyBuildError && (
                          <div className="text-xs text-red-600 ml-6">
                            Error: {batchData.assemblyBuildError}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Solution Information */}
                  {(batchData.solutionCreated || batchData.solutionLotNumber) && (
                    <div>
                      <span className="font-medium text-gray-700">Solution:</span>
                      <div className="space-y-1 mt-1">
                        <div className="flex items-center gap-2">
                          <ui.icons.FlaskRound className="h-4 w-4 text-green-500" />
                          <span className="text-gray-600">
                            {batchData.solutionLotNumber ? `Lot: ${batchData.solutionLotNumber}` : 'Created'}
                          </span>
                          {batchData.solutionQuantity && (
                            <ui.Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
                              {batchData.solutionQuantity} {batchData.solutionUnit || 'units'}
                            </ui.Badge>
                          )}
                        </div>
                        {batchData.solutionCreatedDate && (
                          <div className="text-xs text-gray-500 ml-6">
                            Created: {new Date(batchData.solutionCreatedDate).toLocaleString()}
                          </div>
                        )}
                        {batchData.transactionDate && batchData.transactionDate !== batchData.solutionCreatedDate && (
                          <div className="text-xs text-gray-500 ml-6">
                            Transaction: {new Date(batchData.transactionDate).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Production Process Flags */}
                  <div>
                    <span className="font-medium text-gray-700">Process Status:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {batchData.chemicalsTransacted && (
                        <ui.Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                          <ui.icons.CheckCircle className="h-3 w-3 mr-1" />
                          Chemicals Transacted
                        </ui.Badge>
                      )}
                      {batchData.submittedForReviewAt && (
                        <ui.Badge variant="outline" className="bg-orange-50 text-orange-700 text-xs">
                          <ui.icons.Eye className="h-3 w-3 mr-1" />
                          Submitted for Review
                        </ui.Badge>
                      )}
                      {batchData.wasRejected && (
                        <ui.Badge variant="outline" className="bg-red-50 text-red-700 text-xs">
                          <ui.icons.X className="h-3 w-3 mr-1" />
                          Was Rejected
                        </ui.Badge>
                      )}
                      {batchData.isArchived && (
                        <ui.Badge variant="outline" className="bg-gray-50 text-gray-700 text-xs">
                          <ui.icons.Archive className="h-3 w-3 mr-1" />
                          Archived
                        </ui.Badge>
                      )}
                    </div>
                    {batchData.submittedForReviewAt && (
                      <div className="text-xs text-gray-500 mt-1">
                        Submitted: {new Date(batchData.submittedForReviewAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Placeholder for when batch context is detected but not available */}
          {isFromBatch && !batchData && (
            <div className="pt-3 border-t border-gray-200">
              <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                <ui.icons.GitBranch className="h-4 w-4" />
                Current Batch Information
              </h4>
              
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800 mb-2">
                  <ui.icons.AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">DEBUG: No Batch Data</span>
                </div>
                <div className="text-sm text-red-700 space-y-1">
                  <div>isFromBatch: {String(isFromBatch)}</div>
                  <div>hasBatchContext: {String(!!batchData)}</div>
                  <div>batchContextType: {typeof batchData}</div>
                  <div>batchContextStatus: {batchData?.status || 'undefined'}</div>
                  <div>batchContextKeys: {batchData && typeof batchData === 'object' ? Object.keys(batchData).join(', ') : 'none'}</div>
                  <div>batchContextAsString: {JSON.stringify(batchData).substring(0, 100)}...</div>
                  <div>batchContextIsNull: {String(batchData === null)}</div>
                  <div>batchContextIsUndefined: {String(batchData === undefined)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Original Batch-specific Information (for legacy batches) */}
          {isBatchFile && !isFromBatch && (
            <>
              <div className="pt-3 border-t border-gray-200">
                <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <ui.icons.GitBranch className="h-4 w-4" />
                  Batch Details
                </h4>
                
                <div className="grid grid-cols-1 gap-3 text-sm">
                  {/* Original File Reference */}
                  {core.file?.originalFile && (
                    <div>
                      <span className="font-medium text-gray-700">Original File:</span>
                      <div className="flex items-center gap-2 mt-1">
                        <ui.icons.FileText className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600">{core.file.originalFile.fileName || 'Unknown'}</span>
                        <ui.Badge variant="outline" className="text-xs">
                          ID: {core.file.originalFileId || 'N/A'}
                        </ui.Badge>
                      </div>
                    </div>
                  )}

                  {/* Batch Number/ID */}
                  <div>
                    <span className="font-medium text-gray-700">Batch ID:</span>
                    <div className="text-gray-600 mt-1 font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                      {core.file?._id || 'Unknown'}
                    </div>
                  </div>

                  {/* Work Order Info */}
                  {core.file?.workOrder && (
                    <div>
                      <span className="font-medium text-gray-700">Work Order:</span>
                      <div className="flex items-center gap-2 mt-1">
                        <ui.icons.Clipboard className="h-4 w-4 text-blue-500" />
                        <span className="text-gray-600">{core.file.workOrder.number || 'N/A'}</span>
                        <ui.Badge variant={
                          core.file.workOrder.status === 'completed' ? 'default' :
                          core.file.workOrder.status === 'in_progress' ? 'secondary' :
                          'outline'
                        }>
                          {core.file.workOrder.status || 'pending'}
                        </ui.Badge>
                      </div>
                    </div>
                  )}

                  {/* Assembly Build Info */}
                  {core.file?.assemblyBuild && (
                    <div>
                      <span className="font-medium text-gray-700">Assembly Build:</span>
                      <div className="space-y-1 mt-1">
                        <div className="flex items-center gap-2">
                          <ui.icons.Package className="h-4 w-4 text-purple-500" />
                          <span className="text-gray-600">
                            {core.file.assemblyBuild.internalId || 'N/A'}
                          </span>
                          <ui.Badge variant={
                            core.file.assemblyBuild.status === 'built' ? 'default' :
                            core.file.assemblyBuild.status === 'pending' ? 'secondary' :
                            'outline'
                          }>
                            {core.file.assemblyBuild.status || 'pending'}
                          </ui.Badge>
                        </div>
                        {core.file.assemblyBuild.quantity && (
                          <div className="text-xs text-gray-500 ml-6">
                            Qty: {core.file.assemblyBuild.quantity} {core.file.assemblyBuild.unit || ''}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Production Info */}
                  {core.file?.production && (
                    <div>
                      <span className="font-medium text-gray-700">Production:</span>
                      <div className="mt-1 space-y-1">
                        {core.file.production.batchSize && (
                          <div className="text-gray-600 text-sm">
                            Batch Size: {core.file.production.batchSize} {core.file.production.unit || ''}
                          </div>
                        )}
                        {core.file.production.startDate && (
                          <div className="text-gray-600 text-sm">
                            Started: {new Date(core.file.production.startDate).toLocaleDateString()}
                          </div>
                        )}
                        {core.file.production.completedDate && (
                          <div className="text-gray-600 text-sm">
                            Completed: {new Date(core.file.production.completedDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* User/Creator Info */}
                  {core.file?.createdBy && (
                    <div>
                      <span className="font-medium text-gray-700">Created By:</span>
                      <div className="flex items-center gap-2 mt-1">
                        <ui.icons.User className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600">
                          {core.file.createdBy.name || core.file.createdBy.email || 'Unknown User'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Original File Information (non-batch) */}
          {!isBatchFile && (
            <div className="pt-3 border-t border-gray-200">
              <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                <ui.icons.FileText className="h-4 w-4" />
                Recipe Details
              </h4>
              
              <div className="grid grid-cols-1 gap-3 text-sm">
                {/* File ID */}
                <div>
                  <span className="font-medium text-gray-700">File ID:</span>
                  <div className="text-gray-600 mt-1 font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                    {core.file?._id || 'Unknown'}
                  </div>
                </div>

                {/* Version Info */}
                {core.file?.version && (
                  <div>
                    <span className="font-medium text-gray-700">Version:</span>
                    <div className="text-gray-600 mt-1">
                      {core.file.version}
                    </div>
                  </div>
                )}

                {/* Category/Type */}
                {core.file?.category && (
                  <div>
                    <span className="font-medium text-gray-700">Category:</span>
                    <div className="text-gray-600 mt-1">
                      {core.file.category}
                    </div>
                  </div>
                )}

                {/* Last Modified By */}
                {core.file?.lastModifiedBy && (
                  <div>
                    <span className="font-medium text-gray-700">Last Modified By:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <ui.icons.User className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-600">
                        {core.file.lastModifiedBy.name || core.file.lastModifiedBy.email || 'Unknown User'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* Components Tab Content */
const ComponentsTab = ({ core, state }) => (
  <div className="space-y-6">
    {/* Components Header */}
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-medium">Recipe Components</h3>
        <p className="text-sm text-muted-foreground">
          Manage the chemicals and solutions used in this recipe
        </p>
      </div>
      {core.canEdit && (
        <ui.Button
          onClick={() => state.setShowComponentForm(true)}
          className="flex items-center gap-2"
        >
          <ui.icons.Plus className="h-4 w-4" />
          Add Component
        </ui.Button>
      )}
    </div>

    {/* Components List */}
    {state.componentDisplayData.length > 0 ? (
      <div className="space-y-3">
        {state.componentDisplayData.map((comp, index) => (
          <div key={comp.id || comp.itemId || index} className="border rounded-lg p-4 bg-white">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium truncate">{comp.displayName}</h4>
                  <ui.Badge variant={comp.category === 'chemical' ? 'default' : 'secondary'}>
                    {comp.category}
                  </ui.Badge>
                  {comp.isNetSuiteImported && (
                    <ui.Badge variant="outline" className="bg-blue-50 text-blue-700">
                      <ui.icons.Zap className="h-3 w-3 mr-1" />
                      NetSuite
                    </ui.Badge>
                  )}
                  {!comp.isMapped && (
                    <ui.Badge variant="outline" className="bg-amber-50 text-amber-700">
                      <ui.icons.AlertTriangle className="h-3 w-3 mr-1" />
                      Unmapped
                    </ui.Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  <div>SKU: {comp.sku}</div>
                  <div>Stock: {comp.currentStock} {comp.stockUnit}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-medium text-lg">
                    {comp.qty} {comp.unit}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Amount: {comp.amount || 0}
                  </div>
                </div>
                
                {core.canEdit && (
                  <div className="flex items-center gap-1">
                    <ui.Button
                      size="sm"
                      variant="outline"
                      onClick={() => state.handleEditComponent(comp)}
                    >
                      <ui.icons.Edit className="h-4 w-4" />
                    </ui.Button>
                    <ui.Button
                      size="sm"
                      variant="outline"
                      onClick={() => state.handleRemoveComponent(comp.id || comp.itemId)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <ui.icons.Trash2 className="h-4 w-4" />
                    </ui.Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="text-center py-8 border-2 border-dashed rounded-lg">
        <ui.icons.Beaker className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h4 className="text-lg font-medium mb-2">No Components Added</h4>
        <p className="text-muted-foreground mb-4">
          Add chemicals and solutions to define your recipe
        </p>
        {core.canEdit && (
          <ui.Button onClick={() => state.setShowComponentForm(true)}>
            <ui.icons.Plus className="h-4 w-4 mr-2" />
            Add First Component
          </ui.Button>
        )}
      </div>
    )}
  </div>
);

/* Solution Tab Content */
const SolutionTab = ({ core, state }) => (
  <div className="space-y-6">
    {/* Solution Header */}
    <div>
      <h3 className="text-lg font-medium">Solution Reference</h3>
      <p className="text-sm text-muted-foreground">
        Link this recipe to a solution for NetSuite BOM import
      </p>
    </div>

    {/* Current Solution */}
    {core.selectedSolution ? (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <ui.icons.FlaskRound className="h-5 w-5 text-green-600" />
              <h4 className="font-medium text-green-800">{core.selectedSolution.displayName}</h4>
            </div>
            <div className="text-sm text-green-700 space-y-1">
              <div><span className="font-medium">SKU:</span> {core.selectedSolution.sku}</div>
              {core.selectedSolution.netsuiteInternalId && (
                <div><span className="font-medium">NetSuite ID:</span> {core.selectedSolution.netsuiteInternalId}</div>
              )}
              <div><span className="font-medium">Stock:</span> {core.selectedSolution.qtyOnHand || 0} {core.selectedSolution.uom || ''}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {core.canImportBOM && (
              <ui.Button
                variant="outline"
                onClick={core.openBOMImport}
                disabled={state.bomImportButtonConfig.disabled}
                className="flex items-center gap-2"
              >
                {state.bomImportButtonConfig.loading ? (
                  <ui.icons.Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ui.icons.Zap className="h-4 w-4" />
                )}
                {state.bomImportButtonConfig.text}
              </ui.Button>
            )}
            
            {core.canEdit && (
              <ui.Button
                size="sm"
                variant="outline"
                onClick={core.clearSolution}
              >
                Remove
              </ui.Button>
            )}
          </div>
        </div>
        
        {!core.selectedSolution.netsuiteInternalId && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
            <div className="flex items-center gap-2 text-amber-800">
              <ui.icons.AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">No NetSuite ID</span>
            </div>
            <p className="text-sm text-amber-700 mt-1">
              This solution doesn't have a NetSuite Internal ID, so BOM import is not available.
            </p>
          </div>
        )}
      </div>
    ) : (
      <div className="border-2 border-dashed rounded-lg p-6">
        <div className="text-center">
          <ui.icons.FlaskRound className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h4 className="text-lg font-medium mb-2">No Solution Selected</h4>
          <p className="text-muted-foreground mb-4">
            Select a solution to enable NetSuite BOM import functionality
          </p>
          
          {core.canEdit && (
            <div className="space-y-4">
              <div className="max-w-md mx-auto">
                <ui.Input
                  placeholder="Search solutions..."
                  value={core.solutionSearch}
                  onChange={(e) => core.handleSolutionSearchChange(e.target.value)}
                />
                
                {core.isSearchingSolutions && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                    <ui.icons.Loader2 className="h-4 w-4 animate-spin" />
                    Searching solutions...
                  </div>
                )}
                
                {state.formattedSolutionResults.length > 0 && (
                  <div className="mt-2 border rounded-lg max-h-48 overflow-y-auto">
                    {state.formattedSolutionResults.map((result) => (
                      <div
                        key={result._id}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                        onClick={() => state.handleSelectSolutionResult(result)}
                      >
                        <div className="font-medium">{result.displayText}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          {result.subtitle}
                          {result.hasNetSuiteId && (
                            <ui.Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                              BOM Available
                            </ui.Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);

/* Main FileProperties Component */
export default function FileProperties(props) {
  // Debug logging - check what we receive
  console.log('🔍 FileProperties component render:', {
    propsKeys: Object.keys(props),
    hasFile: !!props.file,
    fileKeys: props.file ? Object.keys(props.file) : null,
    isFromBatch: props.file?.isFromBatch,
    hasBatchContext: !!props.batchContext,
    batchContextStatus: props.batchContext?.status,
    open: props.open
  });

  const core = useCore(props);
  const state = useComponentState(core, props);

  // Debug logging
  React.useEffect(() => {
    console.log('🔍 FileProperties received props:', {
      hasFile: !!props.file,
      isFromBatch: props.file?.isFromBatch,
      hasBatchContext: !!props.batchContext,
      batchContextKeys: props.batchContext ? Object.keys(props.batchContext) : null,
      batchStatus: props.batchContext?.status,
      batchRunNumber: props.batchContext?.runNumber
    });
    
    console.log('🔍 Raw batchContext prop:', props.batchContext);
  }, [props.file, props.batchContext]);

  if (!props.file) return null;

  return (
    <>
      {/* Main Drawer */}
      <ui.Sheet open={props.open} onOpenChange={state.handleClose}>
        <ui.SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
          <ui.SheetHeader className="flex-shrink-0">
            <ui.SheetTitle className="flex items-center gap-2">
              <ui.icons.FileText className="h-5 w-5" />
              File Properties
            </ui.SheetTitle>
            <ui.SheetDescription>
              Manage file metadata, components, and solution references
              {!core.canEdit && (
                <span className="text-amber-600 font-medium"> (Read Only)</span>
              )}
            </ui.SheetDescription>
          </ui.SheetHeader>

          {/* Error Display */}
          {core.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-red-800">
                <ui.icons.AlertCircle className="h-4 w-4" />
                <span className="font-medium">Error</span>
              </div>
              <p className="text-sm text-red-700 mt-1">{core.error}</p>
            </div>
          )}

          {/* Tabs */}
          <ui.Tabs value={state.activeTab} onValueChange={state.setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <ui.TabsList className="grid w-full grid-cols-3 flex-shrink-0">
              {state.tabs.map((tab) => {
                const IconComponent = ui.icons[tab.icon];
                return (
                  <ui.TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                    <IconComponent className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </ui.TabsTrigger>
                );
              })}
            </ui.TabsList>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              <ui.ScrollArea className="h-full">
                <div className="p-1">
                  <ui.TabsContent value="details" className="mt-0">
                    <DetailsTab core={core} state={state} batchContext={props.batchContext} />
                  </ui.TabsContent>

                  <ui.TabsContent value="components" className="mt-0">
                    <ComponentsTab core={core} state={state} />
                  </ui.TabsContent>

                  <ui.TabsContent value="solution" className="mt-0">
                    <SolutionTab core={core} state={state} />
                  </ui.TabsContent>
                </div>
              </ui.ScrollArea>
            </div>
          </ui.Tabs>

          {/* Footer Actions */}
          <ui.SheetFooter className="flex-shrink-0 border-t pt-4">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                {core.hasChanges && (
                  <ui.Badge variant="outline" className="bg-amber-50 text-amber-700">
                    <ui.icons.AlertCircle className="h-3 w-3 mr-1" />
                    Unsaved Changes
                  </ui.Badge>
                )}
                
                {core.canEdit && (
                  <ui.Button
                    variant="destructive"
                    size="sm"
                    onClick={state.handleDelete}
                    disabled={state.deleteButtonConfig.disabled}
                  >
                    {state.deleteButtonConfig.loading ? (
                      <ui.icons.Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ui.icons.Trash2 className="h-4 w-4 mr-2" />
                    )}
                    {state.deleteButtonConfig.text}
                  </ui.Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <ui.Button variant="outline" onClick={state.handleClose}>
                  {core.hasChanges ? 'Cancel' : 'Close'}
                </ui.Button>
                
                {core.canEdit && (
                  <ui.Button
                    onClick={state.handleSave}
                    disabled={state.saveButtonConfig.disabled}
                    variant={state.saveButtonConfig.variant}
                  >
                    {state.saveButtonConfig.loading && (
                      <ui.icons.Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {state.saveButtonConfig.text}
                  </ui.Button>
                )}
              </div>
            </div>
          </ui.SheetFooter>
        </ui.SheetContent>
      </ui.Sheet>

      {/* Component Form Modal */}
      <ComponentFormModal
        open={state.showComponentForm}
        onClose={state.handleCancelComponentEdit}
        component={core.editingComponent}
        onSave={state.handleUpdateComponent}
        searchResults={state.formattedSearchResults}
        searchQuery={core.componentSearch}
        onSearchChange={core.handleComponentSearchChange}
        isSearching={core.isSearching}
        onSelectResult={state.handleSelectSearchResult}
        getDisplayError={state.getDisplayError}
      />

      {/* NetSuite BOM Import Dialog */}
      <NetSuiteBOMImport
        open={core.showBOMImport}
        onClose={core.closeBOMImport}
        onImport={core.handleBOMImport}
        solution={core.selectedSolution}
        isImporting={core.isImportingBOM}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={state.showDeleteConfirm}
        onClose={state.handleDeleteCancel}
        onConfirm={state.handleDeleteConfirm}
        fileName={core.fileName}
        isDeleting={core.isDeleting}
      />
    </>
  );
}