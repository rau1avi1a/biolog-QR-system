// app/(pages)/files/lib/api.js - FIXED: Better response handling and error management
import { api } from '@/app/apiClient'

/**
 * Files Page API Client - FIXED
 * 
 * This module contains all API operations used by the Files page components.
 * Fixed to handle different response formats from the backend and provide
 * consistent error handling.
 */

// Helper function to normalize API responses
function normalizeResponse(result, dataField = 'data') {
  console.log('🔧 Normalizing API response:', result);
  
  // Handle null/undefined responses
  if (!result) {
    return { data: null, error: 'No response received' };
  }
  
  // Handle error responses
  if (result.error) {
    return { data: null, error: result.error };
  }
  
  // Handle success responses with explicit success field
  if (result.success === true) {
    return { 
      data: result[dataField] || result.data || result, 
      error: null 
    };
  }
  
  // Handle success responses with explicit success field = false
  if (result.success === false) {
    return { 
      data: null, 
      error: result.error || result.message || 'Operation failed' 
    };
  }
  
  // Handle direct data responses (arrays or objects)
  if (Array.isArray(result) || (typeof result === 'object' && !result.success && !result.error)) {
    return { data: result, error: null };
  }
  
  // Handle responses with specific data fields
  if (result.folders || result.files || result.batches) {
    return { data: result, error: null };
  }
  
  // Default case - assume it's data
  return { data: result, error: null };
}

// Helper function to handle API calls with consistent error handling
async function handleApiCall(operation, apiCall) {
  try {
    console.log(`🚀 API Call: ${operation}`);
    const result = await apiCall();
    const normalized = normalizeResponse(result);
    console.log(`✅ API Success: ${operation}`, normalized);
    return normalized;
  } catch (error) {
    console.error(`❌ API Error: ${operation}`, error);
    return { 
      data: null, 
      error: error.message || 'An error occurred' 
    };
  }
}

export const filesApi = {
  // === FOLDER OPERATIONS ===
  folders: {
    async list(parentId = null) {
      return handleApiCall('folders.list', async () => {
        const result = await api.list.folders(parentId);
        console.log('📁 Raw folders result:', result);
        
        // Handle different response formats
        if (result.data && result.data.folders) {
          return result.data.folders;
        } else if (result.data && Array.isArray(result.data)) {
          return result.data;
        } else if (result.folders) {
          return result.folders;
        } else if (Array.isArray(result)) {
          return result;
        }
        
        return result;
      });
    },

    async create(name, parentId = null) {
      return handleApiCall('folders.create', async () => {
        const result = await api.create.folder(name, parentId);
        return result;
      });
    },

    async update(id, name) {
      return handleApiCall('folders.update', async () => {
        const result = await api.update.folderName(id, name);
        return result;
      });
    },

    async remove(id) {
      return handleApiCall('folders.remove', async () => {
        const result = await api.remove.folder(id);
        return result;
      });
    },

    async getStructure(rootId = null) {
      return handleApiCall('folders.getStructure', async () => {
        const result = await api.list.folderStructure(rootId);
        return result;
      });
    }
  },

  // === FILE OPERATIONS ===
  files: {
    async list(folderId = null) {
      return handleApiCall('files.list', async () => {
        const result = await api.list.files(folderId);
        console.log('📄 Raw files result:', result);
        
        // Handle different response formats
        if (result.data && result.data.files) {
          return result.data.files;
        } else if (result.data && Array.isArray(result.data)) {
          return result.data;
        } else if (result.files) {
          return result.files;
        } else if (Array.isArray(result)) {
          return result;
        }
        
        return result;
      });
    },

    async get(id) {
      return handleApiCall('files.get', async () => {
        const result = await api.get.file(id);
        return result;
      });
    },

    async getWithPdf(id) {
      return handleApiCall('files.getWithPdf', async () => {
        const result = await api.get.fileWithPdf(id);
        return result;
      });
    },

    async search(query) {
      return handleApiCall('files.search', async () => {
        const result = await api.list.searchFiles(query);
        console.log('🔍 Raw search result:', result);
        
        // Handle different response formats
        if (result.data && result.data.files) {
          return result.data.files;
        } else if (result.data && Array.isArray(result.data)) {
          return result.data;
        } else if (result.files) {
          return result.files;
        } else if (Array.isArray(result)) {
          return result;
        }
        
        return result;
      });
    },

    async upload(file, folderId = null, onProgress = null) {
      return handleApiCall('files.upload', async () => {
        const result = await api.custom.uploadFile(file, folderId, onProgress);
        return result;
      });
    },

    async uploadBatch(fileDataArray, baseFolderId = null, onProgress = null) {
      return handleApiCall('files.uploadBatch', async () => {
        const result = await api.custom.uploadBatch(fileDataArray, baseFolderId, onProgress);
        return result;
      });
    },

    async uploadFolder(files, baseFolderId = null, onProgress = null) {
      return handleApiCall('files.uploadFolder', async () => {
        const result = await api.custom.uploadFolder(files, baseFolderId, onProgress);
        return result;
      });
    },

    async updateMeta(id, metadata) {
      return handleApiCall('files.updateMeta', async () => {
        const result = await api.update.fileMeta(id, metadata);
        return result;
      });
    }
  },

  // === BATCH OPERATIONS ===
  batches: {
    async list(options = {}) {
      return handleApiCall('batches.list', async () => {
        const result = await api.list.batches(options);
        console.log('📦 Raw batches result:', result);
        
        // Handle different response formats
        if (result.data && Array.isArray(result.data)) {
          return result.data;
        } else if (Array.isArray(result)) {
          return result;
        }
        
        return result;
      });
    },

    async listByStatus(status) {
      return handleApiCall('batches.listByStatus', async () => {
        const result = await api.list.batchesByStatus(status);
        console.log(`📦 Raw batches by status (${status}) result:`, result);
        
        // Handle different response formats
        if (result.data && Array.isArray(result.data)) {
          return result.data;
        } else if (Array.isArray(result)) {
          return result;
        }
        
        return result;
      });
    },

    async listByFile(fileId) {
      return handleApiCall('batches.listByFile', async () => {
        const result = await api.list.batchesByFile(fileId);
        return result;
      });
    },

    async get(id) {
      return handleApiCall('batches.get', async () => {
        const result = await api.get.batch(id);
        console.log('📦 Raw batch get result:', result);
        
        // Handle different response formats
        if (result.data) {
          return result.data;
        }
        
        return result;
      });
    },

    async getWithWorkOrder(id) {
      return handleApiCall('batches.getWithWorkOrder', async () => {
        const result = await api.get.batchWithWorkOrder(id);
        return result;
      });
    },

    async create(data) {
      return handleApiCall('batches.create', async () => {
        const result = await api.create.batch(data);
        return result;
      });
    },

    async createFromFile(fileId, options = {}) {
      return handleApiCall('batches.createFromFile', async () => {
        const result = await api.create.batchFromFile(fileId, options);
        return result;
      });
    },

    async createFromEditor(originalFileId, editorData, action = 'save', confirmationData = null) {
      return handleApiCall('batches.createFromEditor', async () => {
        const result = await api.create.batchFromEditor(originalFileId, editorData, action, confirmationData);
        return result;
      });
    },

    async update(id, data) {
      return handleApiCall('batches.update', async () => {
        const result = await api.update.batch(id, data);
        return result;
      });
    },

    async updateStatus(id, status) {
      return handleApiCall('batches.updateStatus', async () => {
        const result = await api.update.batchStatus(id, status);
        return result;
      });
    },

    async remove(id) {
      return handleApiCall('batches.remove', async () => {
        const result = await api.remove.batch(id);
        return result;
      });
    },

    async submitForReview(id, confirmationData = {}) {
      return handleApiCall('batches.submitForReview', async () => {
        const result = await api.update.submitBatchForReview(id, confirmationData);
        return result;
      });
    },

    async complete(id, completionData = {}) {
      return handleApiCall('batches.complete', async () => {
        const result = await api.update.completeBatch(id, completionData);
        return result;
      });
    },

    async reject(id, rejectionReason) {
      return handleApiCall('batches.reject', async () => {
        const result = await api.update.rejectBatch(id, rejectionReason);
        return result;
      });
    }
  },

  // === ARCHIVE OPERATIONS ===
  archive: {
    async listFiles() {
      return handleApiCall('archive.listFiles', async () => {
        const result = await api.list.archivedFiles();
        return result;
      });
    },

    async listFilesByPath(folderPath) {
      return handleApiCall('archive.listFilesByPath', async () => {
        const result = await api.list.archivedFilesByPath(folderPath);
        return result;
      });
    },

    async listFolders() {
      return handleApiCall('archive.listFolders', async () => {
        const result = await api.list.archiveFolders();
        return result;
      });
    },

    async getFile(id) {
      return handleApiCall('archive.getFile', async () => {
        const result = await api.get.archivedFile(id);
        return result;
      });
    },

    async getStats() {
      return handleApiCall('archive.getStats', async () => {
        const result = await api.custom.getArchiveStats();
        return result;
      });
    }
  },

  // === ITEM OPERATIONS ===
  items: {
    async search(query, type = null) {
      return handleApiCall('items.search', async () => {
        const result = await api.list.searchItems(query, type);
        return result;
      });
    },

    async searchChemicals(query) {
      return handleApiCall('items.searchChemicals', async () => {
        const result = await api.list.searchChemicals(query);
        return result;
      });
    },

    async searchSolutions(query) {
      return handleApiCall('items.searchSolutions', async () => {
        const result = await api.list.searchSolutions(query);
        return result;
      });
    },

    async get(id) {
      return handleApiCall('items.get', async () => {
        const result = await api.get.item(id);
        return result;
      });
    },

    async getLots(id) {
      return handleApiCall('items.getLots', async () => {
        const result = await api.get.itemLots(id);
        return result;
      });
    },

    async getTransactions(id, options = {}) {
      return handleApiCall('items.getTransactions', async () => {
        const result = await api.get.itemTransactions(id, options);
        return result;
      });
    }
  },

  // === WORK ORDER OPERATIONS ===
  workOrders: {
    async getStatus(batchId) {
      return handleApiCall('workOrders.getStatus', async () => {
        const result = await api.custom.getWorkOrderStatus(batchId);
        return result;
      });
    },

    async create(batchId, quantity, options = {}) {
      return handleApiCall('workOrders.create', async () => {
        const result = await api.create.netsuiteWorkOrderFromBatch(batchId, quantity, options);
        return result;
      });
    },

    async retry(batchId, quantity) {
      return handleApiCall('workOrders.retry', async () => {
        const result = await api.custom.retryWorkOrder(batchId, quantity);
        return result;
      });
    },

    async complete(workOrderId, quantityCompleted = null) {
      return handleApiCall('workOrders.complete', async () => {
        const result = await api.custom.completeWorkOrder(workOrderId, quantityCompleted);
        return result;
      });
    },

    async cancel(workOrderId) {
      return handleApiCall('workOrders.cancel', async () => {
        const result = await api.custom.cancelWorkOrder(workOrderId);
        return result;
      });
    }
  },

  // === NETSUITE OPERATIONS ===
  netsuite: {
    async getBOM(assemblyItemId) {
      return handleApiCall('netsuite.getBOM', async () => {
        const result = await api.custom.getNetSuiteBOM(assemblyItemId);
        return result;
      });
    },

    async searchItems(query) {
      return handleApiCall('netsuite.searchItems', async () => {
        const result = await api.custom.searchNetSuiteItems(query);
        return result;
      });
    },

    async mapComponents(components) {
      return handleApiCall('netsuite.mapComponents', async () => {
        const result = await api.custom.mapNetSuiteComponents(components);
        return result;
      });
    },

    async getHealth() {
      return handleApiCall('netsuite.getHealth', async () => {
        const result = await api.custom.getNetSuiteHealth();
        return result;
      });
    },

    async getSetup() {
      return handleApiCall('netsuite.getSetup', async () => {
        const result = await api.custom.getNetSuiteSetup();
        return result;
      });
    },

    async test() {
      return handleApiCall('netsuite.test', async () => {
        const result = await api.custom.testNetSuite();
        return result;
      });
    }
  },

  // === WORKFLOW HELPERS ===
  workflow: {
    async getFilesByStatus(status) {
      return this.batches.listByStatus(status);
    },

    async getInProgressFiles() {
      return this.getFilesByStatus('In Progress');
    },

    async getReviewFiles() {
      return this.getFilesByStatus('Review');
    },

    async getCompletedFiles() {
      return this.getFilesByStatus('Completed');
    },

    async getDashboardData() {
      return handleApiCall('workflow.getDashboardData', async () => {
        const result = await api.list.workflowOverview();
        return result;
      });
    }
  },

  // === BULK OPERATIONS ===
  bulk: {
    async uploadFiles(files, folderId = null, onProgress = null) {
      const fileDataArray = Array.from(files).map(file => ({
        file,
        relativePath: file.name
      }));
      return filesApi.files.uploadBatch(fileDataArray, folderId, onProgress);
    },

    async deleteBatches(batchIds, options = {}) {
      return handleApiCall('bulk.deleteBatches', async () => {
        const result = await api.remove.bulkBatches(batchIds, options);
        return result;
      });
    },

    async updateBatchStatuses(statusUpdates) {
      return handleApiCall('bulk.updateBatchStatuses', async () => {
        const result = await api.update.bulkBatchStatuses(statusUpdates);
        return result;
      });
    }
  },

  // === VALIDATION HELPERS ===
  validation: {
    async validateBatchDelete(id) {
      return handleApiCall('validation.validateBatchDelete', async () => {
        const result = await api.remove.validateBeforeDelete('batch', id);
        return result;
      });
    },

    async validateFolderDelete(id) {
      return handleApiCall('validation.validateFolderDelete', async () => {
        const result = await api.remove.validateBeforeDelete('folder', id);
        return result;
      });
    }
  },

  // === EDITOR-SPECIFIC OPERATIONS ===
  editor: {
    async saveFromEditor(originalFileId, editorData, action = 'save', confirmationData = null) {
      return handleApiCall('editor.saveFromEditor', async () => {
        const result = await api.custom.saveBatchFromEditor(originalFileId, editorData, action, confirmationData);
        return result;
      });
    },

    async loadForEditing(id, isBatch = false) {
      return handleApiCall('editor.loadForEditing', async () => {
        if (isBatch) {
          const result = await api.get.batch(id);
          return result;
        } else {
          const result = await api.get.fileWithPdf(id);
          return result;
        }
      });
    }
  }
};

// === CONVENIENCE FUNCTIONS ===

/**
 * Check if a result has an error and handle it consistently
 */
export function hasError(result) {
  return result && result.error !== null && result.error !== undefined;
}

/**
 * Extract data from API result, handling both success and error cases
 */
export function extractData(result, fallback = null) {
  if (hasError(result)) {
    return fallback;
  }
  return result?.data || fallback;
}

/**
 * Handle API errors consistently across components
 */
export function handleApiError(result, defaultMessage = 'An error occurred') {
  if (hasError(result)) {
    console.error('API Error:', result.error);
    return result.error || defaultMessage;
  }
  return null;
}

/**
 * Normalize file/batch data for consistent handling in components
 */
export function normalizeFileData(file) {
  if (!file) return null;
  
  return {
    id: file._id,
    fileName: file.fileName || `Batch Run ${file.runNumber}` || 'Untitled',
    status: file.status,
    isBatch: file.isBatch || !!file.runNumber || !!file.batchId,
    isArchived: file.isArchived || false,
    runNumber: file.runNumber,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    workOrderCreated: file.workOrderCreated || false,
    chemicalsTransacted: file.chemicalsTransacted || false,
    solutionCreated: file.solutionCreated || false,
    // Include all original properties
    ...file
  };
}

/**
 * Normalize folder data for consistent handling
 */
export function normalizeFolderData(folder) {
  if (!folder) return null;
  
  return {
    id: folder._id,
    name: folder.name,
    parentId: folder.parentId,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
    // Include all original properties  
    ...folder
  };
}

// Export individual API modules for focused imports
export const { folders, files, batches, archive, items, workOrders, netsuite, workflow, bulk, validation, editor } = filesApi;