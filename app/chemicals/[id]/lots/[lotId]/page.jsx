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
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, [params?.id, params?.lotId]);

  // Helper function to safely compare ObjectIds or their string representations
  function isSameId(id1, id2) {
    if (!id1 || !id2) return false;
    
    // Try different comparison methods
    return (
      id1 === id2 ||
      id1.toString() === id2.toString() ||
      id1 === id2.toString() ||
      id1.toString() === id2
    );
  }

  async function fetchData() {
    if (!params?.id || !params?.lotId) {
      setError("Missing chemical ID or lot ID parameters");
      setLoading(false);
      return;
    }
    
    try {
      console.log(`Fetching chemical data for ID: ${params.id}`);
      const response = await fetch(`/api/chemicals/${params.id}`);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        console.error(`Failed to fetch chemical: ${response.status} ${errorText}`);
        throw new Error(`Failed to fetch chemical: ${response.status}`);
      }
      
      const chemData = await response.json();
      console.log("Chemical data received:", chemData.ChemicalName);
      setChemical(chemData);
      
      // Improved lot finding logic
      console.log("Looking for lot ID:", params.lotId);
      console.log("Available lot IDs:", chemData.Lots.map(l => l._id));
      
      // Try multiple methods to find the lot
      let foundLot = null;
      
      // Method 1: Direct comparison
      foundLot = chemData.Lots.find(l => l._id === params.lotId);
      
      // Method 2: String comparison
      if (!foundLot) {
        foundLot = chemData.Lots.find(l => l._id.toString() === params.lotId.toString());
      }
      
      // Method 3: Various string comparisons
      if (!foundLot) {
        foundLot = chemData.Lots.find(l => isSameId(l._id, params.lotId));
      }
      
      console.log("Found lot:", foundLot);
      
      if (!foundLot) {
        throw new Error(`Lot with ID ${params.lotId} not found in chemical data`);
      }
      
      setLot(foundLot);
    } catch (error) {
      console.error("Error:", error);
      setError(error.message || "Failed to load data");
      showToast("Error", error.message || "Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  }

  // Updated handleTransaction function with improved error handling
  const handleTransaction = async () => {
    if (!quantity || isNaN(quantity) || parseFloat(quantity) <= 0) {
      showToast("Error", "Please enter a valid quantity", "error");
      return;
    }

    setProcessing(true);
    setError(null);
    
    try {
      const parsedQuantity = parseFloat(quantity);
      const updatedQuantity = transactionType === "subtract" 
        ? lot.Quantity - parsedQuantity
        : lot.Quantity + parsedQuantity;

      if (updatedQuantity < 0) {
        showToast("Error", "Cannot subtract more than available quantity", "error");
        setProcessing(false);
        return;
      }

      console.log('Sending transaction:', {
        endpoint: `/api/chemicals/${params.id}/lots/${params.lotId}`,
        method: 'PUT',
        body: {
          Quantity: updatedQuantity,
          notes: `${transactionType === 'add' ? 'Added' : 'Removed'} ${quantity} units`,
        }
      });

      const response = await fetch(`/api/chemicals/${params.id}/lots/${params.lotId}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          Quantity: updatedQuantity,
          notes: `${transactionType === 'add' ? 'Added' : 'Removed'} ${quantity} units`,
        }),
      });

      // Handle non-OK responses with better error reporting
      if (!response.ok) {
        let errorMessage = `Error: ${response.status} ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          console.error('Transaction failed:', {
            status: response.status,
            statusText: response.statusText,
            errorData
          });
          
          errorMessage = errorData.message || errorMessage;
          
          // If we have detailed error data, show it for debugging
          if (errorData.lotIdRequested && errorData.availableLots) {
            console.error('Lot ID mismatch:', {
              requested: errorData.lotIdRequested,
              available: errorData.availableLots
            });
          }
        } catch (e) {
          console.error('Could not parse error response', e);
        }
        
        throw new Error(errorMessage);
      }

      const updatedChemical = await response.json();
      
      if (!updatedChemical || !updatedChemical.Lots) {
        console.error('Invalid response data:', updatedChemical);
        throw new Error('Invalid response data received');
      }
      
      setChemical(updatedChemical);
      
      // Use the improved lot finding method for consistency
      const updatedLot = updatedChemical.Lots.find(l => isSameId(l._id, params.lotId));
      
      if (!updatedLot) {
        console.error('Updated lot not found in response');
        throw new Error('Updated lot not found in response');
      }
      
      setLot(updatedLot);
      setQuantity("");
      showToast(
        "Success",
        `Successfully ${transactionType === 'add' ? 'added' : 'removed'} ${quantity} units`,
        "success"
      );
    } catch (error) {
      console.error("Transaction error:", error);
      setError(error.message || "Failed to update quantity");
      showToast("Error", error.message || "Failed to update quantity", "error");
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

  if (error && !lot) {
    return (
      <div className="container max-w-md mx-auto p-4">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 py-8">
              <AlertCircle className="h-12 w-12 text-red-500" />
              <h1 className="text-xl font-semibold text-center">Error Loading Lot</h1>
              <p className="text-center text-gray-600">{error}</p>
              <Button onClick={() => fetchData()}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
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
              
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4" />
                    <p className="font-medium">Error</p>
                  </div>
                  <p>{error}</p>
                </div>
              )}
              
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

        {/* Debug Info Card (only in development) */}
        {process.env.NODE_ENV === 'development' && (
          <Card className="mt-6">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Debug Info</h3>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Chemical ID: {params.id}</p>
                  <p>Lot ID: {params.lotId}</p>
                  <p>Lot ID Type: {typeof params.lotId}</p>
                  <p>Found Lot ID: {lot?._id}</p>
                  <p>Found Lot ID Type: {lot?._id ? typeof lot._id : 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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