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
    if (!chemicalId) return
    try {
      const res = await fetch(`/api/chemicals/${chemicalId}/lots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          LotNumber: formValues.LotNumber,
          Quantity: parseInt(formValues.Quantity, 10) || 0
          // ExpirationDate: formValues.ExpirationDate || null
        })
      })
      if (!res.ok) throw new Error("Failed to add lot")
      const updatedDoc = await res.json()
      onLotAdded(updatedDoc)
      onClose()
    } catch (err) {
      console.error(err)
      alert(err.message)
    }
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
