// db/schemas/index.js - Single file with ALL schema definitions
import mongoose from 'mongoose';
const { Schema } = mongoose;

// =============================================================================
// REUSABLE SCHEMA PATTERNS
// =============================================================================
const auditFields = {
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
};

const netsuiteFields = {
  netsuiteInternalId: { type: String, index: true },
  netsuiteLastSync: { type: Date },
  netsuiteSyncStatus: { 
    type: String, 
    enum: ['pending', 'synced', 'error'],
    default: 'pending'
  }
};

const softDeleteFields = {
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' }
};

// =============================================================================
// USER SCHEMA
// =============================================================================

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "operator" },
  
  // Updated NetSuite credentials for OAuth2
  netsuiteCredentials: {
    // OAuth2 fields
    accessToken: { type: String },
    refreshToken: { type: String },
    tokenExpiry: { type: Date },
    scope: { type: String },
    lastTokenRefresh: { type: Date },
    
    // Keep these for backward compatibility during migration
    accountId: { type: String },
    consumerKey: { type: String },
    consumerSecret: { type: String },
    tokenId: { type: String },
    tokenSecret: { type: String },
    
    // Configuration flags
    isConfigured: { type: Boolean, default: false },
    authType: { type: String, enum: ['oauth1', 'oauth2'], default: 'oauth2' }
  },
  
  ...auditFields
}, { 
  timestamps: true,
  strict: false
});

// Updated user methods for OAuth2
userSchema.methods.setNetSuiteOAuth2Credentials = function (oauth2Data) {
  this.netsuiteCredentials = {
    accessToken: oauth2Data.accessToken,
    refreshToken: oauth2Data.refreshToken,
    tokenExpiry: oauth2Data.tokenExpiry,
    scope: oauth2Data.scope,
    lastTokenRefresh: new Date(),
    isConfigured: true,
    authType: 'oauth2'
  };
};

userSchema.methods.hasNetSuiteAccess = function () {
  return this.netsuiteCredentials?.isConfigured && 
         this.netsuiteCredentials?.accessToken;
};

userSchema.methods.isNetSuiteTokenExpired = function () {
  if (!this.netsuiteCredentials?.tokenExpiry) return true;
  
  const now = new Date();
  const expiry = new Date(this.netsuiteCredentials.tokenExpiry);
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
  
  return expiry <= fiveMinutesFromNow;
};

userSchema.methods.clearNetSuiteCredentials = function () {
  this.netsuiteCredentials = {
    isConfigured: false,
    authType: 'oauth2'
  };
};

// =============================================================================
// ITEM SCHEMA (Base for Chemical, Solution, Product)
// =============================================================================
const itemSchema = new Schema({
  sku: { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  itemType: { 
    type: String, 
    required: true, 
    enum: ['chemical', 'solution', 'product'],
    index: true 
  },
  uom: { type: String, default: 'ea' },
  qtyOnHand: { type: Number, default: 0 },
  cost: { type: Number },
  description: { type: String },
  lotTracked: { type: Boolean, default: false },
  
  // Lot tracking
  Lots: [{
    _id: { type: Schema.Types.ObjectId, auto: true },
    lotNumber: { type: String },
    quantity: { type: Number, default: 0 },
    expiryDate: { type: Date },
    location: { type: String },
    vendorLotNumber: { type: String }
  }],
  
  ...netsuiteFields,
  ...auditFields
}, {
  discriminatorKey: 'itemType',
  timestamps: true,
  strict: false
});

// =============================================================================
// FILE SCHEMA
// =============================================================================
const fileSchema = new Schema({
  fileName: { type: String, required: true, index: true },
  description: { type: String },
  folderId: { type: Schema.Types.ObjectId, ref: 'Folder', default: null },

  // Recipe metadata
  productRef: { type: Schema.Types.ObjectId, ref: 'Item', default: null },
  solutionRef: { type: Schema.Types.ObjectId, ref: 'Item', default: null },
  recipeQty: { type: Number, default: 1 },
  recipeUnit: { type: String, default: 'mL' },
  
  // Components
  components: [{
    itemId: { type: Schema.Types.ObjectId, ref: 'Item' },
    amount: { type: Number },
    unit: { type: String },
    // NetSuite import data
    netsuiteData: {
      itemId: { type: String },
      itemRefName: { type: String },
      ingredient: { type: String },
      bomQuantity: { type: Number },
      componentYield: { type: Number },
      units: { type: String },
      lineId: { type: Number },
      bomComponentId: { type: Number },
      itemSource: { type: String },
      type: { type: String, default: 'netsuite' }
    }
  }],

  // NetSuite import metadata
  netsuiteImportData: {
    bomId: { type: String },
    bomName: { type: String },
    revisionId: { type: String },
    revisionName: { type: String },
    importedAt: { type: Date },
    solutionNetsuiteId: { type: String },
    lastSyncAt: { type: Date }
  },

  // PDF data
  pdf: {
    data: { type: Buffer },
    contentType: { type: String, default: 'application/pdf' }
  },
  
  ...auditFields
}, { 
  timestamps: true,
  strict: false 
});

// =============================================================================
// BATCH SCHEMA - Enhanced with all your current fields
// =============================================================================
const batchSchema = new Schema({
  fileId: { type: Schema.Types.ObjectId, ref: 'File', required: true, index: true },
  runNumber: { type: Number, default: 1 },

  // PDF handling
  overlayPng: { type: String },
  overlayHistory: [{ type: String }],
  signedPdf: { 
    data: { type: Buffer }, 
    contentType: { type: String, default: 'application/pdf' }
  },

  overlays: {
    type: Map,
    of: String,
    default: new Map()
  },
    pageOverlays: {
    type: Schema.Types.Mixed,
    default: {}
  },
    overlayPages: [{
    type: Number
  }],

  // Status
  status: {
    type: String,
    enum: ['Draft', 'In Progress', 'Review', 'Completed'],
    default: 'In Progress',
    index: true
  },

  // Archive handling
  isArchived: { type: Boolean, default: false },
  archivedAt: { 
    type: Date,
set: function(value) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }
  
  // Handle empty object (the problematic case)
  if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
    console.warn('⚠️ Empty object passed to date setter, using current date');
    return new Date();
  }
  
  // Handle ISO string conversion for date serialization
  if (typeof value === 'string') {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      console.warn('⚠️ Invalid date string passed to setter:', value);
      return new Date();
    }
    return date;
  }
  
  // Handle Date objects
  if (value instanceof Date) {
    return value;
  }
  
  // Handle timestamp numbers
  if (typeof value === 'number') {
    return new Date(value);
  }
  
  // Handle other object types (like moment objects)
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }
  
  // Last resort - log the problematic value and return current date
  console.warn('⚠️ Unexpected value type in date setter:', typeof value, value);
  return new Date();
}
  },
  folderPath: { type: String },

  // Enhanced Work Order fields
  workOrderId: { type: String },
  workOrderCreated: { type: Boolean, default: false },
  workOrderStatus: { 
    type: String,
    enum: ['not_created', 'creating', 'created', 'completed', 'cancelled', 'failed'],
    default: 'not_created'
  },
  workOrderCreatedAt: { 
    type: Date,
set: function(value) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }
  
  // Handle empty object (the problematic case)
  if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
    console.warn('⚠️ Empty object passed to date setter, using current date');
    return new Date();
  }
  
  // Handle ISO string conversion for date serialization
  if (typeof value === 'string') {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      console.warn('⚠️ Invalid date string passed to setter:', value);
      return new Date();
    }
    return date;
  }
  
  // Handle Date objects
  if (value instanceof Date) {
    return value;
  }
  
  // Handle timestamp numbers
  if (typeof value === 'number') {
    return new Date(value);
  }
  
  // Handle other object types (like moment objects)
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }
  
  // Last resort - log the problematic value and return current date
  console.warn('⚠️ Unexpected value type in date setter:', typeof value, value);
  return new Date();
}
  },
  workOrderError: { type: String },
  workOrderFailedAt: { 
    type: Date,
set: function(value) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }
  
  // Handle empty object (the problematic case)
  if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
    console.warn('⚠️ Empty object passed to date setter, using current date');
    return new Date();
  }
  
  // Handle ISO string conversion for date serialization
  if (typeof value === 'string') {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      console.warn('⚠️ Invalid date string passed to setter:', value);
      return new Date();
    }
    return date;
  }
  
  // Handle Date objects
  if (value instanceof Date) {
    return value;
  }
  
  // Handle timestamp numbers
  if (typeof value === 'number') {
    return new Date(value);
  }
  
  // Handle other object types (like moment objects)
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }
  
  // Last resort - log the problematic value and return current date
  console.warn('⚠️ Unexpected value type in date setter:', typeof value, value);
  return new Date();
}
  },
  
  // Assembly Build fields (when work order is completed)
  assemblyBuildId: { type: String }, // NetSuite internal ID
  assemblyBuildTranId: { type: String }, // The ASSYB number for searching
  assemblyBuildCreated: { type: Boolean, default: false },
  assemblyBuildCreatedAt: { 
    type: Date,
set: function(value) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }
  
  // Handle empty object (the problematic case)
  if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
    console.warn('⚠️ Empty object passed to date setter, using current date');
    return new Date();
  }
  
  // Handle ISO string conversion for date serialization
  if (typeof value === 'string') {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      console.warn('⚠️ Invalid date string passed to setter:', value);
      return new Date();
    }
    return date;
  }
  
  // Handle Date objects
  if (value instanceof Date) {
    return value;
  }
  
  // Handle timestamp numbers
  if (typeof value === 'number') {
    return new Date(value);
  }
  
  // Handle other object types (like moment objects)
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }
  
  // Last resort - log the problematic value and return current date
  console.warn('⚠️ Unexpected value type in date setter:', typeof value, value);
  return new Date();
}
  },
  workOrderCompleted: { type: Boolean, default: false },
  workOrderCompletedAt: { 
    type: Date,
set: function(value) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }
  
  // Handle empty object (the problematic case)
  if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
    console.warn('⚠️ Empty object passed to date setter, using current date');
    return new Date();
  }
  
  // Handle ISO string conversion for date serialization
  if (typeof value === 'string') {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      console.warn('⚠️ Invalid date string passed to setter:', value);
      return new Date();
    }
    return date;
  }
  
  // Handle Date objects
  if (value instanceof Date) {
    return value;
  }
  
  // Handle timestamp numbers
  if (typeof value === 'number') {
    return new Date(value);
  }
  
  // Handle other object types (like moment objects)
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }
  
  // Last resort - log the problematic value and return current date
  console.warn('⚠️ Unexpected value type in date setter:', typeof value, value);
  return new Date();
}
  },
  workOrderCompletionError: { type: String },
  workOrderCompletionFailedAt: { 
    type: Date,
set: function(value) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }
  
  // Handle empty object (the problematic case)
  if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
    console.warn('⚠️ Empty object passed to date setter, using current date');
    return new Date();
  }
  
  // Handle ISO string conversion for date serialization
  if (typeof value === 'string') {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      console.warn('⚠️ Invalid date string passed to setter:', value);
      return new Date();
    }
    return date;
  }
  
  // Handle Date objects
  if (value instanceof Date) {
    return value;
  }
  
  // Handle timestamp numbers
  if (typeof value === 'number') {
    return new Date(value);
  }
  
  // Handle other object types (like moment objects)
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }
  
  // Last resort - log the problematic value and return current date
  console.warn('⚠️ Unexpected value type in date setter:', typeof value, value);
  return new Date();
}
  },
  assemblyBuildStatus: { 
    type: String,
    enum: ['not_created', 'creating', 'created', 'failed'],
    default: 'not_created'
  },
  assemblyBuildError: { type: String },
  assemblyBuildFailedAt: { 
    type: Date,
    set: function(value) {
      // Handle null/undefined
      if (value === null || value === undefined) {
        return null;
      }
      
      // Handle empty object (the problematic case)
      if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
        console.warn('⚠️ Empty object passed to date setter, using current date');
        return new Date();
      }
      
      // Handle ISO string conversion for date serialization
      if (typeof value === 'string') {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          console.warn('⚠️ Invalid date string passed to setter:', value);
          return new Date();
        }
        return date;
      }
      
      // Handle Date objects
      if (value instanceof Date) {
        return value;
      }
      
      // Handle timestamp numbers
      if (typeof value === 'number') {
        return new Date(value);
      }
      
      // Handle other object types (like moment objects)
      if (typeof value === 'object' && typeof value.toDate === 'function') {
        return value.toDate();
      }
      
      // Last resort - log the problematic value and return current date
      console.warn('⚠️ Unexpected value type in date setter:', typeof value, value);
      return new Date();
    }
  },

  // NetSuite work order data
  netsuiteWorkOrderData: {
    workOrderId: { type: String },
    tranId: { type: String },
    bomId: { type: String },
    revisionId: { type: String },
    quantity: { type: Number },
    status: { type: String },
    orderStatus: { type: String },
    createdAt: { 
      type: Date,
      set: function(value) {
        // Handle ISO string conversion for date serialization
        if (typeof value === 'string') return new Date(value);
        return value;
      }
    },
    completedAt: { 
      type: Date,
      set: function(value) {
        // Handle ISO string conversion for date serialization
        if (typeof value === 'string') return new Date(value);
        return value;
      }
    },
    cancelledAt: { 
      type: Date,
      set: function(value) {
        // Handle ISO string conversion for date serialization
        if (typeof value === 'string') return new Date(value);
        return value;
      }
    },
    // Assembly build data (when completed)
    assemblyBuildId: { type: String },
    assemblyBuildTranId: { type: String }, // The ASSYB number
    lastSyncAt: { 
      type: Date,
      set: function(value) {
        // Handle ISO string conversion for date serialization
        if (typeof value === 'string') return new Date(value);
        return value;
      }
    }
  },
  
  // Chemical transaction fields
  chemicalsTransacted: { type: Boolean, default: false },
  transactionDate: { 
    type: Date,
set: function(value) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }
  
  // Handle empty object (the problematic case)
  if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
    console.warn('⚠️ Empty object passed to date setter, using current date');
    return new Date();
  }
  
  // Handle ISO string conversion for date serialization
  if (typeof value === 'string') {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      console.warn('⚠️ Invalid date string passed to setter:', value);
      return new Date();
    }
    return date;
  }
  
  // Handle Date objects
  if (value instanceof Date) {
    return value;
  }
  
  // Handle timestamp numbers
  if (typeof value === 'number') {
    return new Date(value);
  }
  
  // Handle other object types (like moment objects)
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }
  
  // Last resort - log the problematic value and return current date
  console.warn('⚠️ Unexpected value type in date setter:', typeof value, value);
  return new Date();
}
  },

  // Solution creation fields
  solutionCreated: { type: Boolean, default: false },
  solutionLotNumber: { type: String },
  solutionQuantity: { type: Number },
  solutionUnit: { type: String },
  solutionCreatedDate: { 
    type: Date,
set: function(value) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }
  
  // Handle empty object (the problematic case)
  if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
    console.warn('⚠️ Empty object passed to date setter, using current date');
    return new Date();
  }
  
  // Handle ISO string conversion for date serialization
  if (typeof value === 'string') {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      console.warn('⚠️ Invalid date string passed to setter:', value);
      return new Date();
    }
    return date;
  }
  
  // Handle Date objects
  if (value instanceof Date) {
    return value;
  }
  
  // Handle timestamp numbers
  if (typeof value === 'number') {
    return new Date(value);
  }
  
  // Handle other object types (like moment objects)
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }
  
  // Last resort - log the problematic value and return current date
  console.warn('⚠️ Unexpected value type in date setter:', typeof value, value);
  return new Date();
}
  },

  // Rejection handling
  wasRejected: { type: Boolean, default: false },
  rejectionReason: { type: String },
  rejectedBy: { type: String },
  rejectedAt: { 
    type: Date,
set: function(value) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }
  
  // Handle empty object (the problematic case)
  if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
    console.warn('⚠️ Empty object passed to date setter, using current date');
    return new Date();
  }
  
  // Handle ISO string conversion for date serialization
  if (typeof value === 'string') {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      console.warn('⚠️ Invalid date string passed to setter:', value);
      return new Date();
    }
    return date;
  }
  
  // Handle Date objects
  if (value instanceof Date) {
    return value;
  }
  
  // Handle timestamp numbers
  if (typeof value === 'number') {
    return new Date(value);
  }
  
  // Handle other object types (like moment objects)
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }
  
  // Last resort - log the problematic value and return current date
  console.warn('⚠️ Unexpected value type in date setter:', typeof value, value);
  return new Date();
}
  },

  // Confirmed components
  confirmedComponents: [{
    itemId: { type: Schema.Types.ObjectId, ref: 'Item' },
    plannedAmount: { type: Number },
    actualAmount: { type: Number },
    unit: { type: String },
    lotNumber: { type: String },
    lotId: { type: Schema.Types.ObjectId }
  }],

  // Snapshot
  snapshot: {
    enabled: { type: Boolean, default: true },
    productRef: { type: Schema.Types.ObjectId, ref: 'Item' },
    solutionRef: { type: Schema.Types.ObjectId, ref: 'Item' },
    recipeQty: { type: Number },
    recipeUnit: { type: String },
    components: [{
      itemId: { type: Schema.Types.ObjectId, ref: 'Item' },
      amount: { type: Number },
      unit: { type: String }
    }]
  },

  // Workflow tracking
  signedBy: { type: String },
  signedAt: { 
    type: Date,
set: function(value) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }
  
  // Handle empty object (the problematic case)
  if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
    console.warn('⚠️ Empty object passed to date setter, using current date');
    return new Date();
  }
  
  // Handle ISO string conversion for date serialization
  if (typeof value === 'string') {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      console.warn('⚠️ Invalid date string passed to setter:', value);
      return new Date();
    }
    return date;
  }
  
  // Handle Date objects
  if (value instanceof Date) {
    return value;
  }
  
  // Handle timestamp numbers
  if (typeof value === 'number') {
    return new Date(value);
  }
  
  // Handle other object types (like moment objects)
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }
  
  // Last resort - log the problematic value and return current date
  console.warn('⚠️ Unexpected value type in date setter:', typeof value, value);
  return new Date();
}
  },
  submittedForReviewAt: { 
    type: Date,
set: function(value) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }
  
  // Handle empty object (the problematic case)
  if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
    console.warn('⚠️ Empty object passed to date setter, using current date');
    return new Date();
  }
  
  // Handle ISO string conversion for date serialization
  if (typeof value === 'string') {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      console.warn('⚠️ Invalid date string passed to setter:', value);
      return new Date();
    }
    return date;
  }
  
  // Handle Date objects
  if (value instanceof Date) {
    return value;
  }
  
  // Handle timestamp numbers
  if (typeof value === 'number') {
    return new Date(value);
  }
  
  // Handle other object types (like moment objects)
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }
  
  // Last resort - log the problematic value and return current date
  console.warn('⚠️ Unexpected value type in date setter:', typeof value, value);
  return new Date();
}
  },
  completedAt: { 
    type: Date,
set: function(value) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }
  
  // Handle empty object (the problematic case)
  if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
    console.warn('⚠️ Empty object passed to date setter, using current date');
    return new Date();
  }
  
  // Handle ISO string conversion for date serialization
  if (typeof value === 'string') {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      console.warn('⚠️ Invalid date string passed to setter:', value);
      return new Date();
    }
    return date;
  }
  
  // Handle Date objects
  if (value instanceof Date) {
    return value;
  }
  
  // Handle timestamp numbers
  if (typeof value === 'number') {
    return new Date(value);
  }
  
  // Handle other object types (like moment objects)
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }
  
  // Last resort - log the problematic value and return current date
  console.warn('⚠️ Unexpected value type in date setter:', typeof value, value);
  return new Date();
}
  },
  
  ...auditFields
}, { 
  timestamps: true,
  strict: false // IMPORTANT: Allows services to add fields
});


// =============================================================================
// FOLDER SCHEMA
// =============================================================================
const folderSchema = new Schema({
  name: { type: String, required: true, trim: true },
  parentId: { type: Schema.Types.ObjectId, ref: 'Folder', default: null },
  path: { type: [Schema.Types.ObjectId], default: [], index: true },
  
  ...auditFields
}, { 
  timestamps: true,
  strict: false 
});

// =============================================================================
// INVENTORY TRANSACTION SCHEMA
// =============================================================================
const inventoryTxnSchema = new Schema({
  txnType: { 
    type: String, 
    enum: ['receipt', 'issue', 'adjustment', 'build', 'transfer', 'waste', 'sample'], 
    required: true 
  },
  refDoc: { type: Schema.Types.ObjectId },
  refDocType: { type: String },
  
  // Enhanced reference tracking
  batchId: { type: Schema.Types.ObjectId, ref: 'Batch' },
  workOrderId: { type: String },
  purchaseOrderId: { type: String },
  
  // Transaction details
  project: { type: String },
  department: { type: String },
  memo: { type: String },
  reason: { type: String },
  
  // Who did it
  createdBy: {
    _id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String },
    email: { type: String }
  },
  
  // When
  postedAt: { type: Date, default: Date.now },
  effectiveDate: { type: Date, default: Date.now },
  
  // Status
  status: { 
    type: String, 
    enum: ['draft', 'posted', 'reversed', 'cancelled'], 
    default: 'posted' 
  },
  reversedBy: { type: Schema.Types.ObjectId, ref: 'InventoryTxn' },
  
  // Validation
  validated: { type: Boolean, default: false },
  validatedBy: {
    _id: { type: Schema.Types.ObjectId, ref: 'User' },
    name: { type: String },
    email: { type: String },
    date: { type: Date }
  },
  
  // Lines
  lines: [{
    item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
    lot: { type: String },
    qty: { type: Number, required: true },
    unitCost: { type: Number },
    totalValue: { type: Number },
    lotQtyBefore: { type: Number },
    lotQtyAfter: { type: Number },
    itemQtyBefore: { type: Number },
    itemQtyAfter: { type: Number },
    expiryDate: { type: Date },
    vendorLotNumber: { type: String },
    location: { type: String },
    notes: { type: String }
  }],
  
  // Totals
  totalValue: { type: Number, default: 0 },
  lineCount: { type: Number, default: 0 }
}, {
  timestamps: true,
  strict: false,
  indexes: [
    { txnType: 1, postedAt: -1 },
    { 'lines.item': 1, postedAt: -1 },
    { batchId: 1 },
    { status: 1, postedAt: -1 }
  ]
});

// =============================================================================
// OTHER SCHEMAS (keeping them simple for now)
// =============================================================================
const roleSchema = new Schema({
  name: { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  description: { type: String },
  permissions: [{ type: String }],
  homeRoute: { type: String, default: "/dashboard" },
  isActive: { type: Boolean, default: true },
  isSystem: { type: Boolean, default: false },
  
  ...auditFields
}, { 
  timestamps: true,
  strict: false 
});

const vendorSchema = new Schema({
  name: { type: String, required: true, unique: true },
  phone: { type: String },
  email: { type: String },
  address: { type: String },
  terms: { type: String },
  
  ...auditFields
}, { 
  timestamps: true,
  strict: false 
});

const purchaseOrderSchema = new Schema({
  poNumber: { type: String, required: true, unique: true },
  vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
  status: { 
    type: String, 
    enum: ['open', 'partial', 'received', 'closed'], 
    default: 'open' 
  },
  eta: { type: Date },
  lines: [{
    item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
    qty: { type: Number, required: true },
    price: { type: Number },
    uom: { type: String }
  }],
  memo: { type: String },
  
  ...auditFields
}, { 
  timestamps: true,
  strict: false 
});

const vendorItemSchema = new Schema({
  vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
  item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
  vendorSKU: { type: String },
  lastPrice: { type: Number },
  preferred: { type: Boolean, default: false },
  leadTime: { type: Number }, // Days
  minimumOrderQty: { type: Number },
  
  ...auditFields
}, {
  timestamps: true,
  strict: false,
  indexes: [
    { vendor: 1, item: 1, unique: true } // Unique vendor-item combination
  ]
});

const cycleCountSchema = new Schema({
  items: [{
    chemical: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    BiologNumber: { type: String, required: true },
    ChemicalName: { type: String, required: true },
    LotNumber: { type: String, required: true },
    previousQuantity: { type: Number, required: true },
    countedQuantity: { type: Number }
  }],
  isActive: { type: Boolean, default: true },
  completedAt: { type: Date },
  
  ...auditFields
}, { 
  timestamps: true,
  strict: false 
});

// =============================================================================
// EXPORT ALL SCHEMAS
// =============================================================================
export const schemas = {
  userSchema,
  itemSchema,
  fileSchema,
  batchSchema,
  folderSchema,
  inventoryTxnSchema,
  roleSchema,
  vendorSchema,
  vendorItemSchema,
  cycleCountSchema,
  purchaseOrderSchema
};

// Export individual schemas
export {
  userSchema,
  itemSchema,
  fileSchema,
  batchSchema,
  folderSchema,
  inventoryTxnSchema,
  roleSchema,
  vendorSchema,
  vendorItemSchema,
  cycleCountSchema,
  purchaseOrderSchema
};