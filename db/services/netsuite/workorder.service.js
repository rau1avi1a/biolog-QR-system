// services/netsuite/workorder.service.js
import { createNetSuiteAuth } from './auth.service.js';
import { createBOMService } from './bom.service.js';
import db from '@/db/index.js';

/**
 * NetSuite Work Order Service
 * Enhanced to handle Location header and fetch tranId
 * Uses single db import for database operations
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
   * Access to database models through db
   */
  get models() {
    return db.models;
  }

  /**
   * Access to other services through db
   */
  get services() {
    return db.services;
  }

  /**
   * Ensure database connection
   */
  async connect() {
    return db.connect();
  }

  /**
   * Enhanced makeRequest method to handle Location header
   */
  async makeRequestWithLocation(endpoint, method = 'GET', body = null) {
    const url = `${(await this.auth).baseUrl}${endpoint}`;
    const requestData = { url, method };
    const oauthData = (await this.auth).oauth.authorize(requestData, (await this.auth).token);

    // Add realm parameter for NetSuite
    const authHeader = (await this.auth).oauth.toHeader(oauthData);
    authHeader.Authorization = authHeader.Authorization.replace(
      'OAuth ',
      `OAuth realm="${(await this.auth).credentials.accountId}", `
    );

    const headers = {
      ...authHeader,
      'Content-Type': 'application/json',
    };
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NetSuite API Error: ${response.status} - ${errorText}`);
    }

    const locationHeader = response.headers.get('location');
    let data = null;
    try {
      data = await response.json();
    } catch {
      // No JSON body, normal for some NetSuite POST operations
    }

    return { data, location: locationHeader, status: response.status, headers: response.headers };
  }

  /**
   * Extract work order ID from location header
   */
  extractWorkOrderIdFromLocation(locationHeader) {
    if (!locationHeader) return null;
    const matches = locationHeader.match(/\/workorder\/(\d+)$/i);
    return matches ? matches[1] : null;
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
    // Step 1: Get BOM data
    const bomData = await (await this.bomService).getAssemblyBOM(assemblyItemId);
    if (!bomData.bomId || !bomData.revisionId) {
      throw new Error('Missing BOM or revision data');
    }

    // Step 2: Prepare payload
    const workOrderPayload = {
      assemblyItem: { id: assemblyItemId },
      billOfMaterials: { id: bomData.bomId },
      billOfMaterialsRevision: { id: bomData.revisionId },
      quantity,
      location: location || this.defaultLocation,
      subsidiary: subsidiary || this.defaultSubsidiary,
      department: department || this.defaultDepartment,
    };
    const currentDate = startDate || new Date().toISOString().split('T')[0];
    workOrderPayload.startDate = currentDate;
    workOrderPayload.tranDate = currentDate;
    if (endDate) workOrderPayload.endDate = endDate;

    // Step 3: Create the work order
    const response = await this.makeRequestWithLocation('/workOrder', 'POST', workOrderPayload);
    const workOrderId = this.extractWorkOrderIdFromLocation(response.location);
    if (!workOrderId) {
      throw new Error(`Could not extract work order ID from location: ${response.location}`);
    }

    // Step 4: Fetch full work order details
    const details = await (await this.auth).makeRequest(`/workOrder/${workOrderId}`);

    // Step 5: Log and update via DB
    await this.logWorkOrderCreation(details, bomData);

    return {
      success: true,
      workOrder: {
        id: details.id,
        tranId: details.tranId,
        status: details.status?.refName || details.status?.id,
        assemblyItemId,
        quantity,
        startDate: workOrderPayload.startDate,
        endDate: workOrderPayload.endDate,
        bomId: bomData.bomId,
        revisionId: bomData.revisionId,
        netsuiteResponse: details
      },
      bomData
    };
  }

  /**
   * Create work order from a batch
   */
  async createWorkOrderFromBatch(batch, quantity, options = {}) {
    // Resolve solution item
    let solutionItem = batch.snapshot?.solutionRef;
    if (typeof solutionItem === 'string' || solutionItem?._id) {
      await this.connect();
      solutionItem = await this.models.Item.findById(batch.snapshot.solutionRef).lean();
    }
    if (!solutionItem?.netsuiteInternalId) {
      throw new Error('Solution item does not have a NetSuite Internal ID');
    }

    // Validate inventory
    await this.validateInventoryForWorkOrder(batch, quantity);

    // Create work order
    const result = await this.createWorkOrder({
      assemblyItemId: solutionItem.netsuiteInternalId,
      quantity,
      startDate: options.startDate,
      endDate: options.endDate,
      location: options.location,
      subsidiary: options.subsidiary,
      department: options.department
    });

    // Update batch via service
    await this.updateBatchWithWorkOrder(batch._id, result.workOrder);

    return result;
  }

  /**
   * Validate inventory for the work order
   */
  async validateInventoryForWorkOrder(batch, quantity) {
    for (const component of batch.snapshot?.components || []) {
      if (component.itemId) {
        const item = await this.models.Item.findById(component.itemId).lean();
        const reqQty = (component.amount || 0) * quantity;
        if (item && item.qtyOnHand < reqQty) {
          console.warn('Insufficient inventory for', item.displayName);
        }
      }
    }
  }

  /**
   * Update batch with work order info
   */
  async updateBatchWithWorkOrder(batchId, workOrderData) {
    await this.services.batchService.updateBatch(batchId, {
      workOrderId: workOrderData.tranId,
      workOrderStatus: 'created',
      workOrderCreated: true,
      workOrderCreatedAt: new Date(),
      netsuiteWorkOrderData: {
        workOrderId: workOrderData.id,
        tranId: workOrderData.tranId,
        bomId: workOrderData.bomId,
        revisionId: workOrderData.revisionId,
        quantity: workOrderData.quantity,
        status: workOrderData.status,
        orderStatus: workOrderData.status,
        createdAt: new Date(),
        lastSyncAt: new Date()
      }
    });
  }

  /**
   * Log work order creation
   */
  async logWorkOrderCreation(details, bomData) {
    console.log('Work Order Created:', details.tranId, bomData.bomId);
  }

  /**
   * Get work order status
   */
  async getWorkOrderStatus(workOrderId) {
    const resp = await (await this.auth).makeRequest(`/workOrder/${workOrderId}`);
    return resp;
  }

  /**
   * Complete a work order
   */
  async completeWorkOrder(workOrderId, quantityCompleted = null) {
    const payload = { status: { id: "built" } };
    if (quantityCompleted !== null) payload.quantityCompleted = quantityCompleted;
    const resp = await (await this.auth).makeRequest(`/workOrder/${workOrderId}`, 'PATCH', payload);
    return { success: true, workOrder: resp };
  }

  /**
   * Cancel a work order
   */
  async cancelWorkOrder(workOrderId) {
    const resp = await (await this.auth).makeRequest(`/workOrder/${workOrderId}`, 'PATCH', { status: { id: "cancelled" } });
    return { success: true, workOrder: resp };
  }

  /**
   * List work orders with filtering
   */
  async listWorkOrders(filters = {}) {
    let endpoint = '/workOrder';
    const params = [];
    if (filters.status) params.push(`q=status:${filters.status}`);
    if (filters.assemblyItem) params.push(`q=assemblyitem:${filters.assemblyItem}`);
    if (filters.limit) params.push(`limit=${filters.limit}`);
    if (params.length) endpoint += '?' + params.join('&');
    const resp = await (await this.auth).makeRequest(endpoint);
    return resp.items || [resp];
  }

  /**
   * Get components for a work order
   */
  async getWorkOrderComponents(workOrderId) {
    try {
      const resp = await (await this.auth).makeRequest(`/workOrder/${workOrderId}/component`);
      return { success: true, components: resp.items || [] };
    } catch (err) {
      console.error('Error getting components:', err);
      return { success: false, components: [], error: err.message };
    }
  }

  /**
   * Sync work order status with a batch
   */
  async syncWorkOrderStatusWithBatch(workOrderId, batchId = null) {
    const status = await this.getWorkOrderStatus(workOrderId);
    if (batchId) {
      await this.services.batchService.updateBatch(batchId, {
        workOrderStatus: status.status?.refName || status.status,
        netsuiteWorkOrderData: { ...status, lastSyncAt: new Date() }
      });
    }
    return status;
  }

  /**
   * Get work orders for a local item
   */
  async getWorkOrdersForLocalItem(itemId) {
    await this.connect();
    const item = await this.models.Item.findById(itemId).lean();
    if (!item?.netsuiteInternalId) throw new Error('Item not found or missing NS ID');
    const workOrders = await this.listWorkOrders({ assemblyItem: item.netsuiteInternalId, limit: 50 });
    return { localItem: item, workOrders };
  }
}

/**
 * Factory function to create work order service
 */
export const createWorkOrderService = (user) => new NetSuiteWorkOrderService(user);

/**
 * Convenience for creating work orders from batches
 */
export async function createWorkOrderFromBatch(user, batch, quantity, options = {}) {
  const svc = createWorkOrderService(user);
  return svc.createWorkOrderFromBatch(batch, quantity, options);
}
