// models/ChemicalAudit.js
import mongoose, { Schema } from "mongoose";

const chemicalAuditSchema = new Schema(
  {
    chemical: {
      BiologNumber: { type: String, required: true },
      ChemicalName: { type: String, required: true },
      CASNumber: { type: String },
      Location: { type: String }
    },
    lot: {
      LotNumber: { type: String, required: true },
      QuantityPrevious: { type: Number, required: false},
      QuantityUsed: { type: Number, required: true },
      QuantityRemaining: { type: Number, required: true }
    },
    user: {
      _id: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
      name: { type: String, required: true },
      email: { type: String, required: true }
    },
    action: {
      type: String,
      enum: ['USE', 'DEPLETE', 'ADJUST', 'REMOVE', 'ADD'],
      required: true
    },
    notes: { type: String },
    project: { type: String }, // Optional: for tracking which project used the chemical
    department: { type: String }, // Optional: for tracking department usage
  },
  { 
    timestamps: true,
    strict: false,
    // Add compound index for efficient querying
    index: { 
      'chemical.BiologNumber': 1,
      'lot.LotNumber': 1,
      createdAt: -1 
    }
  }
);

// Add method to create usage audit
chemicalAuditSchema.statics.logUsage = async function({
  chemical,
  lotNumber,
  quantityUsed,
  quantityRemaining,
  user,
  notes,
  project,
  department
}) {
  return this.create({
    chemical: {
      BiologNumber: chemical.BiologNumber,
      ChemicalName: chemical.ChemicalName,
      CASNumber: chemical.CASNumber,
      Location: chemical.Location
    },
    lot: {
      LotNumber: lotNumber,
      QuantityUsed: quantityUsed,
      QuantityRemaining: quantityRemaining
    },
    user: {
      _id: user._id,
      name: user.name,
      email: user.email
    },
    action: quantityRemaining === 0 ? 'DEPLETE' : 'USE',
    notes,
    project,
    department
  });
};

const ChemicalAudit = mongoose.models.Audit || mongoose.model("Audit", chemicalAuditSchema);

export default ChemicalAudit;