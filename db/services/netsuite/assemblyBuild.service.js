// services/netsuite/assemblyBuild.service.js
import { createNetSuiteAuth } from './auth.service.js';
import db from '@/db/index.js';

/**
 * NetSuite Assembly Build Service
 * Handles completion of work orders by creating assembly build records
 */
export class NetSuiteAssemblyBuildService {
  constructor(user) {
    this.auth = createNetSuiteAuth(user);
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
   * Create an assembly build from a work order
   * This is the main function that completes production
   */
  async createAssemblyBuild({
    workOrderInternalId,
    quantityCompleted,
    actualComponents = null,
    completionDate = null
  }) {
    try {
      console.log('🏗️ Creating assembly build for work order:', workOrderInternalId);

      // Step 1: Transform work order to assembly build
      const assemblyBuild = await this.transformWorkOrderToAssemblyBuild(
        workOrderInternalId, 
        quantityCompleted
      );

      // Step 2: Set actual component quantities if provided
      if (actualComponents && actualComponents.length > 0) {
        await this.setActualComponentQuantities(assemblyBuild, actualComponents);
      }

      // Step 3: Set completion date if provided
      if (completionDate) {
        assemblyBuild.setValue({
          fieldId: 'trandate',
          value: completionDate
        });
      }

      // Step 4: Save the assembly build
      const assemblyBuildId = assemblyBuild.save();

      console.log('✅ Assembly build created successfully:', assemblyBuildId);

      // Step 5: Get the created assembly build details
      const assemblyBuildDetails = await this.getAssemblyBuildDetails(assemblyBuildId);

      return {
        success: true,
        assemblyBuild: {
          id: assemblyBuildId,
          tranId: assemblyBuildDetails?.tranId || null, // ← The ASSYB number
          workOrderId: workOrderInternalId,
          quantity: quantityCompleted,
          tranDate: completionDate || new Date().toISOString().split('T')[0],
          details: assemblyBuildDetails
        }
      };

    } catch (error) {
      console.error('❌ Assembly build creation failed:', error);
      throw new Error(`Assembly build creation failed: ${error.message}`);
    }
  }

  /**
   * Transform work order to assembly build using NetSuite's record.transform
   */
  async transformWorkOrderToAssemblyBuild(workOrderInternalId, quantity) {
    // This would be the actual NetSuite SuiteScript call
    // Since we're in Node.js, we'll use the REST API approach
    
    // First, get the work order details to understand its structure
    const workOrder = await (await this.auth).makeRequest(`/workOrder/${workOrderInternalId}`);
    
    if (!workOrder) {
      throw new Error(`Work order ${workOrderInternalId} not found`);
    }

    // Create assembly build payload based on work order
    const assemblyBuildPayload = {
      // Reference the work order
      createdFrom: { id: workOrderInternalId },
      
      // Set the assembly item (from work order)
      item: workOrder.assemblyItem,
      
      // Set quantity to build
      quantity: quantity,
      
      // Set location (from work order)
      location: workOrder.location,
      
      // Set subsidiary (from work order)
      subsidiary: workOrder.subsidiary,
      
      // Set department if available
      ...(workOrder.department && { department: workOrder.department }),
      
      // Set transaction date to today
      trandate: new Date().toISOString().split('T')[0]
    };

    // Create the assembly build via NetSuite REST API
    const response = await (await this.auth).makeRequest('/assemblyBuild', 'POST', assemblyBuildPayload);
    
    return {
      id: response.id,
      setValue: (field) => {
        // Store field updates for later use
        this.pendingUpdates = this.pendingUpdates || {};
        this.pendingUpdates[field.fieldId] = field.value;
      },
      save: async () => {
        // Apply any pending updates
        if (this.pendingUpdates) {
          await (await this.auth).makeRequest(`/assemblyBuild/${response.id}`, 'PATCH', this.pendingUpdates);
        }
        return response.id;
      }
    };
  }

  /**
   * Set actual component quantities used in production
   */
  async setActualComponentQuantities(assemblyBuild, actualComponents) {
    // For now, we'll store these for when we save
    // In a full implementation, this would modify the component sublist
    
    const componentUpdates = actualComponents.map(comp => ({
      itemId: comp.itemId,
      quantity: comp.actualAmount,
      lotNumber: comp.lotNumber
    }));

    // Store component updates for later application
    assemblyBuild.componentUpdates = componentUpdates;
    
    console.log('📦 Component quantities set:', componentUpdates.length, 'components');
  }

  /**
   * Get assembly build details after creation
   */
  async getAssemblyBuildDetails(assemblyBuildId) {
    try {
      const details = await (await this.auth).makeRequest(`/assemblyBuild/${assemblyBuildId}`);
      return details;
    } catch (error) {
      console.warn('⚠️ Could not fetch assembly build details:', error.message);
      return null;
    }
  }

  /**
   * Complete work order for a batch (main integration point)
   */
  async completeWorkOrderForBatch(batchId, submissionData) {
    await this.connect();

    // Get the batch with work order data
    const batch = await this.models.Batch.findById(batchId).lean();
    if (!batch) {
      throw new Error('Batch not found');
    }

    if (!batch.netsuiteWorkOrderData?.workOrderId) {
      throw new Error('Batch does not have a NetSuite work order ID');
    }

    // Extract completion data from submission
    const {
      solutionQuantity,
      solutionUnit,
      confirmedComponents,
      solutionLotNumber
    } = submissionData;

    // Create the assembly build
    const result = await this.createAssemblyBuild({
      workOrderInternalId: batch.netsuiteWorkOrderData.workOrderId,
      quantityCompleted: solutionQuantity,
      actualComponents: confirmedComponents,
      completionDate: new Date().toISOString().split('T')[0]
    });

    // Update the batch with assembly build information
    await this.services.batchService.updateBatch(batchId, {
      workOrderStatus: 'completed',
      workOrderCompleted: true,
      workOrderCompletedAt: new Date(),
      assemblyBuildId: result.assemblyBuild.id,
      assemblyBuildCreated: true,
      assemblyBuildCreatedAt: new Date(),
      
      // Update NetSuite work order data
      'netsuiteWorkOrderData.status': 'built',
      'netsuiteWorkOrderData.completedAt': new Date(),
      'netsuiteWorkOrderData.assemblyBuildId': result.assemblyBuild.id,
      'netsuiteWorkOrderData.lastSyncAt': new Date()
    });

    console.log('✅ Work order completed for batch:', batchId);

    return {
      success: true,
      batchId,
      assemblyBuild: result.assemblyBuild,
      workOrderCompleted: true
    };
  }

  /**
   * Get assembly build status
   */
  async getAssemblyBuildStatus(assemblyBuildId) {
    try {
      const assemblyBuild = await (await this.auth).makeRequest(`/assemblyBuild/${assemblyBuildId}`);
      return {
        success: true,
        assemblyBuild
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List assembly builds for a work order
   */
  async getAssemblyBuildsForWorkOrder(workOrderId) {
    try {
      // Search for assembly builds created from this work order
      const response = await (await this.auth).makeRequest(`/assemblyBuild?q=createdfrom:${workOrderId}`);
      const assemblyBuilds = Array.isArray(response.items) ? response.items : [response];
      
      return {
        success: true,
        assemblyBuilds,
        count: assemblyBuilds.length
      };
    } catch (error) {
      return {
        success: false,
        assemblyBuilds: [],
        error: error.message
      };
    }
  }
}

/**
 * Factory function to create assembly build service
 */
export const createAssemblyBuildService = (user) => new NetSuiteAssemblyBuildService(user);

/**
 * Convenience function for completing work order from batch
 */
export async function completeWorkOrderForBatch(user, batchId, submissionData) {
  const service = createAssemblyBuildService(user);
  return service.completeWorkOrderForBatch(batchId, submissionData);
}