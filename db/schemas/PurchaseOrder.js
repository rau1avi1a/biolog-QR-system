import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const lineSchema = new Schema({
  item  :{ type:Schema.Types.ObjectId, ref:'Item', required:true },
  qty   :{ type:Number, required:true },
  price :Number,
  uom   :String
}, { _id:false });

export const PurchaseOrder = model('PurchaseOrder', new Schema({
  poNumber: { type:String, required:true, unique:true }, // mirror NetSuite PO#
  vendor  : { type:Schema.Types.ObjectId, ref:'Vendor', required:true },
  status  : { type:String, enum:['open','partial','received','closed'], default:'open' },
  eta     : Date,
  lines   : [ lineSchema ],
  memo    : String
}, { timestamps:true }));
