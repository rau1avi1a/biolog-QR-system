// components/ui/QRScannerModal.jsx
'use client';

import { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr'; // Add this import
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Camera,
  ScanLine,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

const QRScannerModal = ({ open, onOpenChange, onScan, onItemFound }) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      stopCamera();
    };
  }, []);

  // Safe state setter
  const safeSetState = (setter) => {
    return (...args) => {
      if (isMountedRef.current) {
        setter(...args);
      }
    };
  };

  // Initialize camera devices
  useEffect(() => {
    if (open && isMountedRef.current) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          if (isMountedRef.current) {
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            setDevices(videoDevices);
            if (videoDevices.length > 0) {
              setSelectedDevice(videoDevices[0].deviceId);
            }
          }
        })
        .catch(err => {
          if (isMountedRef.current) {
            setError('Failed to enumerate camera devices');
          }
        });
    }
  }, [open]);

  // Start camera
  const startCamera = async () => {
    if (!isMountedRef.current) return;
    
    try {
      safeSetState(setError)(null);
      safeSetState(setScanning)(true);

      const constraints = {
        video: {
          deviceId: selectedDevice || undefined,
          facingMode: selectedDevice ? undefined : 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (!isMountedRef.current) {
        // Component unmounted while getting stream, clean up
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        startScanning();
      }
    } catch (err) {
      if (isMountedRef.current) {
        safeSetState(setError)('Failed to access camera. Please ensure camera permissions are granted.');
        safeSetState(setScanning)(false);
      }
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (isMountedRef.current) {
      setScanning(false);
    }
  };

  // Start QR scanning
  const startScanning = () => {
    if (!isMountedRef.current) return;

    scanIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) {
        clearInterval(scanIntervalRef.current);
        return;
      }

      if (videoRef.current && canvasRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height); // Use imported jsQR
        
        if (code) {
          handleQRDetected(code.data);
        }
      }
    }, 100);
  };

  // Handle QR code detection
  const handleQRDetected = async (qrData) => {
    if (!isMountedRef.current) return;

    safeSetState(setScanResult)(qrData);
    stopCamera();
    
    try {
      // Try to find item by QR data (assuming QR contains SKU or item ID)
      const foundItem = await onScan(qrData);
      if (foundItem && isMountedRef.current) {
        onItemFound(foundItem);
        onOpenChange(false);
      } else if (isMountedRef.current) {
        safeSetState(setError)(`No item found for QR code: ${qrData}`);
      }
    } catch (err) {
      if (isMountedRef.current) {
        safeSetState(setError)('Failed to process QR code');
      }
    }
  };

  // Cleanup on modal close
  useEffect(() => {
    if (!open) {
      stopCamera();
      if (isMountedRef.current) {
        setScanResult(null);
        setError(null);
      }
    }
  }, [open]);

  // Switch camera
  const switchCamera = () => {
    if (!isMountedRef.current) return;

    const currentIndex = devices.findIndex(device => device.deviceId === selectedDevice);
    const nextIndex = (currentIndex + 1) % devices.length;
    setSelectedDevice(devices[nextIndex].deviceId);
    
    if (scanning) {
      stopCamera();
      setTimeout(startCamera, 100);
    }
  };

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
          {/* Camera Preview */}
          <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
            {scanning ? (
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
            {!scanning ? (
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

            {devices.length > 1 && (
              <Button onClick={switchCamera} variant="outline" size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Device Selection */}
          {devices.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {devices.map((device, index) => (
                <Badge
                  key={device.deviceId}
                  variant={selectedDevice === device.deviceId ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => {
                    if (isMountedRef.current) {
                      setSelectedDevice(device.deviceId);
                      if (scanning) {
                        stopCamera();
                        setTimeout(startCamera, 100);
                      }
                    }
                  }}
                >
                  Camera {index + 1}
                </Badge>
              ))}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Scan Result */}
          {scanResult && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                QR Code detected: {scanResult}
              </AlertDescription>
            </Alert>
          )}

          {/* Instructions */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Position the QR code within the scanning area</p>
            <p>• Ensure good lighting for best results</p>
            <p>• Hold steady until the code is detected</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QRScannerModal;