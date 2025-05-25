'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from '@/components/ui/sheet';
import { Button }        from '@/components/ui/button';
import { Input }         from '@/components/ui/input';
import { Textarea }      from '@/components/ui/textarea';
import { ScrollArea }    from '@/components/ui/scroll-area';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { api }           from '../lib/api';

/* ───────── tiny async picker ───────── */
function AsyncSelect({ label, type, value, onChange, disabled = false }) {
    /* state */
    const [opts, setOpts]  = useState([]);
    const [q,    setQ]     = useState(value?.displayName || '');
    const [busy, setBusy]  = useState(false);
    const [open, setOpen]  = useState(false);
  
    /* debounce remote search */
    const timer = useRef(null);
    useEffect(() => {
      if (disabled) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        setBusy(true);
        const res = await fetch(`/api/items?type=${type}&search=${encodeURIComponent(q)}`);
        const { items=[] } = await res.json();
        setOpts(items);
        setBusy(false);
      }, 300);
      return () => clearTimeout(timer.current);
    }, [q, type, disabled]);
  
    /* tidy blur-/hover handling */
    const blurT = useRef(null);
    const closeSoon  = () => { blurT.current = setTimeout(()=>setOpen(false),120); };
    const cancelClose = () => clearTimeout(blurT.current);

  /* already chosen → show pill + remove button */
if (value) {                                  // already chosen ➜ chip + ×
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        <div className="flex items-center gap-2 border rounded px-2 h-9 bg-muted">
          <span className="truncate flex-1 text-sm">{value.displayName}</span>
          {!disabled && (
            <Button size="icon" variant="ghost" onClick={()=>onChange(null)} title="Remove">
              ×
            </Button>
          )}
        </div>
      </div>
    );
  }

  /* still empty ➜ searchable input */
  return (
    <div className="space-y-1 relative">
      <p className="text-sm font-medium">{label}</p>
      <Input
        placeholder={disabled ? 'No value set' : `Search ${label.toLowerCase()}…`}
        value={q}
        onFocus={disabled ? undefined : ()=>setOpen(true)}
        onBlur={disabled ? undefined : closeSoon}
        onChange={disabled ? undefined : (e=>setQ(e.target.value))}
        disabled={disabled}
      />

      {open && !disabled && (
        <ScrollArea
          className="absolute z-50 mt-1 max-h-48 w-full border rounded bg-white shadow"
          onMouseEnter={cancelClose}
          onMouseLeave={closeSoon}
        >
          {busy && <p className="p-2 text-xs">Loading…</p>}
          {!busy && opts.length===0 && <p className="p-2 text-xs">No results</p>}
          {!busy && opts.map(it=>(
            <div key={it._id}
                 onClick={()=>{ onChange(it); setQ(it.displayName); setOpen(false); }}
                 className="px-2 py-1 text-sm cursor-pointer hover:bg-muted">
              {it.displayName} ({it.sku})
            </div>
          ))}
        </ScrollArea>
      )}
    </div>
  );
}

/* ───────── main drawer ───────── */
export default function FileMetaDrawer({ file, open, onOpenChange, onSaved, readOnly = false }) {
  const [desc,     setDesc]     = useState('');
  const [product,  setProduct]  = useState(null);
  const [solution, setSolution] = useState(null);
  const [rows,     setRows]     = useState([]);
  const [outQty,   setOutQty]   = useState('');
  const [outUnit,  setOutUnit]  = useState('mL');
  const [saving,   setSaving]   = useState(false);

  /* hydrate form */
  useEffect(() => {
    if (!file) return;
    
    console.log('File data in drawer:', file);
    
    // Handle both original files and batches
    const data = file.snapshot || file; // Use snapshot data for batches, direct data for originals
    
    console.log('Data being used:', data);
    
    setDesc   (data.description   || '');
    setProduct(data.productRef    || null);
    setSolution(data.solutionRef  || null);
    setOutQty (data.recipeQty     ?? '');
    setOutUnit(data.recipeUnit    ?? 'mL');
    
    // Handle components with better error checking
    if (data.components?.length) {
      console.log('Components:', data.components);
      setRows(
        data.components.map((c, index) => {
          console.log(`Component ${index}:`, c);
          
          // Handle different data structures
          let item = null;
          if (c.itemId) {
            if (typeof c.itemId === 'object' && c.itemId._id) {
              // Populated reference
              item = {
                _id: c.itemId._id,
                displayName: c.itemId.displayName || 'Unknown Item',
                sku: c.itemId.sku || ''
              };
            } else {
              // Just an ID
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

  const addRow = ()  => setRows(r => [...r, { item:null, qty:'', unit:'g' }]);
  const remRow = i   => setRows(r => r.filter((_,ix) => ix !== i));

  const save = async () => {
    if (!file || readOnly) return;
    setSaving(true);
    await api.updateFileMeta(file._id, {
      description : desc,
      productRef  : product ?._id  || null,
      solutionRef : solution?._id || null,
      recipeQty   : outQty ? Number(outQty) : null,
      recipeUnit  : outUnit,
      components  : rows
        .filter(r => r.item && r.qty)
        .map(r => ({
          itemId : r.item._id,
          amount : Number(r.qty),
          unit   : r.unit || 'g'
        }))
    });
    setSaving(false);
    onSaved?.();
    onOpenChange(false);
  };

  if (!file) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[460px]">
        <SheetHeader>
          <SheetTitle>
            {readOnly ? 'View file properties' : 'Edit file properties'}
          </SheetTitle>
          {readOnly && (
            <p className="text-sm text-muted-foreground">
              Properties are inherited from the original file and cannot be edited in batch copies.
            </p>
          )}
        </SheetHeader>

        <ScrollArea className="h-[70vh] pr-2 space-y-4">

          <div className="space-y-1">
            <p className="text-sm font-medium">File name</p>
            <Input value={file.fileName} disabled />
          </div>

          {file.runNumber && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Run Number</p>
              <Input value={`Run ${file.runNumber}`} disabled />
            </div>
          )}

          <div className="space-y-1">
            <p className="text-sm font-medium">Description</p>
            <Textarea 
              rows={3} 
              value={desc} 
              onChange={e=>setDesc(e.target.value)}
              disabled={readOnly}
            />
          </div>

          <AsyncSelect 
            label="Solution produced" 
            type="solution"
            value={solution} 
            onChange={readOnly ? undefined : setSolution}
            disabled={readOnly}
          />
          <AsyncSelect 
            label="Product (for order)" 
            type="product"
            value={product}  
            onChange={readOnly ? undefined : setProduct}
            disabled={readOnly}
          />

          <div className="space-y-1">
            <p className="text-sm font-medium">Recipe output</p>
            <div className="flex gap-2">
              <Input 
                className="w-24" 
                type="number" 
                placeholder="Qty"
                value={outQty} 
                onChange={e=>setOutQty(e.target.value)}
                disabled={readOnly}
              />
              <Input 
                className="w-24" 
                placeholder="Unit"
                value={outUnit} 
                onChange={e=>setOutUnit(e.target.value)}
                disabled={readOnly}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Components used</p>

            {rows.map((r,i)=>(
              <div key={i} className="flex items-center gap-2">
                <AsyncSelect 
                  label="" 
                  type="chemical" 
                  value={r.item}
                  onChange={readOnly ? undefined : (item=>{
                    const v=[...rows]; v[i].item=item; setRows(v);
                  })}
                  disabled={readOnly}
                />
                <Input 
                  className="w-20" 
                  type="number" 
                  placeholder="Qty"
                  value={r.qty}
                  onChange={readOnly ? undefined : (e=>{
                    const v=[...rows]; v[i].qty=e.target.value; setRows(v);
                  })}
                  disabled={readOnly}
                />
                <Input 
                  className="w-16" 
                  placeholder="Unit"
                  value={r.unit}
                  onChange={readOnly ? undefined : (e=>{
                    const v=[...rows]; v[i].unit=e.target.value; setRows(v);
                  })}
                  disabled={readOnly}
                />
                {!readOnly && (
                  <Button size="icon" variant="ghost" onClick={()=>remRow(i)}>
                    <Trash2 size={14}/>
                  </Button>
                )}
              </div>
            ))}

            {!readOnly && (
              <Button variant="ghost" size="sm" onClick={addRow}>
                <Plus size={14}/> Add component
              </Button>
            )}
          </div>
        </ScrollArea>

        {!readOnly && (
          <Button className="mt-6 w-full" disabled={saving} onClick={save}>
            {saving ? <Loader2 size={16} className="animate-spin"/> : 'Save changes'}
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}