'use client';

import { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/components/dialog';
import { Button } from '@/components/ui/shadcn/components/button';
import { Badge } from '@/components/ui/shadcn/components/badge';
import {
  QrCode,
  Download,
  Printer,
  RefreshCw
} from 'lucide-react';

const QRCodeGenerator = ({ data, onClose }) => {
  const [qrData, setQrData] = useState('');
  const [qrSize] = useState('200'); // Fixed size for display
  const [errorCorrection] = useState('M'); // Fixed error correction
  const qrRef = useRef(null);

  // Generate the QR data URL based on the item or lot
  useEffect(() => {
    if (data) {
      // Use environment variable for production URL, fallback to current origin
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
      let qrUrl;
      
      if (data.type === 'lot') {
        qrUrl = data.url || `${baseUrl}/${data.id}`;
      } else {
        qrUrl = `${baseUrl}/${data.id}`;
      }
      
      setQrData(qrUrl);
    }
  }, [data]);

  const handleDownload = () => {
    if (!qrRef.current) return;

    try {
      const svgElement = qrRef.current.querySelector('svg');
      if (!svgElement) return;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const size = 512; // Higher resolution for download
      
      canvas.width = size;
      canvas.height = size;

      const img = new Image();
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          const link = document.createElement('a');
          const filename = data?.type === 'lot' 
            ? `qr-lot-${data?.lotNumber || 'unknown'}-${Date.now()}.png`
            : `qr-${data?.sku || 'item'}-${Date.now()}.png`;
          link.download = filename;
          link.href = URL.createObjectURL(blob);
          link.click();
          
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

      // Enhanced print template with lot information
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
      
      printWindow.document.write(`
        <html>
          <head>
            <title>QR Code - ${data?.name || 'Item'}</title>
            <style>
              @page {
                size: square;
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
              h2 { margin: 0 0 10px 0; font-size: 18px; }
              p { margin: 5px 0; font-size: 14px; }
              .lot-info { 
                background: #f5f5f5; 
                padding: 8px; 
                margin: 10px 0; 
                border-radius: 4px;
                font-weight: bold;
              }
            </style>
          </head>
          <body onload="setTimeout(function() { window.print(); window.close(); }, 500)">
            <div class="qr-container">
              <div class="qr-code">
                ${svgElement.outerHTML}
              </div>
            </div>
          </body>
        </html>
      `);
      
      printWindow.document.close();
    } catch (error) {
      console.error('Error printing QR code:', error);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            {data?.type === 'lot' ? 'Lot QR Code Label' : 'QR Code Label'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item/Lot Information - Enhanced for Lots */}
          {data && (
            <div className="text-center space-y-2">
              <h3 className="font-medium text-lg">
                {data.type === 'lot' ? `Lot ${data.lotNumber}` : (data.name || data.itemName)}
              </h3>
              
              {/* Show item name for lots */}
              {data.itemName && data.type === 'lot' && (
                <p className="text-sm font-medium text-muted-foreground">{data.itemName}</p>
              )}
              
              <div className="flex gap-2 justify-center flex-wrap">
                {data.sku && <Badge variant="outline" className="text-xs">SKU: {data.sku}</Badge>}
                {data.lotNumber && data.type === 'lot' && (
                  <Badge variant="default" className="text-xs bg-blue-600">Lot: {data.lotNumber}</Badge>
                )}
                <Badge variant="secondary" className="text-xs capitalize">
                  {data.type}
                </Badge>
              </div>
            </div>
          )}

          {/* QR Code Preview - Centered and Compact */}
          <div className="flex justify-center">
            <div className="border border-muted rounded-lg p-3 bg-white" ref={qrRef}>
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

          {/* Show the URL that will be encoded */}
          <div className="text-xs text-center text-muted-foreground bg-gray-50 dark:bg-gray-800 p-2 rounded">
            <p className="font-mono break-all">{qrData}</p>
          </div>

          {/* Actions Only */}
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

          {/* Simple instruction */}
          <p className="text-xs text-center text-muted-foreground">
            Scan to view {data?.type === 'lot' ? 'lot' : 'item'} details
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QRCodeGenerator;