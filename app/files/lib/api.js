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
  getFilesByStatus: (status) => fetch(`/api/batches?by-status=true&status=${encodeURIComponent(status)}`)
                               .then(r => r.json()),

  /* ── batches ────────────────────────── */
  listBatches: (status, fileId) =>
    fetch(
      `/api/batches?` +
      (status  ? `status=${encodeURIComponent(status)}` : '') +
      (fileId  ? `&fileId=${fileId}`                : '')
    ).then(r => r.json()),
    
  newBatch: (fileId, extra={}) =>
    fetch('/api/batches', {
      method:'POST',
      headers:{ 'Content-Type':'application/json'},
      body: JSON.stringify({ fileId, ...extra })
    }).then(r=>r.json()),
      
  getBatch      : (id) => fetch(`/api/batches/${id}`).then(r=>r.json()),
  updateBatch: (id, payload) =>
    fetch(`/api/batches/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json()),
  deleteBatch   : (id) => fetch(`/api/batches/${id}`, { method:'DELETE' })
                   .then(r=>r.json()),

  /* ── NEW: Save with different actions ─── */
  saveBatchFromEditor: (originalFileId, editorData, action = 'save') =>
    fetch('/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        originalFileId, 
        editorData,
        action, // 'save', 'submit_review', 'submit_final', 'reject'
        status: action === 'save' ? 'In Progress' : 
                action === 'submit_review' ? 'Review' :
                action === 'submit_final' ? 'Completed' :
                action === 'reject' ? 'In Progress' : 'In Progress'
      })
    }).then(r => r.json()),
};