"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { QRCodeSVG } from "qrcode.react"

export default function ChemicalDetailClient({ initialData }) {
  const [item, setItem] = React.useState(initialData)
  const [amount, setAmount] = React.useState("")

  const [editOpen, setEditOpen] = React.useState(false)
  const [formValues, setFormValues] = React.useState({ ...initialData })

  // For hydration mismatch fix:
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Extract fields from item
  const {
    ChemicalName,
    BiologNumber,
    LotNumber,
    CASNumber,
    Location,
    Quantity,
  } = item

  // Build detail URL for QR code
  let detailUrl = "https://example.com"
  if (typeof window !== "undefined") {
    detailUrl = `${window.location.origin}/inventory/chemical/${item._id}`
  }

  return (
    <div className="space-y-4">
      {/* Display dynamic fields in the client */}
      <div className="space-y-1">
        <p className="text-lg font-semibold">{ChemicalName}</p>
        {BiologNumber && <p>Biolog Number: {BiologNumber}</p>}
        {LotNumber && <p>Lot Number: {LotNumber}</p>}
        {CASNumber && <p>CAS Number: {CASNumber}</p>}
        {Location && <p>Location: {Location}</p>}
        <p>Quantity: {Quantity ?? 0}</p>
      </div>

      {/* Quantity input */}
      <div className="flex items-center gap-2">
        <Label>Change Quantity:</Label>
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-20"
        />
        <Button onClick={handleApplyQuantity}>Apply</Button>
      </div>

      {/* Edit popup button */}
      <Button variant="outline" onClick={() => openEditDialog()}>
        Edit
      </Button>

      {/* Conditionally render QR code if mounted */}
      {mounted && (
        <div className="flex flex-col items-center mt-4">
          <QRCodeSVG
            value={detailUrl}
            size={128}
            bgColor="#ffffff"
            fgColor="#000000"
            level="L"
          />
          <p className="text-sm mt-2">Scan to view this chemical</p>
        </div>
      )}

      {/* The Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Chemical</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Chemical Name</Label>
              <Input
                name="ChemicalName"
                value={formValues.ChemicalName || ""}
                onChange={handleFormChange}
              />
            </div>
            <div>
              <Label>Biolog Number</Label>
              <Input
                name="BiologNumber"
                value={formValues.BiologNumber || ""}
                onChange={handleFormChange}
              />
            </div>
            <div>
              <Label>Lot Number</Label>
              <Input
                name="LotNumber"
                value={formValues.LotNumber || ""}
                onChange={handleFormChange}
              />
            </div>
            <div>
              <Label>CAS Number</Label>
              <Input
                name="CASNumber"
                value={formValues.CASNumber || ""}
                onChange={handleFormChange}
              />
            </div>
            <div>
              <Label>Location</Label>
              <Input
                name="Location"
                value={formValues.Location || ""}
                onChange={handleFormChange}
              />
            </div>
            <div>
              <Label>Quantity</Label>
              <Input
                name="Quantity"
                type="number"
                value={formValues.Quantity ?? 0}
                onChange={handleFormChange}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )

  // Implementation details
  function openEditDialog() {
    setFormValues(item)
    setEditOpen(true)
  }

  function handleFormChange(e) {
    setFormValues({ ...formValues, [e.target.name]: e.target.value })
  }

  async function handleSave() {
    try {
      const res = await fetch(`/api/chemicals/${item._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues),
      })
      if (!res.ok) throw new Error("Failed to update item")
      const updatedDoc = await res.json()
      setItem(updatedDoc)
      setEditOpen(false)
    } catch (err) {
      console.error(err)
    }
  }

  async function handleApplyQuantity() {
    const val = parseInt(amount, 10)
    if (isNaN(val)) {
      alert("Please enter a valid number")
      return
    }
    try {
      const updated = { ...item, Quantity: (item.Quantity ?? 0) + val }
      const res = await fetch(`/api/chemicals/${item._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      })
      if (!res.ok) throw new Error("Failed to update quantity")
      const updatedDoc = await res.json()
      setItem(updatedDoc)
      setAmount("")
    } catch (err) {
      console.error(err)
    }
  }
}
