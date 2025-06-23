// app/files/components/FileMetaDrawer.jsx - Simplified with direct NetSuite import
'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from '@/components/ui/sheet';
import { Button }        from '@/components/ui/button';
import { Input }         from '@/components/ui/input';
import { ScrollArea }    from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction
} from '@/components/ui/alert-dialog';
import { 
  Loader2, 
  Plus, 
  Trash2, 
  Search, 
  X, 
  Package, 
  FlaskRound, 
  Beaker,
  Hash,
  FileText,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { api }           from '../lib/api';
import SimpleNetSuiteBOMImport from './SimpleNetSuiteBOMImport';

/* ───────── Enhanced async picker with modern styling ───────── */
function AsyncSelect({ label, type, value, onChange, disabled = false, icon: Icon }) {
  const [opts, setOpts] = useState([]);
  const [q, setQ] = useState(value?.displayName || '');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const timer = useRef(null);
  useEffect(() => {
    if (disabled) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setBusy(true);
      console.log('AsyncSelect searching for:', type, 'with term:', q);
      const res = await fetch(`/api/items?type=${type}&search=${encodeURIComponent(q)}`);
      const data = await res.json();
      console.log('AsyncSelect received data:', data);
      console.log('First item in results:', data.items?.[0]);
      setOpts(data.items || []);
      setBusy(false);
    }, 300);
    return () => clearTimeout(timer.current);
  }, [q, type, disabled]);

  const blurT = useRef(null);
  const closeSoon = () => { blurT.current = setTimeout(() => setOpen(false), 120); };
  const cancelClose = () => clearTimeout(blurT.current);

  /* Selected state - modern chip design */
  if (value) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={14} className="text-slate-500" />}
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
        </div>
        <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
              {value.displayName}
            </div>
            {value.sku && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                SKU: {value.sku}
              </div>
            )}
            {value.netsuiteInternalId && (
              <div className="text-xs text-blue-600 dark:text-blue-400">
                NetSuite ID: {value.netsuiteInternalId}
              </div>
            )}
          </div>
          {!disabled && (
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => onChange(null)} 
              className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20"
              title="Remove"
            >
              <X size={14} />
            </Button>
          )}
        </div>
      </div>
    );
  }

  /* Search state - modern input with dropdown */
  return (
    <div className="space-y-2 relative">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={14} className="text-slate-500" />}
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      </div>
      
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <Search size={16} />
        </div>
        <Input
          placeholder={disabled ? 'No value set' : `Search ${label.toLowerCase()}...`}
          value={q}
          onFocus={disabled ? undefined : () => setOpen(true)}
          onBlur={disabled ? undefined : closeSoon}
          onChange={disabled ? undefined : (e => setQ(e.target.value))}
          disabled={disabled}
          className="pl-10 pr-4 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
        />
        {busy && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 size={16} className="animate-spin text-slate-400" />
          </div>
        )}
      </div>

      {open && !disabled && (
        <Card
          className="absolute z-50 mt-1 w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg"
          onMouseEnter={cancelClose}
          onMouseLeave={closeSoon}
        >
          <CardContent className="p-0">
            <ScrollArea className="max-h-48">
              <div className="max-h-48 overflow-y-auto">
                {busy && (
                  <div className="flex items-center justify-center p-4 text-slate-500">
                    <Loader2 size={16} className="animate-spin mr-2" />
                    <span className="text-sm">Searching...</span>
                  </div>
                )}
                {!busy && opts.length === 0 && (
                  <div className="p-4 text-center text-slate-500">
                    <div className="text-sm">No results found</div>
                    <div className="text-xs mt-1">Try a different search term</div>
                  </div>
                )}
                {!busy && opts.map(it => (
                  <div
                    key={it._id}
                    onClick={() => { 
                    console.log('Selecting item:', it);
                    onChange(it); 
                    setQ(it.displayName); 
                    setOpen(false); 
                  }}
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 last:border-b-0 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
                        {it.displayName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        SKU: {it.sku}
                        {it.netsuiteInternalId && (
                          <span className="text-blue-600 dark:text-blue-400 ml-2">
                            NetSuite: {it.netsuiteInternalId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ───────── Component row with full-width chemical name ───────── */
function ComponentRow({ row, index, onChange, onRemove, readOnly }) {
  return (
    <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Chemical selection - full width */}
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <AsyncSelect
                label="Chemical"
                type="chemical"
                value={row.item}
                onChange={readOnly ? undefined : (item => onChange(index, 'item', item))}
                disabled={readOnly}
                icon={Beaker}
              />
            </div>
            
            {!readOnly && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRemove(index)}
                className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20 mt-6"
                title="Remove component"
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
          
          {/* Quantity and Unit - side by side below */}
          <div className="flex gap-3">
            <div className="flex-1">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Quantity</label>
                <Input
                  type="number"
                  placeholder="0"
                  step="0.01"
                  value={row.qty}
                  onChange={readOnly ? undefined : (e => onChange(index, 'qty', e.target.value))}
                  disabled={readOnly}
                  className="text-center"
                />
              </div>
            </div>
            
            <div className="w-24">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Unit</label>
                <Input
                  placeholder="g"
                  value={row.unit}
                  onChange={readOnly ? undefined : (e => onChange(index, 'unit', e.target.value))}
                  disabled={readOnly}
                  className="text-center"
                />
              </div>
            </div>
          </div>

          {/* NetSuite data display if available */}
          {row.netsuiteData && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">NetSuite Import Data</span>
              </div>
              <div className="text-xs text-blue-700 space-y-1">
                <div><strong>Ingredient:</strong> {row.netsuiteData.ingredient}</div>
                <div><strong>NetSuite ID:</strong> {row.netsuiteData.itemId}</div>
                <div><strong>Ref Name:</strong> {row.netsuiteData.itemRefName}</div>
                <div><strong>BOM Qty:</strong> {row.netsuiteData.bomQuantity}</div>
                <div><strong>Yield:</strong> {row.netsuiteData.componentYield}%</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ───────── Main drawer with enhanced styling and simplified NetSuite integration ───────── */
export default function FileMetaDrawer({ file, open, onOpenChange, onSaved, readOnly = false, onFileDeleted }) {
  const [product, setProduct] = useState(null);
  const [solution, setSolution] = useState(null);
  const [rows, setRows] = useState([]);
  const [outQty, setOutQty] = useState('');
  const [outUnit, setOutUnit] = useState('mL');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showNetSuiteImport, setShowNetSuiteImport] = useState(false);

  /* Determine if delete should be available */
  const canDelete = () => {
    if (!file || !file.isBatch) return false; // Only batches can be deleted
    if (file.status === 'Completed') return false; // Cannot delete completed batches
    if (file.isArchived) return false; // Cannot delete archived batches
    if (file.wasRejected) return false; // Cannot delete rejected batches (they need to be fixed)
    return file.status === 'In Progress'; // Only allow deletion of In Progress batches
  };

  /* Check if NetSuite import is available */
  const canImportFromNetSuite = () => {
    return solution && solution.netsuiteInternalId && solution.netsuiteInternalId.trim();
  };

  /* Hydrate form */
  useEffect(() => {
    if (!file) return;

    const data = file.snapshot || file;

    setProduct(data.productRef || null);
    
    // FIXED: If we have a solution reference, we need to fetch the full solution data
    // including the netsuiteInternalId which isn't stored in the file
    if (data.solutionRef) {
      if (typeof data.solutionRef === 'object' && data.solutionRef._id) {
        // Already populated
        setSolution(data.solutionRef);
      } else {
        // Just an ID, need to fetch full solution data
        fetchSolutionData(data.solutionRef);
      }
    } else {
      setSolution(null);
    }
    
    setOutQty(data.recipeQty ?? '');
    setOutUnit(data.recipeUnit ?? 'mL');

    if (data.components?.length) {
      setRows(
        data.components.map((c, index) => {
          let item = null;
          if (c.itemId) {
            if (typeof c.itemId === 'object' && c.itemId._id) {
              item = {
                _id: c.itemId._id,
                displayName: c.itemId.displayName || 'Unknown Item',
                sku: c.itemId.sku || ''
              };
            } else {
              item = {
                _id: c.itemId,
                displayName: c.name || 'Unknown Item',
                sku: ''
              };
            }
          }

          return {
            item: item,
            qty: c.amount,
            unit: c.unit,
            netsuiteData: c.netsuiteData || null // Preserve NetSuite data if available
          };
        })
      );
    } else {
      setRows([{ item: null, qty: '', unit: 'g', netsuiteData: null }]);
    }
  }, [file]);

  /* Fetch full solution data including netsuiteInternalId */
  const fetchSolutionData = async (solutionId) => {
    try {
      const response = await fetch(`/api/items?type=solution&search=`);
      const data = await response.json();
      const fullSolution = data.items?.find(item => item._id === solutionId);
      if (fullSolution) {
        setSolution(fullSolution);
      }
    } catch (error) {
      console.error('Failed to fetch solution data:', error);
    }
  };

  const addRow = () => setRows(r => [...r, { item: null, qty: '', unit: 'g', netsuiteData: null }]);
  const remRow = i => setRows(r => r.filter((_, ix) => ix !== i));

  const updateRow = (index, field, value) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
  };

  /* Handle NetSuite BOM import */
  const handleNetSuiteImport = (importData) => {
    console.log('NetSuite import data received:', importData);
    
    // Set recipe quantity and unit if provided
    if (importData.recipeQty) {
      setOutQty(importData.recipeQty.toString());
    }
    if (importData.recipeUnit) {
      setOutUnit(importData.recipeUnit);
    }

    // Import the components - these will be saved to the File model
    if (importData.components?.length > 0) {
      setRows(importData.components);
    }

    setShowNetSuiteImport(false);
    
    // Auto-save the imported BOM data immediately
    autoSaveImportedBOM(importData);
  };

  /* Auto-save imported BOM data to preserve NetSuite link */
  const autoSaveImportedBOM = async (importData) => {
    if (!file || readOnly) return;
    
    try {
      // Save the BOM data to the File model
      await api.updateFileMeta(file._id, {
        productRef: product?._id || null,
        solutionRef: solution?._id || null,
        recipeQty: importData.recipeQty ? Number(importData.recipeQty) : (outQty ? Number(outQty) : null),
        recipeUnit: importData.recipeUnit || outUnit,
        components: importData.components
          .filter(r => r.qty) // Only save components with quantities
          .map(r => ({
            itemId: r.item?._id || null, // This will be null initially, user can map later
            amount: Number(r.qty),
            unit: r.unit || 'g',
            netsuiteData: r.netsuiteData || undefined // Store NetSuite metadata
          })),
        // Store additional NetSuite metadata at the file level
        netsuiteImportData: importData.netsuiteImportData
      });
      
      console.log('BOM data auto-saved successfully');
      onSaved?.(); // Trigger refresh
    } catch (error) {
      console.error('Failed to auto-save imported BOM data:', error);
      // Don't show error to user since this is auto-save, they can manually save later
    }
  };

  const save = async () => {
    if (!file || readOnly) return;
    setSaving(true);
    try {
      await api.updateFileMeta(file._id, {
        productRef: product?._id || null,
        solutionRef: solution?._id || null,
        recipeQty: outQty ? Number(outQty) : null,
        recipeUnit: outUnit,
        components: rows
          .filter(r => r.item && r.qty)
          .map(r => ({
            itemId: r.item._id,
            amount: Number(r.qty),
            unit: r.unit || 'g',
            netsuiteData: r.netsuiteData || undefined // Include NetSuite data if available
          }))
      });
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save file metadata:', error);
    } finally {
      setSaving(false);
    }
  };

  const deleteBatch = async () => {
    if (!file || !canDelete()) return;
    
    setDeleting(true);
    try {
      await api.deleteBatch(file._id);
      onFileDeleted?.(); // Notify parent that file was deleted
      onOpenChange(false); // Close the drawer
    } catch (error) {
      console.error('Failed to delete batch:', error);
      // You might want to show an error toast here
      alert('Failed to delete batch: ' + (error.message || 'Unknown error'));
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (!file) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[500px] p-0">
          <div className="flex flex-col h-full">
            {/* Header */}
            <SheetHeader className="p-6 pb-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText size={18} className="text-primary" />
                </div>
                <div className="flex-1">
                  <SheetTitle className="text-lg">
                    {readOnly ? 'File Properties' : 'Edit Properties'}
                  </SheetTitle>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {file.fileName}
                  </p>
                </div>
                
                {/* Delete button for batches */}
                {canDelete() && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowDeleteDialog(true)}
                    className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20"
                    title="Delete batch"
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>
              
              {readOnly && (
                <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    {file.isBatch
                      ? 'Properties are inherited from the original file and cannot be edited in batch copies.'
                      : 'Properties cannot be edited in this file state.'
                    }
                  </p>
                </div>
              )}
            </SheetHeader>

            {/* Content */}
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-6">
                {/* File Info Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                    File Information
                  </h3>
                  
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-slate-500" />
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          File name
                        </label>
                      </div>
                      <Input 
                        value={file.fileName} 
                        disabled 
                        className="bg-slate-50 dark:bg-slate-800/50"
                      />
                    </div>

                    {file.runNumber && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Hash size={14} className="text-slate-500" />
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Run Number
                          </label>
                        </div>
                        <Input 
                          value={`Run ${file.runNumber}`} 
                          disabled 
                          className="bg-slate-50 dark:bg-slate-800/50"
                        />
                      </div>
                    )}

                    {/* Batch type indicator */}
                    {file.isBatch && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Package size={14} className="text-slate-500" />
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            File Type
                          </label>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            Batch Copy
                          </Badge>
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            Status: {file.status || 'Unknown'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Product Information Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                    Product Information
                  </h3>
                  
                  <div className="grid gap-4">
                    <AsyncSelect
                      label="Solution produced"
                      type="solution"
                      value={solution}
                      onChange={readOnly ? undefined : setSolution}
                      disabled={readOnly}
                      icon={FlaskRound}
                    />
                    
                    <AsyncSelect
                      label="Product (for order)"
                      type="product"
                      value={product}
                      onChange={readOnly ? undefined : setProduct}
                      disabled={readOnly}
                      icon={Package}
                    />

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Beaker size={14} className="text-slate-500" />
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Recipe output
                        </label>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <Input
                            type="number"
                            placeholder="Quantity"
                            value={outQty}
                            onChange={e => setOutQty(e.target.value)}
                            disabled={readOnly}
                            className="text-center"
                          />
                        </div>
                        <div className="w-24">
                          <Input
                            placeholder="Unit"
                            value={outUnit}
                            onChange={e => setOutUnit(e.target.value)}
                            disabled={readOnly}
                            className="text-center"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Components Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                      Components Used
                    </h3>
                    {rows.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {rows.filter(r => r.item).length} component{rows.filter(r => r.item).length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>

                  {/* NetSuite Import Button - only show when solution has NetSuite ID */}
                  {!readOnly && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3">
                      <div className="text-xs text-slate-600 space-y-1">
                        <div><strong>Debug Info:</strong></div>
                        <div>Solution selected: {solution ? 'Yes' : 'No'}</div>
                        <div>Solution name: {solution?.displayName || 'None'}</div>
                        <div>NetSuite ID: {solution?.netsuiteInternalId || 'None'}</div>
                        <div>Can import: {canImportFromNetSuite() ? 'Yes' : 'No'}</div>
                        <div>ReadOnly: {readOnly ? 'Yes' : 'No'}</div>
                        {solution && (
                          <div className="mt-2 p-2 bg-white border rounded">
                            <div><strong>Full Solution Object:</strong></div>
                            <pre className="text-xs overflow-auto max-h-32">
                              {JSON.stringify(solution, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!readOnly && canImportFromNetSuite() && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-blue-600" />
                          <div>
                            <span className="text-sm font-medium text-blue-800">NetSuite Integration Available</span>
                            <p className="text-xs text-blue-600 mt-1">
                              Import BOM components for "{solution.displayName}"
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowNetSuiteImport(true)}
                          className="border-blue-300 text-blue-700 hover:bg-blue-100"
                        >
                          <Zap className="h-3 w-3 mr-1" />
                          Import BOM
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {rows.map((row, index) => (
                      <ComponentRow
                        key={index}
                        row={row}
                        index={index}
                        onChange={updateRow}
                        onRemove={remRow}
                        readOnly={readOnly}
                      />
                    ))}

                    {!readOnly && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addRow}
                        className="w-full border-dashed border-slate-300 dark:border-slate-600 hover:border-primary/50 hover:bg-primary/5"
                      >
                        <Plus size={16} className="mr-2" />
                        Add component
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Footer */}
            {!readOnly && (
              <div className="p-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button 
                  className="w-full" 
                  disabled={saving} 
                  onClick={save}
                  size="lg"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Saving changes...
                    </>
                  ) : (
                    'Save changes'
                  )}
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Simplified NetSuite BOM Import Dialog */}
      <SimpleNetSuiteBOMImport
        open={showNetSuiteImport}
        onClose={() => setShowNetSuiteImport(false)}
        onImport={handleNetSuiteImport}
        solution={solution}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Batch
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this batch? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {/* File details outside of AlertDialogDescription */}
          <div className="space-y-3 px-6">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded border">
              <div className="text-sm font-medium">{file.fileName}</div>
              {file.runNumber && (
                <div className="text-xs text-slate-600 dark:text-slate-400">Run {file.runNumber}</div>
              )}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              The original file will remain unchanged. Only this batch copy will be deleted.
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteBatch}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleting ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={16} className="mr-2" />
                  Delete Batch
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}