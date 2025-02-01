"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent as AlertContent,
  AlertDialogHeader as AlertHeader,
  AlertDialogTitle as AlertTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import {
  Toast,
  ToastProvider,
  ToastViewport,
  ToastTitle,
  ToastDescription,
  ToastAction,
} from "@/components/ui/toast";
import EditLotDialog from "@/components/Products/ProductEditLotDialog";
import { cn } from "@/lib/utils";
import { CheckCircle } from "lucide-react"; // Import CheckCircle icon

export default function LotDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [lot, setLot] = useState(null);
  const [product, setProduct] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [transactionType, setTransactionType] = useState("subtract"); // "subtract" or "add"
  const [quantity, setQuantity] = useState("");

  // For the confirmation alert
  const [alertOpen, setAlertOpen] = useState(false);

  // For the toast notification
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastTitle, setToastTitle] = useState("");

  useEffect(() => {
    const fetchLotDetails = async () => {
      if (!params.id || !params.lotId) return;

      try {
        setLoading(true);
        const res = await fetch(`/api/products/${params.id}`);
        if (!res.ok) throw new Error("Failed to fetch product");

        const productData = await res.json();
        const lotData = productData.Lots.find((x) => x._id === params.lotId);

        setProduct(productData);
        setLot(lotData);
      } catch (err) {
        console.error("Error fetching lot details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLotDetails();
  }, [params]);

  // Build the URL for generating QR code
  const lotUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/products/${params.id}/lots/${params.lotId}`
      : `https://example.com/products/${params.id}/lots/${params.lotId}`;

  // Called after successfully editing the lot
  const handleSave = (updatedProduct) => {
    setProduct(updatedProduct);
    const updatedLot = updatedProduct.Lots.find((l) => l._id === lot._id);
    setLot(updatedLot);
    setEditOpen(false);
    setToastTitle("Saved");
    setToastMessage("Changes have been saved.");
    setToastOpen(true);
  };

  // Subtract or add items
  const handleTransaction = async () => {
    if (!quantity || isNaN(quantity) || quantity <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }

    try {
      const updatedQuantity =
        transactionType === "subtract"
          ? lot.Quantity - parseInt(quantity, 10)
          : lot.Quantity + parseInt(quantity, 10);

      if (updatedQuantity < 0) {
        alert("Cannot subtract more items than are in stock.");
        return;
      }

      const res = await fetch(`/api/products/${params.id}/lots/${lot._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Quantity: updatedQuantity }),
      });

      if (!res.ok) throw new Error("Failed to update lot quantity");

      const updatedProduct = await res.json();
      const updatedLot = updatedProduct.Lots.find((l) => l._id === lot._id);

      setProduct(updatedProduct);
      setLot(updatedLot);
      setQuantity("");
      setToastTitle("Success");
      setToastMessage(
        `${transactionType === "subtract" ? "Subtracted" : "Added"} ${quantity} items successfully.`
      );
      setToastOpen(true);
    } catch (err) {
      console.error("Error updating lot quantity:", err);
      alert("Failed to process the transaction.");
    }
  };

  // Handle Lot Deletion
  const handleDeleteLot = async () => {
    try {
      const res = await fetch(`/api/products/${params.id}/lots/${lot._id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete lot");

      setToastTitle("Deleted");
      setToastMessage("Lot has been deleted successfully.");
      setToastOpen(true);
      router.push("/"); // Navigate back to Home
    } catch (err) {
      console.error("Error deleting lot:", err);
      setToastTitle("Error");
      setToastMessage("Failed to delete the lot.");
      setToastOpen(true);
    }
  };

  // Format date to "MM/DD/YYYY"
  const formatDate = (date) => {
    if (!date) return "N/A";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "N/A";
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${month}/${day}/${year}`;
  };

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <Card className="mx-auto max-w-3xl shadow-lg rounded-lg">
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-8 w-3/4 rounded-md" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-5 w-2/3 rounded-md" />
            <Skeleton className="h-5 w-1/2 rounded-md" />
            <Skeleton className="h-5 w-3/4 rounded-md" />
            <Skeleton className="h-5 w-1/4 rounded-md" />
            <div className="mt-6 flex justify-end gap-4">
              <Skeleton className="h-10 w-32 rounded-md" />
              <Skeleton className="h-10 w-24 rounded-md" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="container mx-auto py-10">
        <Card className="mx-auto max-w-3xl shadow-lg rounded-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-gray-800">
              {product.CatalogNumber} - {product.ProductName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Lot Details */}
            <div className="flex flex-col space-y-2">
              <span className="text-sm text-gray-600">Lot Number</span>
              <span className="text-lg font-medium text-gray-800">{lot.LotNumber}</span>
            </div>
            <div className="flex flex-col space-y-2">
              <span className="text-sm text-gray-600">Quantity</span>
              <span className="text-lg font-medium text-gray-800">{lot.Quantity}</span>
            </div>
            <div className="flex flex-col space-y-2">
              <span className="text-sm text-gray-600">Expiration Date</span>
              <span className="text-lg font-medium text-gray-800">
                {formatDate(lot.ExpirationDate || lot.calculatedExpirationDate)}
              </span>
            </div>
            <div className="flex flex-col space-y-2">
              <span className="text-sm text-gray-600">Availability</span>
              <span
                className={cn(
                  "text-lg font-medium",
                  lot.isAvailable ? "text-green-600" : "text-red-600"
                )}
              >
                {lot.isAvailable ? "Available" : "Unavailable"}
              </span>
            </div>

            {/* Transaction Section */}
            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-medium text-gray-800">Transaction</h3>
              <div className="flex items-center gap-4">
                <Button
                  variant={transactionType === "subtract" ? "default" : "outline"}
                  onClick={() => setTransactionType("subtract")}
                >
                  Subtract
                </Button>
                <Button
                  variant={transactionType === "add" ? "default" : "outline"}
                  onClick={() => setTransactionType("add")}
                >
                  Add
                </Button>
              </div>
              <div className="flex items-center gap-4 mt-4">
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  className="border px-4 py-2 rounded-md w-1/2"
                />
                <Button onClick={() => setAlertOpen(true)}>Submit</Button>
              </div>
            </div>

            {/* Buttons row */}
            <div className="mt-8 flex justify-end gap-4">
              <Button variant="outline" onClick={() => setQrDialogOpen(true)}>
                View QR
              </Button>
              <Button onClick={() => setEditOpen(true)}>Edit Lot</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Delete Lot</Button>
                </AlertDialogTrigger>
                <AlertContent>
                  <AlertHeader>
                    <AlertTitle>Confirm Deletion</AlertTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this lot? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertHeader>
                  <AlertDialogFooter>
                    <Button variant="outline" onClick={() => setAlertOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setAlertOpen(false);
                        handleDeleteLot();
                      }}
                    >
                      Delete
                    </Button>
                  </AlertDialogFooter>
                </AlertContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        {/* Edit Lot Dialog */}
        <EditLotDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          productId={product._id}
          lot={lot}
          onSaved={handleSave}
        />

        {/* QR Code Dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-lg font-medium text-gray-800">
                QR Code for: {product.CatalogNumber} - {product.ProductName}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-6">
              <QRCodeSVG value={lotUrl} size={256} />
              <Button variant="outline" onClick={() => setQrDialogOpen(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* AlertDialog for Transaction Confirmation */}
        <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
          <AlertContent>
            <AlertHeader>
              <AlertTitle>Confirm Transaction</AlertTitle>
            </AlertHeader>
            <div className="space-y-4">
              <p>
                Are you sure you want to{" "}
                <span className="font-semibold">
                  {transactionType === "subtract" ? "subtract" : "add"}
                </span>{" "}
                <span className="font-semibold">{quantity}</span> items from this lot?
              </p>
            </div>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => {
                setAlertOpen(false)}}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setAlertOpen(false);
                  handleTransaction();
                }}
              >
                Confirm
              </Button>
            </AlertDialogFooter>
          </AlertContent>
        </AlertDialog>

        {/* Toast Notification */}
        <Toast open={toastOpen} onOpenChange={setToastOpen}>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-6 w-6 text-green-500" />
            <div>
              <ToastTitle>{toastTitle}</ToastTitle>
              <ToastDescription>{toastMessage}</ToastDescription>
            </div>
          </div>
        </Toast>
        <ToastViewport />
      </div>
    </ToastProvider>
  );
}
