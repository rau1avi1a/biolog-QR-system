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

export default function ChemAddLotDialog({
  open,
  onClose,
  chemicalId,
  onLotAdded
}) {
  const [formValues, setFormValues] = React.useState({
    LotNumber: "",
    Quantity: ""
    // ExpirationDate: "" // if you want
  })

  React.useEffect(() => {
    if (open) {
      setFormValues({
        LotNumber: "",
        Quantity: ""
      })
    }
  }, [open])

async function handleSave() {
  if (!chemicalId) return;
  const lotNumber = formValues.LotNumber.trim();
  const qty       = parseFloat(formValues.Quantity);
  if (!lotNumber || isNaN(qty) || qty <= 0) {
    alert("Enter a valid lot number & quantity");
    return;
  }

  // POST to your unified transaction route
  const res = await fetch(
    `/api/items/${chemicalId}/lots/${encodeURIComponent(
      lotNumber
    )}/transactions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qty,                                      // positive = add
        memo: `Created lot ${lotNumber} with ${qty}`, 
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to add lot");
  }

  // Pull back the updated item, remap, and update your table
  const { item }   = await res.json();
  const updatedChem = mapItemToChemical(item);
  onLotAdded(updatedChem);  // pass the whole item back, or just the new lot
  onClose();
}

  function handleChange(e) {
    setFormValues({ ...formValues, [e.target.name]: e.target.value })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Lot</DialogTitle>
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
          {/* If you want expiration:
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

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onClose(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
