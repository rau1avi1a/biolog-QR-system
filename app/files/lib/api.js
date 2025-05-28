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
  upload           : (file,fId)=>{
                       const fd=new FormData();
                       fd.append('file',file);
                       fd.append('fileName',file.name);
                       if(fId) fd.append('folderId',fId);
                       return fetch('/api/files',{method:'POST',body:fd});
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
    console.log('API: listBatches called with:', { status, fileId });
    try {
      const url = `/api/batches?` +
        (status  ? `status=${encodeURIComponent(status)}` : '') +
        (fileId  ? `&fileId=${fileId}` : '');
      console.log('API: Making request to:', url);
      
      const response = await fetch(url);
      console.log('API: Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API: Response error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('API: listBatches response:', data);
      return data;
    } catch (error) {
      console.error('API: listBatches error:', error);
      throw error;
    }
  },
    
  // FIXED: Match your API response format { success: true, data: {...} }
  newBatch: async (fileId, extra = {}) => {
    console.log('API: newBatch called with:', { fileId, extra });
    
    try {
      const payload = { fileId, ...extra };
      console.log('API: newBatch payload:', JSON.stringify(payload, null, 2));
      
      const response = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      console.log('API: newBatch response status:', response.status);
      console.log('API: newBatch response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API: newBatch response error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('API: newBatch response data:', data);
      
      // FIXED: Return in the format your frontend expects
      return {
        batch: data.success ? data.data : data
      };
      
    } catch (error) {
      console.error('API: newBatch error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  },
      
  // FIXED: Match your API response format
  getBatch: async (id) => {
    console.log('API: getBatch called with id:', id);
    try {
      const response = await fetch(`/api/batches/${id}`);
      console.log('API: getBatch response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API: getBatch response error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('API: getBatch response:', data);
      
      // FIXED: Return in the format your frontend expects
      return {
        batch: data.success ? data.data : data
      };
    } catch (error) {
      console.error('API: getBatch error:', error);
      throw error;
    }
  },

  // FIXED: Match your API response format
  updateBatch: async (id, payload) => {
    console.log('API: updateBatch called with:', { id, payload });
    try {
      const response = await fetch(`/api/batches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      console.log('API: updateBatch response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API: updateBatch response error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('API: updateBatch response:', data);
      
      // FIXED: Return in the format your frontend expects
      return {
        batch: data.success ? data.data : data
      };
    } catch (error) {
      console.error('API: updateBatch error:', error);
      throw error;
    }
  },

  deleteBatch: (id) => fetch(`/api/batches/${id}`, { method:'DELETE' })
                       .then(r=>r.json()),

  /* ── NEW: Save with different actions ─── */
/* ── Updated Save with confirmation data ─── */
/* ── NEW: Save with different actions and confirmation data ─── */
saveBatchFromEditor: async (originalFileId, editorData, action = 'save', confirmationData = null) => {
  console.log('API: saveBatchFromEditor called with:', { 
    originalFileId, 
    editorData: editorData ? 'present' : 'missing', 
    action,
    confirmationData 
  });

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

    console.log('API: saveBatchFromEditor payload:', JSON.stringify(payload, null, 2));

    const response = await fetch('/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log('API: saveBatchFromEditor response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API: saveBatchFromEditor response error:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('API: saveBatchFromEditor response data:', data);

    return {
      batch: data.success ? data.data : data
    };

  } catch (error) {
    console.error('API: saveBatchFromEditor error:', error);
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