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

export default function ChemEditParentDialog({
  open,
  onClose,
  chemical,
  onSaved
}) {
  const [formValues, setFormValues] = React.useState({})

  React.useEffect(() => {
    if (chemical) {
      setFormValues({
        BiologNumber: chemical.BiologNumber || "",
        ChemicalName: chemical.ChemicalName || "",
        CASNumber: chemical.CASNumber || "",
        Location: chemical.Location || ""
      })
    }
  }, [chemical])

  if (!chemical) return null

  async function handleSave() {
    try {
      const res = await fetch(`/api/chemicals/${chemical._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues)
      })
      if (!res.ok) throw new Error("Failed to update chemical")
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
          <DialogTitle>Edit Chemical</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label>Biolog Number</Label>
            <Input
              name="BiologNumber"
              value={formValues.BiologNumber}
              onChange={handleChange}
            />
          </div>
          <div>
            <Label>Chemical Name</Label>
            <Input
              name="ChemicalName"
              value={formValues.ChemicalName}
              onChange={handleChange}
            />
          </div>
          <div>
            <Label>CAS Number</Label>
            <Input
              name="CASNumber"
              value={formValues.CASNumber}
              onChange={handleChange}
            />
          </div>
          <div>
            <Label>Location</Label>
            <Input
              name="Location"
              value={formValues.Location}
              onChange={handleChange}
            />
          </div>
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
