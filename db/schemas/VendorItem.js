import mongoose,{Schema, model} from 'mongoose';

export const VendorItem = model('VendorItem', new Schema({
  vendor:      { type:Schema.Types.ObjectId, ref:'Vendor', required:true },
  item:        { type:Schema.Types.ObjectId, ref:'Item',   required:true },
  vendorSKU:   String,
  lastPrice:   Number,
  preferred:   { type:Boolean, default:false }
}, {
  timestamps:true,
  indexes:[{ vendor:1, item:1, unique:true }]
}));
