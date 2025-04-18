"use client"

import React from "react"
import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function AddLotDialog({ open, onClose, productId, onLotAdded }) {
  const [formValues, setFormValues] = React.useState({
    LotNumber: "",
    Quantity: "",
    ExpirationDate: "",
  })
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      // reset fields
      setFormValues({
        LotNumber: "",
        Quantity: "",
        ExpirationDate: "",
      })
    }
  }, [open])

  async function handleSave() {
    if (!productId) return
    setLoading(true)
    try {
      // POST /api/products/[id]/lots
      const res = await fetch(`/api/products/${productId}/lots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          LotNumber: formValues.LotNumber,
          Quantity: parseInt(formValues.Quantity, 10) || 0,
          ExpirationDate: formValues.ExpirationDate || null,
        }),
      })
      if (!res.ok) throw new Error("Failed to add lot")

      const updatedDoc = await res.json() // entire product with new lot
      onLotAdded(updatedDoc)
      onClose()
    } catch (err) {
      console.error(err)
      alert(err.message)
    } finally {
      setLoading(false)
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
          <div>
            <Label>Expiration Date</Label>
            <Input
              name="ExpirationDate"
              type="date"
              value={formValues.ExpirationDate}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onClose(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
