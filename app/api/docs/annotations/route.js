import { NextResponse } from 'next/server';
import connectMongoDB from '@/lib';
import { PDFDocument } from 'pdf-lib';
import SubSheets from '@/models/SubSheets';
import DocumentAuditTrail from '@/models/DocumentAuditTrail';

export async function POST(request) {
  try {
    await connectMongoDB();
    const { docId, drawingData, status, metadata } = await request.json();

    // 1. Fetch the SubSheets doc
    const subSheet = await SubSheets.findById(docId);
    if (!subSheet?.pdf?.data) {
      return NextResponse.json({ error: 'No PDF data found' }, { status: 404 });
    }

    // 2. Convert stored Buffer to Uint8Array for pdf-lib
    const existingPdfBytes = new Uint8Array(subSheet.pdf.data);

    // 3. Load the PDFDocument
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // 4. Convert the drawing data to bytes
    const base64Data = drawingData.replace(/^data:image\/png;base64,/, '');
    const drawingBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // 5. Embed the PNG
    const pngImage = await pdfDoc.embedPng(drawingBytes);

    // 6. Draw onto first page
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();
    
    firstPage.drawImage(pngImage, {
      x: 0,
      y: 0,
      width,
      height
    });

    // 7. Save the PDF
    const updatedPdfBytes = await pdfDoc.save();

    // 8. Convert Uint8Array to Buffer before saving to MongoDB
    const updatedPdfBuffer = Buffer.from(updatedPdfBytes);
    
    // 9. Update the document
    subSheet.pdf.data = updatedPdfBuffer;
    subSheet.status = status;
    await subSheet.save();

    // 10. Create audit trail
    const auditEntry = await DocumentAuditTrail.create({
      documentId: docId,
      status,
      annotations: drawingData || '',
      metadata: metadata || {},
    });

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