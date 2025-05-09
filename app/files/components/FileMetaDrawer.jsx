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
function AsyncSelect({ label, type, value, onChange }) {
    /* state */
    const [opts, setOpts]  = useState([]);
    const [q,    setQ]     = useState(value?.displayName || '');
    const [busy, setBusy]  = useState(false);
    const [open, setOpen]  = useState(false);
  
    /* debounce remote search */
    const timer = useRef(null);
    useEffect(() => {
      clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        setBusy(true);
        const res = await fetch(`/api/items?type=${type}&search=${encodeURIComponent(q)}`);
        const { items=[] } = await res.json();
        setOpts(items);
        setBusy(false);
      }, 300);
      return () => clearTimeout(timer.current);
    }, [q, type]);
  
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
          <Button size="icon" variant="ghost" onClick={()=>onChange(null)} title="Remove">
            ×
          </Button>
        </div>
      </div>
    );
  }

  /* still empty ➜ searchable input */
  return (
    <div className="space-y-1 relative">
      <p className="text-sm font-medium">{label}</p>
      <Input
        placeholder={`Search ${label.toLowerCase()}…`}
        value={q}
        onFocus={()=>setOpen(true)}
        onBlur={closeSoon}
        onChange={e=>setQ(e.target.value)}
      />

      {open && (
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
export default function FileMetaDrawer({ file, open, onOpenChange, onSaved }) {
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
    setDesc   (file.description   || '');
    setProduct(file.productRef    || null);
    setSolution(file.solutionRef  || null);
    setOutQty (file.recipeQty     ?? '');
    setOutUnit(file.recipeUnit    ?? 'mL');
    setRows(
      file.components?.length
        ? file.components.map(c => ({
            item : { _id:c.itemId, displayName:c.name ?? '', sku:'' },
            qty  : c.amount,
            unit : c.unit
          }))
        : [{ item:null, qty:'', unit:'g' }]
    );
  }, [file]);

  const addRow = ()  => setRows(r => [...r, { item:null, qty:'', unit:'g' }]);
  const remRow = i   => setRows(r => r.filter((_,ix) => ix !== i));

  const save = async () => {
    if (!file) return;
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
        <SheetHeader><SheetTitle>Edit file properties</SheetTitle></SheetHeader>

        <ScrollArea className="h-[70vh] pr-2 space-y-4">

          <div className="space-y-1">
            <p className="text-sm font-medium">File name</p>
            <Input value={file.fileName} disabled />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Description</p>
            <Textarea rows={3} value={desc} onChange={e=>setDesc(e.target.value)}/>
          </div>

          <AsyncSelect label="Solution produced" type="solution"
                       value={solution} onChange={setSolution}/>
          <AsyncSelect label="Product (for order)" type="product"
                       value={product}  onChange={setProduct}/>

          <div className="space-y-1">
            <p className="text-sm font-medium">Recipe output</p>
            <div className="flex gap-2">
              <Input className="w-24" type="number" placeholder="Qty"
                     value={outQty} onChange={e=>setOutQty(e.target.value)}/>
              <Input className="w-24" placeholder="Unit"
                     value={outUnit} onChange={e=>setOutUnit(e.target.value)}/>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Components used</p>

            {rows.map((r,i)=>(
              <div key={i} className="flex items-center gap-2">
                <AsyncSelect label="" type="chemical" value={r.item}
                             onChange={item=>{
                               const v=[...rows]; v[i].item=item; setRows(v);
                             }}/>
                <Input className="w-20" type="number" placeholder="Qty"
                       value={r.qty}
                       onChange={e=>{
                         const v=[...rows]; v[i].qty=e.target.value; setRows(v);
                       }}/>
                <Input className="w-16" placeholder="Unit"
                       value={r.unit}
                       onChange={e=>{
                         const v=[...rows]; v[i].unit=e.target.value; setRows(v);
                       }}/>
                <Button size="icon" variant="ghost" onClick={()=>remRow(i)}>
                  <Trash2 size={14}/>
                </Button>
              </div>
            ))}

            <Button variant="ghost" size="sm" onClick={addRow}>
              <Plus size={14}/> Add component
            </Button>
          </div>
        </ScrollArea>

        <Button className="mt-6 w-full" disabled={saving} onClick={save}>
          {saving ? <Loader2 size={16} className="animate-spin"/> : 'Save changes'}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
