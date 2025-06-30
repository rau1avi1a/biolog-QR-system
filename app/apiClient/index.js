// app/apiClient/index.js - Unified Frontend API Client (FIXED NORMALIZATION)
import { apiClient, useApi } from '@/app/api'

/**
 * Unified Frontend API Client with Enhanced Normalization
 * 
 * Fixes the inconsistent data structure issues by properly normalizing
 * the data field content across all API responses.
 */

const isDev = process.env.NODE_ENV === 'development'

/**
 * Enhanced response normalization that handles nested data structures
 * 
 * The issue: API routes return { success, data, error } but the 'data' field
 * contains inconsistent structures (sometimes wrapped objects, sometimes direct arrays)
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
      // FIXED: Properly normalize the data field content
      const normalizedData = normalizeDataField(response.data)
      return { 
        data: normalizedData, 
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
  if (isDev) console.warn('🚨 Non-standardized response format detected:', response)
  
  // If it has an error field, treat as error
  if (response.error) {
    return { data: null, error: response.error }
  }
  
  // Otherwise, assume it's data
  return { data: response, error: null }
}

/**
 * FIXED: Normalize the content of the data field to ensure consistent structure
 * 
 * This addresses the main issue: list endpoints return wrapped objects like
 * { files: [...], count: 5 } instead of just the array
 */
function normalizeDataField(data) {
  if (!data) return data
  
  // For list operations, check if data contains a wrapped structure
  if (typeof data === 'object' && !Array.isArray(data)) {
    // Common patterns in your API responses:
    // - Files: { files: [...], count: n, query: {...} }
    // - Batches: { batches: [...], count: n, query: {...} }
    // - Items: { items: [...], count: n, query: {...} }
    // - Folders: { folders: [...], count: n, query: {...} }
    
    // Check for these wrapped structures
    const listFields = ['files', 'batches', 'items', 'folders', 'users', 'transactions', 'vendors']
    
    for (const field of listFields) {
      if (data.hasOwnProperty(field) && Array.isArray(data[field])) {
        // Return the entire wrapper object, not just the array
        // This preserves metadata like count, pagination, etc.
        return data
      }
    }
    
    // For single item operations, return as-is
    return data
  }
  
  // Arrays and primitives return as-is
  return data
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
 * FIXED: Enhanced data extraction that handles wrapped list responses
 */
export function extractData(result, fallback = null) {
  if (hasError(result)) {
    if (isDev) console.warn('🚨 Attempting to extract data from error result:', result.error)
    return fallback
  }
  
  const data = result?.data
  
  // If no data, return fallback
  if (!data) return fallback
  
  // For wrapped list responses, check if caller expects just the array
  if (typeof data === 'object' && !Array.isArray(data)) {
    // Check if this is a wrapped list response
    const listFields = ['files', 'batches', 'items', 'folders', 'users', 'transactions', 'vendors']
    
    for (const field of listFields) {
      if (data.hasOwnProperty(field) && Array.isArray(data[field])) {
        // If fallback is an array, assume caller wants just the array
        if (Array.isArray(fallback)) {
          return data[field]
        }
        // Otherwise return the full wrapper
        break
      }
    }
  }
  
  return data ?? fallback
}

/**
 * NEW: Extract list data specifically (for when you just want the array)
 */
export function extractList(result, listField, fallback = []) {
  if (hasError(result)) {
    return fallback
  }
  
  const data = result?.data
  if (!data) return fallback
  
  // Direct array
  if (Array.isArray(data)) return data
  
  // Wrapped structure
  if (typeof data === 'object' && data[listField] && Array.isArray(data[listField])) {
    return data[listField]
  }
  
  return fallback
}

/**
 * NEW: Extract metadata from wrapped responses
 */
export function extractMetadata(result, fallback = {}) {
  if (hasError(result)) {
    return fallback
  }
  
  const data = result?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return fallback
  }
  
  // Extract all non-array properties as metadata
  const metadata = {}
  for (const [key, value] of Object.entries(data)) {
    if (!Array.isArray(value)) {
      metadata[key] = value
    }
  }
  
  return Object.keys(metadata).length > 0 ? metadata : fallback
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
  extractList,
  extractMetadata,
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

// Get the full response with metadata
const fullData = extractData(result)
console.log('Files:', fullData.files)
console.log('Count:', fullData.count)
console.log('Query:', fullData.query)

// Or just get the files array
const files = extractList(result, 'files', [])

// Get metadata separately
const metadata = extractMetadata(result)
console.log('Total files:', metadata.count)

// Direct data extraction with fallback (for full wrapper)
const fileData = extractData(await api.list.files(), { files: [], count: 0 })

// Direct array extraction
const fileArray = extractList(await api.list.files(), 'files')

// All operations return normalized { data, error } format:
// - api.list.files() → { data: { files: [...], count: n }, error: null }
// - api.get.file(id) → { data: { _id: ..., fileName: ... }, error: null }  
// - api.create.batch(data) → { data: { _id: ..., ... }, error: null }
// - api.update.batch(id, data) → { data: { _id: ..., ... }, error: null }
// - api.remove.file(id) → { data: { deletedFile: {...} }, error: null }
// - api.custom.uploadFile(file) → { data: { _id: ..., ... }, error: null }

*/