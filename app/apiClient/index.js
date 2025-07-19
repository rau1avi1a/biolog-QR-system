// app/apiClient/index.js
import { apiClient, useApi } from '@/app/api'
import { listOperations }   from './list'
import { createOperations } from './create'
import { getOperations }    from './get'
import { updateOperations } from './update'
import { removeOperations } from './remove'
import { customOperations } from './custom'

// 🔇 TEMP: dev logging
const isDev = false

function normalizeResponse(response) {
  if (!response) {
    if (isDev) console.warn('No response received')
    return { data: null, error: 'No response' }
  }
  if (typeof response !== 'object') {
    if (isDev) console.warn('Non-object response:', typeof response)
    return { data: response, error: null }
  }
  if ('success' in response) {
    return response.success
      ? { data: response.data, error: null }
      : { data: response.data || null, error: response.error || 'Operation failed' }
  }
  return response.error
    ? { data: null, error: response.error }
    : { data: response, error: null }
}

async function handleApiCall(operation, resource, params, apiCall) {
  try {
    if (isDev) console.log(`🔍 ${operation} ${resource}`, params)
    const response = await apiCall()
    
    // ✅ FIX: Enhanced authentication handling for OAuth2
    if (response && response.authRequired && response.needsOAuth2) {
      console.log('🔐 API response indicates authentication required, redirecting to OAuth2 login...');
      
      // Store the current URL to redirect back after auth
      const currentUrl = window.location.pathname + window.location.search;
      sessionStorage.setItem('postAuthRedirect', currentUrl);
      
      // ✅ FIX: Add small delay to ensure storage is saved
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Redirect to OAuth2 login
      window.location.href = response.redirectUrl || '/api/netsuite?action=oauth2-login';
      
      // Return a specific error so components know what happened
      return { 
        data: null, 
        error: 'Redirecting to NetSuite authentication...',
        redirecting: true,
        authRequired: true
      };
    }
    
    const normalized = normalizeResponse(response)
    if (isDev) {
      normalized.error
        ? console.log(`❌ ${operation} failed:`, normalized.error)
        : console.log(`✅ ${operation} success`)
    }
    return normalized
  } catch (error) {
    if (isDev) console.log(`💥 ${operation} ${resource} exception:`, error.message)
    
    // ✅ FIX: Enhanced error handling for fetch responses
    if (error instanceof Response) {
      try {
        const errorData = await error.json();
        if (error.status === 401 && errorData.authRequired && errorData.needsOAuth2) {
          console.log('🔐 401 response with authRequired flag detected');
          
          const currentUrl = window.location.pathname + window.location.search;
          sessionStorage.setItem('postAuthRedirect', currentUrl);
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
          window.location.href = errorData.redirectUrl || '/api/netsuite?action=oauth2-login';
          
          return { 
            data: null, 
            error: 'Redirecting to NetSuite authentication...',
            redirecting: true,
            authRequired: true
          };
        }
      } catch (parseError) {
        console.log('Could not parse error response:', parseError);
      }
    }
    
    // ✅ FIX: Check if the error is a fetch error with 401 status
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      // This might be a network error, handle normally
      return { data: null, error: error.message || 'Network error' }
    }
    
    // ✅ FIX: Handle errors that contain auth flags directly
    if (error.authRequired && error.needsOAuth2) {
      console.log('🔐 Error contains authRequired flag, redirecting to OAuth2 login...');
      
      const currentUrl = window.location.pathname + window.location.search;
      sessionStorage.setItem('postAuthRedirect', currentUrl);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      window.location.href = error.redirectUrl || '/api/netsuite?action=oauth2-login';
      
      return { 
        data: null, 
        error: 'Redirecting to NetSuite authentication...',
        redirecting: true,
        authRequired: true
      };
    }
    
    return { data: null, error: error.message || 'Network error' }
  }
}

function hasError(result) {
  return result && result.error != null
}

function extractData(result, fallback = null) {
  return hasError(result) ? fallback : result.data ?? fallback
}

function extractList(result, listField, fallback = []) {
  if (hasError(result)) return fallback
  const data = result.data
  if (Array.isArray(data)) return data
  if (data?.[listField] && Array.isArray(data[listField])) {
    return data[listField]
  }
  return fallback
}

function extractMetadata(result, fallback = {}) {
  if (hasError(result)) return fallback
  const data = result.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return fallback
  const md = {}
  for (const [k,v] of Object.entries(data)) {
    if (!Array.isArray(v)) md[k] = v
  }
  return Object.keys(md).length ? md : fallback
}

function getError(result) {
  return hasError(result) ? result.error : null
}

class ApiManager {
  constructor() {
    this._clients    = new Map()
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
      this._operations.set(
        'list',
        listOperations(this, handleApiCall.bind(this))
      )
    }
    return this._operations.get('list')
  }

  get create() {
    if (!this._operations.has('create')) {
      this._operations.set(
        'create',
        createOperations(this, handleApiCall.bind(this))
      )
    }
    return this._operations.get('create')
  }

  get get() {
    if (!this._operations.has('get')) {
      this._operations.set(
        'get',
        getOperations(this, handleApiCall.bind(this))
      )
    }
    return this._operations.get('get')
  }

  get update() {
    if (!this._operations.has('update')) {
      this._operations.set(
        'update',
        updateOperations(this, handleApiCall.bind(this))
      )
    }
    return this._operations.get('update')
  }

  get remove() {
    if (!this._operations.has('remove')) {
      this._operations.set(
        'remove',
        removeOperations(this, handleApiCall.bind(this))
      )
    }
    return this._operations.get('remove')
  }

  get custom() {
    if (!this._operations.has('custom')) {
      this._operations.set(
        'custom',
        customOperations(this, handleApiCall.bind(this))
      )
    }
    return this._operations.get('custom')
  }

  // Convenience getters
  get files()   { return this.client('files') }
  get batches() { return this.client('batches') }
  get items()   { return this.client('items') }
  get folders(){ return this.client('folders') }
  get netsuite(){ return this.client('netsuite') }
  get auth()    { return this.client('auth') }
  get upload()  { return this.client('upload') }
}

export const api = new ApiManager()

export {
  apiClient, useApi,
  hasError, extractData,
  extractList, extractMetadata,
  getError
}