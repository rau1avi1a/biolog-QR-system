"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export function InventoryDialog({
  isOpen,
  onClose,
  isEditMode,
  formValues,
  setFormValues,
  activeSection, // "product" or "chemical"
  onSave,
  onDelete,
}) {
  const handleChange = (e) => {
    setFormValues({ ...formValues, [e.target.name]: e.target.value })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit" : "Add"}{" "}
            {activeSection === "product" ? "Product" : "Chemical"}
          </DialogTitle>
        </DialogHeader>

        {/* If product, show product fields, else show chemical fields */}
        {activeSection === "product" ? (
          <div className="space-y-4">
            <div>
              <Label>Catalog Number</Label>
              <Input
                name="CatalogNumber"
                value={formValues.CatalogNumber || ""}
                onChange={handleChange}
                placeholder="e.g. 1030"
              />
            </div>
            <div>
              <Label>Product Name</Label>
              <Input
                name="ProductName"
                value={formValues.ProductName || ""}
                onChange={handleChange}
                placeholder="e.g. Gen III"
              />
            </div>
            <div>
              <Label>Lot Number</Label>
              <Input
                name="LotNumber"
                value={formValues.LotNumber || ""}
                onChange={handleChange}
                placeholder="e.g. 3910293"
              />
            </div>
            <div>
              <Label>Expiration Date</Label>
              <Input
                name="ExpirationDate"
                value={formValues.ExpirationDate || ""}
                onChange={handleChange}
                placeholder="e.g. 12 Dec 2024"
              />
            </div>
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                name="Quantity"
                value={formValues.Quantity || ""}
                onChange={handleChange}
                placeholder="e.g. 1200"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Biolog Number</Label>
              <Input
                name="BiologNumber"
                value={formValues.BiologNumber || ""}
                onChange={handleChange}
                placeholder="24-000001"
              />
            </div>
            <div>
              <Label>Chemical Name</Label>
              <Input
                name="ChemicalName"
                value={formValues.ChemicalName || ""}
                onChange={handleChange}
                placeholder="e.g. Acetic Acid"
              />
            </div>
            <div>
              <Label>Lot Number</Label>
              <Input
                name="LotNumber"
                value={formValues.LotNumber || ""}
                onChange={handleChange}
                placeholder="e.g. AC-2023"
              />
            </div>
            <div>
              <Label>CAS Number</Label>
              <Input
                name="CASNumber"
                value={formValues.CASNumber || ""}
                onChange={handleChange}
                placeholder="e.g. 63-1-32"
              />
            </div>
            <div>
              <Label>Location</Label>
              <Input
                name="Location"
                value={formValues.Location || ""}
                onChange={handleChange}
                placeholder="e.g. Room Temperature"
              />
            </div>
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                name="Quantity"
                value={formValues.Quantity || ""}
                onChange={handleChange}
                placeholder="e.g. 50"
              />
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-between items-center">
          {/* Show Delete if editing */}
          {isEditMode ? (
            <Button
              variant="destructive"
              onClick={() => onDelete && onDelete()}
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onClose(false)}>
              Cancel
            </Button>
            <Button onClick={onSave}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
