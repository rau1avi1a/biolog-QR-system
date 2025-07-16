// app/(pages)/home/lib/api.js

/**
 * API functions for home page
 * Uses the apiClient to access page specific api calls
 */

import { api, extractData, extractList, getError } from '@/app/apiClient';

// Items API functions
export const itemsApi = {
  // Get all items
  getAll: async () => {
    const result = await api.list.items();
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractList(result, 'items', []);
  },
  
  // Get item by ID
  getById: async (id) => {
    const result = await api.get.item(id);
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },
  
  // Create new item
  create: async (itemData) => {
    const result = await api.create.item(itemData);
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },
  
  // Update item
  update: async (id, itemData) => {
    const result = await api.update.item(id, itemData);
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },
  
  // Delete item
  delete: async (id) => {
    const result = await api.remove.item(id);
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },
  
  // Search items
  search: async (query) => {
    const result = await api.custom.searchItems(query);
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractList(result, 'items', []);
  }
};

// QR Code API functions
export const qrApi = {
  // Find item by QR code
  findByQRCode: async (qrData) => {
    const result = await api.custom.scanQR(qrData);
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },
  
  // Generate QR code for item
  generateQRCode: async (itemId) => {
    const result = await api.custom.generateQR(itemId);
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  }
};

// Stats API functions
export const statsApi = {
  // Get overview stats
  getOverview: async () => {
    const result = await api.custom.getStats();
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },
  
  // Get low stock items
  getLowStock: async () => {
    const result = await api.custom.getLowStock();
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractList(result, 'items', []);
  }
};

// Upload API functions (for future NetSuite integration)
export const uploadApi = {
  // Upload CSV file
  uploadCSV: async (file, type) => {
    const result = await api.upload.csv(file, { type });
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  }
};

// =============================================================================
// =============================================================================

// NetSuite Import API functions
export const netsuiteApi = {
  // Test NetSuite connection
  testConnection: async () => {
    const result = await api.custom.testNetSuite();
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },

  // Get NetSuite setup/health status
  getStatus: async () => {
    const result = await api.custom.getNetSuiteHealth();
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },

  // Validate NetSuite connection
  validateConnection: async () => {
    const result = await api.custom.netsuiteValidateConnection();
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },

  // Get inventory statistics
  getInventoryStats: async () => {
    const result = await api.custom.netsuiteGetInventoryStats();
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },

  // Get inventory data with pagination
  getInventoryData: async (offset = 0, limit = 1000) => {
    const result = await api.custom.netsuiteGetInventoryData(offset, limit);
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },

  // Get all inventory data in batches
  getAllInventoryData: async (onBatch = null) => {
    const result = await api.custom.netsuiteGetInventoryDataBatch(1000, onBatch);
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },

  // Execute custom SuiteQL query
  executeSuiteQL: async (query, offset = 0, limit = 1000) => {
    const result = await api.custom.netsuiteExecuteSuiteQL(query, offset, limit);
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },

  // Perform full inventory import
  fullImport: async () => {
    const result = await api.custom.netsuiteFullImport();
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },

  // Perform full import with progress tracking
  fullImportWithProgress: async (onProgress = null) => {
    const result = await api.custom.netsuiteFullImportWithProgress(onProgress);
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },

  // Scan for new items
  scanNewItems: async () => {
    const result = await api.custom.netsuiteScanNewItems();
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },

  // Scan for new items with progress tracking
  scanNewItemsWithProgress: async (onProgress = null) => {
    const result = await api.custom.netsuiteScanNewItemsWithProgress(onProgress);
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },

  // Import selected items
  importSelected: async (selectedItems) => {
    const result = await api.custom.netsuiteImportSelected(selectedItems);
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },

  // Import selected items with progress tracking
  importSelectedWithProgress: async (selectedItems, onProgress = null) => {
    const result = await api.custom.netsuiteImportSelectedWithProgress(selectedItems, onProgress);
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },

  // Get NetSuite BOM data
  getBOM: async (assemblyItemId) => {
    const result = await api.custom.getNetSuiteBOM(assemblyItemId);
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },

  // Search NetSuite items
  searchItems: async (query) => {
    const result = await api.custom.searchNetSuiteItems(query);
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },

  // Map NetSuite components to local items
  mapComponents: async (components) => {
    const result = await api.custom.mapNetSuiteComponents(components);
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },

  // Get NetSuite units
  getUnits: async (type = null) => {
    const result = await api.custom.getNetSuiteUnits(type);
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  },

  // Get specific NetSuite unit
  getUnit: async (unitId) => {
    const result = await api.custom.getNetSuiteUnit(unitId);
    if (getError(result)) {
      throw new Error(getError(result));
    }
    return extractData(result);
  }
};

// =============================================================================
// UPDATE THE MAIN API OBJECT (around line 90)
// Replace the existing homeApi with this updated version:
// =============================================================================

// Main API object
const homeApi = {
  items: itemsApi,
  qr: qrApi,
  stats: statsApi,
  upload: uploadApi,
  netsuite: netsuiteApi  // Add this line
};

export default homeApi;