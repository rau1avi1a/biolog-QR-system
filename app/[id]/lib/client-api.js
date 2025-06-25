// app/[id]/lib/client-api.js
// Client-side API methods that match your actual API structure

export const api = {
  // Get transactions for an item with enhanced filtering
  getItemTransactions: async (itemId, options = {}) => {
    const params = new URLSearchParams({
      id: itemId,
      action: 'transactions'
    });
    
    if (options.txnType) params.append('type', options.txnType);
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.page) params.append('page', options.page.toString());
    
    const response = await fetch(`/api/items?${params}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch item transactions');
    }
    
    return response.json(); // Returns { success: true, transactions: [...] }
  },

  // Get item transaction stats
  getItemTransactionStats: async (itemId, startDate, endDate) => {
    const params = new URLSearchParams({
      id: itemId,
      action: 'stats'
    });
    
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const res = await fetch(`/api/items?${params}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!res.ok) throw new Error('Failed to fetch transaction stats');
    return res.json();  // { stats: [...] }
  },

  // Get lot-specific transaction history
  getLotTransactions: async (itemId, lotId, options = {}) => {
    const params = new URLSearchParams({
      id: itemId,
      action: 'transactions',
      lotId: lotId
    });
    
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);

    const res = await fetch(`/api/items?${params}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!res.ok) throw new Error('Failed to fetch lot transactions');
    return res.json();  // { success: true, transactions: [...] }
  },

  // Get detailed transaction by ID (you'll need to implement this endpoint)
  getTransactionDetails: async (txnId) => {
    const response = await fetch(`/api/transactions?id=${txnId}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch transaction details');
    }
    
    return response.json();
  },

  // Reverse a transaction (admin only) - you'll need to implement this endpoint
  reverseTransaction: async (txnId, reason) => {
    const response = await fetch(`/api/transactions?id=${txnId}&action=reverse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    
    if (!response.ok) {
      throw new Error('Failed to reverse transaction');
    }
    
    return response.json();
  },

  // Create inventory adjustment transaction
  createInventoryAdjustment: async (itemId, adjustments) => {
    const response = await fetch('/api/transactions?action=adjustment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId,
        adjustments // Array of { lotNumber, qtyChange, reason, notes }
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to create inventory adjustment');
    }
    
    return response.json();
  },

  // Get available lots for an item
  getAvailableLots: async (itemId) => {
    const response = await fetch(`/api/items?id=${itemId}&action=lots`, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch available lots');
    }
    
    return response.json(); // Returns { success: true, lots: [...] }
  },

  // Create a lot transaction
  createLotTransaction: async (
    itemId,
    lotId,
    { qty, memo, project, department, batchId, workOrderId }
  ) => {
    const body = { qty, memo, project, department, batchId, workOrderId };
    const res = await fetch(`/api/items?id=${itemId}&action=transactions&lotId=${lotId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to create lot transaction");
    }
    
    return res.json(); // { item: {…}, transaction: {…} }
  },

  // Delete a lot
  deleteLot: async (itemId, lotId) => {
    const response = await fetch(`/api/items?id=${itemId}&lotId=${lotId}&action=lot`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to delete lot' }));
      throw new Error(error.error || 'Failed to delete lot');
    }
    
    return response.json();
  },

  // Delete an item
  deleteItem: async (itemId, forceDelete = false) => {
    const response = await fetch(`/api/items?id=${itemId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: forceDelete })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to delete item' }));
      throw new Error(error.error || 'Failed to delete item');
    }
    
    return response.json();
  }
};