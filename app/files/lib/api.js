// app/files/lib/api.js
export const api = {
    folders: (p) =>
      fetch(`/api/folders${p ? `?parentId=${p}` : ''}`).then((r) => r.json()),
  
    files: (f) =>
      fetch(`/api/files${f ? `?folderId=${f}` : ''}`).then((r) => r.json()),
  
    newFolder: (name, parentId) =>
      fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId })
      }).then((r) => r.json()),
  
    updateFolder: (id, name) =>
      fetch(`/api/folders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      }).then((r) => r.json()),
  
    deleteFolder: (id) =>
      fetch(`/api/folders/${id}`, { method: 'DELETE' }).then((r) => r.json()),
  
    upload: (file, folderId) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('fileName', file.name);
      if (folderId) fd.append('folderId', folderId);
      return fetch('/api/files', { method: 'POST', body: fd });
    },
  
    load: (id) => fetch(`/api/files?id=${id}`).then((r) => r.json()),
  
    getFilesByStatus: (status) =>
      fetch(`/api/files/status?status=${status}`).then((r) => r.json()),
  
    updateFileStatus: (id, status) =>
      fetch(`/api/files/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      }).then((r) => r.json()),
  
    saveVersion: (fileId, overlayPng, metadata = {}) =>
      fetch(`/api/files/${fileId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overlayPng, actor: 'user', metadata })
      }).then((r) => r.json())
  };
  