// app/api/batches/route.js

import { NextResponse } from 'next/server';
import { createBatch, listBatches } from '@/services/batch.service';
import { getFileById } from '@/services/file.service';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const fileId = searchParams.get('fileId');
    const byStatus = searchParams.get('by-status'); // New parameter for status-based queries

    // Handle different query types
    if (byStatus === 'true' || status) {
      // Return batches by status, formatted as files for the UI
      if (!status) {
        return NextResponse.json({ error: 'Status parameter required for by-status queries' }, { status: 400 });
      }

      const batches = await listBatches({ status });
      
      // Transform batches to look like files for the UI
      // Note: fileName is now included in the batch objects from listBatches
      const files = batches.map(batch => ({
        _id: batch._id,
        fileName: batch.fileName || `Batch Run ${batch.runNumber}`, // Use batch.fileName or fallback
        status: batch.status,
        updatedAt: batch.updatedAt,
        createdAt: batch.createdAt,
        originalFileId: batch.fileId, // Keep reference to original
        runNumber: batch.runNumber,   // Add run number for identification
        // Add any other fields your UI expects
        description: batch.snapshot?.description || batch.description,
        productRef: batch.snapshot?.productRef,
        solutionRef: batch.snapshot?.solutionRef,
        recipeQty: batch.snapshot?.recipeQty,
        recipeUnit: batch.snapshot?.recipeUnit,
        components: batch.snapshot?.components,
      }));

      return NextResponse.json({ files });
    } else {
      // Regular batch listing
      const batches = await listBatches({ status, fileId });
      return NextResponse.json({ batches });
    }
  } catch (err) {
    console.error('GET /api/batches', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const data = await req.json();
    
    // Check if this is a save-from-editor request
    if (data.originalFileId && data.editorData) {
      // Handle save from editor with property inheritance
      const { originalFileId, editorData, action = 'save', status } = data;
      
      if (!originalFileId || !editorData) {
        return NextResponse.json({ 
          error: 'originalFileId and editorData are required' 
        }, { status: 400 });
      }

      // Determine status based on action
      let batchStatus = status;
      if (!batchStatus) {
        batchStatus = action === 'submit_review' ? 'Review' :
                     action === 'submit_final' ? 'Completed' :
                     action === 'reject' ? 'In Progress' : 'In Progress';
      }

      // Get the original file to inherit its properties
      const originalFile = await getFileById(originalFileId, { includePdf: false });
      
      if (!originalFile) {
        return NextResponse.json({ 
          error: 'Original file not found' 
        }, { status: 404 });
      }

      // Create batch with inherited properties from original file
      const batchData = {
        fileId: originalFileId,
        status: batchStatus,
        fileName: originalFile.fileName || `Copy of ${originalFile.fileName || 'Unknown'}`, // Ensure fileName is set
        
        // Inherit all the properties from the original file
        description: originalFile.description,
        productRef: originalFile.productRef,
        solutionRef: originalFile.solutionRef,
        recipeQty: originalFile.recipeQty,
        recipeUnit: originalFile.recipeUnit,
        components: originalFile.components,
        
        // Add editor-specific data
        overlayPng: editorData.overlayPng,
        // Note: Your batch model only supports single overlayPng, not multiple annotations
        // If you need multiple overlays, you'll need to modify the Batch schema
      };

      const batch = await createBatch(batchData);
      return NextResponse.json({ batch });
    } else {
      // Regular batch creation
      const batch = await createBatch(data);
      return NextResponse.json({ batch });
    }
  } catch (err) {
    console.error('POST /api/batches', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}