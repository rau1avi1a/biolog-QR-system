// models/SubSheets.js
import mongoose, { Schema } from "mongoose";

const subSheetsSchema = new Schema({
  SolutionName: { type: String, required: false },
  fileName: { type: String, required: false },

  Chemical: [{ type: Schema.Types.ObjectId, ref: "Chemical", required: false }],
  AmountUsed: { type: Number, required: false },

  // Product snapshot + reference
  product: {
    catalogNumber: { type: String, required: false },
    productReference: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: false,
    },
  },

  // Store raw PDF bytes in this field:
  pdf: {
    data: Buffer,
    contentType: String,
  },

  // New fields for workflow management
  status: {
    type: String,
    enum: ["new", "inProgress", "review", "completed"],
    default: "new"
  },
  currentAnnotations: [{
    type: {
      type: String,
      required: false
    },
    path: [[Number]],
    page: Number,
    timestamp: Date
  }],
  annotationImage: { type: String },
});

const SubSheets = mongoose.models.SubSheets || mongoose.model("SubSheets", subSheetsSchema);

export default SubSheets;