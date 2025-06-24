// models/Batch.js - Complete Enhanced Batch Model with NetSuite Work Order support
import mongoose from 'mongoose';
const { Schema } = mongoose;

// ─── reusable sub-schemas ───────────────────────────────
const usageSchema = new Schema({
  itemId: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
  lotId : { type: Schema.Types.ObjectId, required: true },
  qty   : Number,
  uom   : { type: String, default: 'ea' }
}, { _id: false });

const outputLotSchema = new Schema({
  lotNumber: String,
  qty      : Number,
  uom      : { type: String, default: 'ea' }
}, { _id: false });

const componentSchema = new Schema({
  itemId: { type: Schema.Types.ObjectId, ref: 'Item' },
  amount: Number,
  unit  : String
}, { _id: false });

// ─── snapshot sub-schema ───────────────────────────────
const snapshotSchema = new Schema({
  enabled     : { type: Boolean, default: true },
  productRef  : { type: Schema.Types.ObjectId, ref: 'Item' },  // ← REF!
  solutionRef : { type: Schema.Types.ObjectId, ref: 'Item' },  // ← REF!
  recipeQty   : Number,
  recipeUnit  : String,
  components  : [ componentSchema ]
}, { _id: false });

// ─── Enhanced NetSuite work order data sub-schema ───────────────
const netsuiteWorkOrderSchema = new Schema({
  workOrderId  : String,        // NetSuite internal work order ID (like "400957")
  tranId       : String,        // NetSuite transaction ID/work order number (like "WO12817")
  bomId        : String,        // NetSuite BOM ID
  revisionId   : String,        // NetSuite BOM revision ID
  quantity     : Number,        // Quantity from work order
  status       : String,        // NetSuite work order status
  orderStatus  : String,        // NetSuite order status (like "Released")
  createdAt    : Date,          // When work order was created
  completedAt  : Date,          // When work order was completed
  cancelledAt  : Date,          // When work order was cancelled (if applicable)
  lastSyncAt   : Date           // Last time we synced with NetSuite
}, { _id: false });

// ─── main Batch schema ─────────────────────────────────
const batchSchema = new Schema({
  fileId   : { type: Schema.Types.ObjectId, ref: 'File', required: true, index: true },
  runNumber: { type: Number, default: 1 },

  overlayPng    : String,
  overlayHistory: [ String ],
  signedPdf     : { data: Buffer, contentType: String },

  status: {
    type: String,
    enum: ['Draft', 'In Progress', 'Review', 'Completed'],
    default: 'Draft'
  },

  isArchived : { type: Boolean, default: false },
  archivedAt : Date,
  folderPath : String,

  // ─── Enhanced Work Order fields ───────────────────
  workOrderId        : String,  // This now stores the NetSuite tranId (like "WO12817")
  workOrderCreated   : { type: Boolean, default: false },
  workOrderStatus    : String,  // 'creating', 'created', 'completed', 'cancelled', 'failed'
  workOrderCreatedAt : Date,
  workOrderError     : String,  // Error message if creation failed
  workOrderFailedAt  : Date,    // When creation failed
  
  // ─── NetSuite-specific work order data ────────────
  netsuiteWorkOrderData: netsuiteWorkOrderSchema,

  // ─── Chemical transaction fields ──────────────────
  chemicalsTransacted: { type: Boolean, default: false },
  transactionDate    : Date,

  // ─── Solution creation fields ─────────────────────
  solutionCreated    : { type: Boolean, default: false },
  solutionLotNumber  : String,
  solutionQuantity   : Number,  // Actual quantity produced
  solutionUnit       : String,  // Unit of measurement
  solutionCreatedDate: Date,

  // ─── Rejection handling ───────────────────────────
  wasRejected    : { type: Boolean, default: false },
  rejectionReason: String,
  rejectedBy     : String,
  rejectedAt     : Date,

  // ─── Confirmed components (from UI) ───────────────
  confirmedComponents: [{
    itemId       : { type: Schema.Types.ObjectId, ref: 'Item' },
    plannedAmount: Number,
    actualAmount : Number,
    unit         : String,
    lotNumber    : String,
    lotId        : { type: Schema.Types.ObjectId },
    _id: false
  }],

  snapshot    : snapshotSchema,  // ← your snapshot with refs
  inputs      : [ usageSchema ],
  outputLot   : outputLotSchema,

  signedBy    : String,
  signedAt    : Date,

  submittedForReviewAt : Date,
  completedAt          : Date
}, { timestamps: true });

// Auto‐increment runNumber per file
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

// ─── Enhanced Instance methods for NetSuite work order management ───
batchSchema.methods.hasNetSuiteWorkOrder = function() {
  return this.netsuiteWorkOrderData && this.netsuiteWorkOrderData.tranId;
};

batchSchema.methods.isWorkOrderCompleted = function() {
  return this.workOrderStatus === 'completed' || 
         (this.netsuiteWorkOrderData && this.netsuiteWorkOrderData.status === 'built');
};

batchSchema.methods.getWorkOrderDisplayId = function() {
  // Prioritize the tranId (user-friendly work order number)
  if (this.netsuiteWorkOrderData && this.netsuiteWorkOrderData.tranId) {
    return this.netsuiteWorkOrderData.tranId;
  }
  // Fallback to the main workOrderId field
  if (this.workOrderId && !this.workOrderId.startsWith('PENDING-') && !this.workOrderId.startsWith('LOCAL-')) {
    return this.workOrderId;
  }
  return this.workOrderId || 'No Work Order';
};

batchSchema.methods.getNetSuiteWorkOrderId = function() {
  // Returns the internal NetSuite ID for API calls
  return this.netsuiteWorkOrderData?.workOrderId || null;
};

batchSchema.methods.getWorkOrderNumber = function() {
  // Returns the user-friendly work order number (tranId)
  return this.netsuiteWorkOrderData?.tranId || this.workOrderId || null;
};

// ─── Enhanced Static methods for NetSuite work order queries ───
batchSchema.statics.findByNetSuiteWorkOrder = function(workOrderIdentifier) {
  return this.find({
    $or: [
      { 'netsuiteWorkOrderData.workOrderId': workOrderIdentifier },
      { 'netsuiteWorkOrderData.tranId': workOrderIdentifier },
      { workOrderId: workOrderIdentifier }
    ]
  });
};

batchSchema.statics.findByWorkOrderNumber = function(tranId) {
  return this.find({
    $or: [
      { 'netsuiteWorkOrderData.tranId': tranId },
      { workOrderId: tranId }
    ]
  });
};

batchSchema.statics.findPendingWorkOrders = function() {
  return this.find({
    workOrderCreated: true,
    status: { $in: ['In Progress', 'Review'] },
    workOrderStatus: { $nin: ['completed', 'cancelled'] }
  });
};

batchSchema.statics.findFailedWorkOrders = function() {
  return this.find({
    workOrderStatus: 'failed',
    workOrderError: { $exists: true }
  });
};

// ─── Enhanced Indexes for NetSuite work order queries ───
batchSchema.index({ 'netsuiteWorkOrderData.workOrderId': 1 });
batchSchema.index({ 'netsuiteWorkOrderData.tranId': 1 });
batchSchema.index({ workOrderId: 1 });
batchSchema.index({ workOrderStatus: 1 });
batchSchema.index({ workOrderCreated: 1, workOrderStatus: 1 });

export default mongoose.models.Batch || mongoose.model('Batch', batchSchema);