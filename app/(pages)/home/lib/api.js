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

// Main API object
const homeApi = {
  items: itemsApi,
  qr: qrApi,
  stats: statsApi,
  upload: uploadApi
};

export default homeApi;