// models/Folder.js
import mongoose, { Schema } from "mongoose";

/**
 * Folder
 * • flat collection with a self‑reference (parentId) so we can nest arbitrarily deep
 * • a compound index (parentId + name) prevents duplicate names inside the same folder
 * • `path` stores the full ancestor chain (array of ObjectIds).  Handy for
 *   1) quickly querying “everything under X”  – Folder.find({ path: X })
 *   2) sorting / breadcrumb rendering without multiple round‑trips
 */
const folderSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    /** null = root */
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
    },

    /** materialised path – ancestor ids ordered root…parent */
    path: {
      type: [Schema.Types.ObjectId],
      default: [],
      index: true, // for “all descendants” queries
    },

    /** (optional) owner / ACL fields */
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

/* ------------------------------------------------------------ */
/*  Pre‑save: maintain `path` automatically                      */
/* ------------------------------------------------------------ */
folderSchema.pre("save", async function (next) {
  if (this.isModified("parentId")) {
    if (this.parentId) {
      const parent = await this.constructor.findById(this.parentId).lean();
      this.path = parent ? [...parent.path, parent._id] : [];
    } else {
      this.path = []; // root folder
    }
  }
  next();
});

/* ------------------------------------------------------------ */
/*  Ensure unique name within the same parent                    */
/* ------------------------------------------------------------ */
folderSchema.index({ parentId: 1, name: 1 }, { unique: true });

/* ------------------------------------------------------------ */
/*  Helper: create child easily                                  */
/* ------------------------------------------------------------ */
folderSchema.statics.createChild = async function (parentId, name, createdBy) {
  const child = new this({ parentId, name, createdBy });
  return child.save();
};

const Folder =
  mongoose.models.Folder || mongoose.model("Folder", folderSchema);

export default Folder;
