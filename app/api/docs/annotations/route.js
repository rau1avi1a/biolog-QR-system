// app/api/docs/annotations/route.js
import { NextResponse } from 'next/server';
import { PDFDocument } from "pdf-lib";  // <--- ADD THIS IMPORT
import connectMongoDB from '@/lib/index';
import SubSheets from '@/models/SubSheets';
import DocumentVersion from '@/models/DocumentVersion';
import DocumentAuditTrail from '@/models/DocumentAuditTrail';

export async function POST(request) {
  try {
    await connectMongoDB();
    const { docId, drawingData, status, metadata, newVersion } = await request.json();

    // 1. Fetch the SubSheets doc
    const subSheet = await SubSheets.findById(docId);
    if (!subSheet?.pdf?.data) {
      return NextResponse.json({ error: 'No PDF data found' }, { status: 404 });
    }

    // 2. Convert stored Buffer to Uint8Array for pdf-lib
    const existingPdfBytes = new Uint8Array(subSheet.pdf.data);

    // 3. Load the PDFDocument
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // 4. Process the drawing data: remove prefix and convert to bytes
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
    
    // 9. Update the document, or create a new version if newVersion is true
    if (newVersion) {
      // Create a new version copy
      const newDocVersion = await DocumentVersion.create({
        originalDocumentId: subSheet._id,
        version: 1, // or calculate the next version number
        fileName: subSheet.fileName,
        status,
        pdf: { data: updatedPdfBuffer, contentType: subSheet.pdf.contentType },
        currentAnnotations: subSheet.currentAnnotations || [],
        metadata: metadata || {},
      });
      
      // Create audit trail entry
      const auditEntry = await DocumentAuditTrail.create({
        documentId: docId,
        status,
        annotations: drawingData || '',
        metadata: metadata || {},
        timestamp: new Date()
      });
      
      return NextResponse.json({
        message: 'Annotations saved and new version created',
        document: newDocVersion,
        auditEntry,
      });
    } else {
      // Update the original mother doc
      subSheet.pdf.data = updatedPdfBuffer;
      subSheet.status = status;
      await subSheet.save();

      const auditEntry = await DocumentAuditTrail.create({
        documentId: docId,
        status,
        annotations: drawingData || '',
        metadata: metadata || {},
        timestamp: new Date()
      });

      return NextResponse.json({
        message: 'Annotations saved and mother document updated',
        document: subSheet,
        auditEntry,
      });
    }
  } catch (err) {
    console.error('Error saving annotations:', err);
    return NextResponse.json({ error: 'Failed to save annotations' }, { status: 500 });
  }
}
