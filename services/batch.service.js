// services/batch.service.js - Updated with async work order creation
import mongoose from 'mongoose';
import connectMongoDB from '@/lib/index';
import Batch    from '@/models/Batch.js';
import File     from '@/models/File.js';
import { Item } from '@/models/Item.js';
import User from '@/models/User.js';
import { txnService } from './txn.service.js';
import { getFileById }       from './file.service.js';
import { createArchiveCopy } from './archive.service.js';
import AsyncWorkOrderService from './async-workorder.service.js';

const asId = (id) => new mongoose.Types.ObjectId(id);

/** Helper function to create a system user for transactions */
function getSystemUser() {
  return {
    _id: new mongoose.Types.ObjectId('000000000000000000000000'), // Use a consistent system user ID
    name: 'System',
    email: 'system@company.com'
  };
}

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

/** REAL implementation: Transact chemicals from inventory (for Submit for Review) */
async function transactChemicals(batch, confirmationData, user = null) {
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

      // Use provided user or system user
      const actor = user || getSystemUser();

      // Post the inventory transaction with batch references and actual user
      await txnService.post({
        txnType: 'issue',
        lines: txnLines,
        actor: {
          _id: actor._id,
          name: actor.name,
          email: actor.email
        },
        memo: `Chemical consumption for batch ${batch.runNumber || 'Unknown'}`,
        project: `Batch-${batch._id}`,
        department: 'Production',
        // ADD BATCH REFERENCES:
        batchId: batch._id,                    // Link to batch
        workOrderId: batch.workOrderId,        // NetSuite work order ID
        refDoc: batch.fileId,                  // Original file reference
        refDocType: 'batch'                    // Document type
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
async function createSolutionLot(batch, solutionLotNumber, solutionQty = null, solutionUnit = 'L', user = null) {
  console.log('Creating solution lot for batch:', batch._id, 'lotNumber:', solutionLotNumber);
  
  try {
    // Get the solution item from the batch snapshot
    const solutionItemId = batch.snapshot?.solutionRef;
    if (!solutionItemId) {
      throw new Error('Batch snapshot missing solutionRef');
    }
    const solutionItem = await Item.findById(solutionItemId).lean();
    if (!solutionItem?.netsuiteInternalId) {
      throw new Error('Solution item does not have a NetSuite Internal ID');
    }

    // Default quantity from recipe if not provided
    const quantity = solutionQty || batch.snapshot?.recipeQty || 1;
    const unit = solutionUnit || batch.snapshot?.recipeUnit || 'L';

    console.log('Creating solution with:', { solutionItemId, solutionLotNumber, quantity, unit });

    // Use provided user or system user
    const actor = user || getSystemUser();

    // Create inventory transaction for the solution (positive quantity = receipt) with batch references
    await txnService.post({
      txnType: 'build', // 'build' because we're creating/building the solution
      lines: [{
        item: solutionItemId,
        lot: solutionLotNumber,
        qty: quantity // Positive for production
      }],
      actor: {
        _id: actor._id,
        name: actor.name,
        email: actor.email
      },
      memo: `Solution lot created from batch ${batch.runNumber || 'Unknown'}`,
      project: `Batch-${batch._id}`,
      department: 'Production',
      // ADD BATCH REFERENCES:
      batchId: batch._id,
      workOrderId: batch.workOrderId,
      refDoc: batch.fileId,
      refDocType: 'batch'
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

/** CREATE a new Batch from a File template with async NetSuite workflow */
export async function createBatch(payload) {
  await connectMongoDB();
  
  let fileId, overlayPng, status, editorData, confirmationData, user;
  
  if (payload.originalFileId && payload.editorData) {
    fileId = payload.originalFileId;
    overlayPng = payload.editorData.overlayPng;
    editorData = payload.editorData;
    status = payload.status || 'In Progress';
    confirmationData = payload.confirmationData;
    user = payload.user; // Get user from payload
  } else {
    fileId = payload.fileId;
    overlayPng = payload.overlayPng;
    status = payload.status || 'In Progress';
    user = payload.user; // Get user from payload
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

  // ENHANCED: Handle work order creation with async processing
  if (payload.action === 'create_work_order') {
    try {
      // Get quantity from confirmation data or default
      const quantity = confirmationData?.batchQuantity || confirmationData?.solutionQuantity || snapshot.recipeQty || 1;
      
      // Use async work order service for background creation
      const workOrderResult = await AsyncWorkOrderService.queueWorkOrderCreation(
        batch._id, 
        quantity, 
        user?._id
      );
      
      console.log('Work order queued successfully:', workOrderResult);
    } catch (e) {
      console.error('Failed to queue work order creation:', e);
      // Don't throw - let the batch be created even if work order queuing fails
    }
  }

  // Handle chemical transactions and solution creation (Submit for Review)
  if (payload.action === 'submit_review' && confirmationData) {
    try {
      // 1. Transact chemicals if components provided
      if (confirmationData.components?.length > 0) {
        const transactionResult = await transactChemicals(batch, confirmationData, user);
        
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
          confirmationData.solutionUnit || snapshot.recipeUnit,
          user
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
    .populate('snapshot.solutionRef', '_id displayName sku netsuiteInternalId')
    .populate('snapshot.components.itemId', '_id displayName sku')
    .lean();
}

/** UPDATE a batch with enhanced NetSuite workflow logic and async work orders */
export async function updateBatch(id, payload) {
  await connectMongoDB();
  
  const prev = await Batch.findById(id).populate('fileId','pdf').lean();
  if (!prev) throw new Error('Batch not found');

  // Get user from payload for transactions
  const user = payload.user || getSystemUser();

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

  // ENHANCED: Handle work order creation during update with async processing
  if (payload.workOrderCreated && !prev.workOrderCreated) {
    try {
      // Get quantity from confirmed components or default
      const quantity = payload.confirmedComponents?.reduce((sum, comp) => sum + (comp.actualAmount || comp.amount || 0), 0) || 
                      prev.snapshot?.recipeQty || 1;
      
      // Use async work order service
      const workOrderResult = await AsyncWorkOrderService.queueWorkOrderCreation(
        id, 
        quantity, 
        user?._id
      );
      
      console.log('Work order queued during update:', workOrderResult);
    } catch (e) {
      console.error('Failed to queue work order creation during update:', e);
    }
  }

  // Handle chemical transactions during update (for submit_review)
  if (payload.chemicalsTransacted && payload.confirmedComponents?.length > 0) {
    try {
      const confirmationData = {
        components: payload.confirmedComponents
      };
      const transactionResult = await transactChemicals({ _id: id, runNumber: prev.runNumber, snapshot: prev.snapshot }, confirmationData, user);
      
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
        { _id: id, runNumber: prev.runNumber, snapshot: prev.snapshot }, 
        payload.solutionLotNumber,
        payload.solutionQuantity || prev.snapshot?.recipeQty,
        payload.solutionUnit || prev.snapshot?.recipeUnit,
        user
      );
      payload.solutionCreatedDate = new Date();
    } catch (e) {
      console.error('Failed to create solution lot during update:', e);
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
    .populate('snapshot.solutionRef', '_id displayName sku netsuiteInternalId')
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
      .populate('snapshot.solutionRef', '_id displayName sku netsuiteInternalId')
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

/** Get work order status for a batch */
export async function getWorkOrderStatus(batchId) {
  return AsyncWorkOrderService.getWorkOrderStatus(batchId);
}

/** Retry work order creation */
export async function retryWorkOrderCreation(batchId, quantity, userId = null) {
  return AsyncWorkOrderService.retryWorkOrderCreation(batchId, quantity, userId);
}

/** Alias for single get */
export const getBatch = getBatchById;