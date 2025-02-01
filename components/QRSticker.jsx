// components/QRSticker.jsx
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

const QRSticker = React.forwardRef(({ chemical, lot }, ref) => {
  const qrData = {
    url: `${window.location.origin}/chemicals/${chemical._id}/lots/${lot._id}`,
    biologNumber: chemical.BiologNumber,
    lotNumber: lot.LotNumber
  };

  return (
    <div ref={ref} className="qr-sticker">
      <style>
        {`
          @media print {
            @page {
              size: 50mm 25mm;
              margin: 0;
            }
            .qr-sticker {
              width: 50mm;
              height: 25mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 2mm;
            }
            .qr-content {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 1mm;
            }
            .qr-info {
              font-family: Arial, sans-serif;
              font-size: 8pt;
              text-align: center;
              line-height: 1.2;
            }
            .qr-code {
              width: 20mm;
              height: 20mm;
            }
          }
        `}
      </style>
      <div className="qr-content">
        <div className="qr-code">
          <QRCodeSVG
            value={JSON.stringify(qrData)}
            size="100%"
            level="H"
            includeMargin
          />
        </div>
        <div className="qr-info">
          <div>{chemical.BiologNumber}</div>
          <div>{lot.LotNumber}</div>
        </div>
      </div>
    </div>
  );
});

QRSticker.displayName = 'QRSticker';