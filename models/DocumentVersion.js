// models/DocumentVersion.js
import mongoose, { Schema } from "mongoose";

const documentVersionSchema = new Schema({
  originalDocumentId: {
    type: Schema.Types.ObjectId,
    ref: "SubSheets",
    required: true,
  },
  version: {
    type: Number,
    default: 1,
  },
  fileName: { 
    type: String, 
    required: true 
  },
  status: {
    type: String,
    enum: ["inProgress", "review", "completed"],
    default: "inProgress"
  },
  // Store the modified PDF
  pdf: {
    data: Buffer,
    contentType: String,
  },
  currentAnnotations: [{
    type: {
      type: String,
      required: true
    },
    path: [[Number]],
    page: Number,
    timestamp: Date
  }],
  metadata: {
    chemicals: [{
      name: String,
      amount: Number,
      unit: String
    }],
    pH: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient querying
documentVersionSchema.index({ originalDocumentId: 1, version: -1 });

const DocumentVersion = mongoose.models.DocumentVersion || 
  mongoose.model("DocumentVersion", documentVersionSchema);

export default DocumentVersion;