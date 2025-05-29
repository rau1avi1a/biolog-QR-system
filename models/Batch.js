// models/Batch.js
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

  workOrderId        : String,
  workOrderCreated   : { type: Boolean, default: false },
  chemicalsTransacted: { type: Boolean, default: false },
  transactionDate    : Date,

  solutionCreated    : { type: Boolean, default: false },
  solutionLotNumber  : String,
  solutionCreatedDate: Date,

  wasRejected    : { type: Boolean, default: false },
  rejectionReason: String,
  rejectedBy     : String,
  rejectedAt     : Date,

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

  workOrderCreatedAt   : Date,
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

export default mongoose.models.Batch || mongoose.model('Batch', batchSchema);
