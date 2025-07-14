// services/async-workorder.service.js - Enhanced with single db import pattern
import db from '@/db/index.js';

/**
 * Enhanced Background Work Order Creation Service
 * Uses single db import for all database operations and service dependencies
 */
export class AsyncWorkOrderService {
  static locks = new Map(); // Static lock map for all instances

    static async acquireLock(batchId, timeoutMs = 30000) {
    const lockKey = `batch-${batchId}`;
    
    if (this.locks.has(lockKey)) {
      console.log(`⏳ Waiting for lock on batch ${batchId}...`);
      // Wait for existing lock to release
      await new Promise(resolve => {
        const checkLock = () => {
          if (!this.locks.has(lockKey)) {
            resolve();
          } else {
            setTimeout(checkLock, 100);
          }
        };
        checkLock();
      });
    }

        // Set the lock
    this.locks.set(lockKey, Date.now());
    console.log(`🔒 Acquired lock for batch ${batchId}`);
    
    // Auto-release after timeout to prevent deadlocks
    setTimeout(() => {
      this.releaseLock(batchId);
    }, timeoutMs);
  }
  
  static releaseLock(batchId) {
    const lockKey = `batch-${batchId}`;
    this.locks.delete(lockKey);
    console.log(`🔓 Released lock for batch ${batchId}`);
  }
  
  // Lazy model getters
  static get User() {
    return db.models.User;
  }

  static get Batch() {
    return db.models.Batch;
  }

  static async connect() {
    return db.connect();
  }

  // Access to other services through db.services
  static get services() {
    return db.services;
  }
  
  /**
   * Queue a work order creation job
   */
  static async queueWorkOrderCreation(batchId, quantity, userId = null) {
    try {
      await this.acquireLock(batchId);
      await this.connect();
      
      // 🔥 CRITICAL: Check current state AFTER acquiring lock
      const currentBatch = await this.Batch.findById(batchId).lean();
      if (!currentBatch) {
        throw new Error('Batch not found');
      }
      
      // Prevent duplicate work order creation
      if (currentBatch.workOrderCreated && currentBatch.workOrderStatus === 'created') {
        console.log(`⚠️ Work order already exists for batch ${batchId}, skipping`);
        return {
          success: true,
          batchId,
          status: 'already_exists',
          message: 'Work order already created'
        };
      }
      
      if (currentBatch.workOrderStatus === 'creating') {
        console.log(`⚠️ Work order creation already in progress for batch ${batchId}, skipping`);
        return {
          success: true,
          batchId,
          status: 'already_creating',
          message: 'Work order creation already in progress'
        };
      }
      
      // Proceed with creation only if not already created/creating
      const updateResult = await this.Batch.updateOne(
        { 
          _id: batchId,
          $or: [
            { workOrderStatus: { $ne: 'creating' } },
            { workOrderStatus: { $exists: false } }
          ]
        },
        {
          $set: {
            workOrderCreated: true,
            workOrderStatus: 'creating',
            workOrderCreatedAt: new Date(),
            workOrderId: `PENDING-${Date.now()}`,
            workOrderError: null,
            workOrderFailedAt: null
          }
        }
      );

      if (updateResult.matchedCount === 0) {
        console.log(`⚠️ Could not update batch ${batchId} - likely already being processed`);
        return {
          success: true,
          batchId,
          status: 'race_condition_avoided',
          message: 'Another process is already handling this work order'
        };
      }

      console.log('✓ Batch status set to creating, starting background job');

      // Start the background job
      setImmediate(() => {
        this.createWorkOrderInBackground(batchId, quantity, userId)
          .catch(error => {
            console.error('❌ Background work order creation failed:', error);
            this.handleWorkOrderFailure(batchId, error.message);
          })
          .finally(() => {
            this.releaseLock(batchId);
          });
      });

      return {
        success: true,
        batchId,
        status: 'creating',
        message: 'Work order creation started in background'
      };

    } catch (error) {
      this.releaseLock(batchId);
      console.error('Error queuing work order creation:', error);
      throw error;
    }
  }

  /**
   * Create work order in background with guaranteed database updates
   */
static async createWorkOrderInBackground(batchId, quantity, userId = null) {
  try {
    console.log('🚀 Starting background work order creation for batch:', batchId);
    
    // CRITICAL: Always start with fresh connection
    await this.connect();
    
    // Get the batch with a fresh query
    const batch = await this.Batch.findById(batchId)
      .populate('fileId', 'fileName')
      .populate('snapshot.solutionRef', 'displayName sku netsuiteInternalId')
      .lean();

    if (!batch) {
      throw new Error('Batch not found');
    }

    // Verify batch is in creating state
    if (batch.workOrderStatus !== 'creating') {
      console.warn('⚠️ Batch not in creating state, current status:', batch.workOrderStatus);
    }

    // Get user if provided
    let user = null;
    if (userId) {
      user = await this.User.findById(userId);
    }

    const fullUser = await this.getFullUser(user);
    
    // Create work order (NetSuite or local)
    let workOrderResult;
    
    if (this.hasNetSuiteAccess(fullUser)) {
      try {
        console.log('🔗 Creating NetSuite work order...');
        workOrderResult = await this.createNetSuiteWorkOrder(batch, quantity, fullUser);
        console.log('✅ NetSuite work order created successfully:', {
          tranId: workOrderResult.tranId,
          netsuiteId: workOrderResult.netsuiteId,
          status: workOrderResult.status
        });
      } catch (error) {
        console.error('❌ NetSuite work order creation failed, falling back to local:', error);
        workOrderResult = this.createLocalWorkOrder(batch, quantity);
      }
    } else {
      console.log('📝 No NetSuite access, creating local work order');
      workOrderResult = this.createLocalWorkOrder(batch, quantity);
    }

    // ENHANCED: Prepare update data with detailed logging
    const updateData = {
      workOrderId: workOrderResult.tranId || workOrderResult.id,
      workOrderStatus: 'created', // CRITICAL: Must be 'created'
      workOrderCreatedAt: new Date().toISOString(), // FIXED: Convert to ISO string
      workOrderError: null,
      workOrderFailedAt: null
    };

    // Store NetSuite-specific data if available
    if (workOrderResult.source === 'netsuite') {
      updateData.netsuiteWorkOrderData = {
        workOrderId: workOrderResult.netsuiteId,
        tranId: workOrderResult.tranId,
        bomId: workOrderResult.bomId,
        revisionId: workOrderResult.revisionId,
        quantity: quantity,
        status: workOrderResult.status,
        orderStatus: workOrderResult.orderStatus,
        // FIXED: Remove problematic date fields or convert to ISO strings
        createdAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString()
      };
      
      console.log('📊 NetSuite data prepared for database:', {
        workOrderId: updateData.netsuiteWorkOrderData.workOrderId,
        tranId: updateData.netsuiteWorkOrderData.tranId,
        hasAllFields: !!(updateData.netsuiteWorkOrderData.workOrderId && updateData.netsuiteWorkOrderData.tranId)
      });
    }

    console.log('📝 Complete update data prepared:', {
      workOrderId: updateData.workOrderId,
      workOrderStatus: updateData.workOrderStatus,
      hasNetsuiteData: !!updateData.netsuiteWorkOrderData,
      netsuiteDataKeys: updateData.netsuiteWorkOrderData ? Object.keys(updateData.netsuiteWorkOrderData) : [],
      updateDataKeys: Object.keys(updateData)
    });

    // ENHANCED: Database update with extensive retry logic and logging
    let updateSuccess = false;
    let attempts = 0;
    const maxAttempts = 5; // Increased attempts
    let lastError = null;

    while (!updateSuccess && attempts < maxAttempts) {
      attempts++;
      console.log(`🔄 Database update attempt ${attempts}/${maxAttempts} for batch ${batchId}`);

      try {
        // CRITICAL: Fresh connection each attempt
        await this.connect();
        
        // PRE-UPDATE: Verify batch still exists
        const preUpdateBatch = await this.Batch.findById(batchId).select('_id workOrderStatus').lean();
        if (!preUpdateBatch) {
          throw new Error('Batch no longer exists in database');
        }
        
        console.log(`📋 Pre-update batch status: ${preUpdateBatch.workOrderStatus}`);
        
        // PERFORM UPDATE with extensive logging
        console.log(`🔧 Executing database update with data:`, JSON.stringify(updateData, null, 2));
        
        const updateResult = await this.Batch.updateOne(
          { _id: batchId },
          { $set: updateData },
          { 
            upsert: false,
            // Add these options for better reliability
            writeConcern: { w: 'majority', j: true },
            maxTimeMS: 10000
          }
        );

        console.log(`📊 Update result for attempt ${attempts}:`, {
          acknowledged: updateResult.acknowledged,
          matchedCount: updateResult.matchedCount,
          modifiedCount: updateResult.modifiedCount,
          upsertedCount: updateResult.upsertedCount,
          upsertedId: updateResult.upsertedId
        });

        // ENHANCED SUCCESS CRITERIA
        if (updateResult.acknowledged && updateResult.matchedCount > 0) {
          if (updateResult.modifiedCount > 0) {
            updateSuccess = true;
            console.log(`✅ Database update successful on attempt ${attempts} - document modified`);
          } else {
            // Matched but not modified - check if data is already correct
            console.log(`⚠️ Document matched but not modified on attempt ${attempts} - checking current state`);
            
            const currentBatch = await this.Batch.findById(batchId)
              .select('workOrderStatus workOrderId netsuiteWorkOrderData')
              .lean();
            
            if (currentBatch && currentBatch.workOrderStatus === 'created' && currentBatch.workOrderId === updateData.workOrderId) {
              console.log(`✅ Data already correct - treating as success`);
              updateSuccess = true;
            } else {
              console.log(`❌ Data not correct after update:`, {
                currentStatus: currentBatch?.workOrderStatus,
                expectedStatus: updateData.workOrderStatus,
                currentWorkOrderId: currentBatch?.workOrderId,
                expectedWorkOrderId: updateData.workOrderId
              });
            }
          }
        } else {
          console.error(`❌ Update attempt ${attempts} failed - no match:`, {
            acknowledged: updateResult.acknowledged,
            matchedCount: updateResult.matchedCount
          });
        }

        if (!updateSuccess && attempts < maxAttempts) {
          const delay = 1000 * attempts; // Exponential backoff
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (updateError) {
        lastError = updateError;
        console.error(`❌ Update attempt ${attempts} failed with exception:`, {
          error: updateError.message,
          code: updateError.code,
          codeName: updateError.codeName,
          stack: updateError.stack?.split('\n')[0] // Just first line of stack
        });
        
        if (attempts < maxAttempts) {
          const delay = 1000 * attempts;
          console.log(`⏳ Waiting ${delay}ms before retry after error...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // FINAL ERROR HANDLING
    if (!updateSuccess) {
      const errorMessage = `Failed to update database after ${maxAttempts} attempts. Last error: ${lastError?.message || 'unknown'}`;
      console.error(`💥 ${errorMessage}`);
      throw new Error(errorMessage);
    }

    // ENHANCED VERIFICATION with detailed checking
    console.log('🔍 Starting final verification...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Longer delay for DB consistency
    
    const verificationBatch = await this.Batch.findById(batchId)
      .select('workOrderStatus workOrderId workOrderCreatedAt netsuiteWorkOrderData')
      .lean();
    
    console.log('🔍 Final verification result:', {
      found: !!verificationBatch,
      workOrderStatus: verificationBatch?.workOrderStatus,
      workOrderId: verificationBatch?.workOrderId,
      workOrderCreatedAt: verificationBatch?.workOrderCreatedAt,
      hasNetsuiteData: !!verificationBatch?.netsuiteWorkOrderData,
      netsuiteDataKeys: verificationBatch?.netsuiteWorkOrderData ? Object.keys(verificationBatch.netsuiteWorkOrderData) : [],
      tranId: verificationBatch?.netsuiteWorkOrderData?.tranId,
      netsuiteWorkOrderId: verificationBatch?.netsuiteWorkOrderData?.workOrderId
    });

    // STRICT VERIFICATION
    if (!verificationBatch) {
      throw new Error('Verification failed - batch not found after update');
    }
    
    if (verificationBatch.workOrderStatus !== 'created') {
      throw new Error(`Verification failed - status is '${verificationBatch.workOrderStatus}', expected 'created'`);
    }
    
    if (verificationBatch.workOrderId !== updateData.workOrderId) {
      throw new Error(`Verification failed - workOrderId is '${verificationBatch.workOrderId}', expected '${updateData.workOrderId}'`);
    }
    
    if (workOrderResult.source === 'netsuite' && !verificationBatch.netsuiteWorkOrderData) {
      throw new Error('Verification failed - NetSuite data not saved');
    }
    
    if (workOrderResult.source === 'netsuite' && verificationBatch.netsuiteWorkOrderData?.tranId !== workOrderResult.tranId) {
      throw new Error(`Verification failed - NetSuite tranId is '${verificationBatch.netsuiteWorkOrderData?.tranId}', expected '${workOrderResult.tranId}'`);
    }

    console.log('🎉 Background work order creation completed successfully with verification:', {
      batchId: batchId,
      tranId: workOrderResult.tranId,
      internalId: workOrderResult.netsuiteId,
      finalStatus: verificationBatch.workOrderStatus,
      finalWorkOrderId: verificationBatch.workOrderId,
      source: workOrderResult.source,
      attempts: attempts,
      verified: true
    });
    
    return {
      success: true,
      workOrderId: workOrderResult.tranId,
      internalId: workOrderResult.netsuiteId,
      source: workOrderResult.source,
      attempts: attempts,
      verified: true
    };

  } catch (error) {
    console.error('💥 Background work order creation failed:', {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3), // First 3 lines of stack
      batchId: batchId
    });
    
    // CRITICAL: Always record failure in database
    await this.handleWorkOrderFailure(batchId, error.message);
    throw error;
  }
}


  // =============================================================================
  // 🆕 NEW: ASSEMBLY BUILD CREATION
  // =============================================================================
  
  /**
   * Queue an assembly build creation job (NEW)
   */

    static async queueAssemblyBuildCreation(batchId, submissionData, userId = null) {
    try {
      await this.acquireLock(batchId);
      await this.connect();
      
      const currentBatch = await this.Batch.findById(batchId).lean();
      if (!currentBatch) {
        throw new Error('Batch not found for assembly build creation');
      }
      
      // Prevent duplicate assembly build creation
      if (currentBatch.assemblyBuildCreated) {
        console.log(`⚠️ Assembly build already exists for batch ${batchId}, skipping`);
        return {
          success: true,
          batchId,
          status: 'already_exists',
          message: 'Assembly build already created'
        };
      }
      
      if (currentBatch.assemblyBuildStatus === 'creating') {
        console.log(`⚠️ Assembly build creation already in progress for batch ${batchId}, skipping`);
        return {
          success: true,
          batchId,
          status: 'already_creating',
          message: 'Assembly build creation already in progress'
        };
      }
      
      // Proceed only if not already created/creating
      const updateResult = await this.Batch.updateOne(
        { 
          _id: batchId,
          assemblyBuildCreated: { $ne: true },
          $or: [
            { assemblyBuildStatus: { $ne: 'creating' } },
            { assemblyBuildStatus: { $exists: false } }
          ]
        },
        {
          $set: {
            assemblyBuildCreated: false,
            assemblyBuildStatus: 'creating',
            assemblyBuildCreatedAt: null,
            assemblyBuildId: `PENDING-AB-${Date.now()}`,
            assemblyBuildError: null,
            assemblyBuildFailedAt: null,
            workOrderCompleted: false,
            workOrderCompletedAt: null
          }
        }
      );

      if (updateResult.matchedCount === 0) {
        console.log(`⚠️ Could not update batch ${batchId} - assembly build likely already being processed`);
        return {
          success: true,
          batchId,
          status: 'race_condition_avoided',
          message: 'Another process is already handling this assembly build'
        };
      }

      console.log('✓ Batch status set to assembly build creating, starting background job');

      setImmediate(() => {
        this.createAssemblyBuildInBackground(batchId, submissionData, userId)
          .catch(error => {
            console.error('❌ Background assembly build creation failed:', error);
            this.handleAssemblyBuildFailure(batchId, error.message);
          })
          .finally(() => {
            this.releaseLock(batchId);
          });
      });

      return {
        success: true,
        batchId,
        status: 'creating_assembly_build',
        message: 'Assembly build creation started in background'
      };

    } catch (error) {
      this.releaseLock(batchId);
      console.error('Error queuing assembly build creation:', error);
      throw error;
    }
  }


  /**
   * Create assembly build in background (NEW)
   */
  static async createAssemblyBuildInBackground(batchId, submissionData, userId = null) {
    try {
      console.log('🚀 Starting background assembly build creation for batch:', batchId);
      
      // CRITICAL: Always start with fresh connection
      await this.connect();
      
      // Get the batch with a fresh query
      const batch = await this.Batch.findById(batchId)
        .populate('fileId', 'fileName')
        .populate('snapshot.solutionRef', 'displayName sku netsuiteInternalId')
        .lean();

      if (!batch) {
        throw new Error('Batch not found');
      }

      // Verify batch has a work order
      if (!batch.netsuiteWorkOrderData?.workOrderId) {
        throw new Error('Batch does not have a NetSuite work order ID for assembly build');
      }

      // Get user if provided
      let user = null;
      if (userId) {
        user = await this.User.findById(userId);
      }

      const fullUser = await this.getFullUser(user);
      
      // Create assembly build using NetSuite service
      let assemblyBuildResult;
      
      if (this.hasNetSuiteAccess(fullUser)) {
        try {
          console.log('🔗 Creating NetSuite assembly build...');
          
          // Import and use the assembly build service
          const { createAssemblyBuildService } = await import('@/db/services/netsuite/assemblyBuild.service.js');
          const assemblyBuildService = createAssemblyBuildService(fullUser);
          
          // Complete the work order by creating assembly build
          assemblyBuildResult = await assemblyBuildService.completeWorkOrderForBatch(batchId, submissionData);
          
          console.log('✅ NetSuite assembly build created successfully:', {
            assemblyBuildId: assemblyBuildResult.assemblyBuild.id,
            tranId: assemblyBuildResult.assemblyBuild.tranId,
            workOrderId: assemblyBuildResult.assemblyBuild.workOrderId
          });
          
        } catch (error) {
          console.error('❌ NetSuite assembly build creation failed:', error);
          throw error; // Don't fall back for assembly builds - they require NetSuite
        }
      } else {
        throw new Error('NetSuite access required for assembly build creation');
      }

      // ENHANCED: Prepare update data with detailed logging
      const updateData = {
        assemblyBuildId: assemblyBuildResult.assemblyBuild.id,
        assemblyBuildTranId: assemblyBuildResult.assemblyBuild.tranId,
        assemblyBuildStatus: 'created', // CRITICAL: Must be 'created'
        assemblyBuildCreated: true,
        assemblyBuildCreatedAt: new Date(),
        assemblyBuildError: null,
        assemblyBuildFailedAt: null,
        
        // Mark work order as completed
        workOrderCompleted: true,
        workOrderCompletedAt: new Date(),
        workOrderStatus: 'completed'
      };

      // Also update the nested NetSuite data if needed
      if (batch.netsuiteWorkOrderData) {
        updateData.netsuiteWorkOrderData = {
          ...batch.netsuiteWorkOrderData,
          status: 'built',
          completedAt: new Date(),
          assemblyBuildId: assemblyBuildResult.assemblyBuild.id,
          assemblyBuildTranId: assemblyBuildResult.assemblyBuild.tranId,
          lastSyncAt: new Date()
        };
      }

      console.log('📝 Complete update data prepared:', {
        assemblyBuildId: updateData.assemblyBuildId,
        assemblyBuildTranId: updateData.assemblyBuildTranId,
        assemblyBuildStatus: updateData.assemblyBuildStatus,
        workOrderCompleted: updateData.workOrderCompleted,
        hasNetsuiteData: !!updateData.netsuiteWorkOrderData
      });

      // ENHANCED: Database update with extensive retry logic
      let updateSuccess = false;
      let attempts = 0;
      const maxAttempts = 5;
      let lastError = null;

      while (!updateSuccess && attempts < maxAttempts) {
        attempts++;
        console.log(`🔄 Database update attempt ${attempts}/${maxAttempts} for batch ${batchId}`);

        try {
          // CRITICAL: Fresh connection each attempt
          await this.connect();
          
          // PERFORM UPDATE with extensive logging
          const updateResult = await this.Batch.updateOne(
            { _id: batchId },
            { $set: updateData },
            { 
              upsert: false,
              writeConcern: { w: 'majority', j: true },
              maxTimeMS: 10000
            }
          );

          console.log(`📊 Update result for attempt ${attempts}:`, {
            acknowledged: updateResult.acknowledged,
            matchedCount: updateResult.matchedCount,
            modifiedCount: updateResult.modifiedCount
          });

          if (updateResult.acknowledged && updateResult.matchedCount > 0) {
            updateSuccess = true;
            console.log(`✅ Database update successful on attempt ${attempts}`);
          }

          if (!updateSuccess && attempts < maxAttempts) {
            const delay = 1000 * attempts;
            console.log(`⏳ Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
        } catch (updateError) {
          lastError = updateError;
          console.error(`❌ Update attempt ${attempts} failed:`, updateError.message);
          
          if (attempts < maxAttempts) {
            const delay = 1000 * attempts;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      if (!updateSuccess) {
        throw new Error(`Failed to update database after ${maxAttempts} attempts: ${lastError?.message}`);
      }

      // ENHANCED VERIFICATION
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const verificationBatch = await this.Batch.findById(batchId)
        .select('assemblyBuildStatus assemblyBuildId assemblyBuildTranId assemblyBuildCreated workOrderCompleted')
        .lean();
      
      console.log('🔍 Final verification result:', {
        found: !!verificationBatch,
        assemblyBuildStatus: verificationBatch?.assemblyBuildStatus,
        assemblyBuildId: verificationBatch?.assemblyBuildId,
        assemblyBuildTranId: verificationBatch?.assemblyBuildTranId,
        assemblyBuildCreated: verificationBatch?.assemblyBuildCreated,
        workOrderCompleted: verificationBatch?.workOrderCompleted
      });

      if (!verificationBatch || verificationBatch.assemblyBuildStatus !== 'created') {
        throw new Error('Verification failed - assembly build not properly created');
      }

      console.log('🎉 Background assembly build creation completed successfully:', {
        batchId: batchId,
        assemblyBuildId: assemblyBuildResult.assemblyBuild.id,
        assemblyBuildTranId: assemblyBuildResult.assemblyBuild.tranId,
        workOrderId: assemblyBuildResult.assemblyBuild.workOrderId,
        attempts: attempts,
        verified: true
      });
      
      return {
        success: true,
        assemblyBuildId: assemblyBuildResult.assemblyBuild.id,
        assemblyBuildTranId: assemblyBuildResult.assemblyBuild.tranId,
        workOrderId: assemblyBuildResult.assemblyBuild.workOrderId,
        attempts: attempts,
        verified: true
      };

    } catch (error) {
      console.error('💥 Background assembly build creation failed:', error);
      await this.handleAssemblyBuildFailure(batchId, error.message);
      throw error;
    }
  }

  /**
   * Handle assembly build creation failure (NEW)
   */
  static async handleAssemblyBuildFailure(batchId, errorMessage) {
    try {
      console.log(`🚨 Recording assembly build failure for batch ${batchId}: ${errorMessage}`);
      await this.connect();
      
      const updateResult = await this.Batch.updateOne(
        { _id: batchId },
        {
          $set: {
            assemblyBuildStatus: 'failed',
            assemblyBuildError: errorMessage,
            assemblyBuildFailedAt: new Date(),
            assemblyBuildCreated: false
          }
        },
        {
          writeConcern: { w: 'majority', j: true }
        }
      );
      
      if (updateResult.modifiedCount > 0) {
        console.log('✅ Assembly build failure recorded for batch:', batchId);
      } else {
        console.error('❌ Failed to record assembly build failure');
      }
    } catch (error) {
      console.error('💥 Error recording assembly build failure:', error);
    }
  }

  // =============================================================================
  // 🆕 NEW: STATUS CHECKING FOR ASSEMBLY BUILDS
  // =============================================================================
  
  /**
   * Get assembly build status (NEW)
   */
  static async getAssemblyBuildStatus(batchId) {
    try {
      console.log('🔍 Getting assembly build status for batch:', batchId);
      
      await this.connect();
      
      const batch = await this.Batch.findOne({ _id: batchId })
        .select('assemblyBuildCreated assemblyBuildStatus assemblyBuildId assemblyBuildTranId assemblyBuildError assemblyBuildCreatedAt assemblyBuildFailedAt workOrderCompleted workOrderCompletedAt netsuiteWorkOrderData')
        .lean()
        .exec();

      if (!batch) {
        return { error: 'Batch not found' };
      }

      const result = {
        created: batch.assemblyBuildCreated,
        status: batch.assemblyBuildStatus,
        assemblyBuildId: batch.assemblyBuildId,
        assemblyBuildTranId: batch.assemblyBuildTranId,
        workOrderCompleted: batch.workOrderCompleted,
        error: batch.assemblyBuildError,
        createdAt: batch.assemblyBuildCreatedAt,
        failedAt: batch.assemblyBuildFailedAt,
        workOrderCompletedAt: batch.workOrderCompletedAt
      };
      
      console.log('📤 Returning assembly build status:', result);
      return result;
    } catch (error) {
      console.error('💥 Error getting assembly build status:', error);
      return { error: error.message };
    }
  }



/**
 * ENHANCED: Handle work order creation failure with better error tracking and verification
 */
static async handleWorkOrderFailure(batchId, errorMessage) {
  try {
    console.log(`🚨 Recording work order failure for batch ${batchId}: ${errorMessage}`);
    await this.connect();
    
    const updateResult = await this.Batch.updateOne(
      { _id: batchId },
      {
        $set: {
          workOrderStatus: 'failed',
          workOrderError: errorMessage,
          workOrderFailedAt: new Date().toISOString() // FIXED: Convert to ISO string
        }
      },
      {
        writeConcern: { w: 'majority', j: true }
      }
    );
    
    console.log('📊 Failure recording result:', {
      acknowledged: updateResult.acknowledged,
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount
    });
    
    if (updateResult.modifiedCount > 0) {
      console.log('✅ Work order failure recorded for batch:', batchId);
      
      // Verify the failure was recorded
      const verifyBatch = await this.Batch.findById(batchId)
        .select('workOrderStatus workOrderError workOrderFailedAt')
        .lean();
      
      console.log('🔍 Failure verification:', {
        status: verifyBatch?.workOrderStatus,
        error: verifyBatch?.workOrderError,
        failedAt: verifyBatch?.workOrderFailedAt
      });
      
    } else {
      console.error('❌ Failed to record work order failure - no document modified');
    }
  } catch (error) {
    console.error('💥 Error recording work order failure:', {
      error: error.message,
      originalError: errorMessage,
      batchId: batchId
    });
  }
}


  /**
   * Enhanced NetSuite work order creation with timeout using db.services
   */
  /**
   */
  static async createNetSuiteWorkOrder(batch, quantity, user) {
    // Helper to actually call NetSuite
    const callNetSuite = async () => {
      const workOrderService = await db.netsuite.createWorkOrderService(user);
      const result = await workOrderService.createWorkOrderFromBatch(batch, quantity);
      return {
        id:       result.workOrder.tranId,
        tranId:   result.workOrder.tranId,
        netsuiteId: result.workOrder.id,
        status:   result.workOrder.status,
        orderStatus: result.workOrder.orderStatus,
        bomId:    result.workOrder.bomId,
        revisionId: result.workOrder.revisionId,
        quantity,
        source:   'netsuite'
      };
    };

    // Wrap in a promise with timeout
    const withTimeout = (promise, ms) => {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('NetSuite request timed out')), ms)
      );
      return Promise.race([promise(), timeout]);
    };

    // Try once, catch timeout, then retry one more time
    try {
      return await withTimeout(callNetSuite, 240_000);
    } catch (err) {
      console.warn('First NetSuite attempt failed:', err.message, '— retrying once...');
      // second attempt
      return await withTimeout(callNetSuite, 240_000);
    }
  }


  /**
   * Create local work order fallback
   */
  static createLocalWorkOrder(batch, quantity) {
    const localId = `LOCAL-WO-${Date.now()}`;
    return {
      id: localId,
      tranId: localId,
      status: 'created_locally',
      quantity: quantity,
      source: 'local'
    };
  }

  /**
   * Handle work order creation failure with better error tracking
   */
  static async handleWorkOrderFailure(batchId, errorMessage) {
    try {
      await this.connect();
      
      const updateResult = await this.Batch.updateOne(
        { _id: batchId },
        {
          $set: {
            workOrderStatus: 'failed',
            workOrderError: errorMessage,
            workOrderFailedAt: new Date().toISOString()
          }
        }
      );
      
      if (updateResult.modifiedCount > 0) {
        console.log('✅ Work order failure recorded for batch:', batchId);
      } else {
        console.error('❌ Failed to record work order failure');
      }
    } catch (error) {
      console.error('💥 Error recording work order failure:', error);
    }
  }

  /**
   * Get work order status with better error handling
   */
  static async getWorkOrderStatus(batchId) {
    try {
      console.log('🔍 Getting work order status for batch:', batchId);
      
      // Force fresh connection and bypass any caching
      await this.connect();
      
      // Use findOne with fresh query to avoid any caching issues
      const batch = await this.Batch.findOne({ _id: batchId })
        .select('workOrderCreated workOrderStatus workOrderId workOrderError netsuiteWorkOrderData workOrderCreatedAt workOrderFailedAt')
        .lean()
        .exec();

      if (!batch) {
        console.log('❌ Batch not found:', batchId);
        return { error: 'Batch not found' };
      }

      // Enhanced logging
      console.log('📊 Raw batch work order data:', {
        workOrderCreated: batch.workOrderCreated,
        workOrderStatus: batch.workOrderStatus,
        workOrderId: batch.workOrderId,
        workOrderError: batch.workOrderError,
        netsuiteData: batch.netsuiteWorkOrderData ? 'present' : 'missing',
        tranId: batch.netsuiteWorkOrderData?.tranId
      });

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
      
      console.log('📤 Returning status:', result);
      return result;
    } catch (error) {
      console.error('💥 Error getting work order status:', error);
      return { error: error.message };
    }
  }

  // =============================================================================
  // ENHANCED HELPER METHODS USING DB.SERVICES
  // =============================================================================

  /**
   * Get batch with work order status using db.services
   */
  static async getBatchWithWorkOrderStatus(batchId) {
    const batch = await db.batches.getBatchById(batchId);    if (!batch) return null;

    const workOrderStatus = await this.getWorkOrderStatus(batchId);
    
    return {
      ...batch,
      workOrderStatus
    };
  }

  /**
   * Retry work order creation with enhanced error handling using db.services
   */
  static async retryWorkOrderCreation(batchId, quantity, userId = null) {
    // Use batch service to get current batch state
    const batch = await db.batches.getBatchById(batchId);
    if (!batch) {
      throw new Error('Batch not found');
    }
  
    // Reset work order status and retry
    const resetResult = await this.Batch.updateOne(
      { _id: batchId },
      {
        $set: {
          workOrderStatus: 'creating',
          workOrderError: null,
          workOrderFailedAt: null,
          workOrderId: `PENDING-RETRY-${Date.now()}`,
          workOrderCreatedAt: new Date().toISOString() // FIXED: Convert to ISO string
        },
        $unset: { netsuiteWorkOrderData: "" }
      }
    );
  
    if (resetResult.matchedCount === 0) {
      throw new Error('Batch not found for retry');
    }
  
    return this.queueWorkOrderCreation(batchId, quantity, userId);
  }

  // Helper methods with lazy model access...
  static async getFullUser(user) {
    if (!user) return null;
    
    if (typeof user.hasNetSuiteAccess === 'function') {
      return user;
    }
    
    if (user._id) {
      try {
        const fullUser = await this.User.findById(user._id);
        return fullUser;
      } catch (error) {
        console.error('Error fetching full user:', error);
        return user;
      }
    }
    
    return user;
  }

  static hasNetSuiteAccess(user) {
    if (!user) {
      return !!(process.env.NETSUITE_ACCOUNT_ID && 
                process.env.NETSUITE_CONSUMER_KEY && 
                process.env.NETSUITE_CONSUMER_SECRET && 
                process.env.NETSUITE_TOKEN_ID && 
                process.env.NETSUITE_TOKEN_SECRET);
    }
    
    if (typeof user.hasNetSuiteAccess === 'function') {
      return user.hasNetSuiteAccess();
    }
    
    if (user.netsuiteCredentials && user.netsuiteCredentials.isConfigured) {
      return true;
    }
    
    return false;
  }
}

export default AsyncWorkOrderService;