// app/apiClient/remove/index.js
export function removeOperations(apiManager, handleApiCall) {
    return {
      // === GENERIC REMOVE ===
      async generic(resource, id) {
        return handleApiCall('remove', resource, { id }, () => 
          apiManager.client(resource).remove(id)
        )
      },
  
      // === FILE OPERATIONS ===
      async file(id) {
        return handleApiCall('remove', 'file', { id }, () =>
          apiManager.client('files').remove(id)
        )
      },
  
      // === FOLDER OPERATIONS ===
      async folder(id) {
        return handleApiCall('remove', 'folder', { id }, () =>
          apiManager.client('folders').custom('delete', {}, 'POST', `?id=${id}`)
        )
      },
  
      async folderIfEmpty(id) {
        // Check if folder is empty first, then delete
        return handleApiCall('remove', 'folder-if-empty', { id }, async () => {
          const folderData = await apiManager.client('folders').get(id, { action: 'children' });
          if (folderData.subfolders?.length > 0 || folderData.files?.length > 0) {
            throw new Error('Cannot delete non-empty folder');
          }
          return apiManager.client('folders').custom('delete', {}, 'POST', `?id=${id}`);
        })
      },
  
      // === BATCH OPERATIONS ===
      async batch(id) {
        return handleApiCall('remove', 'batch', { id }, () =>
          apiManager.client('batches').remove(id)
        )
      },
  
      async batchWithValidation(id) {
        return handleApiCall('remove', 'batch-validated', { id }, async () => {
          // Get batch first to check if it can be deleted
          const batch = await apiManager.client('batches').get(id);
          if (batch.status === 'Completed') {
            throw new Error('Cannot delete completed batch');
          }
          return apiManager.client('batches').remove(id);
        })
      },
  
      // === ITEM OPERATIONS ===
      async item(id, options = {}) {
        const { force = false } = options;
        
        return handleApiCall('remove', 'item', { id, force }, () =>
          apiManager.client('items').remove(id)
        )
      },
  
      async itemWithForce(id) {
        return handleApiCall('remove', 'item-force', { id }, async () => {
          // Try normal delete first, then force if needed
          try {
            return await apiManager.client('items').remove(id);
          } catch (error) {
            if (error.message.includes('quantity') || error.message.includes('transactions')) {
              return await apiManager.client('items').remove(id, { force: true });
            }
            throw error;
          }
        })
      },
  
      async itemLot(itemId, lotId) {
        if (!itemId || !lotId) {
          return { data: null, error: 'Both itemId and lotId are required' };
        }
  
        return handleApiCall('remove', 'item-lot', { itemId, lotId }, () =>
          apiManager.client('items').custom('delete-lot', { lotId }, 'DELETE', `?id=${itemId}&lotId=${lotId}&action=lot`)
        )
      },
  
      // === CHEMICAL OPERATIONS ===
      async chemical(id, options = {}) {
        return this.item(id, options);
      },
  
      async solution(id, options = {}) {
        return this.item(id, options);
      },
  
      async product(id, options = {}) {
        return this.item(id, options);
      },
  
      // === USER OPERATIONS ===
      async user(id) {
        return handleApiCall('remove', 'user', { id }, () =>
          apiManager.client('auth').custom('delete-user', { userId: id }, 'DELETE')
        )
      },
  
      // === VENDOR OPERATIONS ===
      async vendor(id) {
        return handleApiCall('remove', 'vendor', { id }, () =>
          apiManager.client('vendors').remove(id)
        )
      },
  
      async vendorItem(vendorId, itemId) {
        if (!vendorId || !itemId) {
          return { data: null, error: 'Both vendorId and itemId are required' };
        }
  
        return handleApiCall('remove', 'vendor-item', { vendorId, itemId }, () =>
          apiManager.client('vendors').custom('unlink-item', { itemId }, 'DELETE', `?id=${vendorId}`)
        )
      },
  
      // === TRANSACTION OPERATIONS ===
      async transaction(txnId, reason = 'Manual reversal') {
        if (!txnId) {
          return { data: null, error: 'Transaction ID is required' };
        }
  
        return handleApiCall('remove', 'transaction', { txnId, reason }, () =>
          apiManager.client('items').custom('reverse-transaction', { txnId, reason }, 'POST')
        )
      },
  
      // === PURCHASE ORDER OPERATIONS ===
      async purchaseOrder(id) {
        return handleApiCall('remove', 'purchase-order', { id }, () =>
          apiManager.client('purchaseOrders').remove(id)
        )
      },
  
      // === CYCLE COUNT OPERATIONS ===
      async cycleCount(id) {
        return handleApiCall('remove', 'cycle-count', { id }, () =>
          apiManager.client('cycleCounts').remove(id)
        )
      },
  
      // === ARCHIVE OPERATIONS ===
      async archivedFile(id) {
        return handleApiCall('remove', 'archived-file', { id }, () =>
          apiManager.client('archive').remove(id)
        )
      },
  
      // === NETSUITE OPERATIONS ===
      async netsuiteWorkOrder(workOrderId, reason = 'Cancelled via API') {
        if (!workOrderId) {
          return { data: null, error: 'Work order ID is required' };
        }
  
        return handleApiCall('remove', 'netsuite-workorder', { workOrderId, reason }, () =>
          apiManager.client('netsuite').custom('cancel-workorder', { workOrderId, reason }, 'PATCH')
        )
      },
  
      async netsuiteMapping(itemId) {
        if (!itemId) {
          return { data: null, error: 'Item ID is required' };
        }
  
        return handleApiCall('remove', 'netsuite-mapping', { itemId }, () =>
          apiManager.client('items').update(itemId, { 
            netsuiteInternalId: null,
            netsuiteLastSync: null,
            netsuiteSyncStatus: 'pending'
          })
        )
      },
  
      // === BULK OPERATIONS ===
      async bulkItems(itemIds, options = {}) {
        if (!Array.isArray(itemIds) || itemIds.length === 0) {
          return { data: null, error: 'Array of item IDs is required' };
        }
  
        const { force = false, maxItems = 50 } = options;
        
        if (itemIds.length > maxItems) {
          return { data: null, error: `Cannot delete more than ${maxItems} items at once` };
        }
  
        return handleApiCall('remove', 'bulk-items', { count: itemIds.length, force }, async () => {
          const results = [];
          const errors = [];
  
          for (const itemId of itemIds) {
            try {
              const result = await apiManager.client('items').remove(itemId);
              results.push({ itemId, success: true, data: result });
            } catch (error) {
              if (force) {
                try {
                  const forceResult = await apiManager.client('items').remove(itemId, { force: true });
                  results.push({ itemId, success: true, data: forceResult, forced: true });
                } catch (forceError) {
                  errors.push({ itemId, error: forceError.message });
                }
              } else {
                errors.push({ itemId, error: error.message });
              }
            }
          }
  
          return {
            deleted: results.length,
            failed: errors.length,
            results,
            errors
          };
        })
      },
  
      async bulkBatches(batchIds, options = {}) {
        if (!Array.isArray(batchIds) || batchIds.length === 0) {
          return { data: null, error: 'Array of batch IDs is required' };
        }
  
        const { skipCompleted = true, maxBatches = 25 } = options;
        
        if (batchIds.length > maxBatches) {
          return { data: null, error: `Cannot delete more than ${maxBatches} batches at once` };
        }
  
        return handleApiCall('remove', 'bulk-batches', { count: batchIds.length }, async () => {
          const results = [];
          const errors = [];
          const skipped = [];
  
          for (const batchId of batchIds) {
            try {
              if (skipCompleted) {
                const batch = await apiManager.client('batches').get(batchId);
                if (batch.status === 'Completed') {
                  skipped.push({ batchId, reason: 'Batch is completed' });
                  continue;
                }
              }
  
              const result = await apiManager.client('batches').remove(batchId);
              results.push({ batchId, success: true, data: result });
            } catch (error) {
              errors.push({ batchId, error: error.message });
            }
          }
  
          return {
            deleted: results.length,
            failed: errors.length,
            skipped: skipped.length,
            results,
            errors,
            skipped
          };
        })
      },
  
      // === VALIDATION HELPERS ===
      async validateBeforeDelete(resource, id, options = {}) {
        return handleApiCall('validate', `${resource}-delete`, { id }, async () => {
          switch (resource) {
            case 'item':
              const item = await apiManager.client('items').get(id);
              return {
                canDelete: item.qtyOnHand === 0,
                warnings: item.qtyOnHand > 0 ? ['Item has quantity on hand'] : [],
                item
              };
  
            case 'folder':
              const folder = await apiManager.client('folders').get(id, { action: 'children' });
              const isEmpty = (folder.subfolders?.length || 0) === 0 && (folder.files?.length || 0) === 0;
              return {
                canDelete: isEmpty,
                warnings: !isEmpty ? ['Folder is not empty'] : [],
                folder
              };
  
            case 'batch':
              const batch = await apiManager.client('batches').get(id);
              return {
                canDelete: batch.status !== 'Completed',
                warnings: batch.status === 'Completed' ? ['Batch is completed'] : [],
                batch
              };
  
            default:
              return { canDelete: true, warnings: [] };
          }
        });
      }
    }
  }