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

  get models() {
    return db.models;
  }

  get services() {
    return db.services;
  }

  async connect() {
    return db.connect();
  }

  /**
   * Lookup inventory number ID using SuiteQL
   */
  async lookupInventoryNumberId(lotNumber, itemId = null) {
    console.log(`🔍 Looking up inventory number ID for lot "${lotNumber}" ${itemId ? `on item ${itemId}` : ''}`);
    
    let query = `SELECT id, inventorynumber FROM InventoryNumber WHERE inventorynumber = '${lotNumber}'`;
    if (itemId) {
      query += ` AND item = '${itemId}'`;
    }
    
    console.log(`🔍 SuiteQL query: ${query}`);
    
    const authService = await this.auth;
    const originalBaseUrl = authService.baseUrl;
    
    try {
      // Temporarily change to the query base URL
      authService.baseUrl = 'https://4511488-sb1.suitetalk.api.netsuite.com/services/rest';
      
      console.log('🔄 Making SuiteQL request...');
      const response = await authService.makeRequest('/query/v1/suiteql', 'POST', { q: query }, {
        'Prefer': 'transient'
      });
      
      console.log('📋 SuiteQL response received successfully!');
      console.log('Response type:', typeof response);
      console.log('Response data:', JSON.stringify(response, null, 2));
      
      if (response && response.items && Array.isArray(response.items) && response.items.length > 0) {
        const inventoryRecord = response.items[0];
        console.log('📋 First item found:', JSON.stringify(inventoryRecord, null, 2));
        
        if (inventoryRecord.id) {
          console.log(`✅ Found inventory number ID: ${inventoryRecord.id} for lot "${lotNumber}"`);
          return inventoryRecord.id;
        } else {
          console.warn('⚠️ First item has no ID field');
          console.warn('⚠️ Available fields:', Object.keys(inventoryRecord));
        }
      } else {
        console.warn('⚠️ Response has no items or items is empty');
        if (response) {
          console.warn('⚠️ Response structure:', Object.keys(response));
        }
      }
      
      console.warn(`⚠️ No inventory number found for lot "${lotNumber}"`);
      return null;
      
    } catch (error) {
      console.error(`❌ Error looking up inventory number for ${lotNumber}:`, error.message);
      console.error('❌ Full error:', error);
      return null;
    } finally {
      // Always restore the original base URL
      authService.baseUrl = originalBaseUrl;
    }
  }

  /**
   * Transform work order to assembly build (creates the assembly build directly)
   */
  async transformWorkOrderToAssemblyBuild(workOrderInternalId, quantity, actualComponents = [], solutionLotNumber = null) {
    console.log('🔄 Transforming work order to assembly build:', workOrderInternalId);
    
    // Build the transform payload with component inventory details
    const payload = {
      quantity,
      trandate: new Date().toISOString().split('T')[0]
    };

    // Add component inventory details if we have components with lot numbers
    if (actualComponents && actualComponents.length > 0) {
      const componentList = [];
      
      for (const comp of actualComponents) {
        if (comp.lotNumber && comp.netsuiteInternalId) {
          const inventoryNumberId = await this.lookupInventoryNumberId(comp.lotNumber, comp.netsuiteInternalId);
          
          if (inventoryNumberId) {
            componentList.push({
              item: comp.netsuiteInternalId,  // Use string (not object) - this was the key!
              quantity: comp.actualAmount ?? comp.plannedAmount ?? 1,
              componentInventoryDetail: {
                inventoryAssignment: {
                  items: [{
                    issueInventoryNumber: { id: inventoryNumberId },
                    quantity: comp.actualAmount ?? comp.plannedAmount ?? 1
                  }]
                }
              }
            });
            console.log(`✅ Added component with inventory ID ${inventoryNumberId} for lot ${comp.lotNumber}`);
          } else {
            console.warn(`⚠️ Skipping component - no inventory number found for lot ${comp.lotNumber}`);
          }
        }
      }
      
      if (componentList.length > 0) {
        payload.component = { items: componentList };
      }
    }

    // Add solution lot if provided (use as string, not lookup)
    if (solutionLotNumber) {
      payload.inventoryDetail = {
        inventoryAssignment: {
          items: [{
            receiptInventoryNumber: solutionLotNumber,  // Use string directly for new lot
            quantity: quantity
          }]
        }
      };
      console.log(`✅ Added solution lot "${solutionLotNumber}" for newly produced solution`);
    }

    console.log('🔧 Work order transform payload:', JSON.stringify(payload, null, 2));

    // Transform the work order to assembly build (this creates the assembly build)
    const response = await (await this.auth).makeRequest(
      `/workOrder/${workOrderInternalId}/!transform/assemblyBuild`, 
      'POST', 
      payload
    );
    
    console.log('✅ Work order transformed to assembly build:', response.id);
    return response.id;
  }

  /**
   * Complete work order for a batch (main integration point)
   */
  async completeWorkOrderForBatch(batchId, submissionData) {
    await this.connect();

    const batch = await this.models.Batch.findById(batchId).lean();
    if (!batch) {
      throw new Error('Batch not found');
    }

    if (!batch.netsuiteWorkOrderData?.workOrderId) {
      throw new Error('Batch does not have a NetSuite work order ID');
    }

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

    // Process components to get NetSuite internal IDs
    let enhancedComponents = [];
    if (confirmedComponents && confirmedComponents.length > 0) {
      for (const comp of confirmedComponents) {
        const item = await this.models.Item.findById(comp.itemId).lean();
        
        if (!item || !item.netsuiteInternalId) {
          console.warn(`⚠️ Item not found or missing NetSuite ID: ${comp.itemId}`);
          continue;
        }
        
        // Use component lot number or auto-assign from item lots
        let finalLotNumber = comp.lotNumber;
        if ((!finalLotNumber || finalLotNumber.trim() === '') && item.Lots && item.Lots.length > 0) {
          const availableLot = item.Lots.find(lot => lot.quantity >= (comp.actualAmount || comp.plannedAmount || 1));
          finalLotNumber = availableLot ? availableLot.lotNumber : item.Lots[0].lotNumber;
          console.log(`🔧 Auto-assigned lot number "${finalLotNumber}" for ${item.displayName}`);
        }
        
        enhancedComponents.push({
          ...comp,
          netsuiteInternalId: item.netsuiteInternalId,
          displayName: item.displayName,
          sku: item.sku,
          lotNumber: finalLotNumber
        });
        
        console.log('✅ Enhanced component:', {
          displayName: item.displayName,
          sku: item.sku,
          netsuiteInternalId: item.netsuiteInternalId,
          lotNumber: finalLotNumber,
          actualAmount: comp.actualAmount
        });
      }
    }

    // Transform work order to assembly build (this creates it directly)
    const assemblyBuildId = await this.transformWorkOrderToAssemblyBuild(
      batch.netsuiteWorkOrderData.workOrderId,
      solutionQuantity,
      enhancedComponents,
      solutionLotNumber
    );

    // Fetch details for the created assembly build
    const details = await this.getAssemblyBuildDetails(assemblyBuildId);

    // Update the batch
    await this.services.batchService.updateBatch(batchId, {
      workOrderStatus: 'completed',
      workOrderCompleted: true,
      workOrderCompletedAt: new Date().toISOString(),
      assemblyBuildId: assemblyBuildId,
      assemblyBuildTranId: details?.tranId || null,
      assemblyBuildCreated: true,
      assemblyBuildCreatedAt: new Date().toISOString(),
      
      'netsuiteWorkOrderData.status': 'built',
      'netsuiteWorkOrderData.completedAt': new Date().toISOString(),
      'netsuiteWorkOrderData.assemblyBuildId': assemblyBuildId,
      'netsuiteWorkOrderData.assemblyBuildTranId': details?.tranId || null,
      'netsuiteWorkOrderData.lastSyncAt': new Date().toISOString()
    });

    console.log('✅ Work order completed for batch:', batchId);

    return {
      success: true,
      batchId,
      assemblyBuild: {
        id: assemblyBuildId,
        tranId: details?.tranId || null,
        workOrderId: batch.netsuiteWorkOrderData.workOrderId,
        quantity: solutionQuantity,
        tranDate: new Date().toISOString().split('T')[0],
        details: details
      },
      workOrderCompleted: true
    };
  }

  /**
   * Get assembly build details
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