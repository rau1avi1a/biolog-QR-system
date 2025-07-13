// app/apiClient/index.js - FIXED VERSION
import { apiClient, useApi } from '@/app/api'

// 🔇 TEMPORARILY ENABLE dev logging to debug PDF issue
const isDev = false // Set to false when fixed

/**
 * FIXED: Simplified response normalization - don't modify data structure
 */
function normalizeResponse(response) {
  if (!response) {
    if (isDev) console.warn('🚨 Received null/undefined response')
    return { data: null, error: 'No response received from server' }
  }

  if (typeof response !== 'object') {
    if (isDev) console.warn('🚨 Received non-object response:', typeof response)
    return { data: response, error: null }
  }

  // Handle standardized success/error format
  if (response.hasOwnProperty('success')) {
    if (response.success === true) {
      // DEBUG: Log what we're returning
      if (isDev) {
        console.log('🔍 normalizeResponse data keys:', response.data ? Object.keys(response.data) : 'no data');
        console.log('🔍 normalizeResponse has PDF:', !!response.data?.pdf);
      }
      
      // FIXED: Return data as-is, don't modify it!
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

  // Handle legacy direct data responses
  if (isDev) console.warn('🚨 Non-standardized response format detected:', response)
  
  if (response.error) {
    return { data: null, error: response.error }
  }
  
  return { data: response, error: null }
}

/**
 * Enhanced error handling wrapper
 */
async function handleApiCall(operation, resource, params, apiCall) {
  try {
    if (isDev) {
      const paramStr = params ? ` (${Object.keys(params).join(', ')})` : ''
      console.log(`🔍 ${operation} ${resource}${paramStr}`)
    }
    
    const response = await apiCall()
    const normalized = normalizeResponse(response)
    
    if (isDev && normalized.error === null) {
      console.log(`✅ ${operation} ${resource} success`)
    }
    
    if (isDev && normalized.error) {
      console.log(`❌ ${operation} ${resource} failed:`, normalized.error)
    }
    
    return normalized
    
  } catch (error) {
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
 * Check if a normalized result has an error
 */
function hasError(result) {
  return result && result.error !== null && result.error !== undefined
}

/**
 * FIXED: Simplified data extraction - just return the data as-is
 */
function extractData(result, fallback = null) {
  if (hasError(result)) {
    if (isDev) console.warn('🚨 Attempting to extract data from error result:', result.error)
    return fallback
  }
  
  // DEBUG: Log what we're extracting
  if (isDev) {
    console.log('🔍 extractData input:', {
      hasData: !!result?.data,
      dataKeys: result?.data ? Object.keys(result.data) : 'no data',
      hasPdf: !!result?.data?.pdf
    });
  }
  
  // FIXED: Return data exactly as the API provided it
  const extracted = result?.data ?? fallback;
  
  // DEBUG: Log what we're returning
  if (isDev) {
    console.log('🔍 extractData output:', {
      hasExtracted: !!extracted,
      extractedKeys: extracted && typeof extracted === 'object' ? Object.keys(extracted) : 'not object',
      extractedHasPdf: !!extracted?.pdf
    });
  }
  
  return extracted;
}

/**
 * NEW: Extract just the array from wrapped list responses
 */
function extractList(result, listField, fallback = []) {
  if (hasError(result)) {
    return fallback
  }
  
  const data = result?.data
  if (!data) return fallback
  
  // Direct array
  if (Array.isArray(data)) return data
  
  // Wrapped structure like { files: [...], count: 5 }
  if (typeof data === 'object' && data[listField] && Array.isArray(data[listField])) {
    return data[listField]
  }
  
  return fallback
}

/**
 * NEW: Extract metadata from wrapped responses
 */
function extractMetadata(result, fallback = {}) {
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
 * Get error message from normalized result
 */
function getError(result) {
  return hasError(result) ? result.error : null
}

// Rest of your ApiManager class stays the same...
class ApiManager {
  constructor() {
    this._clients = new Map()
    this._operations = new Map()
  }

  client(resource) {
    if (!this._clients.has(resource)) {
      this._clients.set(resource, apiClient(resource))
    }
    return this._clients.get(resource)
  }

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

  async _enhancedHandleApiCall(operation, resource, params, apiCall) {
    return await handleApiCall(operation, resource, params, apiCall)
  }

  // Convenience getters
  get files() { return this.client('files') }
  get batches() { return this.client('batches') }
  get items() { return this.client('items') }
  get folders() { return this.client('folders') }
  get netsuite() { return this.client('netsuite') }
  get auth() { return this.client('auth') }
  get upload() { return this.client('upload') }
}

export const api = new ApiManager()

export { 
  apiClient, 
  useApi, 
  hasError, 
  extractData,
  extractList,
  extractMetadata,
  getError 
}