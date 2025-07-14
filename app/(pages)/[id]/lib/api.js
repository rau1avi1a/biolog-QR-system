// app/(pages)/[id]/lib/api.js - Items/Lots API Client

import { api, hasError, extractData, getError } from '@/app/apiClient'

/**
 * Items/Lots Page API Client
 * 
 * Following the same pattern as the files API for consistency
 */

// Helper function to handle API calls with proper error handling
async function handleApiCall(operation, apiCall) {
  try {
    console.log(`🚀 API Call: ${operation}`);
    const result = await apiCall();
    
    // Return the result as-is, don't extract data here
    return result;
    
  } catch (error) {
    console.error(`💥 API Exception: ${operation}`, error);
    return { 
      data: null, 
      error: error.message || 'An error occurred' 
    };
  }
}

export const itemsApi = {
  // === ITEM OPERATIONS ===
  items: {
    async get(id) {
      return handleApiCall('items.get', async () => {
        return await api.get.item(id);
      });
    },

    async getWithLots(id) {
      return handleApiCall('items.getWithLots', async () => {
        return await api.get.itemWithLots(id);
      });
    },

    async search(query, type = null) {
      return handleApiCall('items.search', async () => {
        return await api.list.searchItems(query, type);
      });
    },

    async searchSolutions(query) {
      return handleApiCall('items.searchSolutions', async () => {
        return await api.list.searchSolutions(query);
      });
    },

    async update(id, data) {
      return handleApiCall('items.update', async () => {
        return await api.update.item(id, data);
      });
    },

    async updateDetails(id, details) {
      return handleApiCall('items.updateDetails', async () => {
        return await api.update.itemDetails(id, details);
      });
    }
  },

  // === TRANSACTION OPERATIONS ===
  transactions: {
    async getForItem(itemId, options = {}) {
      return handleApiCall('transactions.getForItem', async () => {
        return await api.get.itemTransactions(itemId, options);
      });
    },

    async getForLot(itemId, lotId, options = {}) {
      return handleApiCall('transactions.getForLot', async () => {
        return await api.get.lotTransactions(itemId, lotId, options);
      });
    },

    async getDetails(txnId) {
      return handleApiCall('transactions.getDetails', async () => {
        return await api.get.transaction(txnId);
      });
    },

    async reverse(txnId, reason) {
      return handleApiCall('transactions.reverse', async () => {
        return await api.remove.transaction(txnId, reason);
      });
    },

    async create(itemId, transactionData) {
      return handleApiCall('transactions.create', async () => {
        return await api.create.transaction(itemId, transactionData);
      });
    },

    async createInventoryAdjustment(itemId, adjustments) {
      return handleApiCall('transactions.createInventoryAdjustment', async () => {
        return await api.create.inventoryAdjustment(itemId, adjustments);
      });
    }
  },

  // === LOT OPERATIONS ===
  lots: {
    async getForItem(itemId, lotId = null) {
      return handleApiCall('lots.getForItem', async () => {
        return await api.get.itemLots(itemId, lotId);
      });
    },

    async update(itemId, lotId, lotData) {
      return handleApiCall('lots.update', async () => {
        return await api.update.itemLot(itemId, lotId, lotData);
      });
    },

    async delete(itemId, lotId) {
      return handleApiCall('lots.delete', async () => {
        return await api.remove.itemLot(itemId, lotId);
      });
    },

    async getTransactions(itemId, lotId, options = {}) {
      return handleApiCall('lots.getTransactions', async () => {
        return await api.custom.getLotTransactions(itemId, lotId, options);
      });
    }
  },

  // === STATS OPERATIONS ===
  stats: {
    async getForItem(itemId, startDate = null, endDate = null) {
      return handleApiCall('stats.getForItem', async () => {
        return await api.get.itemStats(itemId, startDate, endDate);
      });
    },

    async getTransactionStats(itemId, startDate = null, endDate = null) {
      return handleApiCall('stats.getTransactionStats', async () => {
        return await api.custom.getItemTransactionStats(itemId, startDate, endDate);
      });
    }
  },

  // === DELETE OPERATIONS ===
  async deleteItem(itemId, force = false) {
    return handleApiCall('items.delete', async () => {
      if (force) {
        return await api.remove.itemWithForce(itemId);
      } else {
        return await api.remove.item(itemId);
      }
    });
  },

  async deleteLot(itemId, lotId) {
    return handleApiCall('lots.delete', async () => {
      return await api.remove.itemLot(itemId, lotId);
    });
  },

  // === CONVENIENCE METHODS ===
  
  // Get enhanced transaction data for items
  async getItemTransactions(itemId, options = {}) {
    return handleApiCall('items.getItemTransactions', async () => {
      const result = await api.custom.getItemTransactions(itemId, options);
      
      if (hasError(result)) {
        throw new Error(getError(result));
      }
      
      return result;
    });
  },

  // Get transaction statistics for items
  async getItemTransactionStats(itemId, startDate = null, endDate = null) {
    return handleApiCall('items.getItemTransactionStats', async () => {
      const result = await api.custom.getItemTransactionStats(itemId, startDate, endDate);
      
      if (hasError(result)) {
        throw new Error(getError(result));
      }
      
      return result;
    });
  },

  // Get lot-specific transaction history
  async getLotTransactions(itemId, lotNumber, options = {}) {
    return handleApiCall('lots.getLotTransactions', async () => {
      const params = new URLSearchParams({
        id: itemId,
        action: 'transactions',
        lotNumber: lotNumber
      });
      
      if (options.startDate) params.append('startDate', options.startDate);
      if (options.endDate) params.append('endDate', options.endDate);
      if (options.limit) params.append('limit', options.limit.toString());

      const response = await fetch(`/api/items?${params}`, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch lot transactions');
      }
      
      return response.json();
    });
  },

  // Get item or lot by ID (for the dynamic route)
  async getItemOrLot(id) {
    return handleApiCall('items.getItemOrLot', async () => {
      try {
        // Try to get it as an item first
        const itemResult = await api.get.item(id);
        
        if (!hasError(itemResult)) {
          const itemData = extractData(itemResult);
          
          // Also get the lots for this item
          const lotsResult = await api.get.itemLots(id);
          const lots = hasError(lotsResult) ? [] : extractData(lotsResult)?.lots || [];
          
          return {
            data: {
              type: 'item',
              data: {
                ...itemData,
                lots: lots
              }
            },
            error: null
          };
        }
        
        // If not found as item, try to find it as a lot
        // This would require a different API call to search for lots by ID
        // For now, we'll return not found
        return {
          data: { type: null, data: null },
          error: null
        };
        
      } catch (error) {
        return {
          data: { type: null, data: null },
          error: error.message
        };
      }
    });
  },

  // Get transaction history for either items or lots
  async getTransactionHistory(itemId, lotNumber = null) {
    if (lotNumber) {
      return this.getLotTransactions(itemId, lotNumber);
    } else {
      return this.getItemTransactions(itemId);
    }
  }
};

// === CONVENIENCE FUNCTIONS (aligned with files API pattern) ===

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
 * Normalize item data for consistent handling in components
 */
export function normalizeItemData(item) {
  if (!item) return null;
  
  return {
    id: item._id,
    displayName: item.displayName || 'Unnamed Item',
    sku: item.sku || '',
    itemType: item.itemType || 'product',
    qtyOnHand: Number(item.qtyOnHand) || 0,
    uom: item.uom || 'ea',
    cost: Number(item.cost) || 0,
    location: item.location || '',
    description: item.description || '',
    casNumber: item.casNumber || '',
    lotTracked: Boolean(item.lotTracked),
    bom: item.bom || [],
    lots: item.lots || [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    // Include all original properties
    ...item
  };
}

/**
 * Normalize lot data for consistent handling in components
 */
export function normalizeLotData(lot, parentItem = null) {
  if (!lot) return null;
  
  return {
    id: lot._id,
    lotNumber: lot.lotNumber || '',
    quantity: Number(lot.quantity) || 0,
    qrCodeUrl: lot.qrCodeUrl || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/${lot._id}`,
    parentItem: parentItem ? normalizeItemData(parentItem) : null,
    createdAt: lot.createdAt,
    updatedAt: lot.updatedAt,
    // Include all original properties
    ...lot
  };
}

/**
 * Format transaction data for display in components
 */
export function normalizeTransactionData(transaction) {
  if (!transaction) return null;
  
  return {
    id: transaction._id,
    txnType: transaction.txnType || '',
    status: transaction.status || 'posted',
    memo: transaction.memo || '',
    reason: transaction.reason || '',
    postedAt: transaction.postedAt,
    effectiveDate: transaction.effectiveDate,
    createdBy: transaction.createdBy || {},
    lines: (transaction.lines || []).map(line => ({
      item: line.item,
      lot: line.lot || '',
      qty: Number(line.qty) || 0,
      unitCost: Number(line.unitCost) || 0,
      totalValue: Number(line.totalValue) || 0,
      itemQtyBefore: Number(line.itemQtyBefore) || 0,
      itemQtyAfter: Number(line.itemQtyAfter) || 0,
      lotQtyBefore: Number(line.lotQtyBefore) || 0,
      lotQtyAfter: Number(line.lotQtyAfter) || 0,
      notes: line.notes || '',
      ...line
    })),
    // Include all original properties
    ...transaction
  };
}

// Export individual API modules for focused imports
export const { items, transactions, lots, stats } = itemsApi;