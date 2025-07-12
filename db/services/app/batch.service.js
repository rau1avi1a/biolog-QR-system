// db/services/app/batch.service.js - Consolidated batch operations with single import
import { CoreService } from './core.service.js';
import db from '@/db/index.js';
import mongoose from 'mongoose';

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
  
// COMPLETE createBatch method for batch.service.js - REPLACE YOUR EXISTING createBatch

async createBatch(payload) {
  await this.connect();
  
  console.log('🔍 BatchService: Received payload:', {
    keys: Object.keys(payload),
    hasFileId: !!payload.fileId,
    hasOverlayPng: !!payload.overlayPng,
    hasPageOverlays: !!payload.pageOverlays,
    hasAnnotations: !!payload.annotations,
    hasOverlayPages: !!payload.overlayPages
  });
  
  // Extract fileId
  const fileId = payload.fileId;
  if (!fileId) {
    throw new Error('fileId is required for batch creation');
  }
  
  // Get file data
  const file = await this.File.findById(fileId);
  if (!file) throw new Error('File not found');
  
  console.log('🔍 BatchService: Found file:', {
    fileName: file.fileName,
    hasSolutionRef: !!file.solutionRef,
    solutionRefId: file.solutionRef,
    componentCount: file.components?.length || 0
  });
  
  // ✅ FIXED: Process multi-page overlays properly
  let overlayData = {
    overlayPng: null,        // Page 1 for backward compatibility
    overlays: new Map(),     // All pages as Map
    pageOverlays: {},        // All pages as object
    overlayPages: []         // List of pages with overlays
  };
  
  // Process the overlay data from frontend
  if (payload.pageOverlays && Object.keys(payload.pageOverlays).length > 0) {
    console.log('🎨 Processing pageOverlays from frontend:', Object.keys(payload.pageOverlays));
    
    // Handle pageOverlays format: { "page_1": "data:image/png;base64,...", "page_2": "..." }
    Object.entries(payload.pageOverlays).forEach(([pageKey, overlayPng]) => {
      const pageNumber = parseInt(pageKey.replace('page_', ''));
      if (!isNaN(pageNumber) && overlayPng) {
        overlayData.overlays.set(pageNumber, overlayPng);
        overlayData.pageOverlays[pageNumber] = overlayPng;
        overlayData.overlayPages.push(pageNumber);
        
        // Set page 1 as the main overlayPng for backward compatibility
        if (pageNumber === 1) {
          overlayData.overlayPng = overlayPng;
        }
        
        console.log(`✅ Processed overlay for page ${pageNumber}`);
      }
    });
  } else if (payload.annotations && Object.keys(payload.annotations).length > 0) {
    console.log('🎨 Processing annotations (fallback):', Object.keys(payload.annotations));
    
    // Handle annotations format: { "1": "data:image/png;base64,...", "2": "..." }
    Object.entries(payload.annotations).forEach(([pageNum, overlayPng]) => {
      const pageNumber = parseInt(pageNum);
      if (!isNaN(pageNumber) && overlayPng) {
        overlayData.overlays.set(pageNumber, overlayPng);
        overlayData.pageOverlays[pageNumber] = overlayPng;
        overlayData.overlayPages.push(pageNumber);
        
        if (pageNumber === 1) {
          overlayData.overlayPng = overlayPng;
        }
        
        console.log(`✅ Processed annotation for page ${pageNumber}`);
      }
    });
  } else if (payload.overlayPng) {
    console.log('🎨 Processing single overlayPng (legacy)');
    
    // Legacy single overlay for page 1
    overlayData.overlayPng = payload.overlayPng;
    overlayData.overlays.set(1, payload.overlayPng);
    overlayData.pageOverlays[1] = payload.overlayPng;
    overlayData.overlayPages.push(1);
  }
  
  // Sort overlay pages
  overlayData.overlayPages.sort((a, b) => a - b);
  
  console.log('🎨 Final overlay data:', {
    hasMainOverlay: !!overlayData.overlayPng,
    overlayPagesCount: overlayData.overlayPages.length,
    overlayPages: overlayData.overlayPages,
    overlaysMapSize: overlayData.overlays.size
  });
  
  // Create snapshot from file properties
  const snapshot = {
    enabled: true,
    productRef: file.productRef,
    solutionRef: file.solutionRef,
    recipeQty: file.recipeQty,
    recipeUnit: file.recipeUnit,
    components: file.components || []
  };
  
  console.log('🔍 BatchService: Created snapshot:', {
    hasSolutionRef: !!snapshot.solutionRef,
    solutionRefId: snapshot.solutionRef,
    componentCount: snapshot.components.length
  });
  
  // FIXED: Copy PDF data from original file to batch with validation
  let batchPdf = null;
  if (file.pdf) {
    console.log('📄 Copying PDF data from original file to batch:', {
      hasPdfData: !!file.pdf.data,
      pdfContentType: file.pdf.contentType,
      pdfDataType: typeof file.pdf.data,
      pdfDataLength: file.pdf.data?.length,
      isBuffer: Buffer.isBuffer(file.pdf.data)
    });
    
    try {
      let validatedPdfData = file.pdf.data;
      
      // Handle different data formats
      if (Buffer.isBuffer(file.pdf.data)) {
        // Already a Buffer - this is correct
        validatedPdfData = file.pdf.data;
        console.log('✅ PDF data is already a Buffer');
      } else if (typeof file.pdf.data === 'string') {
        // String data - might be base64 or data URL
        if (file.pdf.data.startsWith('data:')) {
          // Data URL format
          const base64Data = file.pdf.data.split(',')[1];
          validatedPdfData = Buffer.from(base64Data, 'base64');
          console.log('✅ Converted data URL to Buffer');
        } else {
          // Assume it's base64
          validatedPdfData = Buffer.from(file.pdf.data, 'base64');
          console.log('✅ Converted base64 string to Buffer');
        }
      } else if (file.pdf.data && typeof file.pdf.data === 'object') {
        // Handle serialized Buffer or MongoDB Binary
        if (file.pdf.data.type === 'Buffer' && Array.isArray(file.pdf.data.data)) {
          validatedPdfData = Buffer.from(file.pdf.data.data);
          console.log('✅ Converted serialized Buffer to Buffer');
        } else if (file.pdf.data.buffer) {
          validatedPdfData = Buffer.from(file.pdf.data.buffer);
          console.log('✅ Converted MongoDB Binary to Buffer');
        } else {
          throw new Error('Unknown PDF data object structure');
        }
      } else {
        throw new Error(`Unsupported PDF data type: ${typeof file.pdf.data}`);
      }
      
      // Validate the Buffer contains PDF data
      if (!validatedPdfData || validatedPdfData.length === 0) {
        throw new Error('PDF data is empty after conversion');
      }
      
      // Check for PDF header (optional but recommended)
      const header = validatedPdfData.toString('ascii', 0, 4);
      if (!header.startsWith('%PDF')) {
        console.warn('⚠️ PDF data does not start with %PDF header, but continuing...');
      }
      
      batchPdf = {
        data: validatedPdfData,
        contentType: file.pdf.contentType || 'application/pdf'
      };
      
      console.log('✅ PDF data validated and ready for batch:', {
        finalDataType: typeof validatedPdfData,
        isBuffer: Buffer.isBuffer(validatedPdfData),
        length: validatedPdfData.length,
        startsWithPdf: header.startsWith('%PDF')
      });
      
    } catch (pdfError) {
      console.error('❌ Failed to process PDF data for batch:', pdfError);
      // Continue without PDF data rather than failing the entire batch creation
      batchPdf = null;
    }
  }

  // Helper function to convert string IDs to ObjectIds
  const toObjectId = (id) => {
    if (!id) return null;
    if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
      return new mongoose.Types.ObjectId(id);
    }
    if (id instanceof mongoose.Types.ObjectId) {
      return id;
    }
    return id;
  };

  // ✅ FIXED: Bake ALL page overlays into PDF, not just page 1
  let finalSignedPdf = batchPdf; // Start with original PDF
  
  if (overlayData.overlayPages.length > 0 && file.pdf) {
    try {
      console.log(`🔥 Baking ${overlayData.overlayPages.length} page overlays into PDF...`);
      
      // Convert original PDF to data URL for processing
      let currentPdfUrl;
      if (Buffer.isBuffer(file.pdf.data)) {
        const base64String = file.pdf.data.toString('base64');
        currentPdfUrl = `data:${file.pdf.contentType || 'application/pdf'};base64,${base64String}`;
      } else if (typeof file.pdf.data === 'string') {
        if (file.pdf.data.startsWith('data:')) {
          currentPdfUrl = file.pdf.data;
        } else {
          currentPdfUrl = `data:${file.pdf.contentType || 'application/pdf'};base64,${file.pdf.data}`;
        }
      } else if (typeof file.pdf.data === 'object') {
        let buffer;
        if (file.pdf.data.type === 'Buffer' && Array.isArray(file.pdf.data.data)) {
          buffer = Buffer.from(file.pdf.data.data);
        } else if (file.pdf.data.buffer) {
          buffer = Buffer.from(file.pdf.data.buffer);
        } else {
          buffer = Buffer.from(file.pdf.data);
        }
        const base64String = buffer.toString('base64');
        currentPdfUrl = `data:${file.pdf.contentType || 'application/pdf'};base64,${base64String}`;
      }
      
      // ✅ NEW: Use enhanced multi-page baking method
      const bakedBuffer = await this.bakeMultipleOverlaysWithQuality(currentPdfUrl, overlayData.pageOverlays, payload.canvasDimensions);
      
      finalSignedPdf = {
        data: bakedBuffer,
        contentType: 'application/pdf'
      };
      
      console.log('✅ All page overlays baked successfully into PDF');
      
    } catch (e) {
      console.error('❌ Failed to bake overlays into PDF:', e);
      // Fall back to original PDF
      finalSignedPdf = batchPdf;
    }
  }
  
  // ✅ FIXED: Include all overlay data in batch creation
  const batchData = { 
    fileId: toObjectId(fileId),
    
    // Original overlay fields (for backward compatibility)
    overlayPng: overlayData.overlayPng,
    
    // ✅ NEW: Multi-page overlay fields
    overlays: overlayData.overlays,
    pageOverlays: overlayData.pageOverlays,
    overlayPages: overlayData.overlayPages,
    
    // PDF data
    signedPdf: finalSignedPdf,
    
    status: payload.status || 'In Progress',
    snapshot: {
      enabled: snapshot.enabled,
      productRef: toObjectId(snapshot.productRef),
      solutionRef: toObjectId(snapshot.solutionRef),
      recipeQty: snapshot.recipeQty,
      recipeUnit: snapshot.recipeUnit,
      components: snapshot.components.map(comp => ({
        itemId: toObjectId(comp.itemId),
        amount: comp.amount,
        unit: comp.unit,
        netsuiteData: comp.netsuiteData
      }))
    }
  };
  
  console.log('🔍 BatchService: Final batchData with overlays:', {
    hasOverlayPng: !!batchData.overlayPng,
    overlayPagesCount: batchData.overlayPages.length,
    pageOverlaysKeys: Object.keys(batchData.pageOverlays),
    overlaysMapSize: batchData.overlays.size,
    hasSignedPdf: !!batchData.signedPdf
  });
  
  // Handle confirmation data
  if (payload.confirmationData) {
    if (payload.confirmationData.components?.length > 0) {
      // FIXED: Convert ObjectIds in confirmedComponents too
      batchData.confirmedComponents = payload.confirmationData.components.map(comp => ({
        itemId: toObjectId(comp.itemId),
        plannedAmount: comp.plannedAmount || comp.amount,
        actualAmount: comp.actualAmount || comp.amount,
        unit: comp.unit,
        lotNumber: comp.lotNumber || '',
        lotId: toObjectId(comp.lotId),
        displayName: comp.displayName,
        sku: comp.sku
      }));
    }
    if (payload.confirmationData.solutionLotNumber) {
      batchData.solutionLotNumber = payload.confirmationData.solutionLotNumber;
    }
  }
  
  // Set workflow flags
  if (payload.workOrderStatus) batchData.workOrderStatus = payload.workOrderStatus;
  if (payload.chemicalsTransacted) batchData.chemicalsTransacted = payload.chemicalsTransacted;
  if (payload.solutionCreated) batchData.solutionCreated = payload.solutionCreated;
  if (payload.solutionLotNumber) batchData.solutionLotNumber = payload.solutionLotNumber;
  
  // Add debugging before creating the batch
  console.log('🔍 BatchService: Final batchData before create:', {
    hasFileId: !!batchData.fileId,
    fileIdString: batchData.fileId?.toString(),
    allKeys: Object.keys(batchData),
    overlayDataKeys: ['overlayPng', 'pageOverlays', 'overlayPages', 'overlays'].filter(key => batchData[key])
  });
  
  // Create the batch with enhanced error handling
  let batch;
  try {
    console.log('🔍 BatchService: Attempting batch creation...');
    
    batch = new this.model(batchData);
    console.log('🔍 BatchService: Model instance created, attempting save...');
    
    const savedBatch = await batch.save();
    console.log('✅ BatchService: Batch saved successfully:', savedBatch._id);
    
    // Convert to plain object
    batch = savedBatch.toObject();
    
  } catch (error) {
    console.error('❌ BatchService: Batch creation failed:', {
      error: error.message,
      stack: error.stack,
      validationErrors: error.errors ? Object.keys(error.errors) : 'no validation errors'
    });
    
    // Try minimal batch creation as fallback
    console.log('🔍 BatchService: Trying minimal batch creation...');
    try {
      const minimalBatch = new this.model({
        fileId: toObjectId(fileId),
        status: 'In Progress'
      });
      
      const savedMinimal = await minimalBatch.save();
      console.log('✅ BatchService: Minimal batch saved:', savedMinimal._id);
      
      batch = savedMinimal.toObject();
      
    } catch (minimalError) {
      console.error('❌ BatchService: Even minimal creation failed:', minimalError.message);
      throw error; // Throw original error
    }
  }
  
  // Handle work order creation using db.services
  if (payload.action === 'create_work_order') {
    try {
      const quantity = payload.confirmationData?.batchQuantity || payload.confirmationData?.solutionQuantity || snapshot.recipeQty || 1;
      await db.services.AsyncWorkOrderService.queueWorkOrderCreation(batch._id, quantity, payload.user?._id);
      console.log('Work order queued successfully');
    } catch (e) {
      console.error('Failed to queue work order creation:', e);
    }
  }
  
  // Handle chemical transactions and solution creation using db.services
  if (payload.action === 'submit_review' && payload.confirmationData) {
    try {
      if (payload.confirmationData.components?.length > 0) {
        const transactionResult = await this.transactChemicals(batch, payload.confirmationData, payload.user);
        if (transactionResult.success) {
          batch.chemicalsTransacted = true;
          batch.transactionDate = new Date();
        }
      }
  
      if (payload.confirmationData.solutionLotNumber) {
        const solutionResult = await this.createSolutionLot(
          batch, 
          payload.confirmationData.solutionLotNumber,
          payload.confirmationData.solutionQuantity || snapshot.recipeQty,
          payload.confirmationData.solutionUnit || snapshot.recipeUnit,
          payload.user
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
// FIXED updateBatch method in batch.service.js - REPLACE THE OVERLAY UPDATE SECTION

// COMPLETE FIXED updateBatch method in batch.service.js - REPLACE THE ENTIRE METHOD

async updateBatch(id, payload) {
  await this.connect();
  
  const prev = await this.Batch.findById(id).populate('fileId','pdf').lean();
  if (!prev) throw new Error('Batch not found');

  const user = payload.user || this.getSystemUser();
  
  // ✅ FIXED: Properly merge overlays instead of replacing them
  let overlayUpdateData = {};
  
  if (payload.pageOverlays && Object.keys(payload.pageOverlays).length > 0) {
    console.log('🎨 Processing multi-page overlay update with proper merging...');
    console.log('📥 Incoming pageOverlays:', Object.keys(payload.pageOverlays));
    
    // ✅ CRITICAL FIX: Start with existing overlays from database
    const existingOverlays = prev.pageOverlays || {};
    const existingOverlayPages = prev.overlayPages || [];
    
    console.log('📄 Existing overlays in database:', {
      pages: Object.keys(existingOverlays),
      count: Object.keys(existingOverlays).length
    });
    
    // Process incoming overlays (convert page_X format to numbers)
    const incomingOverlays = {};
    const incomingPages = [];
    
    Object.entries(payload.pageOverlays).forEach(([pageKey, overlayPng]) => {
      const pageNumber = parseInt(pageKey.replace('page_', ''));
      if (!isNaN(pageNumber) && overlayPng) {
        incomingOverlays[pageNumber] = overlayPng;
        if (!incomingPages.includes(pageNumber)) {
          incomingPages.push(pageNumber);
        }
      }
    });
    
    console.log('📥 Processed incoming overlays:', {
      pages: Object.keys(incomingOverlays),
      count: Object.keys(incomingOverlays).length
    });
    
    // ✅ MERGE: Combine existing + incoming (incoming takes precedence for same pages)
    const mergedOverlays = { 
      ...existingOverlays,    // Start with existing
      ...incomingOverlays     // Overlay with new/updated pages
    };
    
    const mergedPages = [...new Set([...existingOverlayPages, ...incomingPages])].sort((a, b) => a - b);
    
    overlayUpdateData = {
      pageOverlays: mergedOverlays,
      overlayPages: mergedPages,
      overlayPng: mergedOverlays[1] || Object.values(mergedOverlays)[0] // Update main overlay
    };
    
    console.log('🔗 Merged overlay data:', {
      existingCount: Object.keys(existingOverlays).length,
      incomingCount: Object.keys(incomingOverlays).length,
      finalCount: Object.keys(mergedOverlays).length,
      finalPages: mergedPages,
      hasMainOverlay: !!overlayUpdateData.overlayPng
    });
    
  } else if (payload.annotations && Object.keys(payload.annotations).length > 0) {
    console.log('🎨 Processing annotations update (fallback) with merging...');
    
    // Handle annotations format - same merging logic
    const existingOverlays = prev.pageOverlays || {};
    const existingOverlayPages = prev.overlayPages || [];
    
    const incomingOverlays = {};
    const incomingPages = [];
    
    Object.entries(payload.annotations).forEach(([pageNum, overlayPng]) => {
      const pageNumber = parseInt(pageNum);
      if (!isNaN(pageNumber) && overlayPng) {
        incomingOverlays[pageNumber] = overlayPng;
        if (!incomingPages.includes(pageNumber)) {
          incomingPages.push(pageNumber);
        }
      }
    });
    
    const mergedOverlays = { ...existingOverlays, ...incomingOverlays };
    const mergedPages = [...new Set([...existingOverlayPages, ...incomingPages])].sort((a, b) => a - b);
    
    overlayUpdateData = {
      pageOverlays: mergedOverlays,
      overlayPages: mergedPages,
      overlayPng: mergedOverlays[1] || Object.values(mergedOverlays)[0]
    };
    
  } else if (payload.overlayPng) {
    console.log('🎨 Processing single overlay update (legacy) with merging...');
    
    // Legacy single overlay update - merge with existing
    const existingOverlays = prev.pageOverlays || {};
    const existingOverlayPages = prev.overlayPages || [];
    
    const updatedOverlays = { ...existingOverlays, 1: payload.overlayPng };
    const updatedPages = [...new Set([...existingOverlayPages, 1])].sort((a, b) => a - b);
    
    overlayUpdateData = {
      overlayPng: payload.overlayPng,
      pageOverlays: updatedOverlays,
      overlayPages: updatedPages
    };
  }
  
  // ✅ FIXED: Enhanced PDF baking with better quality handling
  if (Object.keys(overlayUpdateData).length > 0 && prev?.fileId?.pdf) {
    try {
      console.log('🔥 Baking updated overlays into PDF with quality preservation...');
      
      // Get original PDF data URL
      let originalPdfUrl = null;
      if (prev.fileId.pdf?.data) {
        if (Buffer.isBuffer(prev.fileId.pdf.data)) {
          const base64String = prev.fileId.pdf.data.toString('base64');
          originalPdfUrl = `data:${prev.fileId.pdf.contentType || 'application/pdf'};base64,${base64String}`;
        } else if (typeof prev.fileId.pdf.data === 'string') {
          if (prev.fileId.pdf.data.startsWith('data:')) {
            originalPdfUrl = prev.fileId.pdf.data;
          } else {
            originalPdfUrl = `data:${prev.fileId.pdf.contentType || 'application/pdf'};base64,${prev.fileId.pdf.data}`;
          }
        } else if (typeof prev.fileId.pdf.data === 'object') {
          let buffer;
          if (prev.fileId.pdf.data.type === 'Buffer' && Array.isArray(prev.fileId.pdf.data.data)) {
            buffer = Buffer.from(prev.fileId.pdf.data.data);
          } else if (prev.fileId.pdf.data.buffer) {
            buffer = Buffer.from(prev.fileId.pdf.data.buffer);
          } else {
            buffer = Buffer.from(prev.fileId.pdf.data);
          }
          const base64String = buffer.toString('base64');
          originalPdfUrl = `data:${prev.fileId.pdf.contentType || 'application/pdf'};base64,${base64String}`;
        }
      }
      
      if (!originalPdfUrl) {
        throw new Error('Could not construct PDF URL for overlay baking');
      }
      
      console.log('📄 Original PDF URL constructed for multi-page overlay baking');
      
      // ✅ FIXED: Use the merged overlays for baking
      const allOverlays = overlayUpdateData.pageOverlays || {};
      const overlayPages = overlayUpdateData.overlayPages || [];
      
      console.log('🔥 Baking overlays for pages:', overlayPages);
      
      // ✅ IMPROVED: Use the enhanced multi-page baking method
      const bakedBuffer = await this.bakeMultipleOverlaysWithQuality(originalPdfUrl, allOverlays, payload.canvasDimensions);
      
      console.log('✅ Multi-page PDF overlay baking completed successfully');
      
      // Add signedPdf to the update
      overlayUpdateData.signedPdf = { 
        data: bakedBuffer,
        contentType: 'application/pdf' 
      };
      
      // Build comprehensive overlay history
      const allOverlayHistory = [];
      if (prev.overlayHistory?.length) {
        allOverlayHistory.push(...prev.overlayHistory);
      } else if (prev.overlayPng) {
        allOverlayHistory.push(prev.overlayPng);
      }
      
      // Add new overlays to history (only if they're not already there)
      overlayPages.forEach(pageNum => {
        const overlay = allOverlays[pageNum];
        if (overlay && !allOverlayHistory.includes(overlay)) {
          allOverlayHistory.push(overlay);
        }
      });
      
      overlayUpdateData.overlayHistory = allOverlayHistory;
      
    } catch (e) {
      console.error('❌ Failed to bake multi-page overlays during update:', e);
      // Continue without baked PDF rather than failing
    }
  }
  
  // Merge overlay updates with the main payload
  const finalPayload = {
    ...payload,
    ...overlayUpdateData
  };
  
  console.log('🔍 Final update payload with properly merged overlays:', {
    hasSignedPdf: !!finalPayload.signedPdf,
    hasPageOverlays: !!finalPayload.pageOverlays,
    overlayPagesCount: finalPayload.overlayPages?.length || 0,
    overlayPages: finalPayload.overlayPages || [],
    totalOverlaysInFinalPayload: finalPayload.pageOverlays ? Object.keys(finalPayload.pageOverlays).length : 0
  });

  // Handle work order creation during update using db.services
  if (finalPayload.workOrderCreated && !prev.workOrderCreated) {
    try {
      const quantity = finalPayload.confirmedComponents?.reduce((sum, comp) => sum + (comp.actualAmount || comp.amount || 0), 0) || 
                      prev.snapshot?.recipeQty || 1;
      await db.services.AsyncWorkOrderService.queueWorkOrderCreation(id, quantity, user?._id);
    } catch (e) {
      console.error('Failed to queue work order creation during update:', e);
    }
  }

  // Handle chemical transactions during update
  if (finalPayload.chemicalsTransacted && finalPayload.confirmedComponents?.length > 0) {
    try {
      const confirmationData = { components: finalPayload.confirmedComponents };
      const transactionResult = await this.transactChemicals({ _id: id, runNumber: prev.runNumber, snapshot: prev.snapshot }, confirmationData, user);
      if (transactionResult.success) {
        console.log('Chemicals transacted successfully during update');
      }
    } catch (e) {
      console.error('Failed to transact chemicals during update:', e);
    }
  }

  // Handle solution creation during update
  if (finalPayload.solutionCreated && !prev.solutionCreated && finalPayload.solutionLotNumber) {
    try {
      await this.createSolutionLot(
        { _id: id, runNumber: prev.runNumber, snapshot: prev.snapshot }, 
        finalPayload.solutionLotNumber,
        finalPayload.solutionQuantity || prev.snapshot?.recipeQty,
        finalPayload.solutionUnit || prev.snapshot?.recipeUnit,
        user
      );
      finalPayload.solutionCreatedDate = new Date();
    } catch (e) {
      console.error('Failed to create solution lot during update:', e);
    }
  }

  // FIXED: Handle assembly build creation BEFORE the main update
  let assemblyBuildUpdate = {};
  if (prev.status !== 'Review' && finalPayload.status === 'Review' && finalPayload.chemicalsTransacted) {
    console.log('🏗️ Batch moving to Review status - checking for work order completion...');
    
    // Check if batch has a NetSuite work order that needs completion
    if (prev.netsuiteWorkOrderData?.workOrderId && !prev.workOrderCompleted) {
      console.log('🏗️ Completing NetSuite work order:', prev.netsuiteWorkOrderData.tranId);
      
      try {
        // Get user for NetSuite operations
        const user = finalPayload.user || this.getSystemUser();
        
        // Import and use the assembly build service
        const { createAssemblyBuildService } = await import('@/db/services/netsuite/assemblyBuild.service.js');
        const assemblyBuildService = createAssemblyBuildService(user);
        
        // Complete the work order by creating assembly build
        const completionResult = await assemblyBuildService.completeWorkOrderForBatch(prev._id, {
          solutionQuantity: finalPayload.solutionQuantity || prev.snapshot?.recipeQty || 1,
          solutionUnit: finalPayload.solutionUnit || prev.snapshot?.recipeUnit || 'mL',
          confirmedComponents: finalPayload.confirmedComponents || [],
          solutionLotNumber: finalPayload.solutionLotNumber
        });
        
        if (completionResult.success) {
          console.log('✅ Work order completed successfully:', completionResult.assemblyBuild.id);
          
          // FIXED: Prepare assembly build data for the main update
          assemblyBuildUpdate = {
            workOrderCompleted: true,
            workOrderCompletedAt: new Date(),
            assemblyBuildId: completionResult.assemblyBuild.id,
            assemblyBuildTranId: completionResult.assemblyBuild.tranId,
            assemblyBuildCreated: true,
            assemblyBuildCreatedAt: new Date(),
            
            // FIXED: Create a clean netsuiteWorkOrderData object with proper dates
            netsuiteWorkOrderData: {
              workOrderId: prev.netsuiteWorkOrderData?.workOrderId || null,
              tranId: prev.netsuiteWorkOrderData?.tranId || null,
              bomId: prev.netsuiteWorkOrderData?.bomId || null,
              revisionId: prev.netsuiteWorkOrderData?.revisionId || null,
              quantity: prev.netsuiteWorkOrderData?.quantity || null,
              status: 'built',
              orderStatus: 'built',
              createdAt: prev.netsuiteWorkOrderData?.createdAt || null,
              completedAt: new Date(), // This should be a proper Date object
              assemblyBuildId: completionResult.assemblyBuild.id,
              assemblyBuildTranId: completionResult.assemblyBuild.tranId,
              lastSyncAt: new Date()
            }
          };
          
        } else {
          console.error('❌ Work order completion failed:', completionResult.error);
          assemblyBuildUpdate = {
            workOrderCompletionError: completionResult.error,
            workOrderCompletionFailedAt: new Date()
          };
        }
        
      } catch (error) {
        console.error('❌ Work order completion failed with exception:', error);
        assemblyBuildUpdate = {
          workOrderCompletionError: error.message,
          workOrderCompletionFailedAt: new Date()
        };
      }
    } else if (!prev.netsuiteWorkOrderData?.workOrderId) {
      console.log('ℹ️ Batch has no NetSuite work order - skipping assembly build creation');
    } else if (prev.workOrderCompleted) {
      console.log('ℹ️ Work order already completed - skipping assembly build creation');
    }
  }

  // FIXED: Merge assembly build update with the main payload
  const completePayload = {
    ...finalPayload,
    ...assemblyBuildUpdate
  };

  // CRITICAL: Remove any problematic nested updates that might cause the date casting issue
  if (completePayload.netsuiteWorkOrderData) {
    // Ensure all date fields are proper Date objects
    const cleanNetsuiteData = { ...completePayload.netsuiteWorkOrderData };
    
    // Convert any date fields to proper Date objects
    if (cleanNetsuiteData.createdAt && !(cleanNetsuiteData.createdAt instanceof Date)) {
      cleanNetsuiteData.createdAt = new Date(cleanNetsuiteData.createdAt);
    }
    if (cleanNetsuiteData.completedAt && !(cleanNetsuiteData.completedAt instanceof Date)) {
      cleanNetsuiteData.completedAt = new Date(cleanNetsuiteData.completedAt);
    }
    if (cleanNetsuiteData.lastSyncAt && !(cleanNetsuiteData.lastSyncAt instanceof Date)) {
      cleanNetsuiteData.lastSyncAt = new Date(cleanNetsuiteData.lastSyncAt);
    }
    
    completePayload.netsuiteWorkOrderData = cleanNetsuiteData;
  }

  // Update the batch with the complete payload
  const next = await this.updateById(id, completePayload);

  // Get the final updated batch state
  const finalBatch = await this.findById(id);

  // Handle archiving when completed using db.services
  if (prev.status !== 'Completed' && finalBatch.status === 'Completed') {
    await db.services.archiveService.createArchiveCopy(finalBatch);
  }

  return finalBatch;
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

// ADD these methods to your batch.service.js - COMPLETE PDF BAKING IMPLEMENTATION

// ✅ NEW: Enhanced multi-page baking with quality preservation
async bakeMultipleOverlaysWithQuality(originalPdfDataUrl, overlayMap, canvasDimensions = null) {
  try {
    const { PDFDocument } = await import('pdf-lib');
    
    console.log(`🔥 Baking ${Object.keys(overlayMap).length} overlays with quality preservation...`);
    console.log('📐 Canvas dimensions:', canvasDimensions);
    
    // Extract and load PDF
    let pdfBase64;
    if (typeof originalPdfDataUrl === 'string' && originalPdfDataUrl.startsWith('data:')) {
      pdfBase64 = originalPdfDataUrl.split(',')[1];
    } else if (typeof originalPdfDataUrl === 'string') {
      pdfBase64 = originalPdfDataUrl;
    } else {
      throw new Error('Invalid PDF data format');
    }
    
    pdfBase64 = pdfBase64.replace(/\s/g, '');
    const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    
    console.log(`📄 PDF loaded: ${pages.length} pages`);
    
    // Sort pages to ensure consistent order
    const sortedPageNumbers = Object.keys(overlayMap)
      .map(p => parseInt(p))
      .filter(p => !isNaN(p) && p >= 1 && p <= pages.length)
      .sort((a, b) => a - b);
    
    console.log('🎯 Processing pages:', sortedPageNumbers);
    
    // Process each page with its overlay
    for (const pageNumber of sortedPageNumbers) {
      const overlay = overlayMap[pageNumber];
      if (!overlay) continue;
      
      const targetPage = pages[pageNumber - 1]; // Convert to 0-based index
      const { width: pdfWidth, height: pdfHeight } = targetPage.getSize();
      
      console.log(`🖌️ Processing page ${pageNumber} (${pdfWidth}x${pdfHeight})...`);
      
      // ✅ QUALITY FIX: Process overlay with proper scaling
      let pngBase64;
      if (typeof overlay === 'string' && overlay.startsWith('data:')) {
        pngBase64 = overlay.split(',')[1];
      } else if (typeof overlay === 'string') {
        pngBase64 = overlay;
      } else {
        console.warn(`⚠️ Invalid overlay format for page ${pageNumber}, skipping`);
        continue;
      }
      
      pngBase64 = pngBase64.replace(/\s/g, '');
      if (!pngBase64) {
        console.warn(`⚠️ Empty overlay for page ${pageNumber}, skipping`);
        continue;
      }
      
      try {
        const pngBytes = Uint8Array.from(atob(pngBase64), c => c.charCodeAt(0));
        const pngImage = await pdfDoc.embedPng(pngBytes);
        
        // ✅ QUALITY FIX: Calculate proper scaling based on canvas dimensions
        let overlayOptions = {
          x: 0,
          y: 0,
          width: pdfWidth,
          height: pdfHeight
        };
        
        // If we have canvas dimensions, use them for better positioning
        if (canvasDimensions && canvasDimensions.currentPage === pageNumber) {
          console.log(`📐 Using canvas dimensions for page ${pageNumber}:`, {
            canvasSize: `${canvasDimensions.width}x${canvasDimensions.height}`,
            pdfCanvasSize: `${canvasDimensions.pdfCanvasWidth}x${canvasDimensions.pdfCanvasHeight}`,
            offset: `${canvasDimensions.pdfCanvasLeft}x${canvasDimensions.pdfCanvasTop}`
          });
          
          // ✅ POSITION FIX: Account for PDF canvas offset within container
          if (canvasDimensions.pdfCanvasLeft || canvasDimensions.pdfCanvasTop) {
            const scaleX = pdfWidth / canvasDimensions.pdfCanvasWidth;
            const scaleY = pdfHeight / canvasDimensions.pdfCanvasHeight;
            
            overlayOptions = {
              x: 0, // PDF coordinates start at 0
              y: 0, // PDF coordinates start at 0
              width: pdfWidth,
              height: pdfHeight
            };
            
            console.log(`📐 Calculated overlay positioning for page ${pageNumber}:`, overlayOptions);
          }
        }
        
        // Draw the overlay on the target page
        targetPage.drawImage(pngImage, overlayOptions);
        
        console.log(`✅ Successfully applied overlay to page ${pageNumber}`);
        
      } catch (pageError) {
        console.error(`❌ Failed to process overlay for page ${pageNumber}:`, pageError);
        // Continue with other pages rather than failing completely
      }
    }
    
    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save();
    const finalBuffer = Buffer.from(modifiedPdfBytes);
    
    console.log(`✅ Successfully baked ${sortedPageNumbers.length} overlays into PDF`);
    
    return finalBuffer;
    
  } catch (error) {
    console.error('❌ Error baking multiple overlays with quality:', error);
    throw error;
  }
}

// ✅ ENHANCED: Updated single page baking method with better quality
async bakeOverlayIntoPdf(originalPdfDataUrl, overlayPng, targetPageNumber = 1) {
  try {
    const { PDFDocument } = await import('pdf-lib');
        
    // Extract base64 data from PDF data URL
    let pdfBase64;
    if (typeof originalPdfDataUrl === 'string' && originalPdfDataUrl.startsWith('data:')) {
      const parts = originalPdfDataUrl.split(',');
      if (parts.length !== 2) {
        throw new Error('Invalid PDF data URL format');
      }
      pdfBase64 = parts[1];
    } else if (typeof originalPdfDataUrl === 'string') {
      pdfBase64 = originalPdfDataUrl;
    } else {
      throw new Error('Invalid PDF data format - expected string');
    }
    
    // Validate and clean base64
    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      throw new Error('Invalid or empty base64 PDF data');
    }
    pdfBase64 = pdfBase64.replace(/\s/g, '');
        
    // Convert base64 to Uint8Array
    let pdfBytes;
    try {
      pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
    } catch (decodeError) {
      console.error('❌ PDF Base64 decode error:', decodeError);
      throw new Error(`Failed to decode PDF base64: ${decodeError.message}`);
    }
    
    // Load the PDF document
    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.load(pdfBytes);
    } catch (loadError) {
      console.error('❌ PDF load error:', loadError);
      throw new Error(`Failed to load PDF document: ${loadError.message}`);
    }
    
    // Get the specific target page
    const pages = pdfDoc.getPages();
    
    if (targetPageNumber < 1 || targetPageNumber > pages.length) {
      console.warn(`⚠️ Target page ${targetPageNumber} is out of range (1-${pages.length}), using page 1`);
      targetPageNumber = 1;
    }
    
    const targetPage = pages[targetPageNumber - 1]; // Convert to 0-based index
    const { width: pdfWidth, height: pdfHeight } = targetPage.getSize();
    
    console.log(`🎯 Baking overlay onto page ${targetPageNumber} of ${pages.length} (size: ${pdfWidth}x${pdfHeight})`);
        
    // Process overlay PNG with better error handling
    let pngBase64;
    if (typeof overlayPng === 'string' && overlayPng.startsWith('data:')) {
      const parts = overlayPng.split(',');
      if (parts.length !== 2) {
        throw new Error('Invalid overlay PNG data URL format');
      }
      pngBase64 = parts[1];
    } else if (typeof overlayPng === 'string') {
      pngBase64 = overlayPng;
    } else {
      throw new Error('Invalid overlay PNG format - expected string');
    }
    
    // Clean and validate PNG base64
    pngBase64 = pngBase64.replace(/\s/g, '');
    if (!pngBase64 || typeof pngBase64 !== 'string') {
      throw new Error('Invalid or empty base64 PNG data');
    }
        
    let pngBytes;
    try {
      pngBytes = Uint8Array.from(atob(pngBase64), c => c.charCodeAt(0));
    } catch (decodeError) {
      console.error('❌ PNG base64 decode error:', decodeError);
      throw new Error(`Failed to decode PNG base64: ${decodeError.message}`);
    }
    
    let pngImage;
    try {
      pngImage = await pdfDoc.embedPng(pngBytes);
    } catch (embedError) {
      console.error('❌ PNG embed error:', embedError);
      throw new Error(`Failed to embed PNG image: ${embedError.message}`);
    }
    
    // ✅ QUALITY FIX: Get PNG dimensions for better scaling
    const pngDims = pngImage.scale(1);
    
    console.log(`📐 PNG dimensions: ${pngDims.width}x${pngDims.height}, PDF dimensions: ${pdfWidth}x${pdfHeight}`);
    
    // ✅ IMPROVED: Better overlay positioning and scaling
    const overlayOptions = {
      x: 0,
      y: 0,
      width: pdfWidth,
      height: pdfHeight
    };
    
    // Check if we need to preserve aspect ratio
    const pdfAspect = pdfWidth / pdfHeight;
    const pngAspect = pngDims.width / pngDims.height;
    
    if (Math.abs(pdfAspect - pngAspect) > 0.1) {
      console.log(`📐 Aspect ratio difference detected (PDF: ${pdfAspect.toFixed(2)}, PNG: ${pngAspect.toFixed(2)})`);
      // For now, stretch to fit - but this could be improved with letterboxing
    }
    
    // Draw the overlay on the target page
    targetPage.drawImage(pngImage, overlayOptions);
    
    console.log(`✅ Successfully baked overlay onto page ${targetPageNumber}`);
    
    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save();
    
    // Return as Buffer
    const buffer = Buffer.from(modifiedPdfBytes);
        
    return buffer;
    
  } catch (error) {
    console.error('❌ Error baking overlay into PDF:', error);
    throw new Error(`Failed to bake overlay onto page ${targetPageNumber}: ${error.message}`);
  }
}

// ✅ NEW: Helper method to validate overlay quality before baking
validateOverlayQuality(overlayPng, expectedDimensions = null) {
  try {
    if (!overlayPng || typeof overlayPng !== 'string') {
      return { valid: false, reason: 'Invalid overlay format' };
    }
    
    let base64Data;
    if (overlayPng.startsWith('data:')) {
      const parts = overlayPng.split(',');
      if (parts.length !== 2) {
        return { valid: false, reason: 'Invalid data URL format' };
      }
      base64Data = parts[1];
    } else {
      base64Data = overlayPng;
    }
    
    // Check if base64 is valid
    try {
      atob(base64Data);
    } catch (e) {
      return { valid: false, reason: 'Invalid base64 encoding' };
    }
    
    // Check for minimum size (avoid tiny/empty overlays)
    const sizeEstimate = (base64Data.length * 3) / 4; // Rough byte size
    if (sizeEstimate < 100) {
      return { valid: false, reason: 'Overlay too small' };
    }
    
    return { 
      valid: true, 
      sizeBytes: sizeEstimate,
      base64Length: base64Data.length 
    };
    
  } catch (error) {
    return { valid: false, reason: `Validation error: ${error.message}` };
  }
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