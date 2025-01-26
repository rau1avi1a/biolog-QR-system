"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function EditLotDialog({
  open,
  onClose,
  productId,
  lot,
  onSaved,
}) {
  const [formValues, setFormValues] = React.useState({});
  const [isAvailable, setIsAvailable] = React.useState(false);

  React.useEffect(() => {
    if (lot) {
      const expirationDate = lot.ExpirationDate
        ? new Date(lot.ExpirationDate).toISOString().split("T")[0] // Format `ExpirationDate` to YYYY-MM-DD
        : lot.calculatedExpirationDate
        ? new Date(lot.calculatedExpirationDate).toISOString().split("T")[0] // Format `calculatedExpirationDate` to YYYY-MM-DD
        : ""; // Default to empty if neither exists

      setFormValues({
        LotNumber: lot.LotNumber || "",
        Quantity: lot.Quantity || 0,
        ExpirationDate: expirationDate,
      });
      setIsAvailable(lot.isAvailable ?? false);
    }
  }, [lot]);

  if (!lot) return null;

  async function handleSave() {
    if (!productId || !lot._id) return;
    try {
      const res = await fetch(`/api/products/${productId}/lots/${lot._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          LotNumber: formValues.LotNumber,
          Quantity: parseInt(formValues.Quantity, 10),
          ExpirationDate: formValues.ExpirationDate || null,
          isAvailable, // Include isAvailable
        }),
      });
      if (!res.ok) throw new Error("Failed to update lot");
      const updatedDoc = await res.json();
      onSaved(updatedDoc);
      onClose();
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }

  async function handleDelete() {
    if (!productId || !lot._id) return;
    if (!confirm("Are you sure you want to delete this lot?")) return;

    try {
      const res = await fetch(`/api/products/${productId}/lots/${lot._id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete lot");

      const updatedDoc = await res.json();
      onSaved(updatedDoc.product);
      onClose();
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }

  function handleChange(e) {
    setFormValues({ ...formValues, [e.target.name]: e.target.value });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader className="flex justify-between items-center">
          <DialogTitle>Edit Lot</DialogTitle>
          {/* Availability toggle */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Availability:</span>
            <div className="flex gap-2">
              <button
                className={`px-4 py-2 rounded font-semibold ${
                  isAvailable
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
                onClick={() => setIsAvailable(true)}
              >
                Available
              </button>
              <button
                className={`px-4 py-2 rounded font-semibold ${
                  !isAvailable
                    ? "bg-red-500 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
                onClick={() => setIsAvailable(false)}
              >
                Unavailable
              </button>
            </div>
          </div>
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

        <div className="flex justify-between items-center mt-4">
          {/* Left: Delete button */}
          <Button variant="destructive" onClick={handleDelete}>
            Delete
          </Button>

          <div className="flex gap-2">
            {/* Middle: Cancel */}
            <Button variant="outline" onClick={() => onClose(false)}>
              Cancel
            </Button>
            {/* Right: Save */}
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
