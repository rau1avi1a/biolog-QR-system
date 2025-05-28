import mongoose from 'mongoose';
import connectMongoDB from '@/lib/index';
import Batch    from '@/models/Batch.js';
import File     from '@/models/File.js';
import { Item } from '@/models/Item.js';
import { txnService } from './txn.service.js';
import { getFileById }       from './file.service.js';
import { createArchiveCopy } from './archive.service.js';

const asId = (id) => new mongoose.Types.ObjectId(id);

/** Helper function to bake overlay PNG into PDF */
async function bakeOverlayIntoPdf(originalPdfDataUrl, overlayPng) {
  const { PDFDocument } = await import('pdf-lib');
  const pdfBase64 = originalPdfDataUrl.split(',')[1];
  const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const [firstPage] = pdfDoc.getPages();
  const { width: pdfWidth, height: pdfHeight } = firstPage.getSize();
  const pngBase64 = overlayPng.split(',')[1];
  const pngBytes = Uint8Array.from(atob(pngBase64), c => c.charCodeAt(0));
  const pngImage = await pdfDoc.embedPng(pngBytes);
  firstPage.drawImage(pngImage, { x:0, y:0, width:pdfWidth, height:pdfHeight });
  const modifiedPdfBytes = await pdfDoc.save();
  return Buffer.from(modifiedPdfBytes);
}

/** REAL implementation: Create work order (no chemical transactions) */
async function createWorkOrderOnly(batch) {
  console.log('Creating work order for batch:', batch._id);
  
  try {
    // Just create the work order record (you can expand this later for NetSuite)
    const workOrderId = `WO-${Date.now()}`;
    
    console.log('Work order created:', workOrderId);
    
    return { 
      id: workOrderId, 
      status: 'in_progress'
    };
  } catch (error) {
    console.error('Error creating work order:', error);
    throw error;
  }
}

/** REAL implementation: Transact chemicals from inventory (for Submit for Review) */
async function transactChemicals(batch, confirmationData) {
  try {
    if (confirmationData?.components?.length > 0) {
      const txnLines = confirmationData.components.map(comp => {
        // Extract itemId more robustly
        let itemId;
        if (comp.itemId) {
          if (typeof comp.itemId === 'object' && comp.itemId._id) {
            itemId = comp.itemId._id;
          } else {
            itemId = comp.itemId;
          }
        } else if (comp.item) {
          itemId = comp.item._id || comp.item;
        }
        
        return {
          item: itemId,
          lot: comp.lotNumber,
          qty: -(comp.actualAmount || comp.amount) // Negative for consumption
        };
      }).filter(line => line.item && line.lot); // Only include valid lines

      // Post the inventory transaction
      await txnService.post({
        txnType: 'issue',
        lines: txnLines,
        actor: {
          _id: batch._id,
          name: 'Batch System',
          email: 'system@company.com'
        },
        memo: `Chemical consumption for batch ${batch.runNumber}`,
        project: `Batch-${batch._id}`,
        department: 'Production'
      });

      return { success: true, transactionCompleted: true };
    }
    
    return { success: false, reason: 'No components to transact' };
  } catch (error) {
    console.error('Error transacting chemicals:', error);
    throw error;
  }
}

/** REAL implementation: Create solution lot in inventory */
async function createSolutionLot(batch, solutionLotNumber, solutionQty = null, solutionUnit = 'L') {
  console.log('Creating solution lot for batch:', batch._id, 'lotNumber:', solutionLotNumber);
  
  try {
    // Get the solution item from the batch snapshot
    const solutionItemId = batch.snapshot?.solutionRef;
    if (!solutionItemId) {
      throw new Error('No solution reference found in batch snapshot');
    }

    // Default quantity from recipe if not provided
    const quantity = solutionQty || batch.snapshot?.recipeQty || 1;
    const unit = solutionUnit || batch.snapshot?.recipeUnit || 'L';

    console.log('Creating solution with:', { solutionItemId, solutionLotNumber, quantity, unit });
    console.log('Transaction data being sent:', {
      txnType: 'build',
      lines: [{
        item: solutionItemId,
        lot: solutionLotNumber,
        qty: quantity
      }]
    });

    // Create inventory transaction for the solution (positive quantity = receipt)
    await txnService.post({
      txnType: 'build', // 'build' because we're creating/building the solution
      lines: [{
        item: solutionItemId,
        lot: solutionLotNumber,
        qty: quantity // Positive for production
      }],
      actor: {
        _id: batch._id,
        name: 'Batch System',
        email: 'system@company.com'
      },
      memo: `Solution lot created from batch ${batch.runNumber}`,
      project: `Batch-${batch._id}`,
      department: 'Production'
    });

    console.log('Successfully created solution lot:', { solutionLotNumber, quantity, unit });
    
    return { 
      lotNumber: solutionLotNumber, 
      quantity,
      unit,
      created: true 
    };
  } catch (error) {
    console.error('Error creating solution lot:', error);
    throw error;
  }
}

/** Placeholder for completing work order */
async function completeNetSuiteWorkOrder(workOrderId) {
  console.log('Completing work order:', workOrderId);
  return { id: workOrderId, status:'completed' };
}

/** CREATE a new Batch from a File template with enhanced workflow */
export async function createBatch(payload) {
  await connectMongoDB();
  
  let fileId, overlayPng, status, editorData, confirmationData;
  
  if (payload.originalFileId && payload.editorData) {
    fileId = payload.originalFileId;
    overlayPng = payload.editorData.overlayPng;
    editorData = payload.editorData;
    status = payload.status || 'In Progress';
    confirmationData = payload.confirmationData;
  } else {
    fileId = payload.fileId;
    overlayPng = payload.overlayPng;
    status = payload.status || 'In Progress';
  }

  const file = await getFileById(fileId, { includePdf: true });
  if (!file) throw new Error('File not found');

  // Create snapshot from file properties
  const snapshot = {
    enabled     : true,
    productRef  : file.productRef,
    solutionRef : file.solutionRef,
    recipeQty   : file.recipeQty,
    recipeUnit  : file.recipeUnit,
    components  : file.components || []
  };

  // Handle PDF overlay if provided
  let signedPdf = null;
  if (overlayPng && file.pdf) {
    try {
      const originalPdfUrl = `data:${file.pdf.contentType};base64,${file.pdf.data.toString('base64')}`;
      signedPdf = await bakeOverlayIntoPdf(originalPdfUrl, overlayPng);
    } catch (e) {
      console.error('Failed to bake overlay into PDF:', e);
    }
  }

  // Prepare batch data
  const batchData = { 
    fileId: asId(fileId), 
    overlayPng, 
    status, 
    snapshot 
  };

  // Handle confirmation data and set flags
  if (confirmationData) {
    if (confirmationData.components?.length > 0) {
      batchData.confirmedComponents = confirmationData.components;
    }
    if (confirmationData.solutionLotNumber) {
      batchData.solutionLotNumber = confirmationData.solutionLotNumber;
    }
  }

  // Set workflow flags based on payload
  if (payload.workOrderStatus)     batchData.workOrderStatus     = payload.workOrderStatus;
  if (payload.chemicalsTransacted) batchData.chemicalsTransacted = payload.chemicalsTransacted;
  if (payload.solutionCreated)     batchData.solutionCreated     = payload.solutionCreated;
  if (payload.solutionLotNumber)   batchData.solutionLotNumber   = payload.solutionLotNumber;

  if (signedPdf) {
    batchData.signedPdf = { data: signedPdf, contentType: 'application/pdf' };
  }

  // Create the batch
  const batch = await Batch.create(batchData);

  // Handle work order creation (no transactions)
  if (payload.action === 'create_work_order') {
    try {
      const workOrderResult = await createWorkOrderOnly(batch);
      
      // Update batch with work order info only
      batch.workOrderId = workOrderResult.id;
      batch.workOrderCreated = true;
      batch.workOrderCreatedAt = new Date();
      // Don't set chemicalsTransacted here
      
      await batch.save();
      
      console.log('Work order created successfully (no transactions)');
    } catch (e) {
      console.error('Failed to create work order:', e);
      // Don't throw - let the batch be created even if work order fails
    }
  }

  // Handle chemical transactions and solution creation (Submit for Review)
  if (payload.action === 'submit_review' && confirmationData) {
    try {
      // 1. Transact chemicals if components provided
      if (confirmationData.components?.length > 0) {
        const transactionResult = await transactChemicals(batch, confirmationData);
        
        if (transactionResult.success) {
          batch.chemicalsTransacted = true;
          batch.transactionDate = new Date();
          console.log('Chemicals transacted successfully');
        }
      }

      // 2. Create solution if lot number provided
      if (confirmationData.solutionLotNumber) {
        const solutionResult = await createSolutionLot(
          batch, 
          confirmationData.solutionLotNumber,
          confirmationData.solutionQuantity || snapshot.recipeQty,
          confirmationData.solutionUnit || snapshot.recipeUnit
        );
        
        batch.solutionCreated = true;
        batch.solutionCreatedDate = new Date();
        batch.solutionLotNumber = solutionResult.lotNumber;
        
        console.log('Solution lot created successfully');
      }
      
      await batch.save();
      
    } catch (e) {
      console.error('Failed to process submit for review:', e);
      // Don't throw - let the batch be created even if transactions fail
    }
  }

  // Return populated batch
  return Batch.findById(batch._id)
    .populate('fileId', 'fileName pdf')
    .populate('snapshot.productRef',  '_id displayName sku')
    .populate('snapshot.solutionRef', '_id displayName sku')
    .populate('snapshot.components.itemId', '_id displayName sku')
    .lean();
}

/** UPDATE a batch with enhanced workflow logic */
export async function updateBatch(id, payload) {
  await connectMongoDB();
  
  const prev = await Batch.findById(id).populate('fileId','pdf').lean();
  if (!prev) throw new Error('Batch not found');

  // Handle PDF overlay updates
  if (payload.overlayPng && prev?.fileId?.pdf) {
    try {
      const originalPdfUrl = `data:${prev.fileId.contentType};base64,${prev.fileId.pdf.data.toString('base64')}`;
      let allOverlays = prev.overlayHistory?.length ? [...prev.overlayHistory] : (prev.overlayPng ? [prev.overlayPng] : []);
      allOverlays.push(payload.overlayPng);
      let currentPdfUrl = originalPdfUrl;
      for (const ov of allOverlays) {
        const baked = await bakeOverlayIntoPdf(currentPdfUrl, ov);
        currentPdfUrl = `data:application/pdf;base64,${baked.toString('base64')}`;
      }
      const finalBytes = Buffer.from(currentPdfUrl.split(',')[1], 'base64');
      payload.signedPdf = { data: finalBytes, contentType:'application/pdf' };
      payload.overlayHistory = allOverlays;
    } catch (e) {
      console.error('Failed to bake overlays during update:', e);
    }
  }

  // Handle chemical transactions during update (for submit_review)
  if (payload.chemicalsTransacted && payload.confirmedComponents?.length > 0) {
    try {
      const confirmationData = {
        components: payload.confirmedComponents
      };
      const transactionResult = await transactChemicals({ _id: id, snapshot: prev.snapshot }, confirmationData);
      
      if (transactionResult.success) {
        console.log('Chemicals transacted successfully during update');
      }
    } catch (e) {
      console.error('Failed to transact chemicals during update:', e);
    }
  }

  // Handle solution creation during update
  if (payload.solutionCreated && !prev.solutionCreated && payload.solutionLotNumber) {
    try {
      await createSolutionLot(
        { _id: id, snapshot: prev.snapshot }, 
        payload.solutionLotNumber,
        payload.solutionQuantity || prev.snapshot?.recipeQty,
        payload.solutionUnit || prev.snapshot?.recipeUnit
      );
      payload.solutionCreatedDate = new Date();
    } catch (e) {
      console.error('Failed to create solution lot during update:', e);
    }
  }

  // Handle work order completion
  if (payload.status === 'Completed' && prev.status !== 'Completed' && prev.workOrderId) {
    try {
      await completeNetSuiteWorkOrder(prev.workOrderId);
      payload.workOrderStatus = 'completed';
      payload.completedAt = new Date();
    } catch (e) {
      console.error('Failed to complete work order during update:', e);
    }
  }

  // Update the batch
  const next = await Batch.findByIdAndUpdate(id, payload, { new: true })
    .populate('fileId','fileName')
    .lean();

  // Handle archiving when completed
  if (prev.status !== 'Completed' && next.status === 'Completed') {
    await createArchiveCopy(next);
  }

  if (next?.fileId) next.fileName = next.fileId.fileName;
  return next;
}

/** GET a single batch by ID */
export async function getBatchById(id) {
  await connectMongoDB();
  const batch = await Batch.findById(id)
    .populate('fileId', 'fileName pdf')
    .populate('snapshot.productRef',  '_id displayName sku')
    .populate('snapshot.solutionRef', '_id displayName sku')
    .populate('snapshot.components.itemId', '_id displayName sku')
    .lean();
  if (!batch) return null;
  if (batch.fileId) batch.fileName = batch.fileId.fileName;
  return batch;
}

/** LIST batches with filtering and pagination */
export async function listBatches(options = {}) {
  await connectMongoDB();
  const {
    filter = {}, sort = { createdAt:-1 }, limit = 20, skip = 0, populate = true
  } = options;
  let query = Batch.find(filter);
  if (populate) {
    query = query
      .populate('fileId', 'fileName')
      .populate('snapshot.productRef',  '_id displayName sku')
      .populate('snapshot.solutionRef', '_id displayName sku')
      .populate('snapshot.components.itemId', '_id displayName sku');
  }
  const batches = await query.sort(sort).limit(limit).skip(skip).lean();
  return batches.map(b => {
    if (b.fileId) b.fileName = b.fileId.fileName;
    return b;
  });
}

/** DELETE a batch */
export async function deleteBatch(id) {
  await connectMongoDB();
  const batch = await Batch.findByIdAndDelete(id)
    .populate('fileId','fileName')
    .lean();
  if (!batch) return null;
  if (batch.fileId) batch.fileName = batch.fileId.fileName;
  return batch;
}

/** Alias for single get */
export const getBatch = getBatchById;