// models/CycleCount.js
import mongoose, { Schema } from "mongoose";

const cycleCountItemSchema = new Schema({
  // Store a reference to the chemical (or you could use BiologNumber if you prefer)
  chemical: { type: Schema.Types.ObjectId, ref: "Chemical", required: true },
  // Save the chemical’s identifying info (optional but can be useful)
  BiologNumber: { type: String, required: true },
  ChemicalName: { type: String, required: true },
  // The specific lot for the count
  LotNumber: { type: String, required: true },
  // The quantity as found in inventory at the time of generation.
  previousQuantity: { type: Number, required: true },
  // The new counted quantity (to be filled in by the user)
  countedQuantity: { type: Number }
});

const cycleCountSchema = new Schema(
  {
    items: { type: [cycleCountItemSchema], default: [] },
    // When true, this cycle count is still in progress
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

const CycleCount =
  mongoose.models.CycleCount || mongoose.model("CycleCount", cycleCountSchema);

export default CycleCount;
