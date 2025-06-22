// services/netsuite/bom.service.js
import { createNetSuiteAuth } from './auth.service.js';

/**
 * NetSuite BOM (Bill of Materials) Service
 * Handles fetching BOMs and components from NetSuite Assembly Items
 */
export class NetSuiteBOMService {
  constructor(user) {
    this.auth = createNetSuiteAuth(user);
  }

  /**
   * Get Assembly Item BOM and its components
   * Based on your Postman testing:
   * 1. Get BOM list with expandSubResources=true
   * 2. Extract current revision ID  
   * 3. Get revision components
   */
  async getAssemblyBOM(assemblyItemId) {
    try {
      // Step 1: Get BOMs for this assembly item with expanded details
      const endpoint = `/assemblyItem/${assemblyItemId}/billOfMaterials?expandSubResources=true`;
      const bomsResponse = await this.auth.makeRequest(endpoint);
      
      if (!bomsResponse.items || bomsResponse.items.length === 0) {
        throw new Error('No BOMs found for this assembly item');
      }

      // Get the first BOM (you could add logic to pick a specific one)
      const bomData = bomsResponse.items[0];
      
      // Step 2: Get the current revision ID
      if (!bomData.currentRevision || !bomData.currentRevision.id) {
        throw new Error('No current revision found for this BOM');
      }
      
      const revisionId = bomData.currentRevision.id;
      
      // Step 3: Get the revision components
      const components = await this.getBOMRevisionComponents(revisionId);
      
      return {
        bomId: bomData.billOfMaterials?.id,
        bomName: bomData.billOfMaterials?.refName,
        revisionId: revisionId,
        revisionName: bomData.currentRevision.refName,
        effectiveStartDate: bomData.effectiveStartDate,
        effectiveEndDate: bomData.effectiveEndDate,
        components: components
      };
    } catch (error) {
      console.error('Error fetching Assembly BOM:', error);
      throw error;
    }
  }

  /**
   * Get BOM Revision Components
   * This gets the actual ingredient list with quantities
   */
  async getBOMRevisionComponents(revisionId) {
    try {
      const endpoint = `/bomrevision/${revisionId}?expandSubResources=true`;
      const revisionData = await this.auth.makeRequest(endpoint);
      
      if (!revisionData.component || !revisionData.component.items) {
        return [];
      }
      
      return revisionData.component.items;
    } catch (error) {
      console.error('Error fetching BOM revision components:', error);
      throw error;
    }
  }

  /**
   * Search for Solutions/Assembly Items by name or internal ID
   */
  async searchAssemblyItems(searchTerm = '') {
    try {
      let endpoint = '/assemblyItem';
      if (searchTerm) {
        // Add search parameters - adjust based on NetSuite's search API
        endpoint += `?q=${encodeURIComponent(searchTerm)}`;
      }
      
      const results = await this.auth.makeRequest(endpoint);
      return results.items || results || [];
    } catch (error) {
      console.error('Error searching assembly items:', error);
      throw error;
    }
  }

  /**
   * Convert BOM data to recipe format for your app
   * Maps NetSuite BOM structure to your internal recipe format
   */
  formatBOMAsRecipe(bomData) {
    if (!bomData || !bomData.components) {
      return [];
    }

    return bomData.components.map(component => ({
      // Map NetSuite component fields to your recipe format
      ingredient: component.displayName || component.item?.refName || 'Unknown',
      itemId: component.item?.id,
      itemRefName: component.item?.refName,
      quantity: parseFloat(component.quantity) || 0,
      bomQuantity: parseFloat(component.bomQuantity) || 0,
      units: component.units, // This is likely a unit ID - you may need to map this
      componentYield: component.componentYield || 100,
      lineId: component.lineId,
      bomComponentId: component.id,
      itemSource: component.itemSource?.refName
    }));
  }
}

/**
 * Factory function to create BOM service
 */
export const createBOMService = (user) => {
  return new NetSuiteBOMService(user);
};