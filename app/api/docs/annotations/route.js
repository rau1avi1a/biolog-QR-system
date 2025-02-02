// /app/api/docs/annotations/route.js
import { NextResponse } from 'next/server';
import connectMongoDB from '@/lib';
import { PDFDocument } from 'pdf-lib'; // npm install pdf-lib
import SubSheets from '@/models/SubSheets';
import DocumentAuditTrail from '@/models/DocumentAuditTrail';

export async function POST(request) {
  try {
    await connectMongoDB();
    const { docId, drawingData, status, metadata } = await request.json();

    // 1. Fetch the SubSheets doc so we can get the original PDF bytes
    const subSheet = await SubSheets.findById(docId);
    if (!subSheet?.pdf?.data) {
      return NextResponse.json({ error: 'No PDF data found' }, { status: 404 });
    }

    // Convert stored Buffer to Uint8Array for pdf-lib
    const existingPdfBytes = new Uint8Array(subSheet.pdf.data.buffer);

    // 2. Load the PDFDocument from pdf-lib
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // 3. Convert the base64 "data:image/png;base64,..." to actual bytes
    // Strip off the "data:image/png;base64," prefix
    const base64Data = drawingData.replace(/^data:image\/png;base64,/, '');
    const drawingBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // 4. Embed the PNG into the PDF
    const pngImage = await pdfDoc.embedPng(drawingBytes);

    // 5. Draw the image onto the first page (or loop if you have multi-page logic)
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    // You can place it at (x=0, y=0) or somewhere else, and scale to fit:
    const { width, height } = firstPage.getSize();
    // if your canvas matches the PDF’s actual size, you can just do:
    firstPage.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: width,
      height: height
    });

    // 6. Save the PDF with the new annotations “baked in”
    const updatedPdfBytes = await pdfDoc.save();

    // 7. Store the updated PDF bytes back into your SubSheets doc
    subSheet.pdf.data = updatedPdfBytes; // a Buffer or Byte array
    subSheet.status = status;           // e.g., "inProgress"
    // Optional: store the annotation image in subSheet if you want
    // subSheet.annotationImage = drawingData;
    await subSheet.save();

    // 8. Create an AuditTrail entry (with "annotations" stored if needed)
    const auditEntry = await DocumentAuditTrail.create({
      documentId: docId,
      status,
      annotations: drawingData || '', // store the base64 if you want
      metadata: metadata || {},
    });

    // Finally return the updated doc
    return NextResponse.json({
      message: 'Annotations saved and PDF updated',
      document: subSheet,
      auditEntry,
    });
  } catch (err) {
    console.error('Error saving annotations:', err);
    return NextResponse.json(
      { error: 'Failed to save annotations' },
      { status: 500 }
    );
  }
}
