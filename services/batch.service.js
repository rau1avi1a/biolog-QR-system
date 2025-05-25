// services/batch.service.js

import mongoose from 'mongoose';
import connectMongoDB from '@/lib/index';
import Batch    from '@/models/Batch.js';
import File     from '@/models/File.js';
import { getFileById }       from './file.service.js';
import { createArchiveCopy } from './archive.service.js';

const asId = (id) => new mongoose.Types.ObjectId(id);

/** Helper function to bake overlay PNG into PDF */
async function bakeOverlayIntoPdf(originalPdfDataUrl, overlayPng, canvasDimensions = null) {
  // Import pdf-lib
  const { PDFDocument } = await import('pdf-lib');
  
  // Extract base64 data from data URL
  const pdfBase64 = originalPdfDataUrl.split(',')[1];
  const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
  
  // Load the original PDF
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  
  if (pages.length === 0) throw new Error('PDF has no pages');
  
  // Get the first page
  const firstPage = pages[0];
  const { width: pdfWidth, height: pdfHeight } = firstPage.getSize();
  
  console.log('PDF dimensions:', { pdfWidth, pdfHeight });
  
  // Extract base64 data from overlay PNG data URL
  const pngBase64 = overlayPng.split(',')[1];
  const pngBytes = Uint8Array.from(atob(pngBase64), c => c.charCodeAt(0));
  
  // Embed the PNG overlay
  const pngImage = await pdfDoc.embedPng(pngBytes);
  
  // With 1:1 pixel mapping, the overlay should map directly to PDF coordinates
  // The canvas overlay is created at the display size of the PDF
  firstPage.drawImage(pngImage, {
    x: 0,
    y: 0,
    width: pdfWidth,
    height: pdfHeight,
  });
  
  console.log('Drawing overlay with 1:1 mapping to PDF coordinates');
  
  // Serialize the PDF with the overlay baked in
  const modifiedPdfBytes = await pdfDoc.save();
  
  // Return as Buffer for MongoDB storage
  return Buffer.from(modifiedPdfBytes);
}

/** CREATE a new Batch from a File template */
export async function createBatch(payload) {
  await connectMongoDB();
  
  // Handle both old and new API formats
  let fileId, overlayPng, status, editorData;
  
  if (payload.originalFileId && payload.editorData) {
    // New format from editor
    fileId = payload.originalFileId;
    overlayPng = payload.editorData.overlayPng;
    editorData = payload.editorData;
    status = payload.status || 'In Progress';
  } else {
    // Original format
    fileId = payload.fileId;
    overlayPng = payload.overlayPng;
    status = payload.status || 'In Progress';
  }

  const file = await getFileById(fileId, { includePdf: true });
  if (!file) throw new Error('File not found');

  console.log('Original file data:', {
    description: file.description,
    productRef: file.productRef,
    solutionRef: file.solutionRef,
    components: file.components
  });

  const snapshot = {
    enabled     : true,
    productRef  : file.productRef?._id || file.productRef,
    solutionRef : file.solutionRef?._id || file.solutionRef,
    recipeQty   : file.recipeQty,
    recipeUnit  : file.recipeUnit,
    components  : file.components || [],
    description : file.description
  };

  console.log('Snapshot being saved:', snapshot);

  // If we have overlay data, bake it into a new PDF
  let signedPdf = null;
  if (overlayPng && file.pdf) {
    try {
      signedPdf = await bakeOverlayIntoPdf(file.pdf, overlayPng, editorData?.canvasDimensions);
    } catch (error) {
      console.error('Failed to bake overlay into PDF:', error);
      // Continue without signed PDF if baking fails
    }
  }

  const batchData = {
    fileId     : asId(fileId),
    overlayPng,
    status,
    snapshot
  };

  // Add signed PDF if we successfully created one
  if (signedPdf) {
    batchData.signedPdf = {
      data: signedPdf,
      contentType: 'application/pdf'
    };
  }

  const batch = await Batch.create(batchData);

  // Return the batch with populated file data
  return Batch.findById(batch._id)
    .populate('fileId', 'fileName pdf')
    .lean();
}

/** GET one by ID with optional PDF data */
export async function getBatchById(id, { includePdf = false } = {}) {
  await connectMongoDB();
  
  const batch = await Batch.findById(id)
    .populate('fileId', includePdf ? 'fileName pdf' : 'fileName')
    .populate('snapshot.productRef', 'displayName sku')
    .populate('snapshot.solutionRef', 'displayName sku') 
    .populate('snapshot.components.itemId', 'displayName sku')
    .lean();
  
  if (!batch) return null;

  console.log('Loaded batch with populated data:', {
    snapshot: batch.snapshot,
    productRef: batch.snapshot?.productRef,
    solutionRef: batch.snapshot?.solutionRef,
    components: batch.snapshot?.components
  });

  // Add fileName from the referenced file for easier access
  if (batch.fileId) {
    batch.fileName = batch.fileId.fileName;
    
    // If we need PDF data, prioritize the signed/baked PDF
    if (includePdf) {
      if (batch.signedPdf?.data) {
        // Use signed/baked PDF if available (this includes the overlays)
        batch.pdf = `data:${batch.signedPdf.contentType || 'application/pdf'};base64,${batch.signedPdf.data.toString('base64')}`;
      } else if (batch.fileId.pdf?.data) {
        // Fallback to original file PDF
        batch.pdf = `data:${batch.fileId.pdf.contentType || 'application/pdf'};base64,${batch.fileId.pdf.data.toString('base64')}`;
      }
    }
  }

  return batch;
}

/** GET one (legacy method) */
export const getBatch = (id) => getBatchById(id);

/** DELETE one */
export async function deleteBatch(id) {
  await connectMongoDB();
  return Batch.findByIdAndDelete(id).lean();
}

/** LIST all (optionally by fileId / status) */
export async function listBatches({ fileId, status } = {}) {
  await connectMongoDB();
  
  const q = {};
  if (fileId) q.fileId = asId(fileId);
  if (status) q.status = status;

  const batches = await Batch.find(q)
    .sort({ runNumber: -1 })
    .populate('fileId','fileName')    // bring in the mother file's name
    .lean();

  // Add fileName to each batch for easier access
  return batches.map(batch => ({
    ...batch,
    fileName: batch.fileId?.fileName || `Batch Run ${batch.runNumber}`
  }));
}

/** UPDATE a batch (and when flipping to Completed, archive) */
export async function updateBatch(id, payload) {
  await connectMongoDB();
  
  const prev = await Batch.findById(id).populate('fileId', 'pdf').lean();
  
  // If we're updating with new overlay data, accumulate it with previous overlays
  if (payload.overlayPng && prev?.fileId?.pdf) {
    try {
      // Get the base PDF (original file)
      const originalPdf = `data:application/pdf;base64,${prev.fileId.pdf.data.toString('base64')}`;
      
      // Create an array to store all overlays (previous + new)
      let allOverlays = [];
      
      // Add previous overlays if they exist
      if (prev.overlayHistory && prev.overlayHistory.length > 0) {
        allOverlays = [...prev.overlayHistory];
      } else if (prev.overlayPng) {
        // If no overlay history but there's an existing overlay, start the history
        allOverlays = [prev.overlayPng];
      }
      
      // Add the new overlay to the history
      allOverlays.push(payload.overlayPng);
      
      console.log(`Accumulating overlays: ${allOverlays.length} total overlays`);
      
      // Bake all overlays sequentially into the PDF
      let currentPdf = originalPdf;
      for (let i = 0; i < allOverlays.length; i++) {
        console.log(`Baking overlay ${i + 1}/${allOverlays.length}`);
        const bakedBytes = await bakeOverlayIntoPdf(currentPdf, allOverlays[i], payload.canvasDimensions);
        // Convert back to data URL for next iteration
        currentPdf = `data:application/pdf;base64,${bakedBytes.toString('base64')}`;
      }
      
      // Final baked PDF
      const finalBakedBytes = Buffer.from(currentPdf.split(',')[1], 'base64');
      
      payload.signedPdf = {
        data: finalBakedBytes,
        contentType: 'application/pdf'
      };
      
      // Update overlay history
      payload.overlayHistory = allOverlays;
      
    } catch (error) {
      console.error('Failed to bake overlays into PDF during update:', error);
      // Continue without updating signed PDF if baking fails
    }
  }
  
  const next = await Batch.findByIdAndUpdate(id, payload, { new: true })
    .populate('fileId', 'fileName')
    .lean();

  if (prev && next && prev.status !== 'Completed' && next.status === 'Completed') {
    await createArchiveCopy(next);
  }

  // Add fileName for consistency
  if (next?.fileId) {
    next.fileName = next.fileId.fileName;
  }

  return next;
}