// app/api/files/[id]/download/route.js
import { NextResponse } from 'next/server';
import connectMongoDB from '@/db/index';
import Batch from '@/db/schemas/Batch';

export async function GET(request, { params }) {
  try {
    await connectMongoDB();
    
    const { id } = await params; // Await params in Next.js 15
    
    const batch = await Batch.findById(id).select('signedPdf solutionLotNumber runNumber fileId').populate('fileId', 'fileName');
    
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }
    
    if (!batch.signedPdf || !batch.signedPdf.data) {
      return NextResponse.json({ error: 'No PDF file available' }, { status: 404 });
    }
    
    // Build filename: original-filename-lot-number.pdf
    const originalFileName = batch.fileId?.fileName || 'file';
    const baseName = originalFileName.replace(/\.pdf$/i, ''); // Remove .pdf extension if present
    const lotNumber = batch.solutionLotNumber || `run-${batch.runNumber}`;
    const fileName = `${baseName}-${lotNumber}.pdf`;
    
    return new NextResponse(batch.signedPdf.data, {
      status: 200,
      headers: {
        'Content-Type': batch.signedPdf.contentType || 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': batch.signedPdf.data.length.toString(),
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}