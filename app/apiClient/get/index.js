// app/apiClient/get/index.js
export function getOperations(apiManager, handleApiCall) {
    return {
      // === GENERIC GET ===
      async generic(resource, id, query = {}) {
        if (!id) {
          return { data: null, error: 'ID is required for get operation' }
        }
        
        return handleApiCall('get', resource, { id, ...query }, () =>
          apiManager.client(resource).get(id, query)
        )
      },
  
      // === FILE OPERATIONS ===
      async file(id, options = {}) {
        if (!id) {
          return { data: null, error: 'File ID is required' }
        }
        
        return handleApiCall('get', 'file', { id, ...options }, () =>
          apiManager.client('files').get(id, options)
        )
      },
  
      async fileWithPdf(id) {
        return this.file(id, { action: 'with-pdf' })
      },
  
      async fileWithBatches(id) {
        if (!id) {
          return { data: null, error: 'File ID is required' }
        }
        
        return handleApiCall('get', 'file-with-batches', { id }, () =>
          apiManager.client('files').get(id, { action: 'batches' })
        )
      },
  
      async fileStats(id) {
        if (!id) {
          return { data: null, error: 'File ID is required' }
        }
        
        return handleApiCall('get', 'file-stats', { id }, () =>
          apiManager.client('files').get(id, { action: 'stats' })
        )
      },
  
      // === FOLDER OPERATIONS ===
      async folder(id) {
        if (!id) {
          return { data: null, error: 'Folder ID is required' }
        }
        
        return handleApiCall('get', 'folder', { id }, () =>
          apiManager.client('folders').get(id)
        )
      },
  
      async folderTree(id) {
        if (!id) {
          return { data: null, error: 'Folder ID is required' }
        }
        
        return handleApiCall('get', 'folder-tree', { id }, () =>
          apiManager.client('folders').get(id, { action: 'tree' })
        )
      },
  
      async folderChildren(id) {
        if (!id) {
          return { data: null, error: 'Folder ID is required' }
        }
        
        return handleApiCall('get', 'folder-children', { id }, () =>
          apiManager.client('folders').get(id, { action: 'children' })
        )
      },
  
      // === BATCH OPERATIONS ===
      async batch(id) {
        if (!id) {
          return { data: null, error: 'Batch ID is required' }
        }
        
        return handleApiCall('get', 'batch', { id }, () =>
          apiManager.client('batches').get(id)
        )
      },
  
      async batchWithWorkOrder(id) {
        if (!id) {
          return { data: null, error: 'Batch ID is required' }
        }
        
        return handleApiCall('get', 'batch-workorder-status', { id }, () =>
          apiManager.client('batches').get(id, { action: 'workorder-status' })
        )
      },
  
      async batchWorkOrderStatus(id) {
        // Alias for batchWithWorkOrder for clarity
        return this.batchWithWorkOrder(id)
      },
  
      // === ITEM OPERATIONS ===
      async item(id) {
        if (!id) {
          return { data: null, error: 'Item ID is required' }
        }
        
        return handleApiCall('get', 'item', { id }, () =>
          apiManager.client('items').get(id)
        )
      },
  
      async itemWithLots(id) {
        if (!id) {
          return { data: null, error: 'Item ID is required' }
        }
        
        return handleApiCall('get', 'item-with-lots', { id }, () =>
          apiManager.client('items').get(id, { action: 'with-lots' })
        )
      },
  
      async itemLots(id, lotId = null) {
        if (!id) {
          return { data: null, error: 'Item ID is required' }
        }
        
        const params = { action: 'lots' }
        if (lotId) params.lotId = lotId
        
        return handleApiCall('get', 'item-lots', { id, lotId }, () =>
          apiManager.client('items').get(id, params)
        )
      },
  
      async itemTransactions(id, options = {}) {
        if (!id) {
          return { data: null, error: 'Item ID is required' }
        }
        
        const params = { action: 'transactions', ...options }
        
        return handleApiCall('get', 'item-transactions', { id, ...options }, () =>
          apiManager.client('items').get(id, params)
        )
      },
  
      async itemStats(id, startDate = null, endDate = null) {
        if (!id) {
          return { data: null, error: 'Item ID is required' }
        }
        
        const params = { action: 'stats' }
        if (startDate) params.startDate = startDate
        if (endDate) params.endDate = endDate
        
        return handleApiCall('get', 'item-stats', { id, startDate, endDate }, () =>
          apiManager.client('items').get(id, params)
        )
      },
  
      async itemVendors(id) {
        if (!id) {
          return { data: null, error: 'Item ID is required' }
        }
        
        return handleApiCall('get', 'item-vendors', { id }, () =>
          apiManager.client('items').get(id, { action: 'vendors' })
        )
      },
  
      // === VENDOR OPERATIONS ===
      async vendor(id) {
        if (!id) {
          return { data: null, error: 'Vendor ID is required' }
        }
        
        return handleApiCall('get', 'vendor', { id }, () =>
          apiManager.client('vendors').get(id)
        )
      },
  
      async vendorItems(id) {
        if (!id) {
          return { data: null, error: 'Vendor ID is required' }
        }
        
        return handleApiCall('get', 'vendor-items', { id }, () =>
          apiManager.client('vendors').get(id, { action: 'items' })
        )
      },
  
      // === USER OPERATIONS ===
      async user(id) {
        if (!id) {
          return { data: null, error: 'User ID is required' }
        }
        
        return handleApiCall('get', 'user', { id }, () =>
          apiManager.client('users').get(id)
        )
      },
  
      async currentUser() {
        return handleApiCall('get', 'current-user', {}, () =>
          apiManager.client('auth').custom('me', {}, 'GET')
        )
      },
  
      async allUsers() {
        return handleApiCall('get', 'all-users', {}, () =>
          apiManager.client('auth').custom('users', {}, 'GET')
        )
      },
  
      // === NETSUITE OPERATIONS ===
      async netsuiteHealth() {
        return handleApiCall('get', 'netsuite-health', {}, () =>
          apiManager.client('netsuite').custom('health', {}, 'GET')
        )
      },
  
      async netsuiteSetup() {
        return handleApiCall('get', 'netsuite-setup', {}, () =>
          apiManager.client('netsuite').custom('setup', {}, 'GET')
        )
      },
  
      async netsuiteWorkOrder(workOrderId) {
        if (!workOrderId) {
          return { data: null, error: 'Work order ID is required' }
        }
        
        try {
          const response = await fetch(`/api/netsuite?action=workorder&id=${workOrderId}`)
          if (!response.ok) throw new Error('Failed to get work order')
          const result = await response.json()
          return { data: result, error: null }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      async netsuiteWorkOrders(filters = {}) {
        try {
          const params = new URLSearchParams({ action: 'workorder', ...filters })
          const response = await fetch(`/api/netsuite?${params}`)
          if (!response.ok) throw new Error('Failed to list work orders')
          const result = await response.json()
          return { data: result, error: null }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      async netsuiteUnits(type = null) {
        try {
          const params = type ? `?action=units&type=${type}` : '?action=units'
          const response = await fetch(`/api/netsuite${params}`)
          if (!response.ok) throw new Error('Failed to get NetSuite units')
          const result = await response.json()
          return { data: result, error: null }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      async netsuiteUnit(unitId) {
        if (!unitId) {
          return { data: null, error: 'Unit ID is required' }
        }
        
        try {
          const response = await fetch(`/api/netsuite?action=units&id=${unitId}`)
          if (!response.ok) throw new Error('Failed to get NetSuite unit')
          const result = await response.json()
          return { data: result, error: null }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      async netsuiteMappings(itemId = null, netsuiteId = null) {
        const params = new URLSearchParams({ action: 'mapping' })
        if (itemId) params.append('itemId', itemId)
        if (netsuiteId) params.append('netsuiteId', netsuiteId)
        
        try {
          const response = await fetch(`/api/netsuite?${params}`)
          if (!response.ok) throw new Error('Failed to get mappings')
          const result = await response.json()
          return { data: result, error: null }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      // === ARCHIVE OPERATIONS ===
      async archivedFile(id) {
        if (!id) {
          return { data: null, error: 'Archived file ID is required' }
        }
        
        try {
          const response = await fetch(`/api/archive/files/${id}`)
          if (!response.ok) throw new Error('Failed to load archived file')
          const result = await response.json()
          return { data: result, error: null }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      // === TRANSACTION OPERATIONS ===
      async transaction(id) {
        if (!id) {
          return { data: null, error: 'Transaction ID is required' }
        }
        
        try {
          const response = await fetch(`/api/transactions?id=${id}`)
          if (!response.ok) throw new Error('Failed to fetch transaction')
          const result = await response.json()
          return { data: result, error: null }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      async lotTransactions(itemId, lotId, options = {}) {
        if (!itemId || !lotId) {
          return { data: null, error: 'Item ID and lot ID are required' }
        }
        
        const params = { action: 'transactions', lotId, ...options }
        
        return handleApiCall('get', 'lot-transactions', { itemId, lotId, ...options }, () =>
          apiManager.client('items').get(itemId, params)
        )
      },
  
      // === PURCHASE ORDER OPERATIONS ===
      async purchaseOrder(id) {
        if (!id) {
          return { data: null, error: 'Purchase order ID is required' }
        }
        
        return handleApiCall('get', 'purchase-order', { id }, () =>
          apiManager.client('purchaseOrders').get(id)
        )
      },
  
      // === CYCLE COUNT OPERATIONS ===
      async cycleCount(id) {
        if (!id) {
          return { data: null, error: 'Cycle count ID is required' }
        }
        
        return handleApiCall('get', 'cycle-count', { id }, () =>
          apiManager.client('cycleCounts').get(id)
        )
      },
  
      async activeCycleCount() {
        return handleApiCall('get', 'active-cycle-count', {}, () =>
          apiManager.client('cycleCounts').custom('active', {}, 'GET')
        )
      },
  
      // === CONVENIENCE METHODS ===
      
      // Get file and its batches in one call
      async fileWithRelatedData(id) {
        if (!id) {
          return { data: null, error: 'File ID is required' }
        }
        
        try {
          const [fileResult, batchesResult] = await Promise.all([
            this.file(id),
            this.fileWithBatches(id)
          ])
          
          if (fileResult.error) return fileResult
          if (batchesResult.error) return batchesResult
          
          return {
            data: {
              file: fileResult.data,
              batches: batchesResult.data.batches || []
            },
            error: null
          }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      // Get item with all related data
      async itemWithAllData(id) {
        if (!id) {
          return { data: null, error: 'Item ID is required' }
        }
        
        try {
          const [itemResult, lotsResult, vendorsResult, statsResult] = await Promise.all([
            this.item(id),
            this.itemLots(id),
            this.itemVendors(id),
            this.itemStats(id)
          ])
          
          if (itemResult.error) return itemResult
          
          return {
            data: {
              item: itemResult.data,
              lots: lotsResult.data?.lots || [],
              vendors: vendorsResult.data?.vendors || [],
              stats: statsResult.data?.stats || {}
            },
            error: null
          }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      // Get batch with complete workflow status
      async batchWithCompleteStatus(id) {
        if (!id) {
          return { data: null, error: 'Batch ID is required' }
        }
        
        try {
          const [batchResult, workOrderResult] = await Promise.all([
            this.batch(id),
            this.batchWithWorkOrder(id)
          ])
          
          if (batchResult.error) return batchResult
          
          return {
            data: {
              batch: batchResult.data,
              workOrderStatus: workOrderResult.data || {}
            },
            error: null
          }
        } catch (error) {
          return { data: null, error: error.message }
        }
      }
    }
  }