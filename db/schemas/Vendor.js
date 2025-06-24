import mongoose,{Schema, model} from 'mongoose';

export const Vendor = model('Vendor', new Schema({
  name:    { type:String, required:true, unique:true },
  phone:   String,
  email:   String,
  address: String,
  terms:   String
}, { timestamps:true }));
