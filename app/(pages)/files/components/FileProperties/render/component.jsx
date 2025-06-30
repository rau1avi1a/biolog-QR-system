// app/files/components/FileProperties/render/component.jsx
'use client';

import React from 'react';
import { ui } from '@/components/ui';
import { useCore } from '../hooks/core';
import { useComponentState } from '../hooks/state';

/* NetSuite BOM Import Component */
const NetSuiteBOMImport = ({ 
  open, 
  onClose, 
  onImport, 
  solution
}) => {
  // This would be the SimpleNetSuiteBOMImport component content
  // For now, showing a placeholder that matches the functionality
  return (
    <ui.Dialog open={open} onOpenChange={onClose}>
      <ui.DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <ui.DialogHeader>
          <ui.DialogTitle className="flex items-center gap-2">
            <ui.icons.Zap className="h-5 w-5 text-blue-500" />
            Import BOM from NetSuite
          </ui.DialogTitle>
          <ui.DialogDescription>
            Importing BOM components for "{solution?.displayName}" from NetSuite.
          </ui.DialogDescription>
        </ui.DialogHeader>
        
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            NetSuite BOM Import functionality would be implemented here.
            This will fetch and map components from NetSuite BOM data.
          </p>
        </div>

        <ui.DialogFooter>
          <ui.Button variant="outline" onClick={onClose}>
            Cancel
          </ui.Button>
          <ui.Button onClick={onImport}>
            Import Components
          </ui.Button>
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

/* Details Tab Content */
const DetailsTab = ({ core, state }) => (
  <div className="space-y-6">
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

    {/* File Metadata */}
    <div className="space-y-4">
      <h3 className="text-lg font-medium">File Information</h3>
      <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div><span className="font-medium">Type:</span> {core.isOriginalFile ? 'Original' : 'Batch'}</div>
          <div><span className="font-medium">Status:</span> {core.file?.status || 'Draft'}</div>
          <div><span className="font-medium">Created:</span> {core.file?.createdAt ? new Date(core.file.createdAt).toLocaleDateString() : 'Unknown'}</div>
          <div><span className="font-medium">Modified:</span> {core.file?.updatedAt ? new Date(core.file.updatedAt).toLocaleDateString() : 'Unknown'}</div>
        </div>
      </div>
    </div>
  </div>
);

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
  const core = useCore(props);
  const state = useComponentState(core, props);

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
                    <DetailsTab core={core} state={state} />
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