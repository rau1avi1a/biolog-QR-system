"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Toast, ToastProvider, ToastViewport } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { 
  ChevronLeft, 
  QrCode,
  Plus,
  Minus,
  Loader2,
  AlertCircle,
  Check,
  Download
} from "lucide-react";

export default function ChemicalLotDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [chemical, setChemical] = useState(null);
  const [lot, setLot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [transactionType, setTransactionType] = useState("subtract");
  const [alertOpen, setAlertOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState({ open: false, title: "", message: "", type: "success" });
  const qrRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [params?.id, params?.lotId]);

  async function fetchData() {
    if (!params?.id || !params?.lotId) return;
    
    try {
      const response = await fetch(`/api/chemicals/${params.id}`);
      if (!response.ok) throw new Error("Failed to fetch chemical");
      const chemData = await response.json();
      setChemical(chemData);
      
      const foundLot = chemData.Lots.find(l => l._id === params.lotId);
      setLot(foundLot);
    } catch (error) {
      console.error("Error:", error);
      showToast("Error", "Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  }

  const handleTransaction = async () => {
    if (!quantity || isNaN(quantity) || quantity <= 0) {
      showToast("Error", "Please enter a valid quantity", "error");
      return;
    }

    setProcessing(true);
    try {
      const updatedQuantity = transactionType === "subtract" 
        ? lot.Quantity - parseFloat(quantity)
        : lot.Quantity + parseFloat(quantity);

      if (updatedQuantity < 0) {
        showToast("Error", "Cannot subtract more than available quantity", "error");
        return;
      }

      const response = await fetch(`/api/chemicals/${params.id}/lots/${params.lotId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          Quantity: updatedQuantity,
          notes: `${transactionType === 'add' ? 'Added' : 'Removed'} ${quantity} units`,
        }),
      });

      if (!response.ok) throw new Error("Failed to update quantity");

      const updatedChemical = await response.json();
      setChemical(updatedChemical);
      setLot(updatedChemical.Lots.find(l => l._id === params.lotId));
      setQuantity("");
      showToast(
        "Success",
        `Successfully ${transactionType}ed ${quantity} units`,
        "success"
      );
    } catch (error) {
      console.error("Error:", error);
      showToast("Error", "Failed to update quantity", "error");
    } finally {
      setProcessing(false);
      setAlertOpen(false);
    }
  };

  const showToast = (title, message, type = "success") => {
    setToast({ open: true, title, message, type });
  };

  // Function to download QR code
  const downloadQRCode = () => {
    setDownloading(true);
    try {
      if (!qrRef.current) return;

      // Get the SVG element
      const svgElement = qrRef.current.querySelector('svg');
      if (!svgElement) return;

      // Create a canvas element
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size for 1x1 inch at 300 DPI
      canvas.width = 300;  // 1 inch at 300 DPI
      canvas.height = 300; // 1 inch at 300 DPI

      // Create an image from the SVG
      const img = new Image();
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        // Clear the canvas and draw the image
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to blob
        canvas.toBlob((blob) => {
          // Create download link
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `QR_${chemical?.ChemicalName || 'chemical'}_Lot_${lot?.LotNumber || ''}.png`;
          link.click();

          // Clean up
          URL.revokeObjectURL(link.href);
          URL.revokeObjectURL(url);
          setDownloading(false);
        }, 'image/png');
      };

      img.src = url;
    } catch (error) {
      console.error("Error downloading QR code:", error);
      showToast("Error", "Failed to download QR code", "error");
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="container max-w-md mx-auto p-4">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {/* Main Info Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-semibold">{chemical.ChemicalName}</h1>
                <p className="text-sm text-gray-500">{chemical.BiologNumber}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Lot Number</label>
                  <p className="font-medium">{lot.LotNumber}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Current Quantity</label>
                  <p className="font-medium">{lot.Quantity}</p>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setQrDialogOpen(true)}
              >
                <QrCode className="h-4 w-4 mr-2" />
                View QR Code
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Transaction Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Update Quantity</h2>
              
              <div className="flex gap-2">
                <Button
                  variant={transactionType === "subtract" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setTransactionType("subtract")}
                >
                  <Minus className="h-4 w-4 mr-2" />
                  Remove
                </Button>
                <Button
                  variant={transactionType === "add" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setTransactionType("add")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  step="0.01"
                />
                <Button 
                  className="w-full"
                  onClick={() => setAlertOpen(true)}
                  disabled={!quantity || processing}
                >
                  {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Update Quantity
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* QR Dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>QR Code</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4" ref={qrRef}>
              <QRCodeSVG
                value={`${window.location.href}`}
                size={200}
                level="H"
                includeMargin
              />
              <div className="flex gap-2 w-full">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setQrDialogOpen(false)}
                >
                  Close
                </Button>
                <Button 
                  className="flex-1"
                  onClick={downloadQRCode}
                  disabled={downloading}
                >
                  {downloading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download
                </Button>
              </div>
              <p className="text-xs text-gray-500 text-center">
                QR code sized for 1×1 inch printing
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog */}
        <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Transaction</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to {transactionType === "add" ? "add" : "remove"}{" "}
                <span className="font-semibold">{quantity}</span> units
                {transactionType === "subtract" ? " from" : " to"} this lot?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button
                variant="outline"
                onClick={() => setAlertOpen(false)}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleTransaction}
                disabled={processing}
              >
                {processing ? "Processing..." : "Confirm"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Toast */}
        <Toast
          open={toast.open}
          onOpenChange={(open) => setToast(prev => ({ ...prev, open }))}
        >
          <div className="flex items-center gap-2">
            {toast.type === "success" ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
            <div className="flex flex-col gap-1">
              <p className="font-medium">{toast.title}</p>
              <p className="text-sm text-gray-500">{toast.message}</p>
            </div>
          </div>
        </Toast>
        <ToastViewport />
      </div>
    </ToastProvider>
  );
}