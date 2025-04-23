// models/File.js
import mongoose, { Schema } from "mongoose";

/* ──────────────────────────────────────────────────────────────── */
/* shared enum – keep in sync everywhere                           */
export const FILE_STATUSES = ["New", "In Progress", "Review", "Completed"];
/* ──────────────────────────────────────────────────────────────── */

const fileSchema = new Schema(
  {
    fileName:    { type: String, required: true, index: true },
    description: { type: String },

    folderId:   { type: Schema.Types.ObjectId, ref: "Folder",  default: null },
    productRef: { type: Schema.Types.ObjectId, ref: "Product", default: null },

    /* authoritative workflow flag ─────────────────────────────── */
    status: {
      type:   String,
      enum:   FILE_STATUSES,
      default:"New",
      index:  true,
    },

    /* current master PDF (never overwritten) ──────────────────── */
    pdf: {
      data:        Buffer,
      contentType: { type: String, default: "application/pdf" },
    },
  },
  { timestamps: true }
);

/* helper to create the master File straight from an upload */
fileSchema.statics.createFromUpload = async function ({
  buffer,
  fileName,
  productId,
}) {
  const Product = mongoose.model("Product");      // avoid circular import
  const prod     = await Product.findById(productId).lean();
  if (!prod) throw new Error("Product not found");

  return this.create({
    fileName,
    productRef: prod._id,
    product: {
      catalogNumber: prod.CatalogNumber,
      productName:   prod.ProductName,
    },
    pdf: { data: buffer },
    status: "New",
  });
};

export default mongoose.models.File || mongoose.model("File", fileSchema);
