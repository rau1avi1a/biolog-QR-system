import mongoose, { Schema } from "mongoose";

const lotSchema = new Schema({
  LotNumber: { type: String, required: true },
  Quantity: { type: Number, required: true },
  // Add fields as you like (ExpirationDate?), or keep it simple
});

const chemicalSchema = new Schema(
  {
    BiologNumber: { type: String, required: true },
    ChemicalName: { type: String, required: true },
    CASNumber: { type: String, required: false },
    Location: { type: String, required: false },
    Lots: { type: [lotSchema], default: [] },
  },
  { timestamps: true }
);

chemicalSchema.virtual("totalQuantity").get(function () {
  return this.Lots.reduce((sum, lot) => sum + lot.Quantity, 0);
});

chemicalSchema.set("toJSON", { virtuals: true });
chemicalSchema.set("toObject", { virtuals: true });

const Chemical =
  mongoose.models.Chemical || mongoose.model("Chemical", chemicalSchema);

export default Chemical;
