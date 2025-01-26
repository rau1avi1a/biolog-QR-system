"use client"

import React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function EditParentDialog({ open, onClose, product, onSaved, onDeleted }) {
  const [formValues, setFormValues] = React.useState({})

  React.useEffect(() => {
    if (product) {
      setFormValues({
        CatalogNumber: product.CatalogNumber,
        ProductName: product.ProductName,
      })
    }
  }, [product])

  if (!product) return null

  async function handleSave() {
    try {
      const res = await fetch(`/api/products/${product._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues),
      })
      if (!res.ok) throw new Error("Update failed")
      const updatedDoc = await res.json()
      onSaved(updatedDoc)
      onClose()
    } catch (err) {
      console.error(err)
      alert("Failed to update product")
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      const res = await fetch(`/api/products/${product._id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
  
      onDeleted(product._id); // Notify the parent of the deletion
      onClose(); // Close the dialog
    } catch (err) {
      console.error(err);
      alert("Failed to delete product");
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label>Catalog Number</Label>
            <Input
              value={formValues.CatalogNumber || ""}
              onChange={(e) =>
                setFormValues({ ...formValues, CatalogNumber: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Product Name</Label>
            <Input
              value={formValues.ProductName || ""}
              onChange={(e) =>
                setFormValues({ ...formValues, ProductName: e.target.value })
              }
            />
          </div>
        </div>

        <div className="flex justify-between items-center mt-4">
          {/* Left: Delete button */}
          <Button variant="destructive" onClick={handleDelete}>
            Delete
          </Button>

          {/* Right: Save and Cancel buttons */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
