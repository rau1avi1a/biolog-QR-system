"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// section = "product" or "chemical"
export default function AddParentDialog({ open, onClose, section, onAdded }) {
  const [formValues, setFormValues] = React.useState({})
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      // reset form
      setFormValues({})
    }
  }, [open])

  async function handleSave() {
    setLoading(true)
    try {
      // If product: { CatalogNumber, ProductName }
      // If chemical: { BiologNumber, ChemicalName, etc. }
      const url = section === "product" ? "/api/products" : "/api/chemicals"

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues),
      })

      if (!res.ok) throw new Error("Failed to create parent item")
      const newItem = await res.json()
      onAdded(newItem)
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

  // We can show different fields depending on "section"
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Add {section === "product" ? "Product" : "Chemical"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {section === "product" ? (
            <>
              <div>
                <Label>Catalog Number</Label>
                <Input
                  name="CatalogNumber"
                  value={formValues.CatalogNumber || ""}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label>Product Name</Label>
                <Input
                  name="ProductName"
                  value={formValues.ProductName || ""}
                  onChange={handleChange}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <Label>Biolog Number</Label>
                <Input
                  name="BiologNumber"
                  value={formValues.BiologNumber || ""}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label>Chemical Name</Label>
                <Input
                  name="ChemicalName"
                  value={formValues.ChemicalName || ""}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label>CAS Number</Label>
                <Input
                  name="CASNumber"
                  value={formValues.CASNumber || ""}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  name="Location"
                  value={formValues.Location || ""}
                  onChange={handleChange}
                />
              </div>
            </>
          )}
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
