// app/files/components/PDFEditor/hooks/core/print/print.core.js
'use client';

import { useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';

/**
 * Print Core Hook
 * Handles PDF printing functionality:
 * - PDF formatting for letter size printing
 * - Print dialog management
 * - PDF scaling and positioning for print layout
 */
export function usePrint(blobUri) {

  // EXTRACTED: buildLetterPdf function from your core.js
  const buildLetterPdf = useCallback(async (dataUrl) => {
    const [W, H] = [612, 792]; // Letter size in points
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
    const src = await PDFDocument.load(bytes);
    const out = await PDFDocument.create();
    const pages = await out.embedPages(src.getPages());
    
    pages.forEach(ep => {
      const s = Math.min(W / ep.width, H / ep.height);
      const x = (W - ep.width * s) / 2;
      const y = (H - ep.height * s) / 2;
      const pg = out.addPage([W, H]);
      pg.drawPage(ep, { x, y, xScale: s, yScale: s });
    });
    
    return out.save();
  }, []);

  // EXTRACTED: print function from your core.js
  const print = useCallback(async () => {
    if (!blobUri) {
      console.warn('📄 No PDF data available for printing');
      return;
    }

    try {
      console.log('🖨️ Starting print process...');
      
      // Build letter-sized PDF for printing
      const letterPdfBytes = await buildLetterPdf(blobUri);
      
      // Create blob URL for the formatted PDF
      const url = URL.createObjectURL(
        new Blob([letterPdfBytes], { type: 'application/pdf' })
      );
      
      // Open in new window for printing
      const w = window.open(url, '_blank');
      if (!w) {
        console.error('🖨️ Failed to open print window - popup blocked?');
        alert('Print window was blocked. Please allow popups and try again.');
        URL.revokeObjectURL(url);
        return;
      }
      
      // Wait for window to load, then print
      const ready = () => {
        w.removeEventListener('load', ready);
        w.print();
        URL.revokeObjectURL(url);
      };
      
      w.addEventListener('load', ready);
      console.log('🖨️ Print dialog opened');
      
    } catch (error) {
      console.error('🖨️ Print error:', error);
      alert('Print failed: ' + error.message);
    }
  }, [blobUri, buildLetterPdf]);

  // Download PDF instead of printing
  const downloadPdf = useCallback(async (filename = 'document.pdf') => {
    if (!blobUri) {
      console.warn('📄 No PDF data available for download');
      return;
    }

    try {
      console.log('💾 Starting PDF download...');
      
      // Build letter-sized PDF
      const letterPdfBytes = await buildLetterPdf(blobUri);
      
      // Create download link
      const blob = new Blob([letterPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      // Trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      console.log('💾 PDF download completed');
      
    } catch (error) {
      console.error('💾 Download error:', error);
      alert('Download failed: ' + error.message);
    }
  }, [blobUri, buildLetterPdf]);

  // Get print preview URL
  const getPrintPreviewUrl = useCallback(async () => {
    if (!blobUri) {
      return null;
    }

    try {
      const letterPdfBytes = await buildLetterPdf(blobUri);
      return URL.createObjectURL(
        new Blob([letterPdfBytes], { type: 'application/pdf' })
      );
    } catch (error) {
      console.error('🖨️ Print preview error:', error);
      return null;
    }
  }, [blobUri, buildLetterPdf]);

  // Check if printing is available
  const canPrint = useCallback(() => {
    return !!blobUri && typeof window !== 'undefined' && window.print;
  }, [blobUri]);

  return {
    // === FUNCTIONS ===
    print,
    downloadPdf,
    buildLetterPdf,
    getPrintPreviewUrl,
    
    // === STATUS ===
    canPrint: canPrint()
  };
}