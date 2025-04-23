// models/FileVersion.js
import mongoose, { Schema } from "mongoose";
import { FILE_STATUSES } from "./File.js";

const fileVersionSchema = new Schema(
  {
    /* back-reference to the immutable master file */
    fileId: {
      type:   Schema.Types.ObjectId,
      ref:    "File",
      index:  true,
      required: true,
    },

    /* auto-increment per file (set in pre('validate')) */
    version: { type: Number, default: 1 },

    /* the signed / annotated PDF payload */
    pdf: {
      data:        { type: Buffer, required: true },
      contentType: { type: String, default: "application/pdf" },
    },

    /* workflow status *at the moment of signing* (immutable) */
    statusSnapshot: {
      type: String,
      enum: FILE_STATUSES,
      default: undefined,
    },

    /* audit details */
    createdBy: String,
    signedAt:  { type: Date, default: Date.now },

    /* overlay PNG for quick preview */
    overlayPng: String,           // base64-data-url or S3 key

    /* optional structured metadata */
    metadata: {
      verifier:  String,
      manager:   String,
      chemicalsUsed: [
        {
          chemicalId: { type: Schema.Types.ObjectId, ref: "Chemical" },
          amount:     Number,
          unit:       String,
        },
      ],
      pH: Number,
    },
  },
  { timestamps: true }
);

/* speed up “latest version” look-ups */
fileVersionSchema.index({ fileId: 1, version: -1 });

/* auto-increment version per master file */
fileVersionSchema.pre("validate", async function (next) {
  if (!this.isNew) return next();

  const latest = await mongoose
    .model("FileVersion")
    .findOne({ fileId: this.fileId })
    .sort({ version: -1 })
    .select("version")
    .lean();

  this.version = latest ? latest.version + 1 : 1;
  next();
});

/* snapshot the current file.status if not provided explicitly */
fileVersionSchema.pre("save", async function (next) {
  if (this.statusSnapshot) return next();

  const File = mongoose.model("File");
  const parent = await File.findById(this.fileId).select("status").lean();
  if (parent) this.statusSnapshot = parent.status;
  next();
});

export default
  mongoose.models.FileVersion ||
  mongoose.model("FileVersion", fileVersionSchema);
