// app/apiClient/index.js - Unified Frontend API Client (SIMPLIFIED NORMALIZATION)
import { apiClient, useApi } from '@/app/api'

/**
 * Unified Frontend API Client with Simplified Normalization
 * 
 * Now that all API routes return standardized { success, data, error } format,
 * the normalization logic is greatly simplified and more reliable.
 */

const isDev = process.env.NODE_ENV === 'development'

/**
 * Simplified response normalization for standardized API responses
 * 
 * All API routes now return: { success: boolean, data: any, error: string|null }
 * This function handles that consistent format and any edge cases.
 */
function normalizeResponse(response) {
  // Handle null/undefined responses (network errors, etc.)
  if (!response) {
    if (isDev) console.warn('🚨 Received null/undefined response')
    return { data: null, error: 'No response received from server' }
  }

  // Handle non-object responses (should not happen with standardized routes)
  if (typeof response !== 'object') {
    if (isDev) console.warn('🚨 Received non-object response:', typeof response)
    return { data: response, error: null }
  }

  // Handle standardized success/error format
  if (response.hasOwnProperty('success')) {
    if (response.success === true) {
      return { 
        data: response.data, 
        error: null 
      }
    } else if (response.success === false) {
      return { 
        data: response.data || null, 
        error: response.error || 'Operation failed' 
      }
    }
  }

  // Handle legacy direct data responses (should be rare now)
  // This covers any endpoints we might have missed
  if (isDev) console.warn('🚨 Non-standardized response format detected:', response)
  
  // If it has an error field, treat as error
  if (response.error) {
    return { data: null, error: response.error }
  }
  
  // Otherwise, assume it's data
  return { data: response, error: null }
}

/**
 * Enhanced error handling wrapper with better error context
 */
async function handleApiCall(operation, resource, params, apiCall) {
  try {
    if (isDev) {
      const paramStr = params ? ` (${Object.keys(params).join(', ')})` : ''
      console.log(`🔍 ${operation} ${resource}${paramStr}`)
    }
    
    const response = await apiCall()
    const normalized = normalizeResponse(response)
    
    // Log successful operations in dev
    if (isDev && normalized.error === null) {
      console.log(`✅ ${operation} ${resource} success`)
    }
    
    // Log errors in dev (but still return them, don't throw)
    if (isDev && normalized.error) {
      console.log(`❌ ${operation} ${resource} failed:`, normalized.error)
    }
    
    return normalized
    
  } catch (error) {
    // Handle network errors, fetch failures, etc.
    if (isDev) {
      console.log(`💥 ${operation} ${resource} exception:`, error.message)
    }
    
    return { 
      data: null, 
      error: error.message || 'Network error occurred' 
    }
  }
}

/**
 * Convenience function to check if a normalized result has an error
 */
export function hasError(result) {
  return result && result.error !== null && result.error !== undefined
}

/**
 * Convenience function to safely extract data from normalized result
 */
export function extractData(result, fallback = null) {
  if (hasError(result)) {
    if (isDev) console.warn('🚨 Attempting to extract data from error result:', result.error)
    return fallback
  }
  return result?.data ?? fallback
}

/**
 * Convenience function to get error message from normalized result
 */
export function getError(result) {
  return hasError(result) ? result.error : null
}

/**
 * Enhanced validation for API responses in development
 */
function validateApiResponse(response, operation, resource) {
  if (!isDev) return // Only validate in development
  
  if (!response) {
    console.error(`🚨 ${operation} ${resource}: No response received`)
    return
  }
  
  if (typeof response !== 'object') {
    console.error(`🚨 ${operation} ${resource}: Response is not an object:`, typeof response)
    return
  }
  
  if (!response.hasOwnProperty('success')) {
    console.warn(`🚨 ${operation} ${resource}: Response missing 'success' field`)
    return
  }
  
  if (response.success === true && response.data === undefined) {
    console.warn(`🚨 ${operation} ${resource}: Success response missing 'data' field`)
  }
  
  if (response.success === false && !response.error) {
    console.warn(`🚨 ${operation} ${resource}: Error response missing 'error' field`)
  }
  
  if (response.hasOwnProperty('error') && response.error !== null && response.success !== false) {
    console.warn(`🚨 ${operation} ${resource}: Response has error but success is not false`)
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
      this._operations.set('list', listOperations(this, this._enhancedHandleApiCall.bind(this)))
    }
    return this._operations.get('list')
  }

  get create() {
    if (!this._operations.has('create')) {
      const { createOperations } = require('./create')
      this._operations.set('create', createOperations(this, this._enhancedHandleApiCall.bind(this)))
    }
    return this._operations.get('create')
  }

  get get() {
    if (!this._operations.has('get')) {
      const { getOperations } = require('./get')
      this._operations.set('get', getOperations(this, this._enhancedHandleApiCall.bind(this)))
    }
    return this._operations.get('get')
  }

  get update() {
    if (!this._operations.has('update')) {
      const { updateOperations } = require('./update')
      this._operations.set('update', updateOperations(this, this._enhancedHandleApiCall.bind(this)))
    }
    return this._operations.get('update')
  }

  get remove() {
    if (!this._operations.has('remove')) {
      const { removeOperations } = require('./remove')
      this._operations.set('remove', removeOperations(this, this._enhancedHandleApiCall.bind(this)))
    }
    return this._operations.get('remove')
  }

  get custom() {
    if (!this._operations.has('custom')) {
      const { customOperations } = require('./custom')
      this._operations.set('custom', customOperations(this, this._enhancedHandleApiCall.bind(this)))
    }
    return this._operations.get('custom')
  }

  // Enhanced version with validation
  async _enhancedHandleApiCall(operation, resource, params, apiCall) {
    const result = await handleApiCall(operation, resource, params, async () => {
      const response = await apiCall()
      
      // Validate response format in development
      validateApiResponse(response, operation, resource)
      
      return response
    })
    
    return result
  }

  // === CONVENIENCE GETTERS FOR DIRECT CLIENT ACCESS ===
  get files() { return this.client('files') }
  get batches() { return this.client('batches') }
  get items() { return this.client('items') }
  get folders() { return this.client('folders') }
  get netsuite() { return this.client('netsuite') }
  get auth() { return this.client('auth') }
  get upload() { return this.client('upload') }
}

// === SINGLETON INSTANCE ===
export const api = new ApiManager()

// === CONVENIENCE EXPORTS ===
export { 
  apiClient, 
  useApi, 
  hasError, 
  extractData, 
  getError 
}

// === USAGE EXAMPLES ===
/*

// Basic usage with error handling
const result = await api.list.files('folder123')
if (hasError(result)) {
  console.error('Failed to load files:', getError(result))
  return
}
const files = extractData(result, [])

// Direct data extraction with fallback
const files = extractData(await api.list.files('folder123'), [])

// Check for errors
const result = await api.create.batch({ fileId: 'file123' })
if (hasError(result)) {
  setError(getError(result))
} else {
  setBatch(extractData(result))
}

// All operations return normalized { data, error } format:
// - api.list.files() → { data: [...], error: null }
// - api.get.file(id) → { data: {...}, error: null }  
// - api.create.batch(data) → { data: {...}, error: null }
// - api.update.batch(id, data) → { data: {...}, error: null }
// - api.remove.file(id) → { data: {...}, error: null }
// - api.custom.uploadFile(file) → { data: {...}, error: null }

*/