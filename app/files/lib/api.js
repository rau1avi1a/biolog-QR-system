// app/files/lib/api.js
export const api = {
  /* ── folders ────────────────────────── */
  folders       : (p) => fetch(`/api/folders${p?`?parentId=${p}`:''}`)
                         .then(r=>r.json()),
  newFolder     : (n,p) => fetch('/api/folders',{
                         method:'POST', headers:{'Content-Type':'application/json'},
                         body:JSON.stringify({ name:n, parentId:p })
                       }).then(r=>r.json()),
  updateFolder  : (id,n)=> fetch(`/api/folders/${id}`,{
                         method:'PATCH', headers:{'Content-Type':'application/json'},
                         body:JSON.stringify({ name:n })
                       }).then(r=>r.json()),
  deleteFolder  : (id)=> fetch(`/api/folders/${id}`,{ method:'DELETE' })
                       .then(r=>r.json()),

  /* ── files (mother) ─────────────────── */
  files            : (fId) => fetch(`/api/files${fId?`?folderId=${fId}`:''}`)
                             .then(r=>r.json()),
  load             : (id)   => fetch(`/api/files?id=${id}`).then(r=>r.json()),
  searchFiles      : (query) => {
    if (!query?.trim()) {
      return Promise.resolve({ files: [] });
    }
    return fetch(`/api/files?search=${encodeURIComponent(query.trim())}`)
           .then(r => r.json());
  },
  upload           : (file,fId)=>{
                       const fd=new FormData();
                       fd.append('file',file);
                       fd.append('fileName',file.name);
                       if(fId) fd.append('folderId',fId);
                       return fetch('/api/files',{method:'POST',body:fd});
                     },

  /* ── NEW: Batch upload with folder structure - ChatGPT's clean approach ─── */
  uploadBatch: async (fileDataArray, baseFolderId = null) => {
    console.log('API uploadBatch called with:', fileDataArray.length, 'files');
    
    const formData = new FormData();
    
    // Add base folder ID if provided
    if (baseFolderId) {
      formData.append('folderId', baseFolderId);
      console.log('Using base folder ID:', baseFolderId);
    }
    
    // Add each file with its relative path - keep it simple
    fileDataArray.forEach((fileData, index) => {
      const { file, relativePath } = fileData;
      
      console.log(`Adding file ${index}: ${file.name}, relativePath: ${relativePath}`);
      
      // Append the file directly 
      formData.append('files', file);
      
      // Also append the relativePath for this file
      formData.append(`relativePath_${index}`, relativePath);
    });

    const response = await fetch('/api/files/batch-upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Batch upload failed: ${response.status} ${response.statusText}. ${errorData.error || ''}`);
    }

    const result = await response.json();
    console.log('Upload response:', result);
    return result;
  },

  updateFileMeta   : (id,p)=> fetch(`/api/files/${id}`,{
                       method:'PATCH', headers:{'Content-Type':'application/json'},
                       body:JSON.stringify(p)
                     }).then(r=>r.json()),
  updateFileStatus : (id,s)=> fetch(`/api/files/${id}/status`,{
                       method:'PATCH', headers:{'Content-Type':'application/json'},
                       body:JSON.stringify({ status:s })
                     }).then(r=>r.json()),

  /* ── NEW: Get files by status (for Status and Archive tabs) ─── */
  getFilesByStatus: (status) => fetch(`/api/batches?status=${encodeURIComponent(status)}`)
                               .then(r => r.json())
                               .then(response => ({
                                 files: response.success ? response.data : []
                               })),

  /* ── batches with FIXED response handling ────────────────────────── */
  listBatches: async (status, fileId) => {
    try {
      const url = `/api/batches?` +
        (status  ? `status=${encodeURIComponent(status)}` : '') +
        (fileId  ? `&fileId=${fileId}` : '');
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  },
    
  // FIXED: Match your API response format { success: true, data: {...} }
  newBatch: async (fileId, extra = {}) => {
    try {
      const payload = { fileId, ...extra };
      
      const response = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      // FIXED: Return in the format your frontend expects
      return {
        success: data.success || true,
        data: data.success ? data.data : data,
        batch: data.success ? data.data : data
      };
      
    } catch (error) {
      throw error;
    }
  },
      
  // FIXED: Match your API response format
  getBatch: async (id) => {
    try {
      const response = await fetch(`/api/batches/${id}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      // FIXED: Return in the format your frontend expects
      return {
        success: data.success || true,
        data: data.success ? data.data : data,
        batch: data.success ? data.data : data
      };
    } catch (error) {
      throw error;
    }
  },

  // FIXED: Match your API response format
  updateBatch: async (id, payload) => {
    try {
      const response = await fetch(`/api/batches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      // FIXED: Return in the format your frontend expects
      return {
        success: data.success || true,
        data: data.success ? data.data : data,
        batch: data.success ? data.data : data
      };
    } catch (error) {
      throw error;
    }
  },

  deleteBatch: (id) => fetch(`/api/batches/${id}`, { method:'DELETE' })
                       .then(r=>r.json()),

  /* ── NEW: Save with different actions ─── */
/* ── Updated Save with confirmation data ─── */
/* ── NEW: Save with different actions and confirmation data ─── */
saveBatchFromEditor: async (originalFileId, editorData, action = 'save', confirmationData = null) => {
  try {
    const payload = { 
      originalFileId, 
      editorData,
      action,
      confirmationData, // Pass confirmation data to backend
      status: action === 'save' ? 'In Progress' : 
              action === 'submit_review' ? 'Review' :
              action === 'submit_final' ? 'Completed' :
              action === 'reject' ? 'In Progress' : 
              action === 'create_work_order' ? 'In Progress' : 
              action === 'complete' ? 'Completed' : 'In Progress'
    };

    const response = await fetch('/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    return {
      success: data.success || true,
      data: data.success ? data.data : data,
      batch: data.success ? data.data : data
    };

  } catch (error) {
    throw error;
  }
},

  /* ── NetSuite integration methods ─── */
  getAvailableLots: (itemId) =>
    fetch(`/api/items/${itemId}/lots`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch available lots');
        return r.json();
      })
      .then(response => ({
        lots: response.success ? response.lots : []
      })),

  createWorkOrder: (batchId, components) =>
    fetch('/api/netsuite/workorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchId, components })
    }).then(r => {
      if (!r.ok) throw new Error('Failed to create work order');
      return r.json();
    }),

  transactChemicals: (batchId, confirmedComponents) =>
    fetch('/api/netsuite/transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchId, components: confirmedComponents })
    }).then(r => {
      if (!r.ok) throw new Error('Failed to transact chemicals');
      return r.json();
    }),

  createSolution: (batchId, solutionData) =>
    fetch('/api/netsuite/solution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchId, ...solutionData })
    }).then(r => {
      if (!r.ok) throw new Error('Failed to create solution');
      return r.json();
    }),

  completeWorkOrder: (workOrderId) =>
    fetch(`/api/netsuite/workorder/${workOrderId}/complete`, {
      method: 'POST'
    }).then(r => {
      if (!r.ok) throw new Error('Failed to complete work order');
      return r.json();
    }),

  /* ── Enhanced Transaction Methods ─── */
  
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
  getLotTransactions: async (itemId, lotNumber, options = {}) => {
    const params = new URLSearchParams({ lotNumber });
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);
    
    const response = await fetch(`/api/items/${itemId}/lots/transactions?${params}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch lot transactions');
    }
    
    return response.json();
  },

  // Get transaction statistics for an item
  getItemTransactionStats: async (itemId, startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await fetch(`/api/items/${itemId}/transactions/stats?${params}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch transaction stats');
    }
    
    return response.json();
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

  /* ── ARCHIVE methods ────────────────────── */
  getArchiveFolders: () => 
    fetch('/api/archive/folders')
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch archive folders');
        return r.json();
      }),

  getAllArchivedFiles: () =>
    fetch('/api/archive/files')
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch archived files');
        return r.json();
      }),

  getArchivedFilesByPath: (folderPath) =>
    fetch(`/api/archive/files?folderPath=${encodeURIComponent(folderPath)}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch archived files');
        return r.json();
      }),

  loadArchivedFile: (id) => 
    fetch(`/api/archive/files/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load archived file');
        return r.json();
      }),

  /* ── Archive stats for folder view ─── */
  getArchiveStats: () =>
    fetch('/api/archive/stats')
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch archive stats');
        return r.json();
      }),
};