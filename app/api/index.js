// app/api/index.js - Unified Backend API Client
import { useMemo } from 'react';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Unified Backend API Client
 * 
 * This provides a consistent interface to all backend API routes with standardized
 * patterns for CRUD operations and custom actions. All routes follow the same URL
 * structure and response patterns.
 * 
 * BACKEND API STRUCTURE:
 * - GET    /api/{resource}                    → list(query)
 * - GET    /api/{resource}?id=123             → get(id, query)  
 * - POST   /api/{resource}                    → create(data)
 * - PATCH  /api/{resource}?id=123             → update(id, data)
 * - DELETE /api/{resource}?id=123             → remove(id)
 * - *      /api/{resource}?action=customName  → custom(action, data, method)
 * 
 * AVAILABLE RESOURCES:
 * - 'files'     → /api/files     (file management, uploads, search)
 * - 'folders'   → /api/folders   (folder hierarchy management)
 * - 'batches'   → /api/batches   (batch workflows, work orders)
 * - 'items'     → /api/items     (chemicals, solutions, products)
 * - 'netsuite'  → /api/netsuite  (NetSuite integration, BOM, work orders)
 * - 'auth'      → /api/auth      (authentication, user management)
 * - 'upload'    → /api/upload    (specialized upload handlers)
 * 
 * USAGE PATTERNS:
 * 
 * 1. DIRECT CLIENT USAGE:
 *    import { apiClient } from '@/app/api'
 *    
 *    const filesApi = apiClient('files')
 *    const files = await filesApi.list({ folderId: 'folder123' })
 *    const file = await filesApi.get('file123')
 *    const newFile = await filesApi.create({ fileName: 'test.pdf' })
 *    const updated = await filesApi.update('file123', { description: 'Updated' })
 *    await filesApi.remove('file123')
 *    
 *    // Custom actions (specific to each resource)
 *    const searchResults = await filesApi.custom('search', { query: 'test' }, 'GET')
 *    const batchUpload = await filesApi.custom('batch-upload', formData, 'POST')
 * 
 * 2. REACT HOOK USAGE (Recommended for components):
 *    import { useApi } from '@/app/api'
 *    
 *    function MyComponent() {
 *      const batchesApi = useApi('batches')
 *      
 *      const handleCreate = async () => {
 *        const result = await batchesApi.create({ fileId: 'file123' })
 *        // Handle result...
 *      }
 *      
 *      return <button onClick={handleCreate}>Create Batch</button>
 *    }
 * 
 * 3. QUERY PARAMETERS:
 *    // List with filters
 *    await api.list({ status: 'Review', limit: 10 })
 *    // → GET /api/resource?status=Review&limit=10
 *    
 *    // Get with additional data
 *    await api.get('id123', { action: 'with-details' })
 *    // → GET /api/resource?id=id123&action=with-details
 * 
 * 4. CUSTOM ACTIONS BY RESOURCE:
 *    
 *    FILES:
 *    - search: GET ?action=search&query=term
 *    - download: GET ?action=download&id=123
 *    - batch-upload: POST ?action=batch-upload
 *    
 *    BATCHES:
 *    - workorder-retry: POST ?action=workorder-retry
 *    - workorder-status: GET ?action=workorder-status
 *    
 *    ITEMS:
 *    - lots: GET ?action=lots&id=123
 *    - transactions: POST ?action=transactions
 *    - stats: GET ?action=stats
 *    
 *    NETSUITE:
 *    - test: GET ?action=test
 *    - search: GET ?action=search&q=term
 *    - getBOM: GET ?action=getBOM&assemblyItemId=123
 *    - workorder: POST ?action=workorder
 *    - mapping: POST ?action=mapping
 * 
 * RESPONSE PATTERNS:
 * - Success: { success: true, data: [...], message?: string }
 * - Error: { success: false, error: string, message?: string }
 * - Some endpoints return data directly (legacy, being normalized)
 * 
 * ERROR HANDLING:
 * - HTTP errors (400, 500, etc.) throw fetch errors
 * - Application errors return { success: false, error: string }
 * - Always check response.ok for HTTP errors
 * - Check response.success for application errors
 * 
 * AUTHENTICATION:
 * - Uses JWT tokens in httpOnly cookies
 * - Auth handled automatically by backend middleware
 * - 401 responses indicate authentication required
 * 
 * NOTE: This is the low-level client. For higher-level operations with error
 * handling and response normalization, use the frontend client at /app/apiClient
 */

/**
 * Generic API client for any resource under /api
 * @param {string} resource - e.g. 'batches', 'files', 'items'
 * @returns {Object} Client with list, get, create, update, remove, custom methods
 */
export function apiClient(resource) {
  const base = `/api/${resource}`;

  return {
    /**
     * List resources with optional query parameters
     * @param {Object} query - Query parameters (status, folderId, search, etc.)
     * @returns {Promise} Response with list of resources
     */
    list(query = {}) {
      const params = new URLSearchParams(query).toString();
      const url = params ? `${base}?${params}` : base;
      return fetch(url).then(res => res.json());
    },

    /**
     * Get single resource by ID with optional additional parameters
     * @param {string} id - Resource ID
     * @param {Object} query - Additional query parameters
     * @returns {Promise} Response with single resource
     */
    get(id, query = {}) {
      const params = new URLSearchParams({ id, ...query }).toString();
      const url = `${base}?${params}`;
      return fetch(url).then(res => res.json());
    },

    /**
     * Create new resource
     * @param {Object} data - Resource data
     * @returns {Promise} Response with created resource
     */
    create(data) {
      return fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(res => res.json());
    },

    /**
     * Update existing resource by ID
     * @param {string} id - Resource ID
     * @param {Object} data - Updated resource data
     * @returns {Promise} Response with updated resource
     */
    update(id, data) {
      const url = `${base}?id=${encodeURIComponent(id)}`;
      return fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(res => res.json());
    },

    /**
     * Delete resource by ID
     * @param {string} id - Resource ID
     * @returns {Promise} Response confirming deletion
     */
    remove(id) {
      const url = `${base}?id=${encodeURIComponent(id)}`;
      return fetch(url, { method: 'DELETE' }).then(res => res.json());
    },

    /**
     * Perform custom action on resource
     * @param {string} action - Action name (search, download, workorder-retry, etc.)
     * @param {Object} data - Action-specific data
     * @param {string} method - HTTP method (GET, POST, PATCH, DELETE)
     * @returns {Promise} Response from custom action
     */
    custom(action, data = {}, method = 'POST') {
      const url = `${base}?action=${encodeURIComponent(action)}`;
      const options = { method };
      if (method !== 'GET') {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(data);
      }
      return fetch(url, options).then(res => res.json());
    }
  };
}

/**
 * React hook to get an API client for a given resource
 * Memoizes the client to prevent recreating on every render
 * @param {string} resource - e.g. 'batches', 'files', 'items'
 * @returns {Object} Memoized API client
 */
export function useApi(resource) {
  return useMemo(() => apiClient(resource), [resource]);
}