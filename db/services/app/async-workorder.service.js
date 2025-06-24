// services/async-workorder.service.js - FIXED: Better database updates and error handling
import connectMongoDB from '@/db/index';
import Batch from '@/db/schemas/Batch.js';
import User from '@/db/schemas/User.js';
import { createWorkOrderService } from '../netsuite/index.js';

/**
 * Enhanced Background Work Order Creation Service
 * FIXED: Better database updates and status management
 */
export class AsyncWorkOrderService {
  
  /**
   * Queue a work order creation job
   */
  static async queueWorkOrderCreation(batchId, quantity, userId = null) {
    await connectMongoDB();
    
    try {
      // CRITICAL: Use explicit database update with verification
      const updateResult = await Batch.updateOne(
        { _id: batchId },
        {
          $set: {
            workOrderCreated: true,
            workOrderStatus: 'creating',
            workOrderCreatedAt: new Date(),
            workOrderId: `PENDING-${Date.now()}`,
            workOrderError: null, // Clear any previous errors
            workOrderFailedAt: null
          }
        }
      );

      if (updateResult.matchedCount === 0) {
        throw new Error('Batch not found');
      }

      console.log('✓ Batch status set to creating, starting background job');

      // Start the background job with better error handling
      setImmediate(() => {
        this.createWorkOrderInBackground(batchId, quantity, userId)
          .catch(error => {
            console.error('❌ Background work order creation failed:', error);
            this.handleWorkOrderFailure(batchId, error.message);
          });
      });

      return {
        success: true,
        batchId,
        status: 'creating',
        message: 'Work order creation started in background'
      };

    } catch (error) {
      console.error('Error queuing work order creation:', error);
      throw error;
    }
  }

  /**
   * FIXED: Create work order in background with guaranteed database updates
   */
  static async createWorkOrderInBackground(batchId, quantity, userId = null) {
    try {
      console.log('🚀 Starting background work order creation for batch:', batchId);
      
      // CRITICAL: Always start with fresh connection
      await connectMongoDB();
      
      // Get the batch with a fresh query
      const batch = await Batch.findById(batchId)
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
        user = await User.findById(userId);
      }
  
      const fullUser = await this.getFullUser(user);
      
      // Create work order (NetSuite or local)
      let workOrderResult;
      
      if (this.hasNetSuiteAccess(fullUser)) {
        try {
          console.log('🔗 Creating NetSuite work order...');
          workOrderResult = await this.createNetSuiteWorkOrder(batch, quantity, fullUser);
        } catch (error) {
          console.error('❌ NetSuite work order creation failed, falling back to local:', error);
          workOrderResult = this.createLocalWorkOrder(batch, quantity);
        }
      } else {
        console.log('📝 No NetSuite access, creating local work order');
        workOrderResult = this.createLocalWorkOrder(batch, quantity);
      }
  
      // FIXED: Multiple database update attempts with verification
      const updateData = {
        workOrderId: workOrderResult.tranId || workOrderResult.id,
        workOrderStatus: 'created', // CRITICAL: Must be 'created'
        workOrderCreatedAt: new Date(),
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
          createdAt: new Date(),
          lastSyncAt: new Date()
        };
      }

      // ATTEMPT 1: Direct update with retry logic
      let updateSuccess = false;
      let attempts = 0;
      const maxAttempts = 3;

      while (!updateSuccess && attempts < maxAttempts) {
        attempts++;
        console.log(`🔄 Database update attempt ${attempts}/${maxAttempts}`);

        try {
          await connectMongoDB(); // Ensure fresh connection each attempt
          
          const updateResult = await Batch.updateOne(
            { _id: batchId },
            { $set: updateData },
            { upsert: false }
          );

          if (updateResult.matchedCount > 0 && updateResult.modifiedCount > 0) {
            updateSuccess = true;
            console.log('✅ Database update successful on attempt', attempts);
          } else {
            console.warn(`⚠️ Update attempt ${attempts} matched: ${updateResult.matchedCount}, modified: ${updateResult.modifiedCount}`);
            
            // Wait before retry
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
            }
          }
        } catch (updateError) {
          console.error(`❌ Update attempt ${attempts} failed:`, updateError);
          
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          } else {
            throw updateError;
          }
        }
      }

      if (!updateSuccess) {
        throw new Error('Failed to update database after all attempts');
      }

      // VERIFICATION: Confirm the update worked
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for DB consistency
      
      const verificationBatch = await Batch.findById(batchId)
        .select('workOrderStatus workOrderId netsuiteWorkOrderData')
        .lean();
      
      console.log('🔍 Final verification:', {
        workOrderStatus: verificationBatch.workOrderStatus,
        workOrderId: verificationBatch.workOrderId,
        hasNetsuiteData: !!verificationBatch.netsuiteWorkOrderData,
        tranId: verificationBatch.netsuiteWorkOrderData?.tranId
      });

      if (verificationBatch.workOrderStatus !== 'created') {
        console.error('❌ Verification failed! Status is still:', verificationBatch.workOrderStatus);
        throw new Error('Database verification failed - status not updated');
      }
  
      console.log('🎉 Background work order creation completed successfully:', {
        tranId: workOrderResult.tranId,
        internalId: workOrderResult.netsuiteId,
        finalStatus: verificationBatch.workOrderStatus,
        finalWorkOrderId: verificationBatch.workOrderId
      });
      
      return {
        success: true,
        workOrderId: workOrderResult.tranId,
        internalId: workOrderResult.netsuiteId,
        source: workOrderResult.source
      };
  
    } catch (error) {
      console.error('💥 Background work order creation failed:', error);
      
      // CRITICAL: Always record failure in database
      await this.handleWorkOrderFailure(batchId, error.message);
      throw error;
    }
  }

  /**
   * Enhanced NetSuite work order creation with timeout
   */
  static async createNetSuiteWorkOrder(batch, quantity, user) {
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('NetSuite work order creation timed out')), 60000)
      );

      const workOrderPromise = (async () => {
        const workOrderService = createWorkOrderService(user);
        const result = await workOrderService.createWorkOrderFromBatch(batch, quantity);
        
        console.log('✅ NetSuite work order created:', {
          tranId: result.workOrder.tranId,
          internalId: result.workOrder.id,
          status: result.workOrder.status
        });
        
        return {
          id: result.workOrder.tranId,
          tranId: result.workOrder.tranId,
          netsuiteId: result.workOrder.id,
          status: result.workOrder.status,
          orderStatus: result.workOrder.orderStatus,
          bomId: result.workOrder.bomId,
          revisionId: result.workOrder.revisionId,
          quantity: quantity,
          source: 'netsuite'
        };
      })();

      return await Promise.race([workOrderPromise, timeoutPromise]);
    } catch (error) {
      console.error('❌ NetSuite work order creation failed:', error);
      throw error;
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
   * ENHANCED: Handle work order creation failure with better error tracking
   */
  static async handleWorkOrderFailure(batchId, errorMessage) {
    try {
      await connectMongoDB();
      
      const updateResult = await Batch.updateOne(
        { _id: batchId },
        {
          $set: {
            workOrderStatus: 'failed',
            workOrderError: errorMessage,
            workOrderFailedAt: new Date()
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
   * ENHANCED: Get work order status with better error handling
   */
  static async getWorkOrderStatus(batchId) {
    try {
      console.log('🔍 Getting work order status for batch:', batchId);
      
      // Force fresh connection and bypass any caching
      await connectMongoDB();
      
      // Use findOne with fresh query to avoid any caching issues
      const batch = await Batch.findOne({ _id: batchId })
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

  // Helper methods remain the same...
  static async getFullUser(user) {
    if (!user) return null;
    
    if (typeof user.hasNetSuiteAccess === 'function') {
      return user;
    }
    
    if (user._id) {
      try {
        const fullUser = await User.findById(user._id);
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