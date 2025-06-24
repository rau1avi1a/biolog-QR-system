/* models/Item.js - Updated with NetSuite Internal ID */
import mongoose from 'mongoose';
const { Schema } = mongoose;

/* ───────── base item (shared fields) ───────── */
const itemSchema = new Schema({
  sku               : { type: String, required: true, unique: true },
  displayName       : { type: String, required: true },
  itemType          : { type: String, required: true, enum: ['chemical','solution','product'] },
  netsuiteInternalId: { type: String, index: true }, // NEW FIELD - NetSuite Internal ID
  uom               : { type: String, default: 'ea' },
  lotTracked        : { type: Boolean, default: false },
  qtyOnHand         : { type: Number, default: 0 },
  cost              : Number,
  description       : String
},{
  discriminatorKey: 'itemType',
  timestamps: true
});

// Removed duplicate index - already defined above with { index: true }

export const Item =
  mongoose.models.Item || mongoose.model('Item', itemSchema);

/* ───────── helper to (re-)create discriminators ───────── */
const makeDisc = (name, fields) =>
  Item.discriminators?.[name] ||
  Item.discriminator(name, new Schema(fields, { timestamps: true }));

/* ───────── shared lot schema for items that need lot tracking ───────── */
const lotSchema = {
  _id       : { type: Schema.Types.ObjectId, auto: true },
  lotNumber : String,
  quantity  : Number
};

/* ───────── discriminators ───────── */

/* 1️⃣ Chemical */
export const Chemical = makeDisc('chemical',{
  casNumber: String,
  location : String,
  Lots: [lotSchema]
});

/* shared embedded-BOM row */
const componentSchema = new Schema({
  itemId : { type: Schema.Types.ObjectId, ref: 'Item', required: true },
  qty    : Number,
  uom    : { type: String, default: 'ea' }
}, { _id: false });

/* 2️⃣ Solution - now with Lots array for lot tracking */
export const Solution = makeDisc('solution',{
  bom: [componentSchema],          // ← embedded recipe
  Lots: [lotSchema]                // ← lot tracking for solutions
});

/* 3️⃣ Product - also with Lots array for lot tracking */
export const Product = makeDisc('product',{
  bom: [componentSchema],
  Lots: [lotSchema]                // ← lot tracking for products
});