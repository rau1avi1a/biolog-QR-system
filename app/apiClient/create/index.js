// app/apiClient/create/index.js
export function createOperations(apiManager, handleApiCall) {
    return {
      // === GENERIC CREATE ===
      async generic(resource, data) {
        return handleApiCall('create', resource, data, () => 
          apiManager.client(resource).create(data)
        )
      },
  
      // === FOLDER OPERATIONS ===
      async folder(name, parentId = null) {
        if (!name?.trim()) {
          return { data: null, error: 'Folder name is required' }
        }
        
        return handleApiCall('create', 'folder', { name, parentId }, () =>
          apiManager.client('folders').create({ name: name.trim(), parentId })
        )
      },
  
      // === FILE OPERATIONS ===
      async file(data) {
        return handleApiCall('create', 'file', data, () =>
          apiManager.client('files').create(data)
        )
      },
  
      // === BATCH OPERATIONS ===
      async batch(data) {
        if (!data.fileId) {
          return { data: null, error: 'fileId is required for batch creation' }
        }
        
        return handleApiCall('create', 'batch', data, () =>
          apiManager.client('batches').create(data)
        )
      },
  
      async batchFromFile(fileId, options = {}) {
        const data = { 
          fileId, 
          status: 'Draft',
          ...options 
        }
        
        return this.batch(data)
      },
  
      async batchFromEditor(originalFileId, editorData, action = 'save', confirmationData = null) {
        const data = {
          originalFileId,
          editorData,
          action,
          confirmationData,
          status: this._getStatusFromAction(action)
        }
        
        return handleApiCall('create', 'batch-from-editor', data, () =>
          apiManager.client('batches').create(data)
        )
      },
  
      // === ITEM OPERATIONS ===
      async item(data) {
        const required = ['itemType', 'sku', 'displayName']
        const missing = required.filter(field => !data[field])
        
        if (missing.length > 0) {
          return { data: null, error: `Missing required fields: ${missing.join(', ')}` }
        }
        
        return handleApiCall('create', 'item', data, () =>
          apiManager.client('items').create(data)
        )
      },
  
      async chemical(data) {
        return this.item({ ...data, itemType: 'chemical' })
      },
  
      async solution(data) {
        return this.item({ ...data, itemType: 'solution' })
      },
  
      async product(data) {
        return this.item({ ...data, itemType: 'product' })
      },
  
      // === TRANSACTION OPERATIONS ===
      async transaction(itemId, transactionData) {
        if (!itemId || !transactionData.qty) {
          return { data: null, error: 'itemId and qty are required for transactions' }
        }
        
        return handleApiCall('create', 'transaction', { itemId, ...transactionData }, () =>
          apiManager.client('items').custom('transactions', transactionData, 'POST')
        )
      },
  
      async inventoryAdjustment(itemId, adjustments) {
        if (!itemId || !Array.isArray(adjustments)) {
          return { data: null, error: 'itemId and adjustments array are required' }
        }
        
        return handleApiCall('create', 'inventory-adjustment', { itemId, adjustments }, () =>
          apiManager.client('items').custom('adjustment', { adjustments }, 'POST')
        )
      },
  
      // === NETSUITE OPERATIONS ===
      async netsuiteWorkOrder(data) {
        const required = data.batchId ? ['batchId', 'quantity'] : ['assemblyItemId', 'quantity']
        const missing = required.filter(field => !data[field])
        
        if (missing.length > 0) {
          return { data: null, error: `Missing required fields: ${missing.join(', ')}` }
        }
        
        return handleApiCall('create', 'netsuite-workorder', data, () =>
          apiManager.client('netsuite').custom('workorder', data, 'POST')
        )
      },
  
      async netsuiteWorkOrderFromBatch(batchId, quantity, options = {}) {
        return this.netsuiteWorkOrder({ batchId, quantity, ...options })
      },
  
      async netsuiteWorkOrderFromAssembly(assemblyItemId, quantity, options = {}) {
        return this.netsuiteWorkOrder({ assemblyItemId, quantity, ...options })
      },
  
      // === USER OPERATIONS ===
      async user(userData) {
        const required = ['name', 'email', 'password']
        const missing = required.filter(field => !userData[field])
        
        if (missing.length > 0) {
          return { data: null, error: `Missing required fields: ${missing.join(', ')}` }
        }
        
        return handleApiCall('create', 'user', userData, () =>
          apiManager.client('auth').custom('register', userData, 'POST')
        )
      },
  
      // === HELPER METHODS ===
      _getStatusFromAction(action) {
        const statusMap = {
          'save': 'In Progress',
          'submit_review': 'Review',
          'submit_final': 'Completed',
          'reject': 'In Progress',
          'create_work_order': 'In Progress',
          'complete': 'Completed'
        }
        return statusMap[action] || 'In Progress'
      }
    }
  }