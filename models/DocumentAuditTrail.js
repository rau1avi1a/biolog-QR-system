// models/DocumentAuditTrail.js
import mongoose, { Schema } from "mongoose";

const documentAuditTrailSchema = new Schema({
  documentId: {
    type: Schema.Types.ObjectId,
    ref: "SubSheets",
    required: true,
  },
  status: {
    type: String,
    enum: ["new", "inProgress", "review", "completed"],
    required: true,
  },
  annotations: [{
    type: {
      type: String,
      required: true,
    },
    path: [[Number]],
    page: Number,
    timestamp: Date,
  }],
  metadata: {
    operator: String,
    verifier: String,
    manager: String,
    chemicalsUsed: [{
      chemicalId: { type: Schema.Types.ObjectId, ref: "Chemical" },
      amount: Number,
      unit: String
    }],
    pH: Number,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  }
}, {
  timestamps: true
});

// Index for efficient querying
documentAuditTrailSchema.index({ documentId: 1, timestamp: -1 });

const DocumentAuditTrail = mongoose.models.DocumentAuditTrail || 
  mongoose.model("DocumentAuditTrail", documentAuditTrailSchema);

export default DocumentAuditTrail;