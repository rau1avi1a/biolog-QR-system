// app/[id]/lib/client-api.js
// Client-side API methods for transaction operations

export const api = {
    // Get transactions for an item with enhanced filtering
    getItemTransactions: async (itemId, options = {}) => {
      const params = new URLSearchParams();
      if (options.txnType) params.append('type', options.txnType);
      if (options.startDate) params.append('startDate', options.startDate);
      if (options.endDate) params.append('endDate', options.endDate);
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.page) params.append('page', options.page.toString());
      
      const response = await fetch(`/api/items/${itemId}/transactions?${params}`, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch item transactions');
      }
      
      return response.json();
    },
  
    // Get lot-specific transaction history
    getItemTransactionStats: async (itemId, startDate, endDate) => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate)   params.append('endDate',   endDate);
  
      const res = await fetch(
        `/api/items/${itemId}/transactions/stats?${params}`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      if (!res.ok) throw new Error('Failed to fetch transaction stats');
      return res.json();  // { stats: [...] }
    },
  
    // Get lot-specific transaction history
    getLotTransactions: async (itemId, lotId, options = {}) => {
      const params = new URLSearchParams();
      if (options.startDate) params.append('startDate', options.startDate);
      if (options.endDate)   params.append('endDate',   options.endDate);
  
      const res = await fetch(
        `/api/items/${itemId}/lots/${lotId}/transactions?${params}`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      if (!res.ok) throw new Error('Failed to fetch lot transactions');
      return res.json();  // { success: true, transactions: [...] }
    },
  
    // Get detailed transaction by ID
    getTransactionDetails: async (txnId) => {
      const response = await fetch(`/api/transactions/${txnId}`, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch transaction details');
      }
      
      return response.json();
    },
  
    // Reverse a transaction (admin only)
    reverseTransaction: async (txnId, reason) => {
      const response = await fetch(`/api/transactions/${txnId}/reverse`, {
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
      const response = await fetch('/api/transactions/adjustment', {
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
  
    // Get available lots for an item (for dropdowns)
    getAvailableLots: async (itemId) => {
      const response = await fetch(`/api/items/${itemId}/lots`, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch available lots');
      }
      
      return response.json();
    },

    createLotTransaction: async (
      itemId,
      lotId,
      { qty, memo, project, department, batchId, workOrderId }
    ) => {
      const body = { qty, memo, project, department, batchId, workOrderId };
      const res = await fetch(`/api/items/${itemId}/lots/${lotId}/transactions`, {
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
  
  };