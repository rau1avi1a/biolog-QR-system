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
 * Transform work order to assembly build using NetSuite's record.transform
 */
async transformWorkOrderToAssemblyBuild(
    workOrderInternalId,
    quantity,
    actualComponents = [],
    solutionLotNumber = null
  ) {
    // Build the transform payload
    const payload = {
      // override build quantity & date
      quantity,
      trandate: new Date().toISOString().split('T')[0]
    };

    // finished-good lot (receipt) if provided
    if (solutionLotNumber) {
      payload.inventoryDetail = {
        inventoryAssignment: [{
          receiptInventoryNumber: solutionLotNumber,
          quantity
        }]
      };
    }

    // component sublist, wrapped under "items"
    if (actualComponents.length) {
      payload.component = {
        items: actualComponents.map((comp, idx) => {
          const used = comp.actualAmount ?? comp.plannedAmount ?? 1;
          const entry = {
            item: { id: comp.netsuiteInternalId },
            quantity: used
          };
          if (comp.lotNumber) {
            entry.componentInventoryDetail = {
              inventoryAssignment: [{
                issueInventoryNumber: comp.lotNumber,
                quantity: used
              }]
            };
          }
          return entry;
        })
      };
    }

    console.log('🚀 Transform payload:', JSON.stringify(payload, null, 2));

    // **THIS** is the one-call transform endpoint
    const url = `/workOrder/${workOrderInternalId}/!transform/assemblyBuild`;
    const response = await (await this.auth).makeRequest(url, 'POST', payload);

    // NetSuite returns 204 No Content on success; we need to fetch the new internal ID
    // It sets the Location header to the new record URL, or you can GET the workOrder subresource.
    // For simplicity, re-query the list of builds for that WO:
    const list = await (await this.auth)
      .makeRequest(`/assemblyBuild?q=createdfrom:${workOrderInternalId}`);
    const latest = Array.isArray(list.items) ? list.items.pop() : list; 
    if (!latest?.id) throw new Error('Could not retrieve created Assembly Build ID');
    return latest.id;
  }

  /**
   * Wrapper to create the build and return details
   */
  async createAssemblyBuild({ workOrderInternalId, quantityCompleted, actualComponents, solutionLotNumber }) {
    await this.connect();
    console.log('Transforming WO→AssemblyBuild:', workOrderInternalId);

    const buildId = await this.transformWorkOrderToAssemblyBuild(
      workOrderInternalId,
      quantityCompleted,
      actualComponents,
      solutionLotNumber
    );
    console.log('✅ Assembly Build created with ID', buildId);

    // Fetch full details
    const details = await (await this.auth).makeRequest(`/assemblyBuild/${buildId}`);
    return { id: buildId, details };
  }

  
  /**
   * Complete work order for a batch (main integration point)
   * FIXED: All date serialization issues
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
  
    console.log('🔍 Submission data for assembly build:', {
      solutionQuantity,
      solutionUnit,
      confirmedComponentCount: confirmedComponents?.length || 0,
      solutionLotNumber
    });
  
    // ENHANCED: Prepare component data with NetSuite internal IDs
    let enhancedComponents = [];
    if (confirmedComponents && confirmedComponents.length > 0) {
      console.log('🔍 Processing confirmed components:', confirmedComponents.length);
      
      for (const comp of confirmedComponents) {
        console.log('🔍 Looking up item:', comp.itemId);
        
        // Get the full item data to ensure we have NetSuite internal ID
        const item = await this.models.Item.findById(comp.itemId).lean();
        
        if (!item) {
          console.warn(`⚠️ Item not found for component: ${comp.itemId}`);
          continue;
        }
        
        console.log('🔍 Item found:', {
          displayName: item.displayName,
          sku: item.sku,
          netsuiteInternalId: item.netsuiteInternalId,
          hasNetsuiteId: !!item.netsuiteInternalId
        });
        
        if (!item.netsuiteInternalId) {
          console.warn(`⚠️ Item missing NetSuite internal ID: ${item.displayName} (${item.sku})`);
          console.warn(`⚠️ Skipping component - assembly build requires NetSuite internal IDs`);
          continue;
        }
        
        const enhancedComponent = {
          ...comp,
          netsuiteInternalId: item.netsuiteInternalId,
          displayName: item.displayName,
          sku: item.sku
        };
        
        console.log('✅ Enhanced component:', {
          displayName: enhancedComponent.displayName,
          sku: enhancedComponent.sku,
          netsuiteInternalId: enhancedComponent.netsuiteInternalId,
          lotNumber: enhancedComponent.lotNumber,
          actualAmount: enhancedComponent.actualAmount
        });
        
        enhancedComponents.push(enhancedComponent);
      }
      
      console.log('🔧 Total enhanced components for NetSuite:', enhancedComponents.length);
    }
  
    // Create the assembly build
    const result = await this.createAssemblyBuild({
        workOrderInternalId: batch.netsuiteWorkOrderData.workOrderId,
        quantityCompleted: solutionQuantity,
        actualComponents: enhancedComponents,
        completionDate: new Date().toISOString().split('T')[0],
        solutionLotNumber // ← ✅ Passed from submissionData
      });
  
    // FIXED: Update the batch with assembly build information (fixed date serialization)
    await this.services.batchService.updateBatch(batchId, {
      workOrderStatus: 'completed',
      workOrderCompleted: true,
      workOrderCompletedAt: new Date().toISOString(), // ← FIXED: ISO string
      assemblyBuildId: result.assemblyBuild.id,
      assemblyBuildTranId: result.assemblyBuild.tranId, // ← Store ASSYB number
      assemblyBuildCreated: true,
      assemblyBuildCreatedAt: new Date().toISOString(), // ← FIXED: ISO string
      
      // Update NetSuite work order data (fixed dates)
      'netsuiteWorkOrderData.status': 'built',
      'netsuiteWorkOrderData.completedAt': new Date().toISOString(), // ← FIXED: ISO string
      'netsuiteWorkOrderData.assemblyBuildId': result.assemblyBuild.id,
      'netsuiteWorkOrderData.assemblyBuildTranId': result.assemblyBuild.tranId, // ← Store ASSYB number
      'netsuiteWorkOrderData.lastSyncAt': new Date().toISOString() // ← FIXED: ISO string
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