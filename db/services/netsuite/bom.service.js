// services/netsuite/bom.service.js - Updated with enhanced search
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
   * Search for Solutions/Assembly Items by name or internal ID
   * Enhanced search with better error handling
   */
  async searchAssemblyItems(searchTerm = '') {
    try {
      console.log('Searching for assembly items:', searchTerm);
      
      if (!searchTerm || searchTerm.trim().length < 2) {
        return [];
      }

      // Try different search approaches
      let endpoint = '/assemblyItem';
      
      // If search term is numeric, assume it's an internal ID
      if (/^\d+$/.test(searchTerm.trim())) {
        endpoint += `?q=internalid:${encodeURIComponent(searchTerm.trim())}`;
      } else {
        // Text search - search in item ID/name fields
        endpoint += `?q=${encodeURIComponent(searchTerm.trim())}`;
      }
      
      console.log('Search endpoint:', endpoint);
      
      const results = await this.auth.makeRequest(endpoint);
      
      // Handle different response formats
      if (results && results.items) {
        return results.items;
      } else if (Array.isArray(results)) {
        return results;
      } else if (results && results.links) {
        // Single item returned
        return [results];
      } else {
        console.log('Unexpected search result format:', results);
        return [];
      }
      
    } catch (error) {
      console.error('Error searching assembly items:', error);
      
      // Try a simpler search as fallback
      try {
        console.log('Trying fallback search...');
        const fallbackEndpoint = `/assemblyItem?limit=10`;
        const fallbackResults = await this.auth.makeRequest(fallbackEndpoint);
        
        if (fallbackResults && fallbackResults.items) {
          // Filter results client-side
          const filtered = fallbackResults.items.filter(item => {
            const itemId = item.itemid || item.id || '';
            const displayName = item.displayName || item.itemid || '';
            const searchLower = searchTerm.toLowerCase();
            
            return itemId.toLowerCase().includes(searchLower) || 
                   displayName.toLowerCase().includes(searchLower);
          });
          
          return filtered;
        }
      } catch (fallbackError) {
        console.error('Fallback search also failed:', fallbackError);
      }
      
      // Return empty array instead of throwing to prevent UI errors
      return [];
    }
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
      console.log('Getting BOM for assembly item:', assemblyItemId);
      
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