// services/batch.service.js - Updated with NetSuite Work Order integration
import mongoose from 'mongoose';
import connectMongoDB from '@/lib/index';
import Batch    from '@/models/Batch.js';
import File     from '@/models/File.js';
import { Item } from '@/models/Item.js';
import User from '@/models/User.js';
import { txnService } from './txn.service.js';
import { getFileById }       from './file.service.js';
import { createArchiveCopy } from './archive.service.js';
import { createWorkOrderService } from './netsuite/workorder.service.js';

const asId = (id) => new mongoose.Types.ObjectId(id);

/** Helper function to create a system user for transactions */
function getSystemUser() {
  return {
    _id: new mongoose.Types.ObjectId('000000000000000000000000'), // Use a consistent system user ID
    name: 'System',
    email: 'system@company.com'
  };
}

/** Helper function to get a full User document with methods */
async function getFullUser(user) {
  if (!user) return null;
  
  // If it's already a Mongoose document with methods, return as is
  if (typeof user.hasNetSuiteAccess === 'function') {
    return user;
  }
  
  // If it's a plain object with _id, fetch the full user
  if (user._id) {
    try {
      const fullUser = await User.findById(user._id);
      return fullUser;
    } catch (error) {
      console.error('Error fetching full user:', error);
      return user; // Return original if fetch fails
    }
  }
  
  return user;
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

/** ENHANCED: Create work order in NetSuite */
async function createNetSuiteWorkOrder(batch, quantity, user = null) {
  console.log('Creating NetSuite work order for batch:', batch._id);
  
  try {
    // Get full user with methods
    const fullUser = await getFullUser(user);
    
    // Check if user has NetSuite access
    let hasNetSuiteAccess = false;
    
    if (fullUser) {
      // If user is a Mongoose document, call the method
      if (typeof fullUser.hasNetSuiteAccess === 'function') {
        hasNetSuiteAccess = fullUser.hasNetSuiteAccess();
      }
      // If user is a plain object, check the property directly
      else if (fullUser.netsuiteCredentials && fullUser.netsuiteCredentials.isConfigured) {
        hasNetSuiteAccess = true;
      }
    }
    
    // Also check environment variables as fallback
    if (!hasNetSuiteAccess && process.env.NETSUITE_ACCOUNT_ID && process.env.NETSUITE_CONSUMER_KEY && 
        process.env.NETSUITE_CONSUMER_SECRET && process.env.NETSUITE_TOKEN_ID && 
        process.env.NETSUITE_TOKEN_SECRET) {
      hasNetSuiteAccess = true;
      console.log('Using environment variables for NetSuite access');
    }
    
    if (!hasNetSuiteAccess) {
      console.log('User does not have NetSuite access, skipping work order creation');
      return { 
        id: `LOCAL-WO-${Date.now()}`, 
        status: 'created_locally',
        source: 'local'
      };
    }
    
    const workOrderService = createWorkOrderService(fullUser);
    
    // Create work order from batch
    const result = await workOrderService.createWorkOrderFromBatch(batch, quantity);
    
    console.log('NetSuite work order created:', result.workOrder.tranId);
    
    return {
      id: result.workOrder.tranId || result.workOrder.id,
      netsuiteId: result.workOrder.id,
      tranId: result.workOrder.tranId,
      status: result.workOrder.status,
      bomId: result.workOrder.bomId,
      revisionId: result.workOrder.revisionId,
      quantity: quantity,
      source: 'netsuite',
      fullResponse: result
    };
    
  } catch (error) {
    console.error('Error creating NetSuite work order:', error);
    
    // Fall back to local work order creation
    console.log('Falling back to local work order creation');
    return { 
      id: `LOCAL-WO-${Date.now()}`, 
      status: 'created_locally',
      source: 'local',
      error: error.message
    };
  }
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
    // Fetch the solution item so we can read its netsuiteInternalId
      const solutionItemId = batch.snapshot?.solutionRef;
      if (!solutionItemId) {
        throw new Error('Batch snapshot missing solutionRef');
      }
      const solutionItem = await Item.findById(solutionItemId).lean();
      if (!solutionItem?.netsuiteInternalId) {
        throw new Error('Solution item does not have a NetSuite Internal ID');
      }

      const assemblyItemId = solutionItem.netsuiteInternalId;


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

/** ENHANCED: Complete NetSuite work order */
async function completeNetSuiteWorkOrder(workOrderId, user = null, quantityCompleted = null) {
  console.log('Completing NetSuite work order:', workOrderId);
  
  try {
    // Get full user with methods
    const fullUser = await getFullUser(user);
    
    // Check if this is a local work order or if user has NetSuite access
    let hasNetSuiteAccess = false;
    
    if (fullUser) {
      // If user is a Mongoose document, call the method
      if (typeof fullUser.hasNetSuiteAccess === 'function') {
        hasNetSuiteAccess = fullUser.hasNetSuiteAccess();
      }
      // If user is a plain object, check the property directly
      else if (fullUser.netsuiteCredentials && fullUser.netsuiteCredentials.isConfigured) {
        hasNetSuiteAccess = true;
      }
    }
    
    // Also check environment variables as fallback
    if (!hasNetSuiteAccess && process.env.NETSUITE_ACCOUNT_ID && process.env.NETSUITE_CONSUMER_KEY && 
        process.env.NETSUITE_CONSUMER_SECRET && process.env.NETSUITE_TOKEN_ID && 
        process.env.NETSUITE_TOKEN_SECRET) {
      hasNetSuiteAccess = true;
    }
    
    if (workOrderId.startsWith('LOCAL-WO-') || !hasNetSuiteAccess) {
      console.log('Local work order or no NetSuite access, marking as completed locally');
      return { id: workOrderId, status: 'completed_locally', source: 'local' };
    }
    
    const workOrderService = createWorkOrderService(fullUser);
    const result = await workOrderService.completeWorkOrder(workOrderId, quantityCompleted);
    
    console.log('NetSuite work order completed:', workOrderId);
    return { 
      id: workOrderId, 
      status: 'completed',
      source: 'netsuite',
      result: result
    };
    
  } catch (error) {
    console.error('Error completing NetSuite work order:', error);
    
    // Fall back to local completion
    return { 
      id: workOrderId, 
      status: 'completed_locally', 
      source: 'local',
      error: error.message
    };
  }
}

/** CREATE a new Batch from a File template with enhanced NetSuite workflow */
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

  // ENHANCED: Handle work order creation with NetSuite integration
  if (payload.action === 'create_work_order') {
    try {
      // Get quantity from confirmation data or default
      const quantity = confirmationData?.batchQuantity || confirmationData?.solutionQuantity || snapshot.recipeQty || 1;
      
      const workOrderResult = await createNetSuiteWorkOrder(batch, quantity, user);
      
      // Update batch with work order info
      batch.workOrderId = workOrderResult.id;
      batch.workOrderCreated = true;
      batch.workOrderCreatedAt = new Date();
      
      // Store NetSuite-specific data if it's a NetSuite work order
      if (workOrderResult.source === 'netsuite') {
        batch.netsuiteWorkOrderData = {
          workOrderId: workOrderResult.netsuiteId,
          tranId: workOrderResult.tranId,
          bomId: workOrderResult.bomId,
          revisionId: workOrderResult.revisionId,
          quantity: quantity,
          status: workOrderResult.status,
          createdAt: new Date()
        };
      }
      
      await batch.save();
      
      console.log('Work order created successfully:', workOrderResult.source);
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

/** UPDATE a batch with enhanced NetSuite workflow logic */
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

  // ENHANCED: Handle work order creation during update
  if (payload.workOrderCreated && !prev.workOrderCreated) {
    try {
      // Get quantity from confirmed components or default
      const quantity = payload.confirmedComponents?.reduce((sum, comp) => sum + (comp.actualAmount || comp.amount || 0), 0) || 
                      prev.snapshot?.recipeQty || 1;
      
      const workOrderResult = await createNetSuiteWorkOrder(prev, quantity, user);
      
      payload.workOrderId = workOrderResult.id;
      payload.workOrderCreatedAt = new Date();
      
      // Store NetSuite-specific data if it's a NetSuite work order
      if (workOrderResult.source === 'netsuite') {
        payload.netsuiteWorkOrderData = {
          workOrderId: workOrderResult.netsuiteId,
          tranId: workOrderResult.tranId,
          bomId: workOrderResult.bomId,
          revisionId: workOrderResult.revisionId,
          quantity: quantity,
          status: workOrderResult.status,
          createdAt: new Date()
        };
      }
    } catch (e) {
      console.error('Failed to create work order during update:', e);
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

  // ENHANCED: Handle work order completion
  if (payload.status === 'Completed' && prev.status !== 'Completed' && prev.workOrderId) {
    try {
      const completionResult = await completeNetSuiteWorkOrder(
        prev.workOrderId, 
        user,
        payload.solutionQuantity || prev.snapshot?.recipeQty
      );
      
      payload.workOrderStatus = 'completed';
      payload.completedAt = new Date();
      
      // Update NetSuite work order data if it exists
      if (prev.netsuiteWorkOrderData && completionResult.source === 'netsuite') {
        payload.netsuiteWorkOrderData = {
          ...prev.netsuiteWorkOrderData,
          status: 'completed',
          completedAt: new Date()
        };
      }
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

/** Alias for single get */
export const getBatch = getBatchById;