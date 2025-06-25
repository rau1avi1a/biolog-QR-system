// db/models/index.js - Models built from centralized schemas
import mongoose from 'mongoose';
import { schemas } from '@/db/schemas/index.js';

const {
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
  purchaseOrderSchema,
} = schemas;

// =============================================================================
// USER METHODS AND STATICS
// =============================================================================
userSchema.methods.matchPassword = async function (enteredPassword) {
  const bcrypt = await import('bcryptjs');
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.setNetSuiteCredentials = function (credentials) {
  this.netsuiteCredentials = {
    accountId: credentials.accountId,
    consumerKey: credentials.consumerKey,
    consumerSecret: credentials.consumerSecret, // You might want to encode this
    tokenId: credentials.tokenId,
    tokenSecret: credentials.tokenSecret,
    isConfigured: true
  };
};

userSchema.methods.hasNetSuiteAccess = function () {
  return this.netsuiteCredentials?.isConfigured;
};

// =============================================================================
// ITEM METHODS AND STATICS
// =============================================================================
itemSchema.methods.addLot = function(lotData) {
  if (!this.Lots) this.Lots = [];
  this.Lots.push(lotData);
  this.recalculateQuantity();
  return this;
};

itemSchema.methods.recalculateQuantity = function() {
  if (this.lotTracked && this.Lots) {
    this.qtyOnHand = this.Lots.reduce((sum, lot) => sum + (lot.quantity || 0), 0);
  }
  return this;
};

itemSchema.statics.findByNetSuiteId = function(netsuiteId) {
  return this.findOne({ netsuiteInternalId: netsuiteId });
};

itemSchema.statics.searchByName = function(searchTerm) {
  return this.find({
    displayName: { $regex: searchTerm, $options: 'i' }
  });
};

// =============================================================================
// BATCH METHODS AND STATICS
// =============================================================================
batchSchema.methods.hasNetSuiteWorkOrder = function() {
  return this.netsuiteWorkOrderData?.tranId;
};

batchSchema.methods.isWorkOrderCompleted = function() {
  return (
    this.workOrderStatus === 'completed' ||
    this.netsuiteWorkOrderData?.status === 'built'
  );
};

batchSchema.methods.getWorkOrderDisplayId = function() {
  if (this.netsuiteWorkOrderData?.tranId) {
    return this.netsuiteWorkOrderData.tranId;
  }
  if (this.workOrderId && !/^PENDING-/.test(this.workOrderId) && !/^LOCAL-/.test(this.workOrderId)) {
    return this.workOrderId;
  }
  return this.workOrderId || 'No Work Order';
};

batchSchema.statics.findByStatus = function(status) {
  return this.find({ status }).populate('fileId', 'fileName');
};

batchSchema.statics.findByNetSuiteWorkOrder = function(workOrderIdentifier) {
  return this.find({
    $or: [
      { 'netsuiteWorkOrderData.workOrderId': workOrderIdentifier },
      { 'netsuiteWorkOrderData.tranId': workOrderIdentifier },
      { workOrderId: workOrderIdentifier }
    ]
  });
};

// Auto-increment runNumber
batchSchema.pre('validate', async function(next) {
  if (!this.isNew) return next();
  const last = await mongoose.model('Batch')
    .findOne({ fileId: this.fileId })
    .sort({ runNumber: -1 })
    .select('runNumber')
    .lean();
  this.runNumber = last ? last.runNumber + 1 : 1;
  next();
});

// =============================================================================
// FOLDER METHODS AND STATICS
// =============================================================================
folderSchema.pre('save', async function (next) {
  if (this.isModified('parentId')) {
    if (this.parentId) {
      const parent = await this.constructor.findById(this.parentId).lean();
      this.path = parent ? [...parent.path, parent._id] : [];
    } else {
      this.path = [];
    }
  }
  next();
});

folderSchema.statics.createChild = async function (parentId, name, createdBy) {
  const child = new this({ parentId, name, createdBy });
  return child.save();
};

// =============================================================================
// INVENTORY TRANSACTION PRE-SAVE HOOK
// =============================================================================
inventoryTxnSchema.pre('save', function(next) {
  this.lineCount = this.lines.length;
  this.totalValue = this.lines.reduce((sum, line) => sum + (line.totalValue || 0), 0);
  next();
});

// =============================================================================
// HELPER: Create or get existing model (for hot reload)
// =============================================================================
function getOrCreateModel(name, schema) {
  if (process.env.NODE_ENV !== 'production' && mongoose.models[name]) {
    delete mongoose.models[name];
  }
  return mongoose.models[name] || mongoose.model(name, schema);
}

// =============================================================================
// DYNAMIC MODEL REGISTRATION
// =============================================================================
const models = Object.entries(schemas).reduce((acc, [schemaKey, schema]) => {
  const modelName = schemaKey
    .replace(/Schema$/, '')
    .replace(/^[a-z]/, char => char.toUpperCase());
  acc[modelName] = getOrCreateModel(modelName, schema);
  return acc;
}, {});

// =============================================================================
// ITEM DISCRIMINATORS
// =============================================================================
if (models.Item) {
  if (process.env.NODE_ENV !== 'production' && models.Item.discriminators) {
    delete models.Item.discriminators.chemical;
    delete models.Item.discriminators.solution;
    delete models.Item.discriminators.product;
  }

  models.Chemical = models.Item.discriminator(
    'chemical',
    new mongoose.Schema({
      casNumber: { type: String },
      location: { type: String },
      safetyData: { type: mongoose.Schema.Types.Mixed }
    })
  );

  models.Solution = models.Item.discriminator(
    'solution',
    new mongoose.Schema({
      bom: [{
        itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
        qty: { type: Number },
        uom: { type: String }
      }]
    })
  );

  models.Product = models.Item.discriminator(
    'product',
    new mongoose.Schema({
      bom: [{
        itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
        qty: { type: Number },
        uom: { type: String }
      }]
    })
  );
}

// =============================================================================
// EXPORTS
// =============================================================================
export const {
  User,
  Item,
  File,
  Batch,
  Folder,
  InventoryTxn,
  Role,
  Vendor,
  VendorItem,
  CycleCount,
  PurchaseOrder,
  Chemical,
  Solution,
  Product
} = models;

export const modelsRegistry = models;
export default models;
