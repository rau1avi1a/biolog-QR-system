import mongoose from 'mongoose';
const { Schema, model } = mongoose;

/* one line per SKU in the txn */
const lineSchema = new Schema({
  item :{ type:Schema.Types.ObjectId, ref:'Item', required:true },
  lot  :{ type:String },            // LotNumber plain string (optional)
  qty  :{ type:Number, required:true }
}, { _id:false });

export const InventoryTxn = model('InventoryTxn', new Schema({
  /* WHAT happened */
  txnType :{ type:String, enum:['receipt','issue','adjustment','build'], required:true },
  refDoc  :{ type:Schema.Types.ObjectId },         // PO, FileVersion, WorkOrder …

  /* WHY / meta */
  project    :String,
  department :String,
  memo       :String,

  /* WHO did it */
  createdBy:{
    _id  :{ type:Schema.Types.ObjectId, ref:'User', required:true },
    name :String,
    email:String
  },

  /* WHEN */
  postedAt:{ type:Date, default:Date.now },

  /* LINES */
  lines:[ lineSchema ]
}, {
  timestamps:true,
  index: [{ txnType:1, postedAt:-1 }]
}));
