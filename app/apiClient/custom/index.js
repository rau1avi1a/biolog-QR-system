// app/apiClient/custom/index.js
export function customOperations(apiManager, handleApiCall) {
    return {
      // === GENERIC CUSTOM ===
      async generic(resource, action, data = {}, method = 'POST') {
        return handleApiCall('custom', `${resource}-${action}`, { action, ...data }, () =>
          apiManager.client(resource).custom(action, data, method)
        )
      },
  
      // === UPLOAD OPERATIONS ===
      async uploadFile(file, folderId = null, onProgress = null) {
        if (!file) {
          return { data: null, error: 'File is required for upload' }
        }
  
        const formData = new FormData()
        formData.append('file', file)
        formData.append('fileName', file.name)
        if (folderId) formData.append('folderId', folderId)
        
        try {
          let result
          if (onProgress) {
            result = await this._uploadWithProgress('/api/files', formData, onProgress)
          } else {
            const response = await fetch('/api/files', { method: 'POST', body: formData })
            if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`)
            result = await response.json()
          }
          
          return { data: result, error: null }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      async uploadBatch(fileDataArray, baseFolderId = null, onProgress = null) {
        if (!Array.isArray(fileDataArray) || fileDataArray.length === 0) {
          return { data: null, error: 'fileDataArray is required and must not be empty' }
        }
  
        const formData = new FormData()
        
        if (baseFolderId) formData.append('folderId', baseFolderId)
        
        fileDataArray.forEach((fileData, index) => {
          formData.append('files', fileData.file)
          formData.append(`relativePath_${index}`, fileData.relativePath || fileData.file.name)
        })
  
        try {
          let result
          if (onProgress) {
            result = await this._uploadWithProgress('/api/files?action=batch-upload', formData, onProgress)
          } else {
            const response = await fetch('/api/files?action=batch-upload', {
              method: 'POST',
              body: formData
            })
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}))
              throw new Error(`Batch upload failed: ${response.status} ${response.statusText}. ${errorData.error || ''}`)
            }
            result = await response.json()
          }
          
          return { data: result, error: null }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      async uploadFolder(files, baseFolderId = null, onProgress = null) {
        const fileDataArray = Array.from(files).map(file => ({
          file,
          relativePath: file.webkitRelativePath || file.name
        }))
        
        return this.uploadBatch(fileDataArray, baseFolderId, onProgress)
      },
  
      // === WORK ORDER OPERATIONS ===
      async retryWorkOrder(batchId, quantity) {
        if (!batchId || !quantity) {
          return { data: null, error: 'batchId and quantity are required' }
        }
        
        return handleApiCall('custom', 'workorder-retry', { batchId, quantity }, () =>
          apiManager.client('batches').custom('workorder-retry', { quantity })
        )
      },
  
      async getWorkOrderStatus(batchId) {
        if (!batchId) {
          return { data: null, error: 'batchId is required' }
        }
        
        return handleApiCall('custom', 'workorder-status', { batchId }, () =>
          apiManager.client('batches').get(batchId, { action: 'workorder-status' })
        )
      },
  
      async completeWorkOrder(workOrderId, quantityCompleted = null) {
        if (!workOrderId) {
          return { data: null, error: 'workOrderId is required' }
        }
        
        return handleApiCall('custom', 'complete-workorder', { workOrderId }, () =>
          apiManager.client('netsuite').custom('workorder', { 
            workOrderId, 
            action: 'complete', 
            quantityCompleted 
          }, 'PATCH')
        )
      },
  
      async cancelWorkOrder(workOrderId) {
        if (!workOrderId) {
          return { data: null, error: 'workOrderId is required' }
        }
        
        return handleApiCall('custom', 'cancel-workorder', { workOrderId }, () =>
          apiManager.client('netsuite').custom('workorder', { 
            workOrderId, 
            action: 'cancel'
          }, 'PATCH')
        )
      },
  
      // === NETSUITE OPERATIONS ===
      async testNetSuite() {
        return handleApiCall('custom', 'netsuite-test', {}, () =>
          apiManager.client('netsuite').custom('test', {}, 'GET')
        )
      },
  
      async getNetSuiteHealth() {
        return handleApiCall('custom', 'netsuite-health', {}, () =>
          apiManager.client('netsuite').custom('health', {}, 'GET')
        )
      },
  
      async getNetSuiteSetup() {
        return handleApiCall('custom', 'netsuite-setup', {}, () =>
          apiManager.client('netsuite').custom('setup', {}, 'GET')
        )
      },
  
      async setupNetSuite(credentials) {
        if (!credentials) {
          return { data: null, error: 'NetSuite credentials are required' }
        }
        
        return handleApiCall('custom', 'netsuite-setup', credentials, () =>
          apiManager.client('netsuite').custom('setup', credentials, 'POST')
        )
      },
  
      async searchNetSuiteItems(query) {
        if (!query?.trim()) {
          return { data: { items: [] }, error: null }
        }
        
        try {
          const response = await fetch(`/api/netsuite?action=search&q=${encodeURIComponent(query.trim())}`)
          if (!response.ok) throw new Error('Failed to search NetSuite items')
          const result = await response.json()
          return { data: result, error: null }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      async getNetSuiteBOM(assemblyItemId) {
        if (!assemblyItemId) {
          return { data: null, error: 'assemblyItemId is required' }
        }
        
        try {
          const response = await fetch(`/api/netsuite?action=getBOM&assemblyItemId=${assemblyItemId}`)
          if (!response.ok) throw new Error('Failed to fetch NetSuite BOM')
          const result = await response.json()
          return { data: result, error: null }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      async mapNetSuiteComponents(components) {
        if (!Array.isArray(components)) {
          return { data: null, error: 'components must be an array' }
        }
        
        return handleApiCall('custom', 'netsuite-mapping', { components }, () =>
          apiManager.client('netsuite').custom('mapping', { components }, 'POST')
        )
      },
  
      async importNetSuiteItems(netsuiteComponents, createMissing = false) {
        if (!Array.isArray(netsuiteComponents)) {
          return { data: null, error: 'netsuiteComponents must be an array' }
        }
        
        return handleApiCall('custom', 'netsuite-import', { netsuiteComponents, createMissing }, () =>
          apiManager.client('netsuite').custom('import', { netsuiteComponents, createMissing }, 'POST')
        )
      },
  
      async getNetSuiteUnits(type = null) {
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
  
      async getNetSuiteUnit(unitId) {
        if (!unitId) {
          return { data: null, error: 'unitId is required' }
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

            // === ASSEMBLY BUILD OPERATIONS ===
            async createAssemblyBuild(data) {
              const { 
                batchId, 
                workOrderInternalId, 
                quantityCompleted,
                actualComponents,
                completionDate,
                solutionUnit,
                solutionLotNumber
              } = data;
      
              if (!quantityCompleted || quantityCompleted <= 0) {
                return { data: null, error: 'Quantity completed is required and must be greater than 0' };
              }
      
              if (!batchId && !workOrderInternalId) {
                return { data: null, error: 'Either batchId or workOrderInternalId is required' };
              }
      
              return handleApiCall('custom', 'create-assembly-build', data, () =>
                apiManager.client('netsuite').custom('assemblybuild', {
                  batchId,
                  workOrderInternalId,
                  quantityCompleted,
                  actualComponents,
                  completionDate,
                  solutionUnit,
                  solutionLotNumber
                }, 'POST')
              );
            },
      
            async createAssemblyBuildFromBatch(batchId, submissionData) {
              if (!batchId) {
                return { data: null, error: 'batchId is required' };
              }
      
              const {
                solutionQuantity,
                solutionUnit = 'mL',
                confirmedComponents = [],
                solutionLotNumber
              } = submissionData;
      
              if (!solutionQuantity || solutionQuantity <= 0) {
                return { data: null, error: 'Solution quantity is required and must be greater than 0' };
              }
      
              return this.createAssemblyBuild({
                batchId,
                quantityCompleted: solutionQuantity,
                actualComponents: confirmedComponents,
                solutionUnit,
                solutionLotNumber
              });
            },
      
            async getAssemblyBuildStatus(assemblyBuildId) {
              if (!assemblyBuildId) {
                return { data: null, error: 'assemblyBuildId is required' };
              }
      
              try {
                const response = await fetch(`/api/netsuite?action=assemblybuild&id=${assemblyBuildId}`);
                if (!response.ok) throw new Error('Failed to get assembly build status');
                const result = await response.json();
                return { data: result, error: null };
              } catch (error) {
                return { data: null, error: error.message };
              }
            },
      
            async getAssemblyBuildsForWorkOrder(workOrderId) {
              if (!workOrderId) {
                return { data: null, error: 'workOrderId is required' };
              }
      
              try {
                const response = await fetch(`/api/netsuite?action=assemblybuild&workOrderId=${workOrderId}`);
                if (!response.ok) throw new Error('Failed to get assembly builds for work order');
                const result = await response.json();
                return { data: result, error: null };
              } catch (error) {
                return { data: null, error: error.message };
              }
            },
  
      // === INVENTORY OPERATIONS ===
      async getItemLots(itemId, lotId = null) {
        if (!itemId) {
          return { data: null, error: 'itemId is required' }
        }
        
        const params = { action: 'lots' }
        if (lotId) params.lotId = lotId
        
        return handleApiCall('custom', 'item-lots', { itemId, lotId }, () =>
          apiManager.client('items').get(itemId, params)
        )
      },
  
      async getItemTransactions(itemId, options = {}) {
        if (!itemId) {
          return { data: null, error: 'itemId is required' }
        }
        
        const params = { action: 'transactions', ...options }
        
        return handleApiCall('custom', 'item-transactions', { itemId, ...options }, () =>
          apiManager.client('items').get(itemId, params)
        )
      },
  
      async getItemTransactionStats(itemId, startDate = null, endDate = null) {
        if (!itemId) {
          return { data: null, error: 'itemId is required' }
        }
        
        const params = { action: 'stats' }
        if (startDate) params.startDate = startDate
        if (endDate) params.endDate = endDate
        
        return handleApiCall('custom', 'item-stats', { itemId, startDate, endDate }, () =>
          apiManager.client('items').get(itemId, params)
        )
      },
  
      async getLotTransactions(itemId, lotId, options = {}) {
        if (!itemId || !lotId) {
          return { data: null, error: 'itemId and lotId are required' }
        }
        
        const params = { action: 'transactions', lotId, ...options }
        
        return handleApiCall('custom', 'lot-transactions', { itemId, lotId, ...options }, () =>
          apiManager.client('items').get(itemId, params)
        )
      },
  
      // === FILE OPERATIONS ===
      async searchFiles(query) {
        if (!query?.trim()) {
          return { data: { files: [] }, error: null }
        }
        
        return handleApiCall('custom', 'search-files', { query }, () =>
          apiManager.client('files').list({ search: query.trim() })
        )
      },
  
      async downloadFile(fileId) {
        if (!fileId) {
          return { data: null, error: 'fileId is required' }
        }
        
        try {
          // This returns the actual download URL or triggers download
          window.open(`/api/files?id=${fileId}&action=download`)
          return { data: { downloaded: true }, error: null }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      // === ARCHIVE OPERATIONS ===
      async getArchiveFolders() {
        try {
          const response = await fetch('/api/archive/folders')
          if (!response.ok) throw new Error('Failed to fetch archive folders')
          const result = await response.json()
          return { data: result, error: null }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      async getAllArchivedFiles() {
        try {
          const response = await fetch('/api/archive/files')
          if (!response.ok) throw new Error('Failed to fetch archived files')
          const result = await response.json()
          return { data: result, error: null }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      async getArchivedFilesByPath(folderPath) {
        if (!folderPath) {
          return { data: null, error: 'folderPath is required' }
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
  
      async getArchiveStats() {
        try {
          const response = await fetch('/api/archive/stats')
          if (!response.ok) throw new Error('Failed to fetch archive stats')
          const result = await response.json()
          return { data: result, error: null }
        } catch (error) {
          return { data: null, error: error.message }
        }
      },
  
      // === AUTHENTICATION OPERATIONS ===
      async login(email, password) {
        if (!email || !password) {
          return { data: null, error: 'Email and password are required' }
        }
        
        return handleApiCall('custom', 'auth-login', { email }, () =>
          apiManager.client('auth').custom('login', { email, password }, 'POST')
        )
      },
  
      async logout() {
        return handleApiCall('custom', 'auth-logout', {}, () =>
          apiManager.client('auth').custom('logout', {}, 'POST')
        )
      },
  
      async getCurrentUser() {
        return handleApiCall('custom', 'auth-me', {}, () =>
          apiManager.client('auth').custom('me', {}, 'GET')
        )
      },
  
      // === HELPER METHODS ===
      async _uploadWithProgress(url, formData, onProgress) {
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const progress = (e.loaded / e.total) * 100
              onProgress?.(progress)
            }
          })
          
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText))
              } catch {
                resolve({ success: true })
              }
            } else {
              reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`))
            }
          })
          
          xhr.addEventListener('error', () => reject(new Error('Upload failed')))
          xhr.addEventListener('timeout', () => reject(new Error('Upload timed out')))
          
          xhr.open('POST', url)
          xhr.timeout = 300000 // 5 minutes
          xhr.send(formData)
        })
      },
  
      // === BATCH WORKFLOW OPERATIONS ===
      async saveBatchFromEditor(originalFileId, editorData, action = 'save', confirmationData = null) {
        if (!originalFileId || !editorData) {
          return { data: null, error: 'originalFileId and editorData are required' }
        }
        
        const payload = {
          originalFileId,
          editorData,
          action,
          confirmationData
        }
        
        return handleApiCall('custom', 'batch-from-editor', payload, () =>
          apiManager.client('batches').create(payload)
        )
      }
    }
  }