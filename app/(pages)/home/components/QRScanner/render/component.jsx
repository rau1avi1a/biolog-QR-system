// app/(pages)/home/components/QRScanner/render/component.jsx

'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/components/dialog';
import { Button } from '@/components/ui/shadcn/components/button';
import { Badge } from '@/components/ui/shadcn/components/badge';
import { Alert, AlertDescription } from '@/components/ui/shadcn/components/alert';
import { Card, CardContent, CardHeader } from '@/components/ui/shadcn/components/card';
import {
  Camera,
  ScanLine,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Package,
  TestTube,
  Beaker,
  ExternalLink,
  MapPin,
  Calendar,
  Hash
} from 'lucide-react';

// Import hooks
import { useQRScannerState } from '../hooks/state';
import { 
  initializeQRScanner,
  setupVideoElement,
  startQRDetection,
  performQRScan,
  cleanupQRScanner,
  switchToNextCamera
} from '../hooks/core';

// Helper functions
const getItemIcon = (type) => {
  switch (type) {
    case 'chemical': return <TestTube className="h-4 w-4" />;
    case 'solution': return <Beaker className="h-4 w-4" />;
    case 'product': return <Package className="h-4 w-4" />;
    default: return <Package className="h-4 w-4" />;
  }
};

const getStockStatus = (item) => {
  const minQty = item.minQty || 0;
  if (item.qtyOnHand <= minQty) return 'low';
  if (item.qtyOnHand <= minQty * 2) return 'medium';
  return 'good';
};

const QRScannerModal = ({ open, onOpenChange, onScan, onItemFound, allItems }) => {
  const state = useQRScannerState();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Initialize camera devices when modal opens
  useEffect(() => {
    if (open) {
      initializeQRScanner(state.selectedDevice)
        .then(result => {
          if (result.success) {
            state.setDevicesState(result.devices);
            state.setStreamState(result.stream);
          } else {
            state.handleError(result.error);
          }
        })
        .catch(err => {
          state.handleError('Failed to initialize camera');
        });
    }
  }, [open]);

  // Setup video element when stream is available
  useEffect(() => {
    if (state.stream && videoRef.current) {
      setupVideoElement(videoRef.current, state.stream)
        .then(() => {
          // Video is ready, can start detection if scanning
          if (state.scanning) {
            startDetection();
          }
        })
        .catch(err => {
          state.handleError('Failed to setup video');
        });
    }
  }, [state.stream]);

  // Start QR detection
  const startDetection = () => {
    if (videoRef.current && canvasRef.current) {
      const interval = startQRDetection(
        videoRef.current,
        canvasRef.current,
        handleQRDetected
      );
      state.setDetectionIntervalState(interval);
    }
  };

  // Handle QR code detection
  const handleQRDetected = async (qrData) => {
    state.setScanResultState(qrData);
    state.stopScanning();
    
    try {
      const result = await performQRScan(qrData, allItems, (result) => {
        if (result && !result.notFound) {
          state.setFoundItemState(result);
          onItemFound(result);
        } else {
          state.handleError(`No item found for QR code: ${qrData}`);
        }
      });
    } catch (err) {
      state.handleError('Failed to process QR code');
    }
  };

  // Start camera
  const startCamera = async () => {
    try {
      const result = await initializeQRScanner(state.selectedDevice);
      
      if (result.success) {
        state.setStreamState(result.stream);
        state.startScanning();
      } else {
        state.handleError(result.error);
      }
    } catch (err) {
      state.handleError('Failed to start camera');
    }
  };

  // Stop camera
  const stopCamera = () => {
    state.stopScanning();
    cleanupQRScanner(state.stream, state.detectionInterval);
    state.setStreamState(null);
    state.setDetectionIntervalState(null);
  };

  // Switch camera
  const switchCamera = () => {
    if (state.devices.length > 1) {
      const nextDevice = switchToNextCamera(state.devices, state.selectedDevice);
      state.setSelectedDeviceState(nextDevice);
      
      if (state.scanning) {
        stopCamera();
        setTimeout(() => startCamera(), 100);
      }
    }
  };

  // Cleanup on modal close
  useEffect(() => {
    if (!open) {
      state.cleanup();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            QR Code Scanner
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item Details View */}
          {state.showDetails && state.foundItem ? (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>Item found successfully!</AlertDescription>
              </Alert>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      {getItemIcon(state.foundItem.itemType)}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">
                        {state.foundItem.type === 'lot' ? `Lot ${state.foundItem.lotNumber}` : (state.foundItem.displayName || state.foundItem.name)}
                      </h3>
                      <p className="text-sm text-muted-foreground font-mono">{state.foundItem.sku}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Stock:</span>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={getStockStatus(state.foundItem) === 'low' ? 'destructive' : 'secondary'}>
                          {state.foundItem.qtyOnHand} {state.foundItem.uom}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {state.foundItem.matchedLot ? 'Lot #:' : 'SKU:'}
                      </span>
                      <p className="mt-1 font-mono text-xs">
                        {state.foundItem.matchedLot ? state.foundItem.matchedLot.lotNumber : state.foundItem.sku}
                      </p>
                    </div>
                  </div>

                  {state.foundItem.location && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{state.foundItem.location}</span>
                    </div>
                  )}

                  {state.foundItem.itemType === 'chemical' && state.foundItem.casNumber && (
                    <div className="flex items-center gap-2 text-sm">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span>CAS: {state.foundItem.casNumber}</span>
                    </div>
                  )}

                  {state.foundItem.vendor && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Vendor:</span>
                      <p className="mt-1">{state.foundItem.vendor}</p>
                    </div>
                  )}

                  {state.foundItem.description && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Description:</span>
                      <p className="mt-1 text-xs">{state.foundItem.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button asChild className="flex-1">
                  <Link href={`/${state.foundItem._id}`}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Details
                  </Link>
                </Button>
                <Button variant="outline" onClick={state.resetToScanning}>
                  <ScanLine className="h-4 w-4 mr-2" />
                  Scan Again
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Camera Preview */}
              <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                {state.scanning ? (
                  <div className="relative w-full h-full">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                    />
                    <canvas
                      ref={canvasRef}
                      className="hidden"
                    />
                    
                    {/* Scanning Overlay */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute inset-4 border-2 border-primary rounded-lg">
                        <div className="absolute inset-0 border border-primary/50 rounded-lg animate-pulse" />
                      </div>
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Click "Start Camera" to begin scanning
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex gap-2">
                {!state.scanning ? (
                  <Button onClick={startCamera} className="flex-1">
                    <Camera className="h-4 w-4 mr-2" />
                    Start Camera
                  </Button>
                ) : (
                  <Button onClick={stopCamera} variant="outline" className="flex-1">
                    <X className="h-4 w-4 mr-2" />
                    Stop Camera
                  </Button>
                )}

                {state.devices.length > 1 && (
                  <Button onClick={switchCamera} variant="outline" size="icon">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Device Selection */}
              {state.devices.length > 1 && (
                <div className="flex flex-wrap gap-1">
                  {state.devices.map((device, index) => (
                    <Badge
                      key={device.deviceId}
                      variant={state.selectedDevice === device.deviceId ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => {
                        state.setSelectedDeviceState(device.deviceId);
                        if (state.scanning) {
                          stopCamera();
                          setTimeout(startCamera, 100);
                        }
                      }}
                    >
                      Camera {index + 1}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Error Display */}
              {state.error && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              )}

              {/* Instructions */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Position the QR code within the scanning area</p>
                <p>• Ensure good lighting for best results</p>
                <p>• Hold steady until the code is detected</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QRScannerModal;