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

// A client component that manages local state, does PUT requests, etc.
export default function ProductDetailClient({ initialData }) {
  // Local item data that can change
  const [item, setItem] = React.useState(initialData)

  // For the user to input how many to add/sub from Quantity
  const [amount, setAmount] = React.useState("")

  // For the Edit pop-up
  const [editOpen, setEditOpen] = React.useState(false)
  const [formValues, setFormValues] = React.useState({ ...initialData })

  // Track if we've mounted, to avoid hydration mismatch from QR code
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Show dynamic fields here (client only)
  const { ProductName, CatalogNumber, LotNumber, ExpirationDate, Quantity } = item

  // Build detail URL for the QR code
  let detailUrl = "https://example.com"
  if (typeof window !== "undefined") {
    detailUrl = `${window.location.origin}/inventory/product/${item._id}`
  }

  return (
    <div className="space-y-4">
      {/* Display fields - purely client side, so we can see updates instantly */}
      <div className="space-y-1">
        <p className="text-lg font-semibold">{ProductName || "No Name"}</p>
        {CatalogNumber && <p>Catalog Number: {CatalogNumber}</p>}
        {LotNumber && <p>Lot Number: {LotNumber}</p>}
        {ExpirationDate && <p>Expiration: {ExpirationDate}</p>}
        <p>Quantity: {Quantity ?? 0}</p>
      </div>

      {/* Quantity input for add/sub */}
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

      {/* Edit pop-up button */}
      <Button variant="outline" onClick={() => openEditDialog()}>
        Edit
      </Button>

      {/* QR code - only render if mounted to avoid SSR path mismatch */}
      {mounted && (
        <div className="flex flex-col items-center mt-4">
          <QRCodeSVG
            value={detailUrl}
            size={128}
            bgColor="#ffffff"
            fgColor="#000000"
            level="L"
          />
          <p className="text-sm mt-2">Scan to view this product</p>
        </div>
      )}

      {/* The Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Product Name</Label>
              <Input
                name="ProductName"
                value={formValues.ProductName || ""}
                onChange={handleFormChange}
              />
            </div>
            <div>
              <Label>Catalog Number</Label>
              <Input
                name="CatalogNumber"
                value={formValues.CatalogNumber || ""}
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
              <Label>Expiration Date</Label>
              <Input
                name="ExpirationDate"
                value={formValues.ExpirationDate || ""}
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
            <Button onClick={handleSave}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )

  // -------------- Implementation Details -------------- //

  function openEditDialog() {
    setFormValues(item)
    setEditOpen(true)
  }

  function handleFormChange(e) {
    setFormValues({ ...formValues, [e.target.name]: e.target.value })
  }

  async function handleSave() {
    try {
      const res = await fetch(`/api/products/${item._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues),
      })
      if (!res.ok) throw new Error("Failed to update item")
      const updatedDoc = await res.json()
      // update local item instantly
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
      const res = await fetch(`/api/products/${item._id}`, {
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
