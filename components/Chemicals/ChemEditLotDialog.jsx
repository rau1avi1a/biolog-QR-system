"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { mapItemToChemical } from "../../utils/mapItemToChemical"

export default function ChemEditLotDialog({
  open,
  onClose,
  chemicalId,
  lot,
  onSaved
}) {
  const [formValues, setFormValues] = React.useState({})

  React.useEffect(() => {
    if (lot) {
      setFormValues({
        LotNumber: lot.LotNumber || "",
        Quantity: lot.Quantity || 0
        // ExpirationDate: lot.ExpirationDate || ""
      })
    }
  }, [lot])

  if (!lot) return null

  async function handleSave() {
    if (!chemicalId || !lot) return;
    
    const newQty = parseFloat(formValues.Quantity);
    const delta  = newQty - lot.Quantity;
    const lotNumber = lot.LotNumber;
    
    if (isNaN(newQty)) {
      alert("Enter a valid quantity");
      return;
    }
    
    try {
      const res = await fetch(
        `/api/items/${chemicalId}/lots/${encodeURIComponent(lotNumber)}/transactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qty: delta,
            memo: `Adjusted lot ${lotNumber} from ${lot.Quantity} to ${newQty}`
          })
        }
      );
      if (!res.ok) throw new Error("Failed to adjust lot");
      
      const { item } = await res.json();
      onSaved(mapItemToChemical(item));
      onClose();
      
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }

async function handleDelete() {
  if (!chemicalId || !lot) return;
  if (!confirm(`Delete lot ${lot.LotNumber}?`)) return;
  
  try {
    const res = await fetch(
      `/api/items/${chemicalId}/lots/${encodeURIComponent(lot.LotNumber)}`,
      { method: "DELETE" }
    );
    if (!res.ok) throw new Error("Failed to delete lot");
    
    const { item } = await res.json();
    onSaved(mapItemToChemical(item));
    onClose();
    
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

  function handleChange(e) {
    setFormValues({ ...formValues, [e.target.name]: e.target.value })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Lot</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label>Lot Number</Label>
            <Input
              name="LotNumber"
              value={formValues.LotNumber}
              onChange={handleChange}
            />
          </div>
          <div>
            <Label>Quantity</Label>
            <Input
              name="Quantity"
              type="number"
              value={formValues.Quantity}
              onChange={handleChange}
            />
          </div>
          {/* if you want expiration date
          <div>
            <Label>Expiration Date</Label>
            <Input
              name="ExpirationDate"
              type="date"
              value={formValues.ExpirationDate}
              onChange={handleChange}
            />
          </div>
          */}
        </div>

        <div className="flex justify-between items-center mt-4">
          <Button variant="destructive" onClick={handleDelete}>
            Delete
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onClose(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
