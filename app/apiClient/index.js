// app/apiClient/index.js - Unified Frontend API Client
import { apiClient, useApi } from '@/app/api'

/**
 * Unified Frontend API Client
 * 
 * This provides a consistent interface to all backend API operations with:
 * - Lazy loading of operations (only loads what you use)
 * - Response normalization (handles { success, data } vs direct responses)
 * - Consistent error handling
 * - Development logging for debugging
 * 
 * USAGE PATTERNS:
 * 
 * 1. OPERATION-BASED USAGE (Recommended):
 *    import { api } from '@/app/apiClient'
 *    
 *    // List operations
 *    const files = await api.list.files('folder123')
 *    const batches = await api.list.batchesByStatus('Review')
 *    
 *    // Create operations  
 *    const batch = await api.create.batch({ fileId: 'file123' })
 *    const folder = await api.create.folder('New Folder', 'parent123')
 *    
 *    // Get operations
 *    const file = await api.get.file('file123')
 *    const batchWithStatus = await api.get.batchWithWorkOrder('batch123')
 *    
 *    // Update operations
 *    const updated = await api.update.batch('batch123', { status: 'Completed' })
 *    
 *    // Custom operations
 *    await api.custom.uploadFile(file, folderId, onProgress)
 *    const bom = await api.custom.getNetSuiteBOM('assembly123')
 * 
 * 2. DIRECT CLIENT ACCESS (For standard CRUD):
 *    import { api } from '@/app/apiClient'
 *    
 *    // Direct access to unified backend client
 *    const files = await api.files.list({ folderId: 'folder123' })
 *    const batch = await api.batches.get('batch123')
 *    const items = await api.items.list({ type: 'chemical' })
 * 
 * 3. REACT HOOKS (In components):
 *    import { useApi } from '@/app/apiClient'
 *    
 *    function MyComponent() {
 *      const filesApi = useApi('files')
 *      const { data } = useQuery(['files'], () => filesApi.list())
 *      return <div>{data?.files?.map(...)}</div>
 *    }
 * 
 * ERROR HANDLING:
 * - All operations return { data, error } objects
 * - On success: { data: responseData, error: null }
 * - On failure: { data: null, error: 'Error message' }
 * - Components should check result.error before using result.data
 * 
 * RESPONSE NORMALIZATION:
 * - Backend sometimes returns { success: true, data: [...] }
 * - Backend sometimes returns data directly
 * - This client normalizes both to consistent { data, error } format
 * 
 * DEVELOPMENT LOGGING:
 * - Concise logs in development only
 * - Format: "🔍 [operation] [resource] [key params]"
 * - Results: "✅ [operation] success" or "❌ [operation] failed: [error]"
 */

const isDev = process.env.NODE_ENV === 'development'

// Response normalization helper
function normalizeResponse(response) {
  // Handle { success: true, data: [...] } format
  if (typeof response === 'object' && response !== null) {
    if (response.success !== undefined) {
      return response.data || response
    }
    // Handle direct data responses
    return response
  }
  return response
}

// Error handling wrapper
async function handleApiCall(operation, resource, params, apiCall) {
  try {
    if (isDev) {
      const paramStr = params ? ` (${Object.keys(params).join(', ')})` : ''
      console.log(`🔍 ${operation} ${resource}${paramStr}`)
    }
    
    const response = await apiCall()
    const data = normalizeResponse(response)
    
    if (isDev) console.log(`✅ ${operation} ${resource} success`)
    
    return { data, error: null }
  } catch (error) {
    if (isDev) console.log(`❌ ${operation} ${resource} failed:`, error.message)
    
    return { data: null, error: error.message }
  }
}

class ApiManager {
  constructor() {
    this._clients = new Map()
    this._operations = new Map()
  }

  // === LAZY CLIENT GETTERS ===
  client(resource) {
    if (!this._clients.has(resource)) {
      this._clients.set(resource, apiClient(resource))
    }
    return this._clients.get(resource)
  }

  // === LAZY OPERATION GETTERS ===
  get list() {
    if (!this._operations.has('list')) {
      const { listOperations } = require('./list')
      this._operations.set('list', listOperations(this, handleApiCall))
    }
    return this._operations.get('list')
  }

  get create() {
    if (!this._operations.has('create')) {
      const { createOperations } = require('./create')
      this._operations.set('create', createOperations(this, handleApiCall))
    }
    return this._operations.get('create')
  }

  get get() {
    if (!this._operations.has('get')) {
      const { getOperations } = require('./get')
      this._operations.set('get', getOperations(this, handleApiCall))
    }
    return this._operations.get('get')
  }

  get update() {
    if (!this._operations.has('update')) {
      const { updateOperations } = require('./update')
      this._operations.set('update', updateOperations(this, handleApiCall))
    }
    return this._operations.get('update')
  }

  get remove() {
    if (!this._operations.has('remove')) {
      const { removeOperations } = require('./remove')
      this._operations.set('remove', removeOperations(this, handleApiCall))
    }
    return this._operations.get('remove')
  }

  get custom() {
    if (!this._operations.has('custom')) {
      const { customOperations } = require('./custom')
      this._operations.set('custom', customOperations(this, handleApiCall))
    }
    return this._operations.get('custom')
  }

  // === CONVENIENCE GETTERS FOR DIRECT CLIENT ACCESS ===
  get files() { return this.client('files') }
  get batches() { return this.client('batches') }
  get items() { return this.client('items') }
  get folders() { return this.client('folders') }
  get netsuite() { return this.client('netsuite') }
}

// === SINGLETON INSTANCE ===
export const api = new ApiManager()

// === RE-EXPORTS ===
export { apiClient, useApi }