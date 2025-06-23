// lib/netsuite-helpers.js - Client-side helper functions

export const netsuiteHelpers = {
    /**
     * Check if NetSuite is configured for the current user
     */
    async checkConfiguration() {
      try {
        const response = await fetch('/api/netsuite/setup');
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error checking NetSuite configuration:', error);
        return { success: false, configured: false, message: 'Failed to check configuration' };
      }
    },
  
    /**
     * Test NetSuite connection
     */
    async testConnection() {
      try {
        const response = await fetch('/api/netsuite/test');
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error testing NetSuite connection:', error);
        return { success: false, message: 'Failed to test connection' };
      }
    },
  
    /**
     * Search for solutions/assembly items in NetSuite
     */
    async searchSolutions(searchTerm) {
      try {
        const response = await fetch(`/api/netsuite/bom?action=search&q=${encodeURIComponent(searchTerm)}`);
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.message || 'Search failed');
        }
        
        return {
          success: true,
          items: data.items || []
        };
      } catch (error) {
        console.error('Error searching NetSuite solutions:', error);
        return {
          success: false,
          items: [],
          error: error.message
        };
      }
    },
  
    /**
     * Get BOM for a specific assembly item
     */
    async getBOM(assemblyItemId) {
      try {
        const response = await fetch(`/api/netsuite/bom?action=getBOM&assemblyItemId=${assemblyItemId}`);
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.message || 'Failed to fetch BOM');
        }
        
        return {
          success: true,
          bom: data.bom,
          recipe: data.recipe
        };
      } catch (error) {
        console.error('Error fetching NetSuite BOM:', error);
        return {
          success: false,
          error: error.message
        };
      }
    },
  
    /**
     * Map NetSuite units to local units
     * You can expand this based on your NetSuite unit configuration
     */
    mapNetSuiteUnit(netsuiteUnitId) {
      const unitMapping = {
        '33': 'g',    // grams
        '34': 'kg',   // kilograms  
        '35': 'L',    // liters
        '36': 'mL',   // milliliters
        '37': 'ea',   // each
        // Add more mappings as needed
      };
      
      return unitMapping[netsuiteUnitId] || 'ea'; // Default to 'ea' if not found
    },
  
    /**
     * Format NetSuite component for local use
     */
    formatComponent(netsuiteComponent) {
      return {
        netsuiteItemId: netsuiteComponent.itemId,
        displayName: netsuiteComponent.ingredient,
        quantity: parseFloat(netsuiteComponent.quantity) || 0,
        unit: this.mapNetSuiteUnit(netsuiteComponent.units),
        netsuiteData: {
          itemId: netsuiteComponent.itemId,
          itemRefName: netsuiteComponent.itemRefName,
          ingredient: netsuiteComponent.ingredient,
          bomQuantity: netsuiteComponent.bomQuantity,
          componentYield: netsuiteComponent.componentYield,
          units: netsuiteComponent.units,
          lineId: netsuiteComponent.lineId,
          bomComponentId: netsuiteComponent.bomComponentId,
          itemSource: netsuiteComponent.itemSource
        }
      };
    },
  
    /**
     * Show NetSuite configuration prompt if not configured
     */
    async showConfigurationPrompt() {
      const config = await this.checkConfiguration();
      
      if (!config.configured) {
        const shouldConfigure = confirm(
          'NetSuite integration is not configured. Would you like to set it up now?'
        );
        
        if (shouldConfigure) {
          // Redirect to NetSuite setup page or open setup modal
          window.location.href = '/netsuite/setup';
          return false;
        }
      }
      
      return config.configured;
    }
  };
  
  // Enhanced API functions for file service
  export const enhancedFileApi = {
    /**
     * Update file metadata with NetSuite BOM import capability
     */
    async updateFileMetaWithBOM(fileId, metadata, netsuiteComponents = []) {
      try {
        // Process NetSuite components if any
        const processedComponents = netsuiteComponents.map(comp => {
          // Try to find matching local chemical by NetSuite internal ID
          // This would require your local items to have netsuiteInternalId field
          return {
            itemId: comp.localItemId || null, // Will be null if no local match
            amount: comp.quantity,
            unit: netsuiteHelpers.mapNetSuiteUnit(comp.units),
            netsuiteData: comp.netsuiteData
          };
        });
  
        // Merge with existing components
        const allComponents = [
          ...(metadata.components || []),
          ...processedComponents
        ];
  
        const updatedMetadata = {
          ...metadata,
          components: allComponents
        };
  
        const response = await fetch(`/api/files/${fileId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedMetadata)
        });
  
        if (!response.ok) {
          throw new Error('Failed to update file metadata');
        }
  
        return await response.json();
      } catch (error) {
        console.error('Error updating file metadata with BOM:', error);
        throw error;
      }
    },
  
    /**
     * Search local chemicals that might match NetSuite items
     */
    async findMatchingLocalChemicals(netsuiteComponents) {
      const matches = [];
      
      for (const component of netsuiteComponents) {
        try {
          // Search by NetSuite internal ID first
          let response = await fetch(`/api/items?type=chemical&netsuiteId=${component.itemId}`);
          let data = await response.json();
          
          if (data.items && data.items.length > 0) {
            matches.push({
              netsuiteComponent: component,
              localMatches: data.items,
              matchType: 'netsuiteId'
            });
            continue;
          }
          
          // Search by name similarity
          response = await fetch(`/api/items?type=chemical&search=${encodeURIComponent(component.ingredient)}`);
          data = await response.json();
          
          if (data.items && data.items.length > 0) {
            matches.push({
              netsuiteComponent: component,
              localMatches: data.items,
              matchType: 'name'
            });
          } else {
            matches.push({
              netsuiteComponent: component,
              localMatches: [],
              matchType: 'none'
            });
          }
        } catch (error) {
          console.error(`Error finding matches for ${component.ingredient}:`, error);
          matches.push({
            netsuiteComponent: component,
            localMatches: [],
            matchType: 'error',
            error: error.message
          });
        }
      }
      
      return matches;
    }
  };