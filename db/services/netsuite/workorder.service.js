// services/netsuite/workorder.service.js - Enhanced to capture tranId from Location header
import { createNetSuiteAuth } from './auth.service.js';
import { createBOMService } from './bom.service.js';
import { Item } from '@/db/schemas/Item.js';

/**
 * NetSuite Work Order Service
 * Enhanced to handle Location header and fetch tranId
 */
export class NetSuiteWorkOrderService {
  constructor(user) {
    this.auth = createNetSuiteAuth(user);
    this.bomService = createBOMService(user);
    
    // Default NetSuite settings
    this.defaultLocation = { id: "6" };
    this.defaultSubsidiary = { id: "2" };
    this.defaultDepartment = { id: "3" };
  }

  /**
   * Enhanced makeRequest method to handle Location header
   */
  async makeRequestWithLocation(endpoint, method = 'GET', body = null) {
    const url = `${this.auth.baseUrl}${endpoint}`;
    
    console.log('Making request to:', url);
    console.log('Method:', method);
    
    const requestData = { url, method };
    const oauthData = this.auth.oauth.authorize(requestData, this.auth.token);
    
    // Add realm parameter for NetSuite
    const authHeader = this.auth.oauth.toHeader(oauthData);
    authHeader.Authorization = authHeader.Authorization.replace(
      'OAuth ',
      `OAuth realm="${this.auth.credentials.accountId}", `
    );
    
    const headers = {
      ...authHeader,
      'Content-Type': 'application/json',
    };
    
    const options = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response status:', response.status);
        console.error('Response text:', errorText);
        throw new Error(`NetSuite API Error: ${response.status} - ${errorText}`);
      }

      // For POST requests, NetSuite often returns location header instead of body
      const locationHeader = response.headers.get('location');
      let responseData = null;
      
      try {
        responseData = await response.json();
      } catch (e) {
        // No JSON body, which is normal for some NetSuite POST operations
        console.log('No JSON response body, checking location header');
      }

      return {
        data: responseData,
        location: locationHeader,
        status: response.status,
        headers: response.headers
      };
    } catch (error) {
      console.error('NetSuite API Error:', error);
      throw error;
    }
  }

  /**
   * Extract work order ID from location header
   */
  extractWorkOrderIdFromLocation(locationHeader) {
    if (!locationHeader) return null;
    
    console.log('Extracting work order ID from location:', locationHeader);
    
    // Extract ID from URL - handle both cases: workOrder and workorder
    const matches = locationHeader.match(/\/workorder\/(\d+)$/i);
    const workOrderId = matches ? matches[1] : null;
    
    console.log('Extracted work order ID:', workOrderId);
    return workOrderId;
  }

  /**
   * Create a Work Order in NetSuite with enhanced response handling
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
      
      // Step 3: Create the work order in NetSuite using enhanced method
      const createResponse = await this.makeRequestWithLocation('/workOrder', 'POST', workOrderPayload);
      
      console.log('Work order creation response:', {
        status: createResponse.status,
        location: createResponse.location,
        hasData: !!createResponse.data
      });
      
      // Step 4: Extract work order ID from location header
      const workOrderId = this.extractWorkOrderIdFromLocation(createResponse.location);
      if (!workOrderId) {
        console.error('Failed to extract work order ID:', {
          location: createResponse.location,
          status: createResponse.status,
          hasLocation: !!createResponse.location
        });
        throw new Error(`Could not extract work order ID from location: ${createResponse.location}`);
      }
      
      console.log('Extracted work order ID:', workOrderId);
      
      // Step 5: Fetch full work order details to get tranId
      const workOrderDetails = await this.auth.makeRequest(`/workOrder/${workOrderId}`);
      
      console.log('Work order details fetched:', {
        id: workOrderDetails.id,
        tranId: workOrderDetails.tranId,
        status: workOrderDetails.status
      });
      
      // Return formatted response with all the details you need
      return {
        success: true,
        workOrder: {
          id: workOrderDetails.id,
          tranId: workOrderDetails.tranId, // This is what you want to store
          assemblyItemId: assemblyItemId,
          quantity: quantity,
          status: workOrderDetails.status?.refName || workOrderDetails.status?.id,
          startDate: workOrderPayload.startDate,
          endDate: workOrderPayload.endDate,
          bomId: bomData.bomId,
          revisionId: bomData.revisionId,
          location: workOrderPayload.location,
          subsidiary: workOrderPayload.subsidiary,
          orderStatus: workOrderDetails.orderStatus?.refName,
          netsuiteResponse: workOrderDetails
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
   */
  async createWorkOrderFromBatch(batch, quantity, options = {}) {
    try {
      // Resolve the solution item
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