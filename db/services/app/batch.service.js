// db/services/app/batch.service.js - Consolidated batch operations with single import
import { CoreService } from './core.service.js';
import db from '@/db/index.js';

/**
 * Batch Service - Handles all batch-related operations
 * Uses single db import for all dependencies
 */
class BatchService extends CoreService {
  constructor() {
    super(null); // Pass null for lazy model resolution
  }

  async connect() {
    return db.connect();
  }

  // Lazy model getters
  get model() {
    return db.models.Batch;
  }

  get Batch() {
    return db.models.Batch;
  }

  get File() {
    return db.models.File;
  }

  get Item() {
    return db.models.Item;
  }

  get User() {
    return db.models.User;
  }

  // =============================================================================
  // BATCH CREATION - From your original createBatch function
  // =============================================================================
  
  async createBatch(payload) {
    await this.connect();
    
    let fileId, overlayPng, status, editorData, confirmationData, user;
    
    if (payload.originalFileId && payload.editorData) {
      fileId = payload.originalFileId;
      overlayPng = payload.editorData.overlayPng;
      editorData = payload.editorData;
      status = payload.status || 'In Progress';
      confirmationData = payload.confirmationData;
      user = payload.user;
    } else {
      fileId = payload.fileId;
      overlayPng = payload.overlayPng;
      status = payload.status || 'In Progress';
      user = payload.user;
    }

    // Get file data
    const file = await this.File.findById(fileId).lean();
    if (!file) throw new Error('File not found');

    // Create snapshot from file properties
    const snapshot = {
      enabled: true,
      productRef: file.productRef,
      solutionRef: file.solutionRef,
      recipeQty: file.recipeQty,
      recipeUnit: file.recipeUnit,
      components: file.components || []
    };

    // Handle PDF overlay if provided
    let signedPdf = null;
    if (overlayPng && file.pdf) {
      try {
        signedPdf = await this.bakeOverlayIntoPdf(file.pdf, overlayPng);
      } catch (e) {
        console.error('Failed to bake overlay into PDF:', e);
      }
    }

    // Prepare batch data
    const batchData = { 
      fileId,
      overlayPng, 
      status, 
      snapshot 
    };

    // Handle confirmation data
    if (confirmationData) {
      if (confirmationData.components?.length > 0) {
        batchData.confirmedComponents = confirmationData.components;
      }
      if (confirmationData.solutionLotNumber) {
        batchData.solutionLotNumber = confirmationData.solutionLotNumber;
      }
    }

    // Set workflow flags
    if (payload.workOrderStatus) batchData.workOrderStatus = payload.workOrderStatus;
    if (payload.chemicalsTransacted) batchData.chemicalsTransacted = payload.chemicalsTransacted;
    if (payload.solutionCreated) batchData.solutionCreated = payload.solutionCreated;
    if (payload.solutionLotNumber) batchData.solutionLotNumber = payload.solutionLotNumber;

    if (signedPdf) {
      batchData.signedPdf = { data: signedPdf, contentType: 'application/pdf' };
    }

    // Create the batch
    const batch = await this.create(batchData);

    // Handle work order creation using db.services
    if (payload.action === 'create_work_order') {
      try {
        const quantity = confirmationData?.batchQuantity || confirmationData?.solutionQuantity || snapshot.recipeQty || 1;
        await db.services.AsyncWorkOrderService.queueWorkOrderCreation(batch._id, quantity, user?._id);
        console.log('Work order queued successfully');
      } catch (e) {
        console.error('Failed to queue work order creation:', e);
      }
    }

    // Handle chemical transactions and solution creation using db.services
    if (payload.action === 'submit_review' && confirmationData) {
      try {
        if (confirmationData.components?.length > 0) {
          const transactionResult = await this.transactChemicals(batch, confirmationData, user);
          if (transactionResult.success) {
            batch.chemicalsTransacted = true;
            batch.transactionDate = new Date();
          }
        }

        if (confirmationData.solutionLotNumber) {
          const solutionResult = await this.createSolutionLot(
            batch, 
            confirmationData.solutionLotNumber,
            confirmationData.solutionQuantity || snapshot.recipeQty,
            confirmationData.solutionUnit || snapshot.recipeUnit,
            user
          );
          
          batch.solutionCreated = true;
          batch.solutionCreatedDate = new Date();
          batch.solutionLotNumber = solutionResult.lotNumber;
        }
        
        await batch.save();
      } catch (e) {
        console.error('Failed to process submit for review:', e);
      }
    }

    // Return populated batch
    return this.findById(batch._id);
  }

  // =============================================================================
  // BATCH UPDATE - From your original updateBatch function
  // =============================================================================
  
  async updateBatch(id, payload) {
    await this.connect();
    
    const prev = await this.Batch.findById(id).populate('fileId','pdf').lean();
    if (!prev) throw new Error('Batch not found');

    const user = payload.user || this.getSystemUser();

    // Handle PDF overlay updates
    if (payload.overlayPng && prev?.fileId?.pdf) {
      try {
        // Complex overlay logic from your original code
        const originalPdfUrl = `data:${prev.fileId.contentType};base64,${prev.fileId.pdf.data.toString('base64')}`;
        let allOverlays = prev.overlayHistory?.length ? [...prev.overlayHistory] : (prev.overlayPng ? [prev.overlayPng] : []);
        allOverlays.push(payload.overlayPng);
        
        let currentPdfUrl = originalPdfUrl;
        for (const ov of allOverlays) {
          const baked = await this.bakeOverlayIntoPdf(currentPdfUrl, ov);
          currentPdfUrl = `data:application/pdf;base64,${baked.toString('base64')}`;
        }
        
        const finalBytes = Buffer.from(currentPdfUrl.split(',')[1], 'base64');
        payload.signedPdf = { data: finalBytes, contentType:'application/pdf' };
        payload.overlayHistory = allOverlays;
      } catch (e) {
        console.error('Failed to bake overlays during update:', e);
      }
    }

    // Handle work order creation during update using db.services
    if (payload.workOrderCreated && !prev.workOrderCreated) {
      try {
        const quantity = payload.confirmedComponents?.reduce((sum, comp) => sum + (comp.actualAmount || comp.amount || 0), 0) || 
                        prev.snapshot?.recipeQty || 1;
        await db.services.AsyncWorkOrderService.queueWorkOrderCreation(id, quantity, user?._id);
      } catch (e) {
        console.error('Failed to queue work order creation during update:', e);
      }
    }

    // Handle chemical transactions during update
    if (payload.chemicalsTransacted && payload.confirmedComponents?.length > 0) {
      try {
        const confirmationData = { components: payload.confirmedComponents };
        const transactionResult = await this.transactChemicals({ _id: id, runNumber: prev.runNumber, snapshot: prev.snapshot }, confirmationData, user);
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
        await this.createSolutionLot(
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
    const next = await this.updateById(id, payload);

    // Handle archiving when completed using db.services
    if (prev.status !== 'Completed' && next.status === 'Completed') {
      await db.services.archiveService.createArchiveCopy(next);
    }

    return next;
  }

  // =============================================================================
  // BATCH RETRIEVAL - Enhanced versions
  // =============================================================================
  
  async getBatchById(id) {
    return this.findById(id, {
      populate: [
        { path: 'fileId', select: 'fileName pdf' },
        { path: 'snapshot.productRef', select: '_id displayName sku' },
        { path: 'snapshot.solutionRef', select: '_id displayName sku netsuiteInternalId' },
        { path: 'snapshot.components.itemId', select: '_id displayName sku' }
      ]
    });
  }

  async listBatches(options = {}) {
    const { filter = {}, sort = { createdAt: -1 }, limit = 20, skip = 0 } = options;
    
    return this.find({
      filter,
      populate: [
        { path: 'fileId', select: 'fileName' },
        { path: 'snapshot.productRef', select: '_id displayName sku' },
        { path: 'snapshot.solutionRef', select: '_id displayName sku netsuiteInternalId' },
        { path: 'snapshot.components.itemId', select: '_id displayName sku' }
      ],
      sort,
      limit,
      skip
    });
  }

  async deleteBatch(id) {
    const batch = await this.findById(id);
    if (!batch) return null;
    
    await this.deleteById(id);
    return batch;
  }

  // =============================================================================
  // WORK ORDER OPERATIONS - From your original code
  // =============================================================================
  
  async getWorkOrderStatus(batchId) {
    try {
      await this.connect();
      
      const batch = await this.Batch.findOne({ _id: batchId })
        .select('workOrderCreated workOrderStatus workOrderId workOrderError netsuiteWorkOrderData workOrderCreatedAt workOrderFailedAt')
        .lean()
        .read('primary')
        .exec();

      if (!batch) {
        return { error: 'Batch not found' };
      }

      const result = {
        created: batch.workOrderCreated,
        status: batch.workOrderStatus,
        workOrderId: batch.workOrderId,
        workOrderNumber: batch.netsuiteWorkOrderData?.tranId || batch.workOrderId,
        internalId: batch.netsuiteWorkOrderData?.workOrderId,
        error: batch.workOrderError,
        netsuiteData: batch.netsuiteWorkOrderData,
        createdAt: batch.workOrderCreatedAt,
        failedAt: batch.workOrderFailedAt
      };
      
      return result;
    } catch (error) {
      console.error('Error getting work order status:', error);
      return { error: error.message };
    }
  }

  async retryWorkOrderCreation(batchId, quantity, userId = null) {
    try {
      const resetResult = await this.Batch.updateOne(
        { _id: batchId },
        {
          $set: {
            workOrderStatus: 'creating',
            workOrderError: null,
            workOrderFailedAt: null,
            workOrderId: `PENDING-RETRY-${Date.now()}`,
            workOrderCreatedAt: new Date()
          },
          $unset: { netsuiteWorkOrderData: "" }
        }
      );

      if (resetResult.matchedCount === 0) {
        throw new Error('Batch not found for retry');
      }

      // Use db.services for AsyncWorkOrderService
      return db.services.AsyncWorkOrderService.queueWorkOrderCreation(batchId, quantity, userId);
    } catch (error) {
      console.error('Error retrying work order creation:', error);
      throw error;
    }
  }

  // =============================================================================
  // HELPER METHODS - From your original code
  // =============================================================================
  
  async bakeOverlayIntoPdf(originalPdfDataUrl, overlayPng) {
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

  async transactChemicals(batch, confirmationData, user = null) {
    try {
      if (confirmationData?.components?.length > 0) {
        const txnLines = confirmationData.components.map(comp => {
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
            qty: -(comp.actualAmount || comp.amount)
          };
        }).filter(line => line.item && line.lot);

        const actor = user || this.getSystemUser();

        // Use db.services for transaction service
        await db.services.txnService.post({
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
          batchId: batch._id,
          workOrderId: batch.workOrderId,
          refDoc: batch.fileId,
          refDocType: 'batch'
        });

        return { success: true, transactionCompleted: true };
      }
      
      return { success: false, reason: 'No components to transact' };
    } catch (error) {
      console.error('Error transacting chemicals:', error);
      throw error;
    }
  }

  async createSolutionLot(batch, solutionLotNumber, solutionQty = null, solutionUnit = 'L', user = null) {
    try {
      const solutionItemId = batch.snapshot?.solutionRef;
      if (!solutionItemId) {
        throw new Error('Batch snapshot missing solutionRef');
      }
      
      const solutionItem = await this.Item.findById(solutionItemId).lean();
      if (!solutionItem?.netsuiteInternalId) {
        throw new Error('Solution item does not have a NetSuite Internal ID');
      }

      const quantity = solutionQty || batch.snapshot?.recipeQty || 1;
      const unit = solutionUnit || batch.snapshot?.recipeUnit || 'L';
      const actor = user || this.getSystemUser();

      // Use db.services for transaction service
      await db.services.txnService.post({
        txnType: 'build',
        lines: [{
          item: solutionItemId,
          lot: solutionLotNumber,
          qty: quantity
        }],
        actor: {
          _id: actor._id,
          name: actor.name,
          email: actor.email
        },
        memo: `Solution lot created from batch ${batch.runNumber || 'Unknown'}`,
        project: `Batch-${batch._id}`,
        department: 'Production',
        batchId: batch._id,
        workOrderId: batch.workOrderId,
        refDoc: batch.fileId,
        refDocType: 'batch'
      });
      
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

  getSystemUser() {
    return {
      _id: '000000000000000000000000',
      name: 'System',
      email: 'system@company.com'
    };
  }
}

// Create singleton instance
const batchService = new BatchService();

// Export both the class and methods
export { BatchService };

export default batchService;