// app/(pages)/files/lib/api.js - FINAL FIX: Correct data extraction

import { api, hasError, extractData, getError } from '@/app/apiClient'

/**
 * Files Page API Client - FINAL FIX
 * 
 * The issue was: wrapper functions were returning just arrays instead of 
 * the full { data, error } format expected by the frontend components.
 */

// Helper function to handle API calls with proper error handling
async function handleApiCall(operation, apiCall) {
  try {
    console.log(`🚀 API Call: ${operation}`);
    const result = await apiCall();
    
    // FIXED: Just return the result as-is, don't extract data
    return result;
    
  } catch (error) {
    console.error(`💥 API Exception: ${operation}`, error);
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
        
        // FIXED: Return the full data object, not just the folders array
        // The frontend expects { data: {...}, error: null }
        // NOT { data: [...], error: null }
        return result;
      });
    },

    async create(name, parentId = null) {
      return handleApiCall('folders.create', async () => {
        return await api.create.folder(name, parentId);
      });
    },

    async update(id, name) {
      return handleApiCall('folders.update', async () => {
        return await api.update.folderName(id, name);
      });
    },

    async remove(id) {
      return handleApiCall('folders.remove', async () => {
        return await api.remove.folder(id);
      });
    }
  },

  // === FILE OPERATIONS ===
  files: {
    async list(folderId = null) {
      return handleApiCall('files.list', async () => {
        const result = await api.list.files(folderId);
        
        // FIXED: Return the full data object, not just the files array
        return result;
      });
    },

    async get(id) {
      return handleApiCall('files.get', async () => {
        return await api.get.file(id);
      });
    },

    async getWithPdf(id) {
      return handleApiCall('files.getWithPdf', async () => {
        return await api.get.fileWithPdf(id);
      });
    },

    async search(query) {
      return handleApiCall('files.search', async () => {
        const result = await api.list.searchFiles(query);
        
        // FIXED: Return the full data object, not just the files array
        return result;
      });
    },

    async upload(file, folderId = null, onProgress = null) {
      return handleApiCall('files.upload', async () => {
        return await api.custom.uploadFile(file, folderId, onProgress);
      });
    },

    async uploadBatch(fileDataArray, baseFolderId = null, onProgress = null) {
      return handleApiCall('files.uploadBatch', async () => {
        return await api.custom.uploadBatch(fileDataArray, baseFolderId, onProgress);
      });
    },

    async updateMeta(id, metadata) {
      return handleApiCall('files.updateMeta', async () => {
        return await api.update.fileMeta(id, metadata);
      });
    },

    async remove(id) {
      return handleApiCall('files.remove', async () => {
        return await api.remove.file(id);
      });
    }
  },

  // === BATCH OPERATIONS ===
  batches: {
    async list(options = {}) {
      return handleApiCall('batches.list', async () => {
        const result = await api.list.batches(options);
        
        // FIXED: Return the full data object, not just the batches array
        return result;
      });
    },

    async listByStatus(status) {
      return handleApiCall('batches.listByStatus', async () => {
        const result = await api.list.batchesByStatus(status);
        
        // FIXED: Return the full data object, not just the batches array
        return result;
      });
    },

    async get(id) {
      return handleApiCall('batches.get', async () => {
        return await api.get.batch(id);
      });
    },

    async create(data) {
      return handleApiCall('batches.create', async () => {
        return await api.create.batch(data);
      });
    },

    async update(id, data) {
      return handleApiCall('batches.update', async () => {
        return await api.update.batch(id, data);
      });
    },

    async updateStatus(id, status) {
      return handleApiCall('batches.updateStatus', async () => {
        return await api.update.batchStatus(id, status);
      });
    },

    async remove(id) {
      return handleApiCall('batches.remove', async () => {
        return await api.remove.batch(id);
      });
    },

    async submitForReview(id, confirmationData = {}) {
      return handleApiCall('batches.submitForReview', async () => {
        return await api.update.submitBatchForReview(id, confirmationData);
      });
    },

    async complete(id, completionData = {}) {
      return handleApiCall('batches.complete', async () => {
        return await api.update.completeBatch(id, completionData);
      });
    },

    async reject(id, rejectionReason) {
      return handleApiCall('batches.reject', async () => {
        return await api.update.rejectBatch(id, rejectionReason);
      });
    }
  },

  // === ITEM OPERATIONS ===
  items: {
    async search(query, type = null) {
      return handleApiCall('items.search', async () => {
        const result = await api.list.searchItems(query, type);
        
        // FIXED: Return the full data object, not just the items array
        return result;
      });
    },

    async searchSolutions(query) {
      return handleApiCall('items.searchSolutions', async () => {
        const result = await api.list.searchItems(query, 'solution');
        
        // FIXED: Return the full data object, not just the items array
        return result;
      });
    },

    async get(id) {
      return handleApiCall('items.get', async () => {
        return await api.get.item(id);
      });
    },

    async getLots(id) {
      return handleApiCall('items.getLots', async () => {
        const result = await api.get.itemLots(id);
        
        // FIXED: Return the full data object, not just the lots array
        return result;
      });
    }
  },

  // === WORK ORDER OPERATIONS ===
  workOrders: {
    async getStatus(batchId) {
      return handleApiCall('workOrders.getStatus', async () => {
        return await api.get.batchWorkOrderStatus(batchId);
      });
    },

    async create(batchId, quantity, options = {}) {
      return handleApiCall('workOrders.create', async () => {
        return await api.create.netsuiteWorkOrderFromBatch(batchId, quantity, options);
      });
    }
  },

  // === WORKFLOW HELPERS ===
  workflow: {
    async getFilesByStatus(status) {
      return filesApi.batches.listByStatus(status);
    },

    async getInProgressFiles() {
      return filesApi.workflow.getFilesByStatus('In Progress');
    },

    async getReviewFiles() {
      return filesApi.workflow.getFilesByStatus('Review');
    },

    async getCompletedFiles() {
      return filesApi.workflow.getFilesByStatus('Completed');
    }
  },

  // === EDITOR-SPECIFIC OPERATIONS ===
  editor: {
    async saveFromEditor(originalFileId, editorData, action = 'save', confirmationData = null) {
      return handleApiCall('editor.saveFromEditor', async () => {
        return await api.custom.saveBatchFromEditor(originalFileId, editorData, action, confirmationData);
      });
    }
  },

  // === VALIDATION HELPERS ===
  validation: {
    async validateBatchDelete(id) {
      return handleApiCall('validation.validateBatchDelete', async () => {
        return await api.remove.validateBeforeDelete('batch', id);
      });
    },

    async validateFolderDelete(id) {
      return handleApiCall('validation.validateFolderDelete', async () => {
        return await api.remove.validateBeforeDelete('folder', id);
      });
    }
  }
};

// === CONVENIENCE FUNCTIONS (aligned with GUIDE.md) ===

/**
 * Check if a result has an error and handle it consistently
 */
export function hasApiError(result) {
  return hasError(result);
}

/**
 * Extract data from API result, handling both success and error cases
 */
export function extractApiData(result, fallback = null) {
  return extractData(result, fallback);
}

/**
 * Handle API errors consistently across components
 */
export function handleApiError(result, defaultMessage = 'An error occurred') {
  if (hasError(result)) {
    console.error('API Error:', getError(result));
    return getError(result) || defaultMessage;
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

// Export individual API modules for focused imports
export const { folders, files, batches, items, workOrders, workflow, editor, validation } = filesApi;