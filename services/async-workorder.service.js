// services/async-workorder.service.js - Background Work Order Creation
import connectMongoDB from '@/lib/index';
import Batch from '@/models/Batch.js';
import User from '@/models/User.js';
import { createWorkOrderService } from './netsuite/workorder.service.js';

/**
 * Background Work Order Creation Service
 * Handles asynchronous work order creation to prevent UI timeouts
 */
export class AsyncWorkOrderService {
  
  /**
   * Queue a work order creation job
   * Returns immediately with a pending status
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
          // Update batch to show failure
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
   * Create work order in background
   * This runs asynchronously and updates the batch when complete
   */
  static async createWorkOrderInBackground(batchId, quantity, userId = null) {
    await connectMongoDB();
    
    try {
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

      // Update batch with successful work order creation
      const updateData = {
        workOrderId: workOrderResult.tranId || workOrderResult.id, // Use NetSuite tranId if available
        workOrderStatus: 'created',
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
          createdAt: new Date()
        };
      }

      await Batch.findByIdAndUpdate(batchId, updateData);
      
      console.log('Background work order creation completed successfully:', workOrderResult.id);
      
      return {
        success: true,
        workOrderId: workOrderResult.id,
        source: workOrderResult.source
      };

    } catch (error) {
      console.error('Background work order creation failed:', error);
      throw error;
    }
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
   * Create NetSuite work order
   */
  static async createNetSuiteWorkOrder(batch, quantity, user) {
    try {
      const workOrderService = createWorkOrderService(user);
      const result = await workOrderService.createWorkOrderFromBatch(batch, quantity);
      
      return {
        id: result.workOrder.tranId || result.workOrder.id,
        netsuiteId: result.workOrder.id,
        tranId: result.workOrder.tranId,
        status: result.workOrder.status,
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
    return {
      id: `LOCAL-WO-${Date.now()}`,
      status: 'created_locally',
      quantity: quantity,
      source: 'local'
    };
  }

  /**
   * Get full user with methods
   */
  static async getFullUser(user) {
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
        return user;
      }
    }
    
    return user;
  }

  /**
   * Check if user has NetSuite access
   */
  static hasNetSuiteAccess(user) {
    if (!user) {
      // Check environment variables as fallback
      return !!(process.env.NETSUITE_ACCOUNT_ID && 
                process.env.NETSUITE_CONSUMER_KEY && 
                process.env.NETSUITE_CONSUMER_SECRET && 
                process.env.NETSUITE_TOKEN_ID && 
                process.env.NETSUITE_TOKEN_SECRET);
    }
    
    // If user is a Mongoose document, call the method
    if (typeof user.hasNetSuiteAccess === 'function') {
      return user.hasNetSuiteAccess();
    }
    
    // If user is a plain object, check the property directly
    if (user.netsuiteCredentials && user.netsuiteCredentials.isConfigured) {
      return true;
    }
    
    return false;
  }

  /**
   * Get work order status for a batch
   */
  static async getWorkOrderStatus(batchId) {
    await connectMongoDB();
    
    try {
      const batch = await Batch.findById(batchId)
        .select('workOrderCreated workOrderStatus workOrderId workOrderError netsuiteWorkOrderData')
        .lean();

      if (!batch) {
        return { error: 'Batch not found' };
      }

      return {
        created: batch.workOrderCreated,
        status: batch.workOrderStatus,
        workOrderId: batch.workOrderId,
        error: batch.workOrderError,
        netsuiteData: batch.netsuiteWorkOrderData
      };
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
}

export default AsyncWorkOrderService;