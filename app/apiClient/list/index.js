// app/apiClient/list/index.js
export function listOperations(apiManager, handleApiCall) {
    return {
      // === GENERIC LIST ===
      async generic(resource, query = {}) {
        return handleApiCall('list', resource, query, () =>
          apiManager.client(resource).list(query)
        )
      },
  
      // === FILE OPERATIONS ===
      async files(folderId = null) {
        const params = folderId ? { folderId } : {}
        
        return handleApiCall('list', 'files', params, () =>
          apiManager.client('files').list(params)
        )
      },
  
      async filesInFolder(folderId) {
        if (!folderId) {
          return { data: { files: [] }, error: null }
        }
        
        return this.files(folderId)
      },
  
      async rootFiles() {
        return this.files(null)
      },
  
      async searchFiles(query) {
        if (!query?.trim()) {
          return { data: { files: [] }, error: null }
        }
        
        return handleApiCall('list', 'search-files', { query }, () =>
          apiManager.client('files').list({ search: query.trim() })
        )
      },
  
      async filesByStatus(status) {
        if (!status) {
          return { data: null, error: 'Status is required' }
        }
        
        return handleApiCall('list', 'files-by-status', { status }, async () => {
          const result = await apiManager.client('batches').list({ status })
          return { files: result.success ? result.data : [] }
        })
      },
  
      // === FOLDER OPERATIONS ===
      async folders(parentId = null) {
        const params = parentId ? { parentId } : {}
        
        return handleApiCall('list', 'folders', params, () =>
          apiManager.client('folders').list(params)
        )
      },
  
      async foldersInParent(parentId) {
        if (!parentId) {
          return this.folders(null) // Root folders
        }
        
        return this.folders(parentId)
      },
  
      async rootFolders() {
        return this.folders(null)
      },
  
      async allFolders() {
        return handleApiCall('list', 'all-folders', {}, () =>
          apiManager.client('folders').list({})
        )
      },
  
      // === BATCH OPERATIONS ===
      async batches(options = {}) {
        return handleApiCall('list', 'batches', options, () =>
          apiManager.client('batches').list(options)
        )
      },
  
      async batchesByStatus(status) {
        if (!status) {
          return { data: null, error: 'Status is required' }
        }
        
        return handleApiCall('list', 'batches-by-status', { status }, () =>
          apiManager.client('batches').list({ status })
        )
      },
  
      async batchesByFile(fileId) {
        if (!fileId) {
          return { data: null, error: 'File ID is required' }
        }
        
        return handleApiCall('list', 'batches-by-file', { fileId }, () =>
          apiManager.client('batches').list({ fileId })
        )
      },
  
      async batchesInProgress() {
        return this.batchesByStatus('In Progress')
      },
  
      async batchesInReview() {
        return this.batchesByStatus('Review')
      },
  
      async completedBatches() {
        return this.batchesByStatus('Completed')
      },
  
      async recentBatches(limit = 10) {
        return handleApiCall('list', 'recent-batches', { limit }, () =>
          apiManager.client('batches').list({ 
            limit, 
            sort: 'createdAt',
            order: 'desc'
          })
        )
      },
  
      // === ITEM OPERATIONS ===
      async items(options = {}) {
        return handleApiCall('list', 'items', options, () =>
          apiManager.client('items').list(options)
        )
      },
  
      async itemsByType(type) {
        if (!type) {
          return { data: null, error: 'Item type is required' }
        }
        
        return handleApiCall('list', 'items-by-type', { type }, () =>
          apiManager.client('items').list({ type })
        )
      },
  
      async chemicals(options = {}) {
        return this.itemsByType('chemical')
      },
  
      async solutions(options = {}) {
        return this.itemsByType('solution')
      },
  
      async products(options = {}) {
        return this.itemsByType('product')
      },
  
      async searchItems(query, type = null) {
        if (!query?.trim()) {
          return { data: { items: [] }, error: null }
        }
        
        const params = { search: query.trim() }
        if (type) params.type = type
        
        return handleApiCall('list', 'search-items', params, () =>
          apiManager.client('items').list(params)
        )
      },
  
      async searchChemicals(query) {
        return this.searchItems(query, 'chemical')
      },
  
      async searchSolutions(query) {
        return this.searchItems(query, 'solution')
      },
  
      async searchProducts(query) {
        return this.searchItems(query, 'product')
      },
  
      async itemsWithLowStock(threshold = 10) {
        return handleApiCall('list', 'low-stock-items', { threshold }, () =>
          apiManager.client('items').list({ lowStock: threshold })
        )
      },
  
      async itemsByNetSuiteId(netsuiteId) {
        if (!netsuiteId) {
          return { data: null, error: 'NetSuite ID is required' }
        }
        
        return handleApiCall('list', 'items-by-netsuite-id', { netsuiteId }, () =>
          apiManager.client('items').list({ netsuiteId })
        )
      },
  
      // === TRANSACTION OPERATIONS ===
      async transactions(options = {}) {
        return handleApiCall('list', 'transactions', options, () =>
          apiManager.client('transactions').list(options)
        )
      },
  
      async transactionsByType(txnType) {
        if (!txnType) {
          return { data: null, error: 'Transaction type is required' }
        }
        
        return handleApiCall('list', 'transactions-by-type', { txnType }, () =>
          apiManager.client('transactions').list({ txnType })
        )
      },
  
      async transactionsByItem(itemId, options = {}) {
        if (!itemId) {
          return { data: null, error: 'Item ID is required' }
        }
        
        const params = { action: 'transactions', ...options }
        
        return handleApiCall('list', 'transactions-by-item', { itemId, ...options }, () =>
          apiManager.client('items').get(itemId, params)
        )
      },
  
      async recentTransactions(limit = 20) {
        return handleApiCall('list', 'recent-transactions', { limit }, () =>
          apiManager.client('transactions').list({ 
            limit,
            sort: 'postedAt',
            order: 'desc'
          })
        )
      },
  
      // === USER OPERATIONS ===
      async users() {
        return handleApiCall('list', 'users', {}, () =>
          apiManager.client('auth').custom('users', {}, 'GET')
        )
      },
  
      async usersByRole(role) {
        if (!role) {
          return { data: null, error: 'Role is required' }
        }
        
        return handleApiCall('list', 'users-by-role', { role }, () =>
          apiManager.client('users').list({ role })
        )
      },
  
      // === VENDOR OPERATIONS ===
      async vendors() {
        return handleApiCall('list', 'vendors', {}, () =>
          apiManager.client('vendors').list({})
        )
      },
  
      async vendorItems(vendorId) {
        if (!vendorId) {
          return { data: null, error: 'Vendor ID is required' }
        }
        
        return handleApiCall('list', 'vendor-items', { vendorId }, () =>
          apiManager.client('vendors').get(vendorId, { action: 'items' })
        )
      },
  
      async itemVendors(itemId) {
        if (!itemId) {
          return { data: null, error: 'Item ID is required' }
        }
        
        return handleApiCall('list', 'item-vendors', { itemId }, () =>
          apiManager.client('items').get(itemId, { action: 'vendors' })
        )
      },
  
      // === PURCHASE ORDER OPERATIONS ===
      async purchaseOrders(options = {}) {
        return handleApiCall('list', 'purchase-orders', options, () =>
          apiManager.client('purchaseOrders').list(options)
        )
      },
  
      async purchaseOrdersByStatus(status) {
        if (!status) {
          return { data: null, error: 'Status is required' }
        }
        
        return handleApiCall('list', 'purchase-orders-by-status', { status }, () =>
          apiManager.client('purchaseOrders').list({ status })
        )
      },
  
      async openPurchaseOrders() {
        return this.purchaseOrdersByStatus('open')
      },
  
      // === NETSUITE OPERATIONS ===
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
  
      async netsuiteWorkOrdersByStatus(status) {
        return this.netsuiteWorkOrders({ status })
      },
  
      async netsuiteWorkOrdersByAssembly(assemblyItem) {
        if (!assemblyItem) {
          return { data: null, error: 'Assembly item is required' }
        }
        
        return this.netsuiteWorkOrders({ assemblyItem })
      },
  
      async netsuiteMappedItems() {
        try {
          const response = await fetch('/api/netsuite?action=mapping')
          if (!response.ok) throw new Error('Failed to get mapped items')
          const result = await response.json()
          return { data: result, error: null }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      // === ARCHIVE OPERATIONS ===
      async archivedFiles() {
        try {
          const response = await fetch('/api/archive/files')
          if (!response.ok) throw new Error('Failed to fetch archived files')
          const result = await response.json()
          return { data: result, error: null }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      async archivedFilesByPath(folderPath) {
        if (!folderPath) {
          return { data: null, error: 'Folder path is required' }
        }
        
        try {
          const response = await fetch(`/api/archive/files?folderPath=${encodeURIComponent(folderPath)}`)
          if (!response.ok) throw new Error('Failed to fetch archived files')
          const result = await response.json()
          return { data: result, error: null }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      async archiveFolders() {
        try {
          const response = await fetch('/api/archive/folders')
          if (!response.ok) throw new Error('Failed to fetch archive folders')
          const result = await response.json()
          return { data: result, error: null }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      // === CYCLE COUNT OPERATIONS ===
      async cycleCounts() {
        return handleApiCall('list', 'cycle-counts', {}, () =>
          apiManager.client('cycleCounts').list({})
        )
      },
  
      async cycleCountHistory(limit = 10) {
        return handleApiCall('list', 'cycle-count-history', { limit }, () =>
          apiManager.client('cycleCounts').list({ 
            completed: true,
            limit,
            sort: 'completedAt',
            order: 'desc'
          })
        )
      },
  
      // === CONVENIENCE METHODS ===
      
      // Get all data for dashboard
      async dashboardData() {
        try {
          const [
            inProgressBatches,
            reviewBatches,
            recentFiles,
            lowStockItems,
            recentTransactions
          ] = await Promise.all([
            this.batchesInProgress(),
            this.batchesInReview(),
            this.files(),
            this.itemsWithLowStock(5),
            this.recentTransactions(10)
          ])
  
          return {
            data: {
              batches: {
                inProgress: inProgressBatches.data?.data || [],
                review: reviewBatches.data?.data || []
              },
              files: recentFiles.data?.files || [],
              lowStockItems: lowStockItems.data?.items || [],
              recentTransactions: recentTransactions.data?.transactions || []
            },
            error: null
          }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      // Get complete folder structure with files
      async folderStructure(rootId = null) {
        try {
          const [foldersResult, filesResult] = await Promise.all([
            this.folders(rootId),
            this.files(rootId)
          ])
  
          if (foldersResult.error) return foldersResult
          if (filesResult.error) return filesResult
  
          return {
            data: {
              folders: foldersResult.data?.folders || [],
              files: filesResult.data?.files || [],
              parentId: rootId
            },
            error: null
          }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      // Get inventory overview
      async inventoryOverview() {
        try {
          const [chemicals, solutions, products, lowStock, recentTxns] = await Promise.all([
            this.chemicals(),
            this.solutions(), 
            this.products(),
            this.itemsWithLowStock(10),
            this.recentTransactions(20)
          ])
  
          return {
            data: {
              inventory: {
                chemicals: chemicals.data?.items || [],
                solutions: solutions.data?.items || [],
                products: products.data?.items || []
              },
              alerts: {
                lowStock: lowStock.data?.items || []
              },
              activity: {
                recentTransactions: recentTxns.data?.transactions || []
              }
            },
            error: null
          }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      // Get workflow overview
      async workflowOverview() {
        try {
          const [inProgress, review, completed, recentBatches] = await Promise.all([
            this.batchesInProgress(),
            this.batchesInReview(),
            this.completedBatches(),
            this.recentBatches(15)
          ])
  
          return {
            data: {
              workflow: {
                inProgress: inProgress.data?.data || [],
                review: review.data?.data || [],
                completed: completed.data?.data || []
              },
              recent: recentBatches.data?.data || []
            },
            error: null
          }
        } catch (error) {
          return { data: null, error: error.message }
        }
      }
    }
  }