'use client';

import { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react'; // Add this import
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  QrCode,
  Download,
  Printer,
  Copy,
  Check,
  RefreshCw,
  Zap
} from 'lucide-react';

const QRCodeGenerator = ({ data, onClose }) => {
  const [qrData, setQrData] = useState('');
  const [qrSize, setQrSize] = useState('256');
  const [errorCorrection, setErrorCorrection] = useState('M');
  const [copied, setCopied] = useState(false);
  const qrRef = useRef(null);

  // Generate the QR data URL based on the item or lot
  useEffect(() => {
    if (data) {
      let qrUrl;
      
      if (data.type === 'lot') {
        // For lots, use the permanent URL that was pre-generated  
        qrUrl = data.url || `${window.location.origin}/${data.id}`;
      } else {
        // For items, create a URL that points to the item detail page
        qrUrl = `${window.location.origin}/${data.id}`;
      }
      
      setQrData(qrUrl);
    }
  }, [data]);

  const handleDownload = () => {
    if (!qrRef.current) return;

    try {
      // Get the SVG element
      const svgElement = qrRef.current.querySelector('svg');
      if (!svgElement) return;

      // Create a canvas to convert SVG to PNG
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const size = parseInt(qrSize);
      
      canvas.width = size;
      canvas.height = size;

      // Create an image from the SVG
      const img = new Image();
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        // Fill with white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the QR code
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Convert to blob and download
        canvas.toBlob((blob) => {
          const link = document.createElement('a');
          const filename = data?.type === 'lot' 
            ? `qr-lot-${data?.lotNumber || 'unknown'}-${Date.now()}.png`
            : `qr-${data?.sku || 'item'}-${Date.now()}.png`;
          link.download = filename;
          link.href = URL.createObjectURL(blob);
          link.click();
          
          // Clean up
          URL.revokeObjectURL(link.href);
          URL.revokeObjectURL(url);
        }, 'image/png');
      };

      img.src = url;
    } catch (error) {
      console.error('Error downloading QR code:', error);
    }
  };

  const handlePrint = () => {
    if (!qrRef.current) return;

    try {
      const svgElement = qrRef.current.querySelector('svg');
      if (!svgElement) return;

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Please allow pop-ups to print QR codes');
        return;
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>QR Code - ${data?.name || 'Item'}</title>
            <style>
              @page {
                size: letter;
                margin: 0.5in;
              }
              body { 
                margin: 0; 
                display: flex; 
                flex-direction: column;
                align-items: center; 
                justify-content: center; 
                min-height: 100vh;
                font-family: Arial, sans-serif;
              }
              .qr-container {
                text-align: center;
                padding: 20px;
                border: 2px solid #000;
                margin: 20px;
                max-width: 400px;
              }
              .qr-info {
                margin-bottom: 15px;
              }
              .qr-code {
                margin: 15px 0;
              }
              .qr-code svg {
                width: 200px !important;
                height: 200px !important;
              }
              h2 { margin: 0 0 10px 0; }
              p { margin: 5px 0; }
            </style>
          </head>
          <body onload="setTimeout(function() { window.print(); window.close(); }, 500)">
            <div class="qr-container">
              <div class="qr-info">
                <h2>${data?.name || data?.itemName || 'Item'}</h2>
                <p><strong>SKU:</strong> ${data?.sku || 'N/A'}</p>
                ${data?.lotNumber ? `<p><strong>Lot:</strong> ${data.lotNumber}</p>` : ''}
                <p><strong>Type:</strong> ${data?.type || 'N/A'}</p>
                <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
              </div>
              <div class="qr-code">
                ${svgElement.outerHTML}
              </div>
              <p><small>Scan to view item details</small></p>
            </div>
          </body>
        </html>
      `);
      
      printWindow.document.close();
    } catch (error) {
      console.error('Error printing QR code:', error);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const errorCorrectionLevels = {
    'L': 'Low (~7%)',
    'M': 'Medium (~15%)', 
    'Q': 'Quartile (~25%)',
    'H': 'High (~30%)'
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Generate QR Code
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Item/Lot Information */}
          {data && (
            <div className="space-y-2">
              <h3 className="font-medium">
                {data.type === 'lot' ? `Lot ${data.lotNumber}` : (data.name || data.itemName)}
              </h3>
              <div className="flex gap-2 flex-wrap">
                {data.sku && <Badge variant="outline">SKU: {data.sku}</Badge>}
                {data.lotNumber && data.type === 'lot' && (
                  <Badge variant="outline">Lot: {data.lotNumber}</Badge>
                )}
                <Badge variant="secondary" className="capitalize">
                  {data.type}
                </Badge>
              </div>
              {data.itemName && data.type === 'lot' && (
                <p className="text-sm text-muted-foreground">Item: {data.itemName}</p>
              )}
            </div>
          )}

          {/* QR Code Preview */}
          <div className="flex justify-center">
            <div className="border border-muted rounded-lg p-4 bg-white" ref={qrRef}>
              {qrData ? (
                <QRCodeSVG
                  value={qrData}
                  size={parseInt(qrSize)}
                  level={errorCorrection}
                  includeMargin={true}
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                />
              ) : (
                <div className="flex items-center justify-center" style={{ width: qrSize + 'px', height: qrSize + 'px' }}>
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>

          {/* QR Configuration */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="qr-data">QR Code Data</Label>
              <div className="flex gap-2">
                <Input
                  id="qr-data"
                  value={qrData}
                  onChange={(e) => setQrData(e.target.value)}
                  placeholder="Enter data to encode"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="qr-size">Size (px)</Label>
                <Select value={qrSize} onValueChange={setQrSize}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="128">128px</SelectItem>
                    <SelectItem value="256">256px</SelectItem>
                    <SelectItem value="512">512px</SelectItem>
                    <SelectItem value="1024">1024px</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="error-correction">Error Correction</Label>
                <Select value={errorCorrection} onValueChange={setErrorCorrection}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(errorCorrectionLevels).map(([level, description]) => (
                      <SelectItem key={level} value={level}>
                        {level} - {description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handleDownload} className="flex-1" disabled={!qrData}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button onClick={handlePrint} variant="outline" className="flex-1" disabled={!qrData}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>

          {/* QR Code Info */}
          <Alert>
            <Zap className="h-4 w-4" />
            <AlertDescription>
              This QR code links directly to the item's detail page. 
              Scanning it will open the full item information in any browser.
            </AlertDescription>
          </Alert>

          {/* Instructions */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Higher error correction allows for better scanning when damaged</p>
            <p>• Larger sizes work better for printing and distant scanning</p>
            <p>• Print on white paper with good contrast for best results</p>
          </div>

          {/* Debug info (only in development) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-muted-foreground border-t pt-2">
              <p><strong>Debug:</strong> QR Data: {qrData}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QRCodeGenerator;