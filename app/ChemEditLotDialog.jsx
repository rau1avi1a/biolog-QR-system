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
    if (!chemicalId || !lot._id) return
    try {
      const res = await fetch(`/api/chemicals/${chemicalId}/lots/${lot._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          LotNumber: formValues.LotNumber,
          Quantity: parseInt(formValues.Quantity, 10)
          // ExpirationDate: formValues.ExpirationDate
        })
      })
      if (!res.ok) throw new Error("Failed to update lot")
      const updatedDoc = await res.json()
      onSaved(updatedDoc)
      onClose()
    } catch (err) {
      console.error(err)
      alert(err.message)
    }
  }

  async function handleDelete() {
    if (!chemicalId || !lot._id) return
    if (!confirm("Are you sure you want to delete this lot?")) return

    try {
      const res = await fetch(`/api/chemicals/${chemicalId}/lots/${lot._id}`, {
        method: "DELETE"
      })
      if (!res.ok) throw new Error("Failed to delete lot")
      const updatedDoc = await res.json()
      onSaved(updatedDoc)
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
