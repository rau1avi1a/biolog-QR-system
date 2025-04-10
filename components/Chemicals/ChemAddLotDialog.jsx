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
      // First validate the inputs
      if (!formValues.LotNumber.trim()) {
        alert("Please enter a Lot Number");
        return;
      }
      
      if (!formValues.Quantity || isNaN(parseFloat(formValues.Quantity)) || parseFloat(formValues.Quantity) <= 0) {
        alert("Please enter a valid Quantity");
        return;
      }
      
      // Clean the chemical ID by removing any potential prefix
      const cleanChemicalId = chemicalId.replace(/^chem/, '');
      
      console.log('Adding new lot:', {
        endpoint: `/api/chemicals/${cleanChemicalId}/lots`,
        data: {
          LotNumber: formValues.LotNumber,
          Quantity: parseFloat(formValues.Quantity) || 0
        }
      });
      
      const res = await fetch(`/api/chemicals/${cleanChemicalId}/lots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          LotNumber: formValues.LotNumber,
          Quantity: parseFloat(formValues.Quantity) || 0
          // ExpirationDate: formValues.ExpirationDate || null
        })
      })
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to add lot");
      }
      
      const updatedDoc = await res.json();
      onLotAdded(updatedDoc);
      onClose();
    } catch (err) {
      console.error("Error adding lot:", err);
      alert(err.message || "Failed to add lot. Please try again.");
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
