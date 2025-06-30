# ApiClient Usage Guide

## Overview

The ApiClient provides a unified interface for all API operations with consistent error handling and response normalization. All API responses follow the standardized format: `{ success, data, error }`.

## Import and Setup

```javascript
import { api, hasError, extractData, extractList, extractMetadata, getError } from '@/app/apiClient'
```

## Response Format

All API responses are normalized to:
```javascript
{
  data: any,           // The actual response data (null on error)
  error: string|null   // Error message (null on success)
}
```

### List Responses
List endpoints return wrapped objects with metadata:
```javascript
{
  data: {
    files: [...],      // The actual array of items
    count: 5,          // Total count
    query: {...},      // Query parameters used
    pagination: {...}, // Pagination info (if applicable)
    // ... other metadata
  },
  error: null
}
```

### Single Item Responses
Single item endpoints return the object directly:
```javascript
{
  data: {
    _id: "123",
    fileName: "document.pdf",
    // ... other fields
  },
  error: null
}
```

## Helper Functions

### `hasError(result)`
Check if a response has an error:
```javascript
const result = await api.list.files()
if (hasError(result)) {
  console.error('Error:', getError(result))
  return
}
```

### `extractData(result, fallback)`
Extract the full data object with fallback:
```javascript
// For wrapped list responses - returns the full wrapper
const fileData = extractData(await api.list.files(), { files: [], count: 0 })
console.log(fileData.files)   // Array of files
console.log(fileData.count)   // Total count

// For single item responses - returns the item
const file = extractData(await api.get.file(id), null)
```

### `extractList(result, listField, fallback)`
Extract just the array from wrapped list responses:
```javascript
// Get just the files array
const files = extractList(await api.list.files(), 'files', [])

// Get just the batches array
const batches = extractList(await api.list.batches(), 'batches', [])
```

### `extractMetadata(result, fallback)`
Extract metadata from wrapped responses:
```javascript
const metadata = extractMetadata(await api.list.files())
console.log(metadata.count)      // Total files
console.log(metadata.query)      // Query parameters
console.log(metadata.pagination) // Pagination info
```

### `getError(result)`
Get the error message from a failed response:
```javascript
const result = await api.create.file(data)
if (hasError(result)) {
  alert(`Failed to create file: ${getError(result)}`)
}
```

## Common Patterns

### List Operations

```javascript
// List files with full metadata
const result = await api.list.files()
if (!hasError(result)) {
  const data = extractData(result)
  console.log(`Found ${data.count} files`)
  data.files.forEach(file => console.log(file.fileName))
}

// List files - just get the array
const files = extractList(await api.list.files(), 'files')
files.forEach(file => console.log(file.fileName))

// List with parameters
const searchResult = await api.list.searchFiles('test')
const searchedFiles = extractList(searchResult, 'files')

// List batches by status
const reviewBatches = extractList(
  await api.list.batchesByStatus('Review'), 
  'batches'
)
```

### Single Item Operations

```javascript
// Get a single file
const result = await api.get.file(fileId)
if (hasError(result)) {
  console.error('File not found:', getError(result))
} else {
  const file = extractData(result)
  console.log('File:', file.fileName)
}

// Get with additional data
const fileWithPdf = extractData(
  await api.get.fileWithPdf(fileId)
)
```

### Create Operations

```javascript
// Create a folder
const result = await api.create.folder('New Folder', parentId)
if (hasError(result)) {
  alert(`Failed to create folder: ${getError(result)}`)
} else {
  const folder = extractData(result)
  console.log('Created folder:', folder._id)
}

// Create a batch
const batchResult = await api.create.batch({
  fileId: file._id,
  status: 'Draft'
})
const newBatch = extractData(batchResult)
```

### Update Operations

```javascript
// Update file metadata
const result = await api.update.file(fileId, {
  description: 'Updated description',
  components: updatedComponents
})

if (!hasError(result)) {
  const updated = extractData(result)
  console.log('File updated:', updated)
}

// Update batch status
await api.update.batchStatus(batchId, 'Review')
```

### Delete Operations

```javascript
// Delete a file
const result = await api.remove.file(fileId)
if (hasError(result)) {
  alert(`Cannot delete: ${getError(result)}`)
} else {
  const deleted = extractData(result)
  console.log('Deleted file:', deleted.deletedFile)
  console.log('Deleted batches:', deleted.deletedBatches)
}
```

### File Upload

```javascript
// Single file upload
const file = document.getElementById('fileInput').files[0]
const result = await api.custom.uploadFile(file, folderId, (progress) => {
  console.log(`Upload progress: ${progress}%`)
})

if (!hasError(result)) {
  const uploaded = extractData(result)
  console.log('File uploaded:', uploaded._id)
}

// Batch upload
const files = Array.from(document.getElementById('filesInput').files)
const uploadResult = await api.custom.uploadBatch(
  files.map(f => ({ file: f, relativePath: f.webkitRelativePath })),
  baseFolderId
)
const uploadData = extractData(uploadResult)
console.log(`Uploaded ${uploadData.uploaded} files, ${uploadData.failed} failed`)
```

## React Component Examples

### File List Component
```javascript
function FileList({ folderId }) {
  const [files, setFiles] = useState([])
  const [metadata, setMetadata] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadFiles() {
      setLoading(true)
      setError(null)
      
      const result = await api.list.files(folderId)
      
      if (hasError(result)) {
        setError(getError(result))
        setFiles([])
      } else {
        // Option 1: Get just the array
        setFiles(extractList(result, 'files'))
        
        // Option 2: Get full data with metadata
        const fullData = extractData(result)
        setFiles(fullData.files)
        setMetadata({
          count: fullData.count,
          folder: fullData.folder
        })
      }
      
      setLoading(false)
    }
    
    loadFiles()
  }, [folderId])

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  
  return (
    <div>
      <h2>Files ({metadata.count || files.length})</h2>
      {files.map(file => (
        <div key={file._id}>{file.fileName}</div>
      ))}
    </div>
  )
}
```

### Search Component
```javascript
function SearchFiles() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  const handleSearch = async () => {
    if (query.length < 2) {
      alert('Search query must be at least 2 characters')
      return
    }

    setSearching(true)
    const result = await api.custom.searchFiles(query)
    
    if (hasError(result)) {
      alert(`Search failed: ${getError(result)}`)
      setResults([])
    } else {
      // Get the full response to access metadata
      const data = extractData(result)
      setResults(data.files)
      
      if (data.filtered) {
        console.log(`Showing ${data.count} of ${data.totalFound} results`)
      }
    }
    
    setSearching(false)
  }

  return (
    <div>
      <input 
        value={query} 
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search files..."
      />
      <button onClick={handleSearch} disabled={searching}>
        Search
      </button>
      
      {results.map(file => (
        <div key={file._id}>{file.fileName}</div>
      ))}
    </div>
  )
}
```

### Error Handling Pattern
```javascript
async function performOperation() {
  try {
    // Multiple operations with consistent error handling
    const fileResult = await api.create.file(fileData)
    if (hasError(fileResult)) {
      throw new Error(`File creation failed: ${getError(fileResult)}`)
    }
    const file = extractData(fileResult)

    const batchResult = await api.create.batch({ fileId: file._id })
    if (hasError(batchResult)) {
      throw new Error(`Batch creation failed: ${getError(batchResult)}`)
    }
    const batch = extractData(batchResult)

    return { file, batch }
  } catch (error) {
    console.error('Operation failed:', error.message)
    throw error
  }
}
```

## Available Operations

### List Operations
- `api.list.files(folderId?)` - List files
- `api.list.folders(parentId?)` - List folders
- `api.list.batches(options?)` - List batches
- `api.list.items(options?)` - List inventory items
- `api.list.searchFiles(query)` - Search files
- `api.list.batchesByStatus(status)` - List batches by status
- `api.list.chemicals()` - List chemical items
- `api.list.solutions()` - List solution items
- `api.list.products()` - List product items

### Get Operations
- `api.get.file(id)` - Get file details
- `api.get.fileWithPdf(id)` - Get file with PDF data
- `api.get.batch(id)` - Get batch details
- `api.get.item(id)` - Get item details
- `api.get.folder(id)` - Get folder details

### Create Operations
- `api.create.file(data)` - Create file
- `api.create.folder(name, parentId?)` - Create folder
- `api.create.batch(data)` - Create batch
- `api.create.item(data)` - Create item
- `api.create.chemical(data)` - Create chemical
- `api.create.solution(data)` - Create solution

### Update Operations
- `api.update.file(id, data)` - Update file
- `api.update.batch(id, data)` - Update batch
- `api.update.item(id, data)` - Update item
- `api.update.folder(id, data)` - Update folder

### Delete Operations
- `api.remove.file(id)` - Delete file
- `api.remove.batch(id)` - Delete batch
- `api.remove.item(id)` - Delete item
- `api.remove.folder(id)` - Delete folder

### Custom Operations
- `api.custom.uploadFile(file, folderId?, onProgress?)` - Upload file
- `api.custom.uploadBatch(files, folderId?, onProgress?)` - Batch upload
- `api.custom.searchNetSuiteItems(query)` - Search NetSuite
- `api.custom.getNetSuiteBOM(assemblyItemId)` - Get BOM
- `api.custom.retryWorkOrder(batchId, quantity)` - Retry work order