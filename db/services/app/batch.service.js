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
  
  async createBatch(payload) {
    await this.connect();
    
    console.log('🔍 BatchService: Received payload:', {
      keys: Object.keys(payload),
      hasFileId: !!payload.fileId,
      hasOriginalFileId: !!payload.originalFileId,
      hasEditorData: !!payload.editorData,
      fileId: payload.fileId,
      originalFileId: payload.originalFileId
    });
    
    // FIXED: Handle the new payload structure properly
    let fileId, overlayPng, status, editorData, confirmationData, user;
    
    // Extract fileId - it should already be set by the API route
    fileId = payload.fileId;
    if (!fileId) {
      throw new Error('fileId is required for batch creation');
    }
    
    // Extract other fields from payload
    overlayPng = payload.overlayPng;
    status = payload.status || 'Draft';
    user = payload.user;
    confirmationData = payload.confirmationData;
    
    console.log('🔍 BatchService: Extracted values:', {
      fileId,
      status,
      hasOverlayPng: !!overlayPng,
      hasUser: !!user
    });
  
    // Get file data
    const file = await this.File.findById(fileId).lean();
    if (!file) throw new Error('File not found');
  
    console.log('🔍 BatchService: Found file:', {
      fileName: file.fileName,
      hasSolutionRef: !!file.solutionRef,
      solutionRefId: file.solutionRef,
      componentCount: file.components?.length || 0
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
  
    // Handle PDF overlay if provided
    let signedPdf = null;
    if (overlayPng && file.pdf) {
      try {
        signedPdf = await this.bakeOverlayIntoPdf(file.pdf, overlayPng);
      } catch (e) {
        console.error('Failed to bake overlay into PDF:', e);
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
  
    // FIXED: Convert all ObjectId fields properly
    const batchData = { 
      fileId: toObjectId(fileId), // Convert to ObjectId
      overlayPng, 
      status, 
      snapshot: {
        enabled: snapshot.enabled,
        productRef: toObjectId(snapshot.productRef), // Convert to ObjectId
        solutionRef: toObjectId(snapshot.solutionRef), // Convert to ObjectId
        recipeQty: snapshot.recipeQty,
        recipeUnit: snapshot.recipeUnit,
        components: snapshot.components.map(comp => ({
          itemId: toObjectId(comp.itemId), // Convert to ObjectId
          amount: comp.amount,
          unit: comp.unit,
          netsuiteData: comp.netsuiteData
        }))
      }
    };
  
    console.log('🔍 BatchService: Prepared batch data:', {
      hasFileId: !!batchData.fileId,
      fileId: batchData.fileId,
      fileIdType: typeof batchData.fileId,
      fileIdConstructor: batchData.fileId.constructor.name,
      status: batchData.status,
      hasSnapshot: !!batchData.snapshot,
      solutionRefType: typeof batchData.snapshot.solutionRef,
      solutionRefConstructor: batchData.snapshot.solutionRef?.constructor.name,
      keys: Object.keys(batchData)
    });
  
    // Handle confirmation data
    if (confirmationData) {
      if (confirmationData.components?.length > 0) {
        // FIXED: Convert ObjectIds in confirmedComponents too
        batchData.confirmedComponents = confirmationData.components.map(comp => ({
          itemId: toObjectId(comp.itemId), // Convert to ObjectId
          plannedAmount: comp.plannedAmount || comp.amount,
          actualAmount: comp.actualAmount || comp.amount,
          unit: comp.unit,
          lotNumber: comp.lotNumber || '',
          lotId: toObjectId(comp.lotId), // Convert to ObjectId if exists
          displayName: comp.displayName,
          sku: comp.sku
        }));
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
  
    // Add debugging before creating the batch
    console.log('🔍 BatchService: Final batchData before create:', {
      fullData: JSON.stringify(batchData, (key, value) => {
        if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'ObjectId') {
          return value.toString();
        }
        return value;
      }, 2),
      hasFileId: !!batchData.fileId,
      fileIdString: batchData.fileId?.toString(),
      allKeys: Object.keys(batchData)
    });
  
    console.log('🔍 BatchService: Model info:', {
      modelName: this.model?.modelName,
      hasModel: !!this.model,
      modelSchema: this.model?.schema?.paths ? Object.keys(this.model.schema.paths) : 'no schema'
    });
  
    // Create the batch with enhanced error handling - BYPASS CoreService
    let batch;
    try {
      console.log('🔍 BatchService: Attempting direct model creation...');
      
      // FIXED: Try direct model creation instead of this.create()
      batch = new this.model(batchData);
      console.log('🔍 BatchService: Model instance created, attempting save...');
      
      const savedBatch = await batch.save();
      console.log('✅ BatchService: Batch saved successfully:', savedBatch._id);
      
      // Convert to plain object
      batch = savedBatch.toObject();
      
    } catch (error) {
      console.error('❌ BatchService: Direct model creation failed:', {
        error: error.message,
        stack: error.stack,
        validationErrors: error.errors ? Object.keys(error.errors) : 'no validation errors'
      });
      
      // Try one more approach - minimal data only
      console.log('🔍 BatchService: Trying minimal batch creation...');
      try {
        const minimalBatch = new this.model({
          fileId: toObjectId(fileId),
          status: 'Draft'
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
        console.log('🔍 Processing overlay update for batch:', id);
        
        // Debug the original PDF data
        console.log('📋 Original PDF data info:', {
          hasPdfData: !!prev.fileId.pdf?.data,
          dataType: typeof prev.fileId.pdf?.data,
          isBuffer: Buffer.isBuffer(prev.fileId.pdf?.data),
          dataLength: prev.fileId.pdf?.data?.length,
          contentType: prev.fileId.pdf?.contentType,
          dataConstructor: prev.fileId.pdf?.data?.constructor?.name,
          dataKeys: prev.fileId.pdf?.data && typeof prev.fileId.pdf?.data === 'object' ? Object.keys(prev.fileId.pdf?.data).slice(0, 10) : 'not object'
        });
  
        // REMOVED: Deep PDF data analysis - moved to separate debug if needed
        if (prev.fileId.pdf?.data && typeof prev.fileId.pdf.data === 'object') {
          console.log('🔬 Deep PDF data analysis:', {
            hasType: 'type' in prev.fileId.pdf.data,
            type: prev.fileId.pdf.data.type,
            hasDataArray: 'data' in prev.fileId.pdf.data,
            isDataArray: Array.isArray(prev.fileId.pdf.data.data),
            dataArrayLength: Array.isArray(prev.fileId.pdf.data.data) ? prev.fileId.pdf.data.data.length : 'not array',
            hasBuffer: 'buffer' in prev.fileId.pdf.data,
            hasByteLength: 'byteLength' in prev.fileId.pdf.data,
            isMongooseDocument: prev.fileId.pdf.data.constructor?.name,
            allKeys: Object.keys(prev.fileId.pdf.data),
            firstFewBytes: Array.isArray(prev.fileId.pdf.data.data) ? 
              prev.fileId.pdf.data.data.slice(0, 10) : 
              'no data array',
            stringPreview: typeof prev.fileId.pdf.data.toString === 'function' ? 
              prev.fileId.pdf.data.toString().substring(0, 50) : 
              'no toString method'
          });
        }
        
        // Get the original PDF data URL
        let originalPdfUrl;
        if (prev.fileId.pdf?.data) {
          if (Buffer.isBuffer(prev.fileId.pdf.data)) {
            const base64String = prev.fileId.pdf.data.toString('base64');
            originalPdfUrl = `data:${prev.fileId.pdf.contentType || 'application/pdf'};base64,${base64String}`;
          } else if (typeof prev.fileId.pdf.data === 'string') {
            // Already a string, check if it's a data URL or base64
            if (prev.fileId.pdf.data.startsWith('data:')) {
              originalPdfUrl = prev.fileId.pdf.data;
            } else {
              originalPdfUrl = `data:${prev.fileId.pdf.contentType || 'application/pdf'};base64,${prev.fileId.pdf.data}`;
            }
          } else if (typeof prev.fileId.pdf.data === 'object') {
            // Handle Mongoose document or serialized Buffer
            console.log('🔍 Handling object-type PDF data...');
            
            let buffer;
            if (prev.fileId.pdf.data.type === 'Buffer' && Array.isArray(prev.fileId.pdf.data.data)) {
              // Serialized Buffer: { type: 'Buffer', data: [1, 2, 3, ...] }
              buffer = Buffer.from(prev.fileId.pdf.data.data);
              console.log('✅ Reconstructed Buffer from serialized data');
            } else if (prev.fileId.pdf.data.buffer) {
              // MongoDB Binary object - extract the actual buffer
              console.log('🔍 Detected MongoDB Binary object, extracting buffer...');
              
              // MongoDB Binary objects can be accessed in different ways
              let extractedBuffer;
              if (Buffer.isBuffer(prev.fileId.pdf.data.buffer)) {
                // Direct buffer access
                extractedBuffer = prev.fileId.pdf.data.buffer;
              } else if (prev.fileId.pdf.data.buffer.buffer) {
                // Nested buffer (sometimes happens with MongoDB Binary)
                extractedBuffer = Buffer.from(prev.fileId.pdf.data.buffer.buffer);
              } else {
                // Convert the buffer property to Buffer
                extractedBuffer = Buffer.from(prev.fileId.pdf.data.buffer);
              }
              
              buffer = extractedBuffer;
              console.log('✅ Extracted Buffer from MongoDB Binary:', {
                bufferLength: buffer.length,
                firstBytes: buffer.subarray(0, 10),
                isPdf: buffer.toString('ascii', 0, 4) === '%PDF',
                bufferConstructor: buffer.constructor.name
              });
            } else if (prev.fileId.pdf.data.byteLength) {
              // ArrayBuffer or TypedArray
              buffer = Buffer.from(prev.fileId.pdf.data);
              console.log('✅ Converted ArrayBuffer/TypedArray to Buffer');
            } else if (typeof prev.fileId.pdf.data.toString === 'function') {
              // Try to convert to Buffer (might be a Mongoose document)
              try {
                buffer = Buffer.from(prev.fileId.pdf.data);
                console.log('✅ Converted object to Buffer using Buffer.from()');
              } catch (e) {
                console.error('❌ Failed to convert object to Buffer:', e);
                throw new Error('Cannot convert PDF data object to Buffer');
              }
            } else {
              console.error('❌ Unknown object structure:', Object.keys(prev.fileId.pdf.data));
              throw new Error('Cannot handle PDF data object structure');
            }
            
            // Validate the buffer contains PDF data
            if (!buffer || buffer.length === 0) {
              throw new Error('Extracted buffer is empty');
            }
            
            if (!buffer.toString('ascii', 0, 4).startsWith('%PDF')) {
              console.warn('⚠️ Buffer does not start with PDF header, but continuing...');
            }
            
            const base64String = buffer.toString('base64');
            console.log('📋 Base64 conversion result:', {
              originalBufferLength: buffer.length,
              base64Length: base64String.length,
              base64Preview: base64String.substring(0, 50)
            });
            
            originalPdfUrl = `data:${prev.fileId.pdf.contentType || 'application/pdf'};base64,${base64String}`;
          } else {
            throw new Error(`Unsupported PDF data type: ${typeof prev.fileId.pdf.data}`);
          }
        } else {
          throw new Error('No PDF data found in original file');
        }
        
        console.log('📄 Constructed PDF URL info:', {
          length: originalPdfUrl.length,
          startsWithData: originalPdfUrl.startsWith('data:'),
          mimeType: originalPdfUrl.substring(0, originalPdfUrl.indexOf(';')),
          base64Part: originalPdfUrl.split(',')[1]?.length || 0,
          firstCharsAfterComma: originalPdfUrl.split(',')[1]?.substring(0, 20) || 'no base64 part'
        });
        
        // Build overlay history
        let allOverlays = [];
        if (prev.overlayHistory?.length) {
          allOverlays = [...prev.overlayHistory];
        } else if (prev.overlayPng) {
          allOverlays = [prev.overlayPng];
        }
        allOverlays.push(payload.overlayPng);
        
        console.log('🖌️ Overlay processing info:', {
          newOverlayLength: payload.overlayPng?.length,
          newOverlayType: typeof payload.overlayPng,
          newOverlayStartsWith: payload.overlayPng?.substring(0, 20),
          totalOverlays: allOverlays.length,
          historyOverlays: prev.overlayHistory?.length || 0
        });
        
        // Apply all overlays sequentially
        let currentPdfUrl = originalPdfUrl;
        for (let i = 0; i < allOverlays.length; i++) {
          const overlay = allOverlays[i];
          console.log(`🖌️ Applying overlay ${i + 1}/${allOverlays.length}...`);
          
          if (!overlay || typeof overlay !== 'string') {
            console.warn(`⚠️ Skipping invalid overlay ${i + 1}:`, typeof overlay);
            continue;
          }
          
          const bakedBuffer = await this.bakeOverlayIntoPdf(currentPdfUrl, overlay);
          
          // Convert Buffer back to data URL for next iteration
          const base64String = bakedBuffer.toString('base64');
          currentPdfUrl = `data:application/pdf;base64,${base64String}`;
        }
        
        // Extract the final Buffer properly
        const finalBase64 = currentPdfUrl.split(',')[1];
        const finalBuffer = Buffer.from(finalBase64, 'base64');
        
        // IMMEDIATE validation after Buffer creation
        console.log('🔍 Immediate post-creation buffer check:', {
          isBuffer: Buffer.isBuffer(finalBuffer),
          length: finalBuffer.length,
          constructor: finalBuffer.constructor.name,
          type: typeof finalBuffer
        });
        
        // Set the signedPdf with proper Buffer
        payload.signedPdf = { 
          data: finalBuffer,  // This should be a proper Buffer
          contentType: 'application/pdf' 
        };
        
        // IMMEDIATE validation after assignment
        console.log('🔍 Immediate post-assignment buffer check:', {
          isBuffer: Buffer.isBuffer(payload.signedPdf.data),
          length: payload.signedPdf.data?.length,
          constructor: payload.signedPdf.data?.constructor.name,
          type: typeof payload.signedPdf.data,
          keys: typeof payload.signedPdf.data === 'object' ? Object.keys(payload.signedPdf.data).slice(0, 10) : 'not object'
        });
        
        payload.overlayHistory = allOverlays;
        
        console.log('✅ PDF overlay processing completed:', {
          overlayCount: allOverlays.length,
          finalSize: finalBuffer.length,
          isBuffer: Buffer.isBuffer(finalBuffer)
        });
        
      } catch (e) {
        console.error('❌ Failed to bake overlays during update:', e);
        // Don't throw - continue with update without baked PDF
        delete payload.signedPdf;
      }
    }
    
    // SINGLE Buffer validation before saving
    if (payload.signedPdf?.data) {
      console.log('🔍 Pre-save signedPdf validation:', {
        dataType: typeof payload.signedPdf.data,
        isBuffer: Buffer.isBuffer(payload.signedPdf.data),
        constructor: payload.signedPdf.data?.constructor?.name,
        hasType: payload.signedPdf.data?.type,
        hasDataArray: Array.isArray(payload.signedPdf.data?.data),
        dataLength: payload.signedPdf.data?.length || 'no length',
        isNumericObject: typeof payload.signedPdf.data === 'object' && Object.keys(payload.signedPdf.data || {}).every(key => !isNaN(key)),
        keyCount: typeof payload.signedPdf.data === 'object' ? Object.keys(payload.signedPdf.data || {}).length : 'not object'
      });
      
      // Fix ANY non-Buffer signedPdf.data
      if (!Buffer.isBuffer(payload.signedPdf.data)) {
        console.log('🔧 signedPdf.data is not a Buffer, attempting to fix...');
        
        if (payload.signedPdf.data?.type === 'Buffer' && Array.isArray(payload.signedPdf.data.data)) {
          // Serialized Buffer format: {type: 'Buffer', data: [1,2,3...]}
          console.log('🔧 Converting serialized Buffer (type/data format)');
          payload.signedPdf.data = Buffer.from(payload.signedPdf.data.data);
        } else if (typeof payload.signedPdf.data === 'object' && payload.signedPdf.data !== null) {
          // Check if it's a numeric object like {0: 123, 1: 456, ...}
          const keys = Object.keys(payload.signedPdf.data);
          if (keys.length > 0 && keys.every(key => !isNaN(key) && Number.isInteger(Number(key)))) {
            console.log('🔧 Converting numeric object to Buffer');
            const values = keys
              .map(key => parseInt(key))
              .sort((a, b) => a - b)
              .map(index => payload.signedPdf.data[index]);
            payload.signedPdf.data = Buffer.from(values);
          } else {
            console.error('❌ Unknown object structure for signedPdf.data:', {
              keys: keys.slice(0, 10),
              hasNumericKeys: keys.every(key => !isNaN(key)),
              sampleValues: keys.slice(0, 3).map(key => ({ key, value: payload.signedPdf.data[key], type: typeof payload.signedPdf.data[key] }))
            });
            
            // Last resort: remove invalid data
            delete payload.signedPdf;
            console.log('🗑️ Removed invalid signedPdf to prevent save error');
          }
        } else if (typeof payload.signedPdf.data === 'string') {
          // String - might be base64
          console.log('🔧 Converting string to Buffer (assuming base64)');
          try {
            payload.signedPdf.data = Buffer.from(payload.signedPdf.data, 'base64');
          } catch (e) {
            console.error('❌ Failed to convert string to Buffer:', e.message);
            delete payload.signedPdf;
          }
        } else {
          console.error('❌ Cannot handle signedPdf.data type:', typeof payload.signedPdf.data);
          delete payload.signedPdf;
        }
      }
      
      // Final validation and logging
      if (payload.signedPdf?.data) {
        if (Buffer.isBuffer(payload.signedPdf.data)) {
          console.log('✅ signedPdf.data is now a valid Buffer:', {
            length: payload.signedPdf.data.length,
            isPdf: payload.signedPdf.data.toString('ascii', 0, 4) === '%PDF',
            lastBytes: payload.signedPdf.data.toString('ascii', payload.signedPdf.data.length - 10)
          });
        } else {
          console.error('❌ signedPdf.data is STILL not a Buffer after conversion attempts!');
          delete payload.signedPdf;
        }
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

    if (payload.status === 'Review' && payload.chemicalsTransacted) {
      console.log('🏗️ Batch moving to Review status - checking for work order completion...');
      
      // Check if batch has a NetSuite work order that needs completion
      if (batch.netsuiteWorkOrderData?.workOrderId && !batch.workOrderCompleted) {
        console.log('🏗️ Completing NetSuite work order:', batch.netsuiteWorkOrderData.tranId);
        
        try {
          // Get user for NetSuite operations (you'll need to pass this or get it from context)
          const user = payload.user || await this.getUserFromContext(); // You'll need to implement this
          
          // Import and use the assembly build service
          const { createAssemblyBuildService } = await import('@/services/netsuite/assemblyBuild.service.js');
          const assemblyBuildService = createAssemblyBuildService(user);
          
          // Complete the work order by creating assembly build
          const completionResult = await assemblyBuildService.completeWorkOrderForBatch(batch._id, {
            solutionQuantity: payload.solutionQuantity || batch.snapshot?.recipeQty || 1,
            solutionUnit: payload.solutionUnit || batch.snapshot?.recipeUnit || 'mL',
            confirmedComponents: payload.confirmedComponents || [],
            solutionLotNumber: payload.solutionLotNumber
          });
          
          if (completionResult.success) {
            console.log('✅ Work order completed successfully:', completionResult.assemblyBuild.id);
            
            // Update payload with completion data
            payload.workOrderCompleted = true;
            payload.workOrderCompletedAt = new Date();
            payload.assemblyBuildId = completionResult.assemblyBuild.id;
            payload.assemblyBuildTranId = completionResult.assemblyBuild.tranId; // ← Store the ASSYB number
            payload.assemblyBuildCreated = true;
            payload.assemblyBuildCreatedAt = new Date();
            
            // Update NetSuite work order data
            payload.netsuiteWorkOrderData = {
              ...batch.netsuiteWorkOrderData,
              status: 'built',
              completedAt: new Date(),
              assemblyBuildId: completionResult.assemblyBuild.id,
              assemblyBuildTranId: completionResult.assemblyBuild.tranId, // ← Store the ASSYB number
              lastSyncAt: new Date()
            };
            
          } else {
            console.error('❌ Work order completion failed:', completionResult.error);
            // Don't fail the entire operation, just log the error
            payload.workOrderCompletionError = completionResult.error;
            payload.workOrderCompletionFailedAt = new Date();
          }
          
        } catch (error) {
          console.error('❌ Work order completion failed with exception:', error);
          // Don't fail the entire operation, just log the error
          payload.workOrderCompletionError = error.message;
          payload.workOrderCompletionFailedAt = new Date();
        }
      } else if (!batch.netsuiteWorkOrderData?.workOrderId) {
        console.log('ℹ️ Batch has no NetSuite work order - skipping assembly build creation');
      } else if (batch.workOrderCompleted) {
        console.log('ℹ️ Work order already completed - skipping assembly build creation');
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
  
// Replace the bakeOverlayIntoPdf function in your batch.service.js:

async bakeOverlayIntoPdf(originalPdfDataUrl, overlayPng) {
  try {
    const { PDFDocument } = await import('pdf-lib');
        
    // Extract base64 data from data URL
    let pdfBase64;
    if (typeof originalPdfDataUrl === 'string' && originalPdfDataUrl.startsWith('data:')) {
      const parts = originalPdfDataUrl.split(',');
      if (parts.length !== 2) {
        throw new Error('Invalid data URL format');
      }
      pdfBase64 = parts[1];
    } else if (typeof originalPdfDataUrl === 'string') {
      // If it's already base64, use it directly
      pdfBase64 = originalPdfDataUrl;
    } else {
      throw new Error('Invalid PDF data format - expected string');
    }
    
    // Validate base64 string
    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      throw new Error('Invalid or empty base64 PDF data');
    }
    
    // Clean the base64 string (remove any whitespace/newlines)
    pdfBase64 = pdfBase64.replace(/\s/g, '');
        
    // Convert base64 to Uint8Array with better error handling
    let pdfBytes;
    try {
      pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
    } catch (decodeError) {
      console.error('❌ Base64 decode error:', decodeError);
      throw new Error(`Failed to decode PDF base64: ${decodeError.message}`);
    }
    
    // Load the PDF with better error handling
    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.load(pdfBytes);
    } catch (loadError) {
      console.error('❌ PDF load error:', loadError);
      throw new Error(`Failed to load PDF document: ${loadError.message}`);
    }
    
    const [firstPage] = pdfDoc.getPages();
    const { width: pdfWidth, height: pdfHeight } = firstPage.getSize();
        
    // Process overlay PNG
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
    
    // Draw the overlay on the first page
    firstPage.drawImage(pngImage, { 
      x: 0, 
      y: 0, 
      width: pdfWidth, 
      height: pdfHeight 
    });
    
    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save();
    
    // FIXED: Ensure we return a proper Buffer
    const buffer = Buffer.from(modifiedPdfBytes);
        
    return buffer;
    
  } catch (error) {
    console.error('❌ Error baking overlay into PDF:', error);
    throw new Error(`Failed to bake overlay: ${error.message}`);
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