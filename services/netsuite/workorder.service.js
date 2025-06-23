// services/netsuite/workorder.service.js - NetSuite Work Order Management
import { createNetSuiteAuth } from './auth.service.js';
import { createBOMService } from './bom.service.js';
import { Item } from '@/models/Item'; // Assuming you have an Item model for MongoDB

/**
 * NetSuite Work Order Service
 * Handles creating and managing work orders in NetSuite
 */
export class NetSuiteWorkOrderService {
  constructor(user) {
    this.auth = createNetSuiteAuth(user);
    this.bomService = createBOMService(user);
    
    // Default NetSuite settings - update these based on your setup
    this.defaultLocation = { id: "6" };      // Your production location
    this.defaultSubsidiary = { id: "2" };    // Your subsidiary
    this.defaultDepartment = { id: "3" }; // Your department (if applicable)
  }

  /**
   * Create a Work Order in NetSuite
   * @param {Object} params - Work order parameters
   * @param {string} params.assemblyItemId - NetSuite assembly item ID
   * @param {number} params.quantity - Quantity to produce
   * @param {string} params.startDate - Start date (YYYY-MM-DD format)
   * @param {string} params.endDate - End date (optional)
   * @param {Object} params.location - Location override (optional)
   * @param {Object} params.subsidiary - Subsidiary override (optional)
   * @returns {Object} Created work order data
   */
  async createWorkOrder({
    assemblyItemId,
    quantity,
    startDate = null,
    endDate = null,
    location = null,
    subsidiary = null,
    department = null
  }) {
    try {
      console.log('Creating work order for assembly item:', assemblyItemId);
      
      // Step 1: Get BOM data for the assembly item
      const bomData = await this.bomService.getAssemblyBOM(assemblyItemId);
      
      if (!bomData.bomId || !bomData.revisionId) {
        throw new Error('Could not find BOM or revision data for assembly item');
      }
      
      // Step 2: Prepare work order payload
      const workOrderPayload = {
        assemblyItem: { id: assemblyItemId },
        billOfMaterials: { id: bomData.bomId },
        billOfMaterialsRevision: { id: bomData.revisionId },
        quantity: quantity,
        location: location || this.defaultLocation,
        subsidiary: subsidiary || this.defaultSubsidiary,
        department: department || this.defaultDepartment,
      };
      
      // Add dates if provided
      const currentDate = startDate || new Date().toISOString().split('T')[0];
      workOrderPayload.startDate = currentDate;
      workOrderPayload.tranDate = currentDate;
      
      if (endDate) {
        workOrderPayload.endDate = endDate;
      }
      
      console.log('Work order payload:', JSON.stringify(workOrderPayload, null, 2));
      
      // Step 3: Create the work order in NetSuite
      const response = await this.auth.makeRequest('/workOrder', 'POST', workOrderPayload);
      
      console.log('Work order created successfully:', response);
      
      // Return formatted response
      return {
        success: true,
        workOrder: {
          id: response.id,
          tranId: response.tranId,
          assemblyItemId: assemblyItemId,
          quantity: quantity,
          status: response.status,
          startDate: workOrderPayload.startDate,
          endDate: workOrderPayload.endDate,
          bomId: bomData.bomId,
          revisionId: bomData.revisionId,
          location: workOrderPayload.location,
          subsidiary: workOrderPayload.subsidiary,
          netsuiteResponse: response
        },
        bomData: bomData
      };
      
    } catch (error) {
      console.error('Error creating work order:', error);
      throw new Error(`Failed to create work order: ${error.message}`);
    }
  }

  /**
   * Create work order from a batch (your main use case)
   * @param {Object} batch - Batch data from your MongoDB
   * @param {number} quantity - Quantity to produce
   * @param {Object} options - Additional options
   */
  async createWorkOrderFromBatch(batch, quantity, options = {}) {
    try {
      // Resolve the solution item (populated or lookup)
      let solutionItem;
      if (
        batch.snapshot?.solutionRef &&
        typeof batch.snapshot.solutionRef === 'object' &&
        batch.snapshot.solutionRef.netsuiteInternalId
      ) {
        solutionItem = batch.snapshot.solutionRef;
      } else {
        const solutionItemId = batch.snapshot?.solutionRef;
        if (!solutionItemId) {
          throw new Error('Batch snapshot missing solutionRef');
        }
        solutionItem = await Item.findById(solutionItemId).lean();
      }

      if (!solutionItem?.netsuiteInternalId) {
        throw new Error('Solution item does not have a NetSuite Internal ID');
      }
      const assemblyItemId = solutionItem.netsuiteInternalId;

      console.log('Creating work order for batch:', batch._id, 'solution:', solutionItem.displayName);

      // Create the work order
      const result = await this.createWorkOrder({
        assemblyItemId,
        quantity,
        startDate: options.startDate,
        endDate: options.endDate,
        location: options.location,
        subsidiary: options.subsidiary
      });

      // Add batch context to the result
      result.batchContext = {
        batchId: batch._id,
        runNumber: batch.runNumber,
        fileName: batch.fileId?.fileName,
        solutionName: solutionItem.displayName,
        solutionSku: solutionItem.sku
      };

      return result;

    } catch (error) {
      console.error('Error creating work order from batch:', error);
      throw error;
    }
  }

  /**
   * Get work order status from NetSuite
   * @param {string} workOrderId - NetSuite work order ID
   */
  async getWorkOrderStatus(workOrderId) {
    try {
      const response = await this.auth.makeRequest(`/workOrder/${workOrderId}`);
      
      return {
        id: response.id,
        tranId: response.tranId,
        status: response.status,
        quantity: response.quantity,
        quantityCompleted: response.quantityCompleted,
        assemblyItem: response.assemblyItem,
        startDate: response.startDate,
        endDate: response.endDate
      };
      
    } catch (error) {
      console.error('Error getting work order status:', error);
      throw new Error(`Failed to get work order status: ${error.message}`);
    }
  }

  /**
   * Complete a work order (mark as finished)
   * @param {string} workOrderId - NetSuite work order ID
   * @param {number} quantityCompleted - Actual quantity completed
   */
  async completeWorkOrder(workOrderId, quantityCompleted = null) {
    try {
      const updatePayload = {
        status: { id: "built" } // or whatever your completion status is
      };
      
      if (quantityCompleted !== null) {
        updatePayload.quantityCompleted = quantityCompleted;
      }
      
      const response = await this.auth.makeRequest(
        `/workOrder/${workOrderId}`, 
        'PATCH', 
        updatePayload
      );
      
      return {
        success: true,
        workOrder: response
      };
      
    } catch (error) {
      console.error('Error completing work order:', error);
      throw new Error(`Failed to complete work order: ${error.message}`);
    }
  }

  /**
   * Cancel a work order
   * @param {string} workOrderId - NetSuite work order ID
   */
  async cancelWorkOrder(workOrderId) {
    try {
      const updatePayload = {
        status: { id: "cancelled" }
      };
      
      const response = await this.auth.makeRequest(
        `/workOrder/${workOrderId}`, 
        'PATCH', 
        updatePayload
      );
      
      return {
        success: true,
        workOrder: response
      };
      
    } catch (error) {
      console.error('Error cancelling work order:', error);
      throw new Error(`Failed to cancel work order: ${error.message}`);
    }
  }

  /**
   * List work orders with filtering
   * @param {Object} filters - Filter options
   */
  async listWorkOrders(filters = {}) {
    try {
      let endpoint = '/workOrder';
      const queryParams = [];
      
      if (filters.status) {
        queryParams.push(`q=status:${filters.status}`);
      }
      
      if (filters.assemblyItem) {
        queryParams.push(`q=assemblyitem:${filters.assemblyItem}`);
      }
      
      if (filters.limit) {
        queryParams.push(`limit=${filters.limit}`);
      }
      
      if (queryParams.length > 0) {
        endpoint += '?' + queryParams.join('&');
      }
      
      const response = await this.auth.makeRequest(endpoint);
      
      return {
        success: true,
        workOrders: response.items || [response]
      };
      
    } catch (error) {
      console.error('Error listing work orders:', error);
      throw new Error(`Failed to list work orders: ${error.message}`);
    }
  }

  /**
   * Get work order components/material requirements
   * @param {string} workOrderId - NetSuite work order ID
   */
  async getWorkOrderComponents(workOrderId) {
    try {
      // This might need to be adjusted based on your NetSuite setup
      const endpoint = `/workOrder/${workOrderId}/component`;
      const response = await this.auth.makeRequest(endpoint);
      
      return {
        success: true,
        components: response.items || []
      };
      
    } catch (error) {
      console.error('Error getting work order components:', error);
      // Don't throw here, as this endpoint might not be available
      return {
        success: false,
        components: [],
        error: error.message
      };
    }
  }
}

/**
 * Factory function to create work order service
 */
export const createWorkOrderService = (user) => {
  return new NetSuiteWorkOrderService(user);
};

/**
 * Convenience function for creating work orders from batches
 */
export async function createWorkOrderFromBatch(user, batch, quantity, options = {}) {
  const workOrderService = createWorkOrderService(user);
  return await workOrderService.createWorkOrderFromBatch(batch, quantity, options);
}