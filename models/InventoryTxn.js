import mongoose from 'mongoose';
const { Schema, model } = mongoose;

// Enhanced line schema with more tracking details
const lineSchema = new Schema({
  item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
  lot: { type: String }, // LotNumber plain string (optional)
  qty: { type: Number, required: true }, // Signed quantity (+/-)
  unitCost: { type: Number }, // Cost per unit at time of transaction
  totalValue: { type: Number }, // qty * unitCost
  lotQtyBefore: { type: Number }, // Lot quantity before this transaction
  lotQtyAfter: { type: Number }, // Lot quantity after this transaction
  itemQtyBefore: { type: Number }, // Item total quantity before
  itemQtyAfter: { type: Number }, // Item total quantity after
  expiryDate: { type: Date }, // For receipts, track expiry
  vendorLotNumber: { type: String }, // Original vendor lot number
  location: { type: String }, // Storage location
  notes: { type: String } // Line-specific notes
}, { _id: false });

const inventoryTxnSchema = new Schema({
  // WHAT happened
  txnType: { 
    type: String, 
    enum: ['receipt', 'issue', 'adjustment', 'build', 'transfer', 'waste', 'sample'], 
    required: true 
  },
  refDoc: { type: Schema.Types.ObjectId }, // PO, FileVersion, WorkOrder, etc.
  refDocType: { type: String }, // 'purchase_order', 'work_order', 'batch', etc.
  
  // Enhanced reference tracking
  batchId: { type: Schema.Types.ObjectId, ref: 'Batch' }, // Link to file/batch
  workOrderId: { type: String }, // NetSuite work order ID
  purchaseOrderId: { type: String }, // NetSuite PO ID
  
  // WHY / meta
  project: String,
  department: String,
  memo: String,
  reason: String, // For adjustments/waste - reason code
  
  // WHO did it
  createdBy: {
    _id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: String,
    email: String
  },
  
  // WHEN
  postedAt: { type: Date, default: Date.now },
  effectiveDate: { type: Date, default: Date.now }, // When the transaction actually occurred
  
  // STATUS
  status: { 
    type: String, 
    enum: ['draft', 'posted', 'reversed', 'cancelled'], 
    default: 'posted' 
  },
  reversedBy: { type: Schema.Types.ObjectId, ref: 'InventoryTxn' }, // Link to reversal txn
  
  // VALIDATION
  validated: { type: Boolean, default: false },
  validatedBy: {
    _id: { type: Schema.Types.ObjectId, ref: 'User' },
    name: String,
    email: String,
    date: Date
  },
  
  // LINES
  lines: [lineSchema],
  
  // TOTALS (computed)
  totalValue: { type: Number, default: 0 }, // Sum of all line totalValues
  lineCount: { type: Number, default: 0 }   // Number of lines
}, {
  timestamps: true,
  indexes: [
    { txnType: 1, postedAt: -1 },
    { 'lines.item': 1, postedAt: -1 },
    { refDoc: 1 },
    { batchId: 1 },
    { 'createdBy._id': 1, postedAt: -1 },
    { status: 1, postedAt: -1 }
  ]
});

// Pre-save middleware to calculate totals
inventoryTxnSchema.pre('save', function(next) {
  this.lineCount = this.lines.length;
  this.totalValue = this.lines.reduce((sum, line) => sum + (line.totalValue || 0), 0);
  next();
});

// Create and export the model
const InventoryTxn = mongoose.models.InventoryTxn || model('InventoryTxn', inventoryTxnSchema);

export { InventoryTxn };