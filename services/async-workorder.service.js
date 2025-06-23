// services/async-workorder.service.js - Enhanced to store tranId
import connectMongoDB from '@/lib/index';
import Batch from '@/models/Batch.js';
import User from '@/models/User.js';
import { createWorkOrderService } from './netsuite/workorder.service.js';

/**
 * Enhanced Background Work Order Creation Service
 * Now properly captures and stores NetSuite tranId
 */
export class AsyncWorkOrderService {
  
  /**
   * Queue a work order creation job
   */
  static async queueWorkOrderCreation(batchId, quantity, userId = null) {
    await connectMongoDB();
    
    try {
      // Update batch to show work order is being created
      const batch = await Batch.findByIdAndUpdate(
        batchId,
        {
          workOrderCreated: true,
          workOrderStatus: 'creating',
          workOrderCreatedAt: new Date(),
          workOrderId: `PENDING-${Date.now()}` // Temporary ID
        },
        { new: true }
      );

      if (!batch) {
        throw new Error('Batch not found');
      }

      // Start the background job (don't await)
      this.createWorkOrderInBackground(batchId, quantity, userId)
        .catch(error => {
          console.error('Background work order creation failed:', error);
          this.handleWorkOrderFailure(batchId, error.message);
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
   * Create work order in background - Enhanced to capture tranId
   */
/**
 * Create work order in background - FIXED: Update status on completion
 */
static async createWorkOrderInBackground(batchId, quantity, userId = null) {
    try {
      // CRITICAL: Force a fresh database connection
      await connectMongoDB();
      
      console.log('Starting background work order creation for batch:', batchId);
      
      // Get the batch with populated data
      const batch = await Batch.findById(batchId)
        .populate('fileId', 'fileName')
        .populate('snapshot.solutionRef', 'displayName sku netsuiteInternalId')
        .lean();
  
      if (!batch) {
        throw new Error('Batch not found');
      }
  
      // Get user if provided
      let user = null;
      if (userId) {
        user = await User.findById(userId);
      }
  
      // Get full user with methods for NetSuite access
      const fullUser = await this.getFullUser(user);
      
      // Check if we can create NetSuite work order
      let workOrderResult;
      
      if (this.hasNetSuiteAccess(fullUser)) {
        try {
          console.log('Creating NetSuite work order...');
          workOrderResult = await this.createNetSuiteWorkOrder(batch, quantity, fullUser);
        } catch (error) {
          console.error('NetSuite work order creation failed, falling back to local:', error);
          workOrderResult = this.createLocalWorkOrder(batch, quantity);
        }
      } else {
        console.log('No NetSuite access, creating local work order');
        workOrderResult = this.createLocalWorkOrder(batch, quantity);
      }
  
      // FIXED: Explicit database update with proper error handling
      console.log('Updating database with work order result:', {
        batchId,
        tranId: workOrderResult.tranId,
        internalId: workOrderResult.netsuiteId
      });
  
      const updateData = {
        workOrderId: workOrderResult.tranId || workOrderResult.id,
        workOrderStatus: 'created', // CRITICAL: Set to 'created'
        workOrderCreatedAt: new Date()
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
  
      // CRITICAL: Use proper Mongoose update with explicit options
      const updatedBatch = await Batch.findByIdAndUpdate(
        batchId, 
        { $set: updateData }, // Use $set to be explicit
        { 
          new: true,           // Return updated document
          runValidators: true, // Run schema validation
          lean: true          // Return plain object
        }
      );
  
      if (!updatedBatch) {
        throw new Error('Failed to update batch - batch not found');
      }
  
      // VERIFICATION: Check that the update actually worked
      console.log('Database update verification:', {
        originalStatus: batch.workOrderStatus,
        updatedStatus: updatedBatch.workOrderStatus,
        originalWorkOrderId: batch.workOrderId,
        updatedWorkOrderId: updatedBatch.workOrderId,
        hasNetsuiteData: !!updatedBatch.netsuiteWorkOrderData
      });
  
      // Double-check with a fresh query
      const verificationBatch = await Batch.findById(batchId)
        .select('workOrderStatus workOrderId netsuiteWorkOrderData')
        .lean();
      
      console.log('Fresh database verification:', {
        workOrderStatus: verificationBatch.workOrderStatus,
        workOrderId: verificationBatch.workOrderId,
        hasNetsuiteData: !!verificationBatch.netsuiteWorkOrderData
      });
  
      console.log('Background work order creation completed successfully:', {
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
      console.error('Background work order creation failed:', error);
      
      // CRITICAL: Ensure failure is recorded in database
      try {
        await connectMongoDB();
        await Batch.findByIdAndUpdate(batchId, {
          $set: {
            workOrderStatus: 'failed',
            workOrderError: error.message,
            workOrderFailedAt: new Date()
          }
        });
        console.log('Work order failure recorded in database');
      } catch (updateError) {
        console.error('Failed to record work order failure:', updateError);
      }
      
      throw error;
    }
  }

  /**
   * Enhanced NetSuite work order creation
   */
  static async createNetSuiteWorkOrder(batch, quantity, user) {
    try {
      const workOrderService = createWorkOrderService(user);
      const result = await workOrderService.createWorkOrderFromBatch(batch, quantity);
      
      console.log('NetSuite work order created:', {
        tranId: result.workOrder.tranId,
        internalId: result.workOrder.id,
        status: result.workOrder.status
      });
      
      return {
        id: result.workOrder.tranId,           // Use tranId as the main ID
        tranId: result.workOrder.tranId,       // The user-friendly work order number
        netsuiteId: result.workOrder.id,       // Internal NetSuite ID
        status: result.workOrder.status,
        orderStatus: result.workOrder.orderStatus,
        bomId: result.workOrder.bomId,
        revisionId: result.workOrder.revisionId,
        quantity: quantity,
        source: 'netsuite'
      };
    } catch (error) {
      console.error('NetSuite work order creation failed:', error);
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
      tranId: localId,  // For consistency
      status: 'created_locally',
      quantity: quantity,
      source: 'local'
    };
  }

  /**
   * Handle work order creation failure
   */
  static async handleWorkOrderFailure(batchId, errorMessage) {
    await connectMongoDB();
    
    try {
      await Batch.findByIdAndUpdate(batchId, {
        workOrderStatus: 'failed',
        workOrderError: errorMessage,
        workOrderFailedAt: new Date()
      });
      
      console.log('Work order failure recorded for batch:', batchId);
    } catch (error) {
      console.error('Error recording work order failure:', error);
    }
  }

  /**
   * Get work order status for a batch
   */
static async getWorkOrderStatus(batchId) {
  await connectMongoDB();
  
  try {
    console.log('Getting work order status for batch:', batchId);
    
    // Force a completely fresh query
    const batch = await Batch.findById(batchId)
    .read('primary')
    .lean();

    if (!batch) {
      console.log('Batch not found:', batchId);
      return { error: 'Batch not found' };
    }

    // Log EVERYTHING from the database
    console.log('Raw batch data from DB:', {
      _id: batch._id,
      workOrderCreated: batch.workOrderCreated,
      workOrderStatus: batch.workOrderStatus,
      workOrderId: batch.workOrderId,
      workOrderError: batch.workOrderError,
      netsuiteWorkOrderData: batch.netsuiteWorkOrderData,
      // Log ALL fields to see what's actually there
      allFields: Object.keys(batch)
    });

    const result = {
      created: batch.workOrderCreated,
      status: batch.workOrderStatus,
      workOrderId: batch.workOrderId,
      workOrderNumber: batch.netsuiteWorkOrderData?.tranId,
      internalId: batch.netsuiteWorkOrderData?.workOrderId,
      error: batch.workOrderError,
      netsuiteData: batch.netsuiteWorkOrderData
    };
    
    console.log('Returning status:', result);
    return result;
  } catch (error) {
    console.error('Error getting work order status:', error);
    return { error: error.message };
  }
}


  /**
   * Retry failed work order creation
   */
  static async retryWorkOrderCreation(batchId, quantity, userId = null) {
    await connectMongoDB();
    
    try {
      // Reset the work order status
      await Batch.findByIdAndUpdate(batchId, {
        workOrderStatus: 'creating',
        workOrderError: null,
        workOrderFailedAt: null,
        workOrderId: `PENDING-${Date.now()}`
      });

      // Queue the creation again
      return this.queueWorkOrderCreation(batchId, quantity, userId);
    } catch (error) {
      console.error('Error retrying work order creation:', error);
      throw error;
    }
  }

  // ... rest of your helper methods remain the same
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