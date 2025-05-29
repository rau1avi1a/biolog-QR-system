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
  Loader2, 
  Plus, 
  Trash2, 
  Search, 
  X, 
  Package, 
  FlaskRound, 
  Beaker,
  Hash,
  FileText
} from 'lucide-react';
import { api }           from '../lib/api';

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
      const res = await fetch(`/api/items?type=${type}&search=${encodeURIComponent(q)}`);
      const { items = [] } = await res.json();
      setOpts(items);
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
                  onClick={() => { onChange(it); setQ(it.displayName); setOpen(false); }}
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 last:border-b-0 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
                      {it.displayName}
                    </div>
                    {it.sku && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        SKU: {it.sku}
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
        </div>
      </CardContent>
    </Card>
  );
}

/* ───────── Main drawer with enhanced styling ───────── */
export default function FileMetaDrawer({ file, open, onOpenChange, onSaved, readOnly = false }) {
  const [product, setProduct] = useState(null);
  const [solution, setSolution] = useState(null);
  const [rows, setRows] = useState([]);
  const [outQty, setOutQty] = useState('');
  const [outUnit, setOutUnit] = useState('mL');
  const [saving, setSaving] = useState(false);

  /* Hydrate form */
  useEffect(() => {
    if (!file) return;

    const data = file.snapshot || file;

    setProduct(data.productRef || null);
    setSolution(data.solutionRef || null);
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
            unit: c.unit
          };
        })
      );
    } else {
      setRows([{ item: null, qty: '', unit: 'g' }]);
    }
  }, [file]);

  const addRow = () => setRows(r => [...r, { item: null, qty: '', unit: 'g' }]);
  const remRow = i => setRows(r => r.filter((_, ix) => ix !== i));

  const updateRow = (index, field, value) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
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
            unit: r.unit || 'g'
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

  if (!file) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[500px] p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="p-6 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText size={18} className="text-primary" />
              </div>
              <div>
                <SheetTitle className="text-lg">
                  {readOnly ? 'File Properties' : 'Edit Properties'}
                </SheetTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {file.fileName}
                </p>
              </div>
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
  );
}