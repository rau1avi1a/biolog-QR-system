# ApiClient Usage Guide - Frontend Integration

## 📋 Overview

This guide explains how to use the **standardized ApiClient** in your frontend components. All API endpoints have been normalized to return consistent data structures, making frontend integration predictable and reliable.

## 🎯 Core Response Format

**Every API operation returns this standardized format:**

```javascript
{
  data: any,           // The actual response data (null on error)
  error: string|null   // Error message (null on success)
}
```

## 🚀 Basic Usage

### Import and Setup
```javascript
import { api, hasError, extractData, getError } from '@/app/apiClient'

// Or for React hooks
import { useApi } from '@/app/apiClient'
```

### Error Checking Pattern
```javascript
const result = await api.list.files('folder123')

if (hasError(result)) {
  console.error('Failed to load files:', getError(result))
  setError(getError(result))
  return
}

const files = extractData(result, [])
setFiles(files.files)
setCount(files.count)
```

### One-liner with Fallback
```javascript
// Extract data with fallback if error occurs
const files = extractData(await api.list.files(), { files: [], count: 0 })
```

## 📂 Files API

### List Files
```javascript
// Root files
const result = await api.list.files()
// result.data = {
//   files: [...],
//   count: 5,
//   query: { folderId: null, search: null },
//   folder: null
// }

// Files in specific folder
const result = await api.list.files('folder123')
// result.data = {
//   files: [...],
//   count: 3,
//   query: { folderId: "folder123", search: null },
//   folder: { id: "folder123" }
// }

// Search files
const result = await api.list.searchFiles('eco')
// result.data = {
//   files: [...],
//   count: 2,
//   query: { search: "eco", folderId: null },
//   searchTerm: "eco"
// }
```

### Single File Operations
```javascript
// Get file details
const result = await api.get.file('file123')
// result.data = { _id: "file123", fileName: "...", ... }

// Get file with PDF data
const result = await api.get.fileWithPdf('file123')
// result.data = { _id: "file123", pdf: "data:application/pdf;base64...", ... }

// Get file's batches
const result = await api.get.fileWithBatches('file123')
// result.data = { batches: [...], count: 3, fileId: "file123" }
```

### Component Example
```javascript
function FileList({ folderId }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadFiles() {
      setLoading(true)
      const result = await api.list.files(folderId)
      
      if (hasError(result)) {
        setError(getError(result))
      } else {
        const data = extractData(result)
        setFiles(data.files)
      }
      setLoading(false)
    }
    
    loadFiles()
  }, [folderId])

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  
  return (
    <div>
      {files.map(file => (
        <div key={file._id}>{file.fileName}</div>
      ))}
    </div>
  )
}
```

## 📦 Batches API

### List Batches
```javascript
// All batches (with pagination)
const result = await api.list.batches()
// result.data = {
//   batches: [...],
//   count: 25,
//   totalCount: 150,
//   pagination: {
//     limit: 50,
//     skip: 0,
//     hasMore: true,
//     page: 1,
//     totalPages: 3
//   },
//   query: { filter: {...}, pagination: {...} }
// }

// Batches by status
const result = await api.list.batchesByStatus('Review')
// result.data = {
//   batches: [...],
//   count: 8,
//   statusFilter: {
//     status: "Review",
//     description: "Batches with status: Review"
//   },
//   ...
// }

// Batches for specific file
const result = await api.list.batchesByFile('file123')
// result.data = {
//   batches: [...],
//   count: 3,
//   fileContext: {
//     fileId: "file123",
//     fileName: "EcoPlate Substrate.pdf",
//     description: "Batches for file: EcoPlate Substrate.pdf"
//   },
//   ...
// }
```

### Single Batch Operations
```javascript
// Get batch details
const result = await api.get.batch('batch123')
// result.data = { _id: "batch123", runNumber: 5, status: "Review", ... }

// Get work order status
const result = await api.get.batchWorkOrderStatus('batch123')
// result.data = {
//   created: true,
//   workOrderId: "WO-123",
//   workOrderNumber: "WO-123",
//   displayId: "WO-123",
//   description: "NetSuite Work Order WO-123"
// }
```

### Pagination Example
```javascript
function BatchList() {
  const [batches, setBatches] = useState([])
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(false)

  async function loadPage(page = 1, limit = 20) {
    setLoading(true)
    const skip = (page - 1) * limit
    
    const result = await api.list.batches({ limit, skip })
    
    if (!hasError(result)) {
      const data = extractData(result)
      setBatches(data.batches)
      setPagination(data.pagination)
    }
    setLoading(false)
  }

  return (
    <div>
      {batches.map(batch => (
        <div key={batch._id}>
          {batch.fileName} - Run {batch.runNumber}
        </div>
      ))}
      
      {pagination && (
        <div>
          Page {pagination.page} of {pagination.totalPages}
          {pagination.hasMore && (
            <button onClick={() => loadPage(pagination.page + 1)}>
              Next Page
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

## 📁 Folders API

### List Folders
```javascript
// Root folders
const result = await api.list.folders()
// result.data = {
//   folders: [...],
//   count: 3,
//   summary: {
//     totalFolders: 3,
//     totalFiles: 45,
//     emptyFolders: 0
//   },
//   hierarchy: { isRoot: true, level: "root" },
//   description: "Root level folders"
// }

// Subfolders
const result = await api.list.folders('parent123')
// result.data = {
//   folders: [...],
//   count: 5,
//   parentContext: {
//     id: "parent123",
//     name: "MFG Documents",
//     isRoot: true
//   },
//   description: "Subfolders of \"MFG Documents\""
// }
```

### Folder Navigation
```javascript
// Get breadcrumbs/path
const result = await api.get.folderTree('folder123')
// result.data = {
//   folder: {...},
//   path: [...],
//   breadcrumbs: [
//     { _id: "root", name: "Root" },
//     { _id: "parent", name: "Parent" }
//   ],
//   depth: 2,
//   isRoot: false
// }

// Get folder contents
const result = await api.get.folderChildren('folder123')
// result.data = {
//   subfolders: [...],
//   files: [...],
//   counts: { subfolders: 3, files: 7, total: 10 },
//   isEmpty: false
// }
```

## 🧪 Items API

### Search Items
```javascript
// All items
const result = await api.list.items()
// result.data = {
//   items: [...],
//   count: 3792,
//   query: { type: null, search: "", netsuiteId: null }
// }

// By type
const result = await api.list.itemsByType('chemical')
// result.data = {
//   items: [...],
//   count: 50,
//   query: { type: "chemical", search: "", netsuiteId: null },
//   pagination: { limit: 50, skip: 0 }
// }

// Search with query
const result = await api.list.searchItems('water', 'chemical')
// result.data = {
//   items: [...],
//   count: 4,
//   query: { type: "chemical", search: "water", netsuiteId: null }
// }
```

### Single Item Operations
```javascript
// Get item with lots
const result = await api.get.itemWithLots('item123')
// result.data = {
//   _id: "item123",
//   sku: "1030 A1",
//   displayName: "GEN III A1 Solution",
//   lotTracked: true,
//   qtyOnHand: 56,
//   Lots: [...],
//   bom: [...]
// }

// Get item lots only
const result = await api.get.itemLots('item123')
// result.data = {
//   lots: [...],
//   count: 5,
//   itemId: "item123"
// }

// Get item transactions
const result = await api.get.itemTransactions('item123')
// result.data = {
//   transactions: [...],
//   count: 25,
//   itemId: "item123",
//   options: { status: "posted", limit: 100, page: 1 }
// }
```

## 🔧 Custom Operations

### File Uploads
```javascript
// Single file upload
const result = await api.custom.uploadFile(file, folderId, onProgress)
// result.data = { _id: "file123", fileName: "...", ... }

// Batch upload
const result = await api.custom.uploadBatch(fileDataArray, folderId, onProgress)
// result.data = {
//   uploaded: 5,
//   failed: 1,
//   results: [...],
//   errors: [...],
//   folderId: "folder123"
// }
```

### NetSuite Operations
```javascript
// Search NetSuite items
const result = await api.custom.searchNetSuiteItems('assembly')
// result.data = { items: [...], query: "assembly", count: 15 }

// Get BOM
const result = await api.custom.getNetSuiteBOM('assembly123')
// result.data = {
//   bom: {...},
//   recipe: [...],
//   components: [...],
//   assemblyItemId: "assembly123"
// }
```

## ⚠️ Error Handling Best Practices

### 1. Always Check for Errors
```javascript
// ❌ DON'T do this
const files = await api.list.files()
setFiles(files.data.files) // Could crash if files.data is null

// ✅ DO this
const result = await api.list.files()
if (hasError(result)) {
  setError(getError(result))
  return
}
setFiles(extractData(result).files)
```

### 2. Use Fallbacks
```javascript
// ✅ Safe with fallback
const files = extractData(await api.list.files(), { files: [], count: 0 })
setFiles(files.files)
setCount(files.count)
```

### 3. Handle Loading States
```javascript
// ✅ Complete error handling
async function loadData() {
  setLoading(true)
  setError(null)
  
  const result = await api.list.files()
  
  if (hasError(result)) {
    setError(getError(result))
    setFiles([])
  } else {
    const data = extractData(result)
    setFiles(data.files)
    setCount(data.count)
  }
  
  setLoading(false)
}
```

## 🎨 React Hook Pattern

```javascript
function useFiles(folderId) {
  const [data, setData] = useState({ files: [], count: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      
      const result = await api.list.files(folderId)
      
      if (hasError(result)) {
        setError(getError(result))
        setData({ files: [], count: 0 })
      } else {
        setData(extractData(result))
      }
      
      setLoading(false)
    }
    
    load()
  }, [folderId])

  return { data, loading, error, reload: () => load() }
}

// Usage in component
function MyComponent() {
  const { data, loading, error } = useFiles('folder123')
  
  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  
  return (
    <div>
      <h2>Files ({data.count})</h2>
      {data.files.map(file => (
        <div key={file._id}>{file.fileName}</div>
      ))}
    </div>
  )
}
```

## 📝 Summary

### Key Points:
1. **All operations return `{ data, error }`** - Check for errors first
2. **Use helper functions** - `hasError()`, `extractData()`, `getError()`
3. **List operations return wrapped objects** - `{ items: [], count: 0, ... }`
4. **Single operations return objects directly** - `{ _id: "123", name: "..." }`
5. **Always provide fallbacks** - Handle error states gracefully
6. **Rich metadata available** - Count, pagination, query info, context

### Helper Functions:
- `hasError(result)` - Check if operation failed
- `extractData(result, fallback)` - Get data with fallback
- `getError(result)` - Get error message
- `api.list.*` - List operations (wrapped objects)
- `api.get.*` - Single item operations (direct objects)
- `api.create.*` - Create operations
- `api.update.*` - Update operations
- `api.remove.*` - Delete operations
- `api.custom.*` - Custom operations

This standardized approach ensures predictable, reliable frontend integration across your entire application!