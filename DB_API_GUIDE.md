# 🗃️ Database & API Usage Guide

This guide explains how to use the unified database API and frontend API client in your Next.js application.

## 📚 Table of Contents

- [🏗️ Database API (Backend)](#️-database-api-backend)
- [🌐 Frontend API Client](#-frontend-api-client)
- [🔗 API Routes](#-api-routes)
- [📝 Examples](#-examples)
- [🧪 Testing](#-testing)

---

## 🏗️ Database API (Backend)

### Import the Unified DB Object

```javascript
import db from '@/db';
```

### Core Database Operations

#### Connect to Database
```javascript
await db.connect();
```

#### Check Connection Status
```javascript
const isConnected = db.connected; // boolean
```

### 📦 Models Access

Access any Mongoose model directly:

```javascript
// User operations
const users = await db.models.User.find();
const user = await db.models.User.findById(id);

// Item operations  
const items = await db.models.Item.find({ itemType: 'chemical' });
const batch = await db.models.Batch.findById(id);

// Available models:
// - User, Item, File, Batch, Folder
// - InventoryTxn, Role, Vendor, VendorItem
// - CycleCount, PurchaseOrder
// - Chemical, Solution, Product (discriminators)
```

### 🛠️ Services Access

Use high-level service operations:

```javascript
// Batch operations
const batch = await db.services.batchService.getBatchById(id);
const batches = await db.services.batchService.listBatches({ filter: {} });
const newBatch = await db.services.batchService.createBatch(data);

// File operations
const file = await db.services.fileService.getFileById(id);
const files = await db.services.fileService.searchFiles('query');

// Item operations
const item = await db.services.itemService.getById(id);
const items = await db.services.itemService.search({ type: 'chemical' });

// Transaction operations
const txn = await db.services.txnService.post(transactionData);
const stats = await db.services.txnService.getItemStats(itemId);

// Available services:
// - batchService, fileService, itemService, txnService
// - archiveService, poService, vendorService, cycleCountService
// - AsyncWorkOrderService
```

### 🌐 NetSuite Integration

```javascript
// Create NetSuite services (async factories)
const auth = await db.netsuite.createNetSuiteAuth(user);
const bomService = await db.netsuite.createBOMService(user);
const workOrderService = await db.netsuite.createWorkOrderService(user);

// Test connection
const testResult = await auth.testConnection();

// Search assembly items
const items = await bomService.searchAssemblyItems('search term');

// Get BOM data
const bom = await bomService.getAssemblyBOM(assemblyItemId);

// Create work orders
const workOrder = await workOrderService.createWorkOrder(data);

// Map components
const mappingResults = await db.netsuite.mapNetSuiteComponents(components);
```

### 🔐 Authentication Utilities

```javascript
// In API routes - wrap handlers with auth
export const GET = db.auth.withAuth(async (request, context) => {
  const user = context.user; // Authenticated user
  // Your handler logic
});

// Role-based access
export const DELETE = db.auth.withRole(async (request, context) => {
  // Only admins can access
}, ['admin']);

// In server components - get current user
const user = await db.auth.basicAuth(); // Redirects if not logged in
```

---

## 🌐 Frontend API Client

### Import the API Client

```javascript
import { apiClient, useApi } from '@/app/api';
```

### Basic Usage Patterns

#### 1. Direct API Client
```javascript
const batchesApi = apiClient('batches');
const filesApi = apiClient('files');
const itemsApi = apiClient('items');
```

#### 2. React Hook (Recommended)
```javascript
function MyComponent() {
  const batchesApi = useApi('batches');
  const filesApi = useApi('files');
  
  // Use in effects, handlers, etc.
}
```

### 📋 CRUD Operations

#### List Resources
```javascript
// GET /api/batches
const response = await batchesApi.list();
const batches = response.data;

// With query parameters
const response = await batchesApi.list({ 
  status: 'Review', 
  fileId: '123',
  limit: 10 
});
```

#### Get Single Resource
```javascript
// GET /api/batches?id=123
const response = await batchesApi.get(id);
const batch = response.data;

// With additional parameters
const response = await batchesApi.get(id, { includePdf: true });
```

#### Create Resource
```javascript
// POST /api/batches
const response = await batchesApi.create({
  fileId: 'file123',
  status: 'Draft',
  overlayPng: 'data:image/png;base64,...'
});
const newBatch = response.data;
```

#### Update Resource
```javascript
// PATCH /api/batches?id=123
const response = await batchesApi.update(id, {
  status: 'Completed',
  signedBy: 'John Doe'
});
const updatedBatch = response.data;
```

#### Delete Resource
```javascript
// DELETE /api/batches?id=123
const response = await batchesApi.remove(id);
```

### 🎯 Custom Actions

Use the `custom()` method for special endpoints:

```javascript
// POST /api/batches?action=workorder-retry
const response = await batchesApi.custom('workorder-retry', { 
  quantity: 100 
}, 'POST');

// GET /api/files?action=download
const response = await filesApi.custom('download', {}, 'GET');

// POST /api/netsuite?action=setup
const netsuiteApi = apiClient('netsuite');
const response = await netsuiteApi.custom('setup', {
  accountId: 'ACCT123',
  consumerKey: 'key',
  // ... other credentials
});
```

---

## 🔗 API Routes

### Authentication (`/api/auth`)
```javascript
const authApi = apiClient('auth');

// Login
await authApi.custom('login', { email, password });

// Register
await authApi.custom('register', { name, email, password, role });

// Get current user
await authApi.custom('me', {}, 'GET');

// Logout
await authApi.custom('logout');
```

### Batches (`/api/batches`)
```javascript
const batchesApi = apiClient('batches');

// List batches
await batchesApi.list({ status: 'Review' });

// Get batch
await batchesApi.get(id);

// Create batch
await batchesApi.create({ fileId, overlayPng, status });

// Update batch
await batchesApi.update(id, { status: 'Completed' });

// Work order operations
await batchesApi.custom('workorder-retry', { quantity: 100 });
await batchesApi.get(id, { action: 'workorder-status' });
```

### Files (`/api/files`)
```javascript
const filesApi = apiClient('files');

// Upload file
const formData = new FormData();
formData.append('file', fileBlob);
formData.append('fileName', 'recipe.pdf');
await fetch('/api/files', { method: 'POST', body: formData });

// Search files
await filesApi.list({ search: 'recipe' });

// Get file with PDF
await filesApi.get(id);

// Download PDF
window.open(`/api/files?id=${id}&action=download`);
```

### Items (`/api/items`)
```javascript
const itemsApi = apiClient('items');

// Search items
await itemsApi.list({ type: 'chemical', search: 'water' });

// Get item
await itemsApi.get(id);

// Create item
await itemsApi.create({
  itemType: 'chemical',
  sku: 'CHEM-001',
  displayName: 'Water',
  uom: 'L'
});

// Get lots
await itemsApi.get(id, { action: 'lots' });

// Post transaction
await itemsApi.custom('transactions', {
  qty: 100,
  memo: 'Receipt from vendor'
});
```

### NetSuite (`/api/netsuite`)
```javascript
const netsuiteApi = apiClient('netsuite');

// Test connection
await netsuiteApi.custom('test', {}, 'GET');

// Search assembly items
await netsuiteApi.custom('search', {}, 'GET').then(r => 
  new URLSearchParams({ q: 'solution name' })
);

// Get BOM
await netsuiteApi.custom('getBOM', {}, 'GET').then(r =>
  new URLSearchParams({ assemblyItemId: '123' })
);

// Create work order
await netsuiteApi.custom('workorder', {
  batchId: 'batch123',
  quantity: 100
});
```

---

## 📝 Examples

### Complete Batch Workflow

```javascript
import { useApi } from '@/app/api';

function BatchManager() {
  const batchesApi = useApi('batches');
  const filesApi = useApi('files');
  
  const createBatchFromFile = async (fileId) => {
    try {
      // Create batch
      const batchResponse = await batchesApi.create({
        fileId,
        status: 'Draft',
        action: 'create_work_order'
      });
      
      // Check work order status
      const statusResponse = await batchesApi.get(batchResponse.data._id, { 
        action: 'workorder-status' 
      });
      
      return {
        batch: batchResponse.data,
        workOrderStatus: statusResponse.data
      };
    } catch (error) {
      console.error('Batch creation failed:', error);
      throw error;
    }
  };
  
  return (
    <div>
      {/* Your batch UI */}
    </div>
  );
}
```

### File Upload with Metadata

```javascript
function FileUploader() {
  const filesApi = useApi('files');
  
  const uploadFile = async (file, metadata) => {
    // 1. Upload the PDF file
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', file.name);
    formData.append('description', metadata.description);
    
    const uploadResponse = await fetch('/api/files', {
      method: 'POST',
      body: formData
    });
    const fileData = await uploadResponse.json();
    
    // 2. Update file metadata (recipe data)
    const updatedFile = await filesApi.update(fileData.file._id, {
      productRef: metadata.productId,
      solutionRef: metadata.solutionId,
      recipeQty: metadata.quantity,
      recipeUnit: metadata.unit,
      components: metadata.components
    });
    
    return updatedFile.file;
  };
}
```

### NetSuite BOM Import

```javascript
function NetSuiteBOMImporter() {
  const netsuiteApi = useApi('netsuite');
  const filesApi = useApi('files');
  
  const importBOM = async (assemblyItemId, fileId) => {
    try {
      // 1. Get BOM from NetSuite
      const bomResponse = await fetch(
        `/api/netsuite?action=getBOM&assemblyItemId=${assemblyItemId}`
      );
      const bomData = await bomResponse.json();
      
      // 2. Map components to local items
      const mappingResponse = await netsuiteApi.custom('mapping', {
        components: bomData.components
      });
      
      // 3. Import into file
      const importResponse = await netsuiteApi.custom('import', {
        bomData: bomData.bom,
        fileId,
        overwriteExisting: true
      });
      
      return {
        bom: bomData,
        mapping: mappingResponse,
        import: importResponse
      };
    } catch (error) {
      console.error('BOM import failed:', error);
      throw error;
    }
  };
}
```

### Inventory Transaction Processing

```javascript
function InventoryManager() {
  const itemsApi = useApi('items');
  
  const processTransaction = async (itemId, lotNumber, quantity, type = 'issue') => {
    try {
      // 1. Get current item state
      const item = await itemsApi.get(itemId, { action: 'with-lots' });
      
      // 2. Validate lot availability
      const lots = await itemsApi.get(itemId, { 
        action: 'lots', 
        lotId: lotNumber 
      });
      
      if (lots.lots.length === 0) {
        throw new Error('Lot not found');
      }
      
      if (type === 'issue' && lots.lots[0].availableQty < Math.abs(quantity)) {
        throw new Error('Insufficient quantity');
      }
      
      // 3. Post transaction
      const txnResponse = await itemsApi.custom('transactions', {
        qty: type === 'issue' ? -Math.abs(quantity) : Math.abs(quantity),
        memo: `${type === 'issue' ? 'Issue' : 'Receipt'} via web interface`,
        department: 'Production'
      }, 'POST');
      
      return txnResponse;
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  };
}
```

### Real-time Status Polling

```javascript
function WorkOrderStatus({ batchId }) {
  const [status, setStatus] = useState(null);
  const batchesApi = useApi('batches');
  
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const response = await batchesApi.get(batchId, { 
          action: 'workorder-status' 
        });
        setStatus(response.data);
      } catch (error) {
        console.error('Status check failed:', error);
      }
    };
    
    // Poll every 5 seconds
    const interval = setInterval(pollStatus, 5000);
    pollStatus(); // Initial call
    
    return () => clearInterval(interval);
  }, [batchId]);
  
  return (
    <div>
      {status?.created ? (
        <span className={`status-${status.status}`}>
          Work Order: {status.displayId}
        </span>
      ) : (
        <span>No work order</span>
      )}
    </div>
  );
}
```

---

## 🧪 Testing

### Backend Testing (Database API)

Test your database API with the built-in test suite:

```bash
# Test all services
http://localhost:3000/api/tests/api

# Test specific services
http://localhost:3000/api/tests/api?suite=batches
http://localhost:3000/api/tests/api?suite=items
http://localhost:3000/api/tests/api?suite=netsuite

# Verbose output with stack traces
http://localhost:3000/api/tests/api?verbose=true
```

### Frontend Testing (API Client)

```javascript
// Test API client in console or component
import { apiClient } from '@/app/api';

const testAPIs = async () => {
  const batchesApi = apiClient('batches');
  
  try {
    // Test list
    const batches = await batchesApi.list({ limit: 5 });
    console.log('Batches:', batches);
    
    // Test get
    if (batches.data.length > 0) {
      const batch = await batchesApi.get(batches.data[0]._id);
      console.log('Single batch:', batch);
    }
    
    console.log('✅ API tests passed');
  } catch (error) {
    console.error('❌ API test failed:', error);
  }
};
```

### Database Health Check

```javascript
// Quick health check in any API route or component
import db from '@/db';

const healthCheck = async () => {
  await db.connect();
  
  console.log('🔗 Connected:', db.connected);
  console.log('📦 Models:', Object.keys(db.models));
  console.log('🛠️ Services:', Object.keys(db.services));
  console.log('🌐 NetSuite:', Object.keys(db.netsuite));
  console.log('🔐 Auth:', Object.keys(db.auth));
};
```

---

## 🚀 Best Practices

### 1. Always Handle Errors
```javascript
try {
  const result = await db.services.batchService.createBatch(data);
  return result;
} catch (error) {
  console.error('Operation failed:', error);
  // Handle gracefully
}
```

### 2. Use Transactions for Multiple Operations
```javascript
const session = await mongoose.startSession();
try {
  session.startTransaction();
  
  const batch = await db.services.batchService.create(batchData, session);
  await db.services.txnService.post(txnData, session);
  
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

### 3. Cache API Responses
```javascript
// Use React Query or SWR for caching
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/app/api';

function BatchList() {
  const batchesApi = useApi('batches');
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchesApi.list(),
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
  
  // Your component logic
}
```

### 4. Type Safety (Optional)
```typescript
// Define types for better development experience
interface Batch {
  _id: string;
  fileId: string;
  status: 'Draft' | 'In Progress' | 'Review' | 'Completed';
  runNumber: number;
  // ... other fields
}

const batch: Batch = await batchesApi.get(id);
```

---

## 🔧 Troubleshooting

### Common Issues

1. **"Service not found" Error**
   ```javascript
   // Make sure you're accessing services correctly
   await db.services.batchService.getBatchById(id); // ✅ Correct
   await db.batches.getBatchById(id); // ❌ Wrong
   ```

2. **"Cannot find module" Error**
   ```javascript
   // Use the correct import path
   import db from '@/db'; // ✅ Correct
   import db from '@/db/index.js'; // ✅ Also correct
   ```

3. **NetSuite Services Not Working**
   ```javascript
   // NetSuite services are async factories
   const auth = await db.netsuite.createNetSuiteAuth(user); // ✅ Correct
   const auth = db.netsuite.createNetSuiteAuth(user); // ❌ Missing await
   ```

4. **API Client Not Working**
   ```javascript
   // Make sure your API routes are fixed to use db.services
   // Check the API test suite for validation
   ```

### Debug Mode

Enable detailed logging:

```javascript
// In development, add to any file
console.log('DB Status:', {
  connected: db.connected,
  models: Object.keys(db.models),
  services: Object.keys(db.services)
});
```

---

## 📚 Quick Reference

### Database API Cheat Sheet
```javascript
import db from '@/db';

// Connection
await db.connect();

// Models (direct Mongoose access)
db.models.User, db.models.Batch, db.models.Item

// Services (high-level operations)
db.services.batchService, db.services.fileService
db.services.itemService, db.services.txnService

// NetSuite (async factories)
await db.netsuite.createNetSuiteAuth(user)
await db.netsuite.createBOMService(user)

// Auth utilities
db.auth.withAuth, db.auth.withRole, db.auth.basicAuth
```

### Frontend API Cheat Sheet
```javascript
import { apiClient, useApi } from '@/app/api';

// Create client
const api = apiClient('resource');
const api = useApi('resource'); // React hook

// CRUD operations
api.list(query)      // GET /api/resource
api.get(id, query)   // GET /api/resource?id=123
api.create(data)     // POST /api/resource
api.update(id, data) // PATCH /api/resource?id=123
api.remove(id)       // DELETE /api/resource?id=123

// Custom actions
api.custom('action', data, 'POST') // POST /api/resource?action=custom
```

---

This guide covers everything you need to know about using the unified database API and frontend client. The system is designed to be intuitive and consistent across all operations. Happy coding! 🚀