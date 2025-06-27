'use client';

import { useState, useEffect } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from '@/components/ui/shadcn/components/sheet';
import { Button } from '@/components/ui/shadcn/components/button';
import { Input  } from '@/components/ui/shadcn/components/input';
import { ScrollArea } from '@/components/ui/shadcn/components/scroll-area';
import { Loader2, Plus, Trash2 } from 'lucide-react';

/* quick fetch of all items for BOM picking */
const useAllItems = () => {
  const [items, setItems] = useState([]);
  
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch('/api/items');
        if (response.ok) {
          const data = await response.json();
          setItems(data.items || []);
        }
      } catch (error) {
        // Silently handle error - items will remain empty array
        setItems([]);
      }
    };
    
    fetchItems();
  }, []);
  
  return items;
};

export default function CreateItemDrawer({ open, onOpenChange, type }) {
  const isChem = type === 'chemical';
  const items  = useAllItems();

  const [sku,  setSku ] = useState('');
  const [name, setName] = useState('');
  const [qty,  setQty ] = useState('');           // ← starting quantity
  const [bom,  setBom ] = useState([{ componentId: '', quantity: '' }]);
  const [busy, setBusy] = useState(false);

  const addRow    = () => setBom([...bom, { componentId: '', quantity: '' }]);
  const removeRow = (idx) => setBom(bom.filter((_, i) => i !== idx));

  const save = async () => {
    setBusy(true);
    try {
      const response = await fetch('/api/items', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          itemType    : type,
          sku,
          displayName : name,
          qtyOnHand   : qty ? Number(qty) : 0,
          bom         : isChem ? [] : bom.filter(r => r.componentId && r.quantity),
        }),
      });
      
      if (response.ok) {
        onOpenChange(false);
        window.location.reload();
      }
    } catch (error) {
      // Handle error silently for now
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[430px]">
        <SheetHeader>
          <SheetTitle>New {type}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4 pr-2">
          {/* SKU */}
          <div className="space-y-1">
            <p className="text-sm font-medium">SKU</p>
            <Input value={sku} onChange={e => setSku(e.target.value)} />
          </div>

          {/* Display name */}
          <div className="space-y-1">
            <p className="text-sm font-medium">Display name</p>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>

          {/* Starting quantity */}
          <div className="space-y-1">
            <p className="text-sm font-medium">Starting quantity</p>
            <Input
              type="number"
              value={qty}
              onChange={e => setQty(e.target.value)}
              placeholder="0"
              className="w-40"
            />
          </div>

          {/* BOM for solutions / products */}
          {!isChem && (
            <div className="space-y-3">
              <p className="text-sm font-medium">BOM components</p>
              <ScrollArea className="h-40 border rounded pr-2">
                {bom.map((row, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <select
                      value={row.componentId}
                      onChange={e => {
                        const v = [...bom];
                        v[i].componentId = e.target.value;
                        setBom(v);
                      }}
                      className="flex-1 border rounded px-2 py-1 text-sm"
                    >
                      <option value="">Choose…</option>
                      {items.map(it => (
                        <option key={it._id} value={it._id}>
                          {it.displayName} ({it.itemType})
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={row.quantity}
                      onChange={e => {
                        const v = [...bom];
                        v[i].quantity = e.target.value;
                        setBom(v);
                      }}
                      className="w-24"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeRow(i)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={addRow}>
                  <Plus size={14} /> Add row
                </Button>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Save */}
        <Button
          className="mt-6 w-full"
          onClick={save}
          disabled={busy || !sku || !name}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : 'Create'}
        </Button>
      </SheetContent>
    </Sheet>
  );
}