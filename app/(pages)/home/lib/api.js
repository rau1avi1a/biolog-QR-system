// app/(pages)/home/lib/api.js - Enhanced with OAuth2 handling

/**
 * API functions for home page
 * Uses the apiClient to access page specific api calls
 * Enhanced with OAuth2 authentication handling
 */

import { api, extractData, extractList, getError } from '@/app/apiClient';

/**
 * Enhanced error handler that manages OAuth2 authentication
 */
const handleApiError = (error, context = '') => {
  console.log(`API Error in ${context}:`, error);
  
  // Check if this is a NetSuite authentication error from service layer
  if (
    error.message?.includes('NetSuite authentication required') ||
    error.message?.includes('No OAuth2 access token found') ||
    error.message?.includes('Token refresh failed') ||
    error.message?.includes('Authentication failed') ||
    error.needsOAuth2
  ) {
    console.log('🔐 NetSuite authentication required (service layer), redirecting to OAuth2 login...');
    
    // Store current page for post-auth redirect
    const currentUrl = window.location.pathname + window.location.search;
    sessionStorage.setItem('postAuthRedirect', currentUrl);
    
    // Redirect to OAuth2 login
    window.location.href = '/api/netsuite?action=oauth2-login';
    
    // Return a specific error so components know what happened
    throw new Error('Redirecting to NetSuite authentication...');
  }
  
  // Check if this is a 401 response with authRequired flag from API layer
  if (error.response && error.response.status === 401) {
    console.log('🔐 Received 401 response, checking for authRequired flag...');
    
    // For fetch responses, we need to handle this differently
    // The error object should contain the parsed response data
    if (error.authRequired && error.needsOAuth2) {
      console.log('🔐 API returned authRequired=true, redirecting to OAuth2 login...');
      
      // Store current page for post-auth redirect
      const currentUrl = window.location.pathname + window.location.search;
      sessionStorage.setItem('postAuthRedirect', currentUrl);
      
      // Redirect to OAuth2 login
      window.location.href = error.redirectUrl || '/api/netsuite?action=oauth2-login';
      
      // Return a specific error so components know what happened
      throw new Error('Redirecting to NetSuite authentication...');
    }
  }
  
  // Check if the error object directly contains auth flags (from your API response)
  if (error.authRequired && error.needsOAuth2) {
    console.log('🔐 Error contains authRequired flag, redirecting to OAuth2 login...');
    
    // Store current page for post-auth redirect
    const currentUrl = window.location.pathname + window.location.search;
    sessionStorage.setItem('postAuthRedirect', currentUrl);
    
    // Redirect to OAuth2 login
    window.location.href = error.redirectUrl || '/api/netsuite?action=oauth2-login';
    
    // Return a specific error so components know what happened
    throw new Error('Redirecting to NetSuite authentication...');
  }
  
  // For other errors, just throw them normally
  throw new Error(error.message || 'API request failed');
};

/**
 * Wrapper function that adds OAuth2 handling to any API call
 */
const withOAuth2Handling = (apiCall, context = '') => {
  return async (...args) => {
    try {
      const result = await apiCall(...args);
      if (getError(result)) {
        handleApiError(new Error(getError(result)), context);
      }
      return result;
    } catch (error) {
      handleApiError(error, context);
    }
  };
};

// Items API functions (unchanged)
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

// QR Code API functions (unchanged)
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

// Stats API functions (unchanged)
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

// Upload API functions (unchanged)
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
// NETSUITE API - ENHANCED WITH OAUTH2 HANDLING
// =============================================================================

// NetSuite Import API functions - Enhanced with OAuth2 handling
export const netsuiteApi = {
  // OAuth2 Authentication functions
  oauth2: {
    // Get OAuth2 connection status
    getStatus: withOAuth2Handling(async () => {
      const result = await api.custom.netsuiteOAuth2Status();
      return extractData(result);
    }, 'OAuth2 Status'),

    // Initiate OAuth2 login (redirects user)
    login: async () => {
      // Store current page for post-auth redirect
      const currentUrl = window.location.pathname + window.location.search;
      sessionStorage.setItem('postAuthRedirect', currentUrl);
      
      // Redirect to OAuth2 login
      window.location.href = '/api/netsuite?action=oauth2-login';
    },

    // Disconnect OAuth2
    disconnect: withOAuth2Handling(async () => {
      const result = await api.custom.netsuiteOAuth2Disconnect();
      return extractData(result);
    }, 'OAuth2 Disconnect'),

    // Test OAuth2 connection
    test: withOAuth2Handling(async () => {
      const result = await api.custom.netsuiteOAuth2Test();
      return extractData(result);
    }, 'OAuth2 Test')
  },

  // Test NetSuite connection
  testConnection: withOAuth2Handling(async () => {
    const result = await api.custom.testNetSuite();
    return extractData(result);
  }, 'NetSuite Test Connection'),

  // Get NetSuite setup/health status
  getStatus: withOAuth2Handling(async () => {
    const result = await api.custom.getNetSuiteHealth();
    return extractData(result);
  }, 'NetSuite Status'),

  // Validate NetSuite connection
  validateConnection: withOAuth2Handling(async () => {
    const result = await api.custom.netsuiteValidateConnection();
    return extractData(result);
  }, 'NetSuite Validate'),

  // Get inventory statistics
  getInventoryStats: withOAuth2Handling(async () => {
    const result = await api.custom.netsuiteGetInventoryStats();
    return extractData(result);
  }, 'NetSuite Inventory Stats'),

  // Get inventory data with pagination
  getInventoryData: withOAuth2Handling(async (offset = 0, limit = 1000) => {
    const result = await api.custom.netsuiteGetInventoryData(offset, limit);
    return extractData(result);
  }, 'NetSuite Inventory Data'),

  // Get all inventory data in batches
  getAllInventoryData: withOAuth2Handling(async (onBatch = null) => {
    const result = await api.custom.netsuiteGetInventoryDataBatch(1000, onBatch);
    return extractData(result);
  }, 'NetSuite All Inventory Data'),

  // Execute custom SuiteQL query
  executeSuiteQL: withOAuth2Handling(async (query, offset = 0, limit = 1000) => {
    const result = await api.custom.netsuiteExecuteSuiteQL(query, offset, limit);
    return extractData(result);
  }, 'NetSuite SuiteQL'),

  // Perform full inventory import
  fullImport: withOAuth2Handling(async () => {
    const result = await api.custom.netsuiteFullImport();
    return extractData(result);
  }, 'NetSuite Full Import'),

  // Perform full import with progress tracking
  fullImportWithProgress: withOAuth2Handling(async (onProgress = null) => {
    const result = await api.custom.netsuiteFullImportWithProgress(onProgress);
    return extractData(result);
  }, 'NetSuite Full Import with Progress'),

  // Scan for new items
  scanNewItems: withOAuth2Handling(async () => {
    const result = await api.custom.netsuiteScanNewItems();
    return extractData(result);
  }, 'NetSuite Scan New Items'),

  // Scan for new items with progress tracking
  scanNewItemsWithProgress: withOAuth2Handling(async (onProgress = null) => {
    const result = await api.custom.netsuiteScanNewItemsWithProgress(onProgress);
    return extractData(result);
  }, 'NetSuite Scan New Items with Progress'),

  // Import selected items
  importSelected: withOAuth2Handling(async (selectedItems) => {
    const result = await api.custom.netsuiteImportSelected(selectedItems);
    return extractData(result);
  }, 'NetSuite Import Selected'),

  // Import selected items with progress tracking
  importSelectedWithProgress: withOAuth2Handling(async (selectedItems, onProgress = null) => {
    const result = await api.custom.netsuiteImportSelectedWithProgress(selectedItems, onProgress);
    return extractData(result);
  }, 'NetSuite Import Selected with Progress'),

  // Get NetSuite BOM data
  getBOM: withOAuth2Handling(async (assemblyItemId) => {
    const result = await api.custom.getNetSuiteBOM(assemblyItemId);
    return extractData(result);
  }, 'NetSuite Get BOM'),

  // Search NetSuite items
  searchItems: withOAuth2Handling(async (query) => {
    const result = await api.custom.searchNetSuiteItems(query);
    return extractData(result);
  }, 'NetSuite Search Items'),

  // Map NetSuite components to local items
  mapComponents: withOAuth2Handling(async (components) => {
    const result = await api.custom.mapNetSuiteComponents(components);
    return extractData(result);
  }, 'NetSuite Map Components'),

  // Get NetSuite units
  getUnits: withOAuth2Handling(async (type = null) => {
    const result = await api.custom.getNetSuiteUnits(type);
    return extractData(result);
  }, 'NetSuite Get Units'),

  // Get specific NetSuite unit
  getUnit: withOAuth2Handling(async (unitId) => {
    const result = await api.custom.getNetSuiteUnit(unitId);
    return extractData(result);
  }, 'NetSuite Get Unit')
};

// =============================================================================
// OAUTH2 STATUS HOOK FOR COMPONENTS
// =============================================================================

/**
 * Hook to check OAuth2 status and provide connection helpers
 * Use this in components that need NetSuite functionality
 */
export const useNetSuiteOAuth2 = () => {
  const [status, setStatus] = React.useState({
    connected: false,
    loading: true,
    error: null
  });

  const checkStatus = async () => {
    try {
      setStatus(prev => ({ ...prev, loading: true }));
      const statusData = await netsuiteApi.oauth2.getStatus();
      setStatus({
        connected: statusData?.connected || false,
        expired: statusData?.expired || false,
        needsReauth: statusData?.needsReauth || false,
        loading: false,
        error: null
      });
    } catch (error) {
      setStatus({
        connected: false,
        loading: false,
        error: error.message
      });
    }
  };

  const connect = async () => {
    await netsuiteApi.oauth2.login();
  };

  const disconnect = async () => {
    try {
      await netsuiteApi.oauth2.disconnect();
      setStatus({
        connected: false,
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  };

  const testConnection = async () => {
    try {
      const result = await netsuiteApi.oauth2.test();
      return result;
    } catch (error) {
      throw error;
    }
  };

  React.useEffect(() => {
    checkStatus();
  }, []);

  return {
    status,
    connect,
    disconnect,
    testConnection,
    refetch: checkStatus
  };
};

// =============================================================================
// MAIN API OBJECT
// =============================================================================

// Main API object
const homeApi = {
  items: itemsApi,
  qr: qrApi,
  stats: statsApi,
  upload: uploadApi,
  netsuite: netsuiteApi
};

export default homeApi;