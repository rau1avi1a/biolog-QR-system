// app/apiClient/update/index.js
export function updateOperations(apiManager, handleApiCall) {
    return {
      // === GENERIC UPDATE ===
      async generic(resource, id, data) {
        return handleApiCall('update', resource, { id, ...data }, () =>
          apiManager.client(resource).update(id, data)
        )
      },
  
      // === FILE OPERATIONS ===
      async file(id, data) {
        if (!id) {
          return { data: null, error: 'File ID is required' }
        }
  
        return handleApiCall('update', 'file', { id, ...data }, () =>
          apiManager.client('files').update(id, data)
        )
      },
  
      async fileMeta(id, metadata) {
        if (!id) {
          return { data: null, error: 'File ID is required' }
        }
  
        return handleApiCall('update', 'file-meta', { id, ...metadata }, () =>
          apiManager.client('files').update(id, metadata)
        )
      },
  
      async fileComponents(id, components) {
        if (!id) {
          return { data: null, error: 'File ID is required' }
        }
  
        if (!Array.isArray(components)) {
          return { data: null, error: 'Components must be an array' }
        }
  
        return handleApiCall('update', 'file-components', { id, componentCount: components.length }, () =>
          apiManager.client('files').update(id, { components })
        )
      },
  
      async fileWithNetSuiteData(id, netsuiteData) {
        if (!id) {
          return { data: null, error: 'File ID is required' }
        }
  
        return handleApiCall('update', 'file-netsuite', { id }, () =>
          apiManager.client('files').update(id, { netsuiteImportData: netsuiteData })
        )
      },
  
      // === FOLDER OPERATIONS ===
      async folder(id, data) {
        if (!id) {
          return { data: null, error: 'Folder ID is required' }
        }
  
        return handleApiCall('update', 'folder', { id, ...data }, () =>
          apiManager.client('folders').update(id, data)
        )
      },
  
      async folderName(id, name) {
        if (!id) {
          return { data: null, error: 'Folder ID is required' }
        }
  
        if (!name?.trim()) {
          return { data: null, error: 'Folder name is required' }
        }
  
        return handleApiCall('update', 'folder-name', { id, name }, () =>
          apiManager.client('folders').update(id, { name: name.trim() })
        )
      },
  
      async moveFolder(id, newParentId = null) {
        if (!id) {
          return { data: null, error: 'Folder ID is required' }
        }
  
        return handleApiCall('update', 'move-folder', { id, newParentId }, () =>
          apiManager.client('folders').custom('move', { folderId: id, newParentId }, 'POST')
        )
      },
  
      // === BATCH OPERATIONS ===
      async batch(id, data) {
        if (!id) {
          return { data: null, error: 'Batch ID is required' }
        }
  
        return handleApiCall('update', 'batch', { id, ...data }, () =>
          apiManager.client('batches').update(id, data)
        )
      },
  
      async batchStatus(id, status) {
        if (!id) {
          return { data: null, error: 'Batch ID is required' }
        }
  
        if (!status) {
          return { data: null, error: 'Status is required' }
        }
  
        const validStatuses = ['Draft', 'In Progress', 'Review', 'Completed']
        if (!validStatuses.includes(status)) {
          return { data: null, error: `Status must be one of: ${validStatuses.join(', ')}` }
        }
  
        return handleApiCall('update', 'batch-status', { id, status }, () =>
          apiManager.client('batches').update(id, { status })
        )
      },
  
      async batchOverlay(id, overlayPng) {
        if (!id) {
          return { data: null, error: 'Batch ID is required' }
        }
  
        if (!overlayPng) {
          return { data: null, error: 'Overlay PNG data is required' }
        }
  
        return handleApiCall('update', 'batch-overlay', { id }, () =>
          apiManager.client('batches').update(id, { overlayPng })
        )
      },
  
      async batchComponents(id, confirmedComponents) {
        if (!id) {
          return { data: null, error: 'Batch ID is required' }
        }
  
        if (!Array.isArray(confirmedComponents)) {
          return { data: null, error: 'Confirmed components must be an array' }
        }
  
        return handleApiCall('update', 'batch-components', { id, componentCount: confirmedComponents.length }, () =>
          apiManager.client('batches').update(id, { confirmedComponents })
        )
      },
  
      async batchWorkOrder(id, workOrderData) {
        if (!id) {
          return { data: null, error: 'Batch ID is required' }
        }
  
        return handleApiCall('update', 'batch-workorder', { id }, () =>
          apiManager.client('batches').update(id, {
            workOrderCreated: true,
            workOrderStatus: 'created',
            workOrderCreatedAt: new Date(),
            ...workOrderData
          })
        )
      },
  
      async batchSolutionLot(id, solutionData) {
        if (!id) {
          return { data: null, error: 'Batch ID is required' }
        }
  
        const { solutionLotNumber, solutionQuantity, solutionUnit } = solutionData
  
        if (!solutionLotNumber) {
          return { data: null, error: 'Solution lot number is required' }
        }
  
        return handleApiCall('update', 'batch-solution', { id, solutionLotNumber }, () =>
          apiManager.client('batches').update(id, {
            solutionCreated: true,
            solutionLotNumber,
            solutionQuantity,
            solutionUnit,
            solutionCreatedDate: new Date()
          })
        )
      },
  
      // === ITEM OPERATIONS ===
      async item(id, data) {
        if (!id) {
          return { data: null, error: 'Item ID is required' }
        }
  
        return handleApiCall('update', 'item', { id, ...data }, () =>
          apiManager.client('items').update(id, data)
        )
      },
  
      async itemDetails(id, details) {
        if (!id) {
          return { data: null, error: 'Item ID is required' }
        }
  
        const allowedFields = ['displayName', 'description', 'cost', 'casNumber', 'location']
        const updateData = {}
        
        for (const field of allowedFields) {
          if (details[field] !== undefined) {
            updateData[field] = details[field]
          }
        }
  
        if (Object.keys(updateData).length === 0) {
          return { data: null, error: 'No valid fields to update' }
        }
  
        return handleApiCall('update', 'item-details', { id, fields: Object.keys(updateData) }, () =>
          apiManager.client('items').update(id, updateData)
        )
      },
  
      async itemNetSuiteData(id, netsuiteData) {
        if (!id) {
          return { data: null, error: 'Item ID is required' }
        }
  
        const { netsuiteInternalId, netsuiteSyncStatus = 'synced' } = netsuiteData
  
        return handleApiCall('update', 'item-netsuite', { id, netsuiteInternalId }, () =>
          apiManager.client('items').update(id, {
            netsuiteInternalId,
            netsuiteLastSync: new Date(),
            netsuiteSyncStatus
          })
        )
      },
  
      async itemQuantity(id, quantity) {
        if (!id) {
          return { data: null, error: 'Item ID is required' }
        }
  
        if (typeof quantity !== 'number' || quantity < 0) {
          return { data: null, error: 'Quantity must be a non-negative number' }
        }
  
        return handleApiCall('update', 'item-quantity', { id, quantity }, () =>
          apiManager.client('items').update(id, { qtyOnHand: quantity })
        )
      },
  
      async itemLot(itemId, lotId, lotData) {
        if (!itemId || !lotId) {
          return { data: null, error: 'Both item ID and lot ID are required' }
        }
  
        return handleApiCall('update', 'item-lot', { itemId, lotId }, () =>
          apiManager.client('items').custom('update-lot', { lotId, ...lotData }, 'PATCH', `?id=${itemId}`)
        )
      },
  
      // === CHEMICAL OPERATIONS ===
      async chemical(id, data) {
        return this.item(id, { ...data, itemType: 'chemical' })
      },
  
      async chemicalLocation(id, location) {
        return this.itemDetails(id, { location })
      },
  
      async chemicalCAS(id, casNumber) {
        return this.itemDetails(id, { casNumber })
      },
  
      // === SOLUTION OPERATIONS ===
      async solution(id, data) {
        return this.item(id, { ...data, itemType: 'solution' })
      },
  
      async solutionBOM(id, bom) {
        if (!id) {
          return { data: null, error: 'Solution ID is required' }
        }
  
        if (!Array.isArray(bom)) {
          return { data: null, error: 'BOM must be an array' }
        }
  
        return handleApiCall('update', 'solution-bom', { id, bomLength: bom.length }, () =>
          apiManager.client('items').update(id, { bom })
        )
      },
  
      // === PRODUCT OPERATIONS ===
      async product(id, data) {
        return this.item(id, { ...data, itemType: 'product' })
      },
  
      // === TRANSACTION OPERATIONS ===
      async transaction(id, data) {
        if (!id) {
          return { data: null, error: 'Transaction ID is required' }
        }
  
        return handleApiCall('update', 'transaction', { id, ...data }, () =>
          apiManager.client('transactions').update(id, data)
        )
      },
  
      async transactionStatus(id, status) {
        if (!id) {
          return { data: null, error: 'Transaction ID is required' }
        }
  
        const validStatuses = ['draft', 'posted', 'reversed', 'cancelled']
        if (!validStatuses.includes(status)) {
          return { data: null, error: `Status must be one of: ${validStatuses.join(', ')}` }
        }
  
        return handleApiCall('update', 'transaction-status', { id, status }, () =>
          apiManager.client('transactions').update(id, { status })
        )
      },
  
      // === USER OPERATIONS ===
      async user(id, data) {
        if (!id) {
          return { data: null, error: 'User ID is required' }
        }
  
        // Remove sensitive fields
        const { password, netsuiteCredentials, ...safeData } = data
  
        return handleApiCall('update', 'user', { id, ...safeData }, () =>
          apiManager.client('auth').custom('update-user', { userId: id, ...safeData }, 'PATCH')
        )
      },
  
      async userProfile(id, profileData) {
        if (!id) {
          return { data: null, error: 'User ID is required' }
        }
  
        const allowedFields = ['name', 'email', 'role']
        const updateData = {}
        
        for (const field of allowedFields) {
          if (profileData[field] !== undefined) {
            updateData[field] = profileData[field]
          }
        }
  
        return handleApiCall('update', 'user-profile', { id, fields: Object.keys(updateData) }, () =>
          apiManager.client('auth').custom('update-profile', { userId: id, ...updateData }, 'PATCH')
        )
      },
  
      async userNetSuiteCredentials(id, credentials) {
        if (!id) {
          return { data: null, error: 'User ID is required' }
        }
  
        return handleApiCall('update', 'user-netsuite', { id }, () =>
          apiManager.client('auth').custom('update-netsuite', { userId: id, credentials }, 'PATCH')
        )
      },
  
      // === VENDOR OPERATIONS ===
      async vendor(id, data) {
        if (!id) {
          return { data: null, error: 'Vendor ID is required' }
        }
  
        return handleApiCall('update', 'vendor', { id, ...data }, () =>
          apiManager.client('vendors').update(id, data)
        )
      },
  
      async vendorContact(id, contactData) {
        if (!id) {
          return { data: null, error: 'Vendor ID is required' }
        }
  
        const { name, phone, email, address } = contactData
  
        return handleApiCall('update', 'vendor-contact', { id }, () =>
          apiManager.client('vendors').update(id, { name, phone, email, address })
        )
      },
  
      async vendorItem(vendorId, itemId, data) {
        if (!vendorId || !itemId) {
          return { data: null, error: 'Both vendor ID and item ID are required' }
        }
  
        return handleApiCall('update', 'vendor-item', { vendorId, itemId }, () =>
          apiManager.client('vendors').custom('update-item', { itemId, ...data }, 'PATCH', `?id=${vendorId}`)
        )
      },
  
      async vendorItemPricing(vendorId, itemId, pricingData) {
        if (!vendorId || !itemId) {
          return { data: null, error: 'Both vendor ID and item ID are required' }
        }
  
        const { lastPrice, preferred, vendorSKU, leadTime, minimumOrderQty } = pricingData
  
        return this.vendorItem(vendorId, itemId, {
          lastPrice,
          preferred,
          vendorSKU,
          leadTime,
          minimumOrderQty
        })
      },
  
      // === PURCHASE ORDER OPERATIONS ===
      async purchaseOrder(id, data) {
        if (!id) {
          return { data: null, error: 'Purchase order ID is required' }
        }
  
        return handleApiCall('update', 'purchase-order', { id, ...data }, () =>
          apiManager.client('purchaseOrders').update(id, data)
        )
      },
  
      async purchaseOrderStatus(id, status) {
        if (!id) {
          return { data: null, error: 'Purchase order ID is required' }
        }
  
        const validStatuses = ['open', 'partial', 'received', 'closed']
        if (!validStatuses.includes(status)) {
          return { data: null, error: `Status must be one of: ${validStatuses.join(', ')}` }
        }
  
        return handleApiCall('update', 'purchase-order-status', { id, status }, () =>
          apiManager.client('purchaseOrders').update(id, { status })
        )
      },
  
      async purchaseOrderLines(id, lines) {
        if (!id) {
          return { data: null, error: 'Purchase order ID is required' }
        }
  
        if (!Array.isArray(lines)) {
          return { data: null, error: 'Lines must be an array' }
        }
  
        return handleApiCall('update', 'purchase-order-lines', { id, lineCount: lines.length }, () =>
          apiManager.client('purchaseOrders').update(id, { lines })
        )
      },
  
      // === NETSUITE OPERATIONS ===
      async netsuiteWorkOrder(workOrderId, data) {
        if (!workOrderId) {
          return { data: null, error: 'Work order ID is required' }
        }
  
        return handleApiCall('update', 'netsuite-workorder', { workOrderId }, () =>
          apiManager.client('netsuite').custom('update-workorder', { workOrderId, ...data }, 'PATCH')
        )
      },
  
      async netsuiteWorkOrderStatus(workOrderId, action, data = {}) {
        if (!workOrderId) {
          return { data: null, error: 'Work order ID is required' }
        }
  
        const validActions = ['complete', 'cancel', 'sync']
        if (!validActions.includes(action)) {
          return { data: null, error: `Action must be one of: ${validActions.join(', ')}` }
        }
  
        return handleApiCall('update', 'netsuite-workorder-status', { workOrderId, action }, () =>
          apiManager.client('netsuite').custom('workorder', { workOrderId, action, ...data }, 'PATCH')
        )
      },
  
      async netsuiteItemMapping(itemId, netsuiteItemId) {
        if (!itemId || !netsuiteItemId) {
          return { data: null, error: 'Both item ID and NetSuite item ID are required' }
        }
  
        return handleApiCall('update', 'netsuite-mapping', { itemId, netsuiteItemId }, () =>
          apiManager.client('netsuite').custom('sync', { itemId, netsuiteItemId }, 'POST')
        )
      },
  
      // === CYCLE COUNT OPERATIONS ===
      async cycleCount(id, data) {
        if (!id) {
          return { data: null, error: 'Cycle count ID is required' }
        }
  
        return handleApiCall('update', 'cycle-count', { id, ...data }, () =>
          apiManager.client('cycleCounts').update(id, data)
        )
      },
  
      async cycleCountQuantities(id, countUpdates) {
        if (!id) {
          return { data: null, error: 'Cycle count ID is required' }
        }
  
        if (!Array.isArray(countUpdates)) {
          return { data: null, error: 'Count updates must be an array' }
        }
  
        return handleApiCall('update', 'cycle-count-quantities', { id, updateCount: countUpdates.length }, () =>
          apiManager.client('cycleCounts').custom('update-counts', { countUpdates }, 'PATCH', `?id=${id}`)
        )
      },
  
      // === ARCHIVE OPERATIONS ===
      async archivedFile(id, data) {
        if (!id) {
          return { data: null, error: 'Archived file ID is required' }
        }
  
        return handleApiCall('update', 'archived-file', { id, ...data }, () =>
          apiManager.client('archive').update(id, data)
        )
      },
  
      async moveArchivedFile(id, targetFolderPath) {
        if (!id) {
          return { data: null, error: 'Archived file ID is required' }
        }
  
        return handleApiCall('update', 'move-archived-file', { id, targetFolderPath }, () =>
          apiManager.client('archive').custom('move', { fileId: id, targetFolderPath }, 'PATCH')
        )
      },
  
      // === BULK OPERATIONS ===
      async bulkItems(updates) {
        if (!Array.isArray(updates) || updates.length === 0) {
          return { data: null, error: 'Updates array is required' }
        }
  
        const maxUpdates = 50
        if (updates.length > maxUpdates) {
          return { data: null, error: `Cannot update more than ${maxUpdates} items at once` }
        }
  
        return handleApiCall('update', 'bulk-items', { count: updates.length }, async () => {
          const results = []
          const errors = []
  
          for (const update of updates) {
            try {
              const { id, data } = update
              if (!id) {
                errors.push({ update, error: 'Missing item ID' })
                continue
              }
  
              const result = await apiManager.client('items').update(id, data)
              results.push({ id, success: true, data: result })
            } catch (error) {
              errors.push({ update, error: error.message })
            }
          }
  
          return {
            updated: results.length,
            failed: errors.length,
            results,
            errors
          }
        })
      },
  
      async bulkBatchStatuses(statusUpdates) {
        if (!Array.isArray(statusUpdates) || statusUpdates.length === 0) {
          return { data: null, error: 'Status updates array is required' }
        }
  
        const maxUpdates = 25
        if (statusUpdates.length > maxUpdates) {
          return { data: null, error: `Cannot update more than ${maxUpdates} batches at once` }
        }
  
        return handleApiCall('update', 'bulk-batch-statuses', { count: statusUpdates.length }, async () => {
          const results = []
          const errors = []
  
          for (const update of statusUpdates) {
            try {
              const { id, status } = update
              if (!id || !status) {
                errors.push({ update, error: 'Missing batch ID or status' })
                continue
              }
  
              const result = await apiManager.client('batches').update(id, { status })
              results.push({ id, status, success: true, data: result })
            } catch (error) {
              errors.push({ update, error: error.message })
            }
          }
  
          return {
            updated: results.length,
            failed: errors.length,
            results,
            errors
          }
        })
      },
  
      // === WORKFLOW OPERATIONS ===
      async submitBatchForReview(id, confirmationData = {}) {
        if (!id) {
          return { data: null, error: 'Batch ID is required' }
        }
  
        return handleApiCall('update', 'submit-batch-review', { id }, () =>
          apiManager.client('batches').update(id, {
            status: 'Review',
            submittedForReviewAt: new Date(),
            ...confirmationData
          })
        )
      },
  
      async completeBatch(id, completionData = {}) {
        if (!id) {
          return { data: null, error: 'Batch ID is required' }
        }
  
        return handleApiCall('update', 'complete-batch', { id }, () =>
          apiManager.client('batches').update(id, {
            status: 'Completed',
            completedAt: new Date(),
            ...completionData
          })
        )
      },
  
      async rejectBatch(id, rejectionReason) {
        if (!id) {
          return { data: null, error: 'Batch ID is required' }
        }
  
        if (!rejectionReason?.trim()) {
          return { data: null, error: 'Rejection reason is required' }
        }
  
        return handleApiCall('update', 'reject-batch', { id, rejectionReason }, () =>
          apiManager.client('batches').update(id, {
            status: 'In Progress',
            wasRejected: true,
            rejectionReason: rejectionReason.trim(),
            rejectedAt: new Date()
          })
        )
      }
    }
  }