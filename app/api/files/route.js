// =============================================================================
// app/api/files/route.js - Complete file operations
// =============================================================================
import { NextResponse } from 'next/server';
import db from '@/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const action = searchParams.get('action');
  const search = searchParams.get('search');
  const folder = searchParams.get('folderId');

  if (id) {
    if (action === 'download') {
      // Handle PDF download: GET /api/files?id=123&action=download
      const batch = await db.batches.getBatchById(id);
      if (!batch?.signedPdf?.data) {
        return NextResponse.json({ error: 'No PDF found' }, { status: 404 });
      }
      
      const fileName = `${batch.fileId?.fileName || 'file'}-${batch.solutionLotNumber || `run-${batch.runNumber}`}.pdf`;
      return new NextResponse(batch.signedPdf.data, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName}"`
        }
      });
    }
    
    if (action === 'batches') {
      // Get batches for this file: GET /api/files?id=123&action=batches
      const batches = await db.batches.listBatches({ filter: { fileId: id } });
      return NextResponse.json({ batches });
    }
    
    // Regular file get: GET /api/files?id=123
    const file = await db.files.getFileById(id, { includePdf: true });
    if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ file });
  }

  // Search: GET /api/files?search=eco
  if (search) {
    const files = search.trim() ? await db.files.searchFiles(search) : [];
    return NextResponse.json({ files });
  }

  // List files: GET /api/files?folderId=abc
  const files = await db.files.listFiles({ folderId: folder ?? null });
  return NextResponse.json({ files });
}

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  if (action === 'batch-upload') {
    // Handle batch upload with folder structure
    const formData = await request.formData();
    const files = formData.getAll('files');
    const baseFolderId = formData.get('folderId') || null;
    
    const fileDataArray = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file || file.size === 0) continue;
      
      const buffer = Buffer.from(await file.arrayBuffer());
      const relativePath = formData.get(`relativePath_${i}`);
      
      fileDataArray.push({
        buffer,
        fileName: relativePath ? relativePath.split('/').pop() : file.name,
        relativePath: relativePath || file.name,
        description: ''
      });
    }
    
    const results = await db.files.createMultipleFilesFromUpload(fileDataArray, baseFolderId);
    const successful = results.filter(r => !r.error);
    
    return NextResponse.json({
      success: true,
      message: `Uploaded ${successful.length} files successfully`,
      uploaded: successful.length,
      results: successful
    });
  }
  
  // Regular single file upload
  const form = await request.formData();
  const blob = form.get('file');
  if (!blob) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const buffer = Buffer.from(await blob.arrayBuffer());
  const file = await db.files.createFileFromUpload({
    buffer,
    fileName: form.get('fileName') || blob.name,
    description: form.get('description') || '',
    folderId: form.get('folderId') || null,
    relativePath: form.get('relativePath') || ''
  });
  
  return NextResponse.json({ file });
}

export async function PATCH(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  
  const body = await request.json();
  const file = 'status' in body 
    ? await db.files.updateFileStatus(id, body.status)
    : await db.files.updateFileMeta(id, body);
  
  return NextResponse.json({ file });
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  
  await db.files.deleteFile(id);
  return NextResponse.json({ ok: true });
}