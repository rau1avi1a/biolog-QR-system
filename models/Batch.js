/* models/Batch.js -------------------------------------------------- */
import mongoose from 'mongoose';
const { Schema } = mongoose;

/* reusable sub-schemas */
const usageSchema = new Schema({
  itemId:{ type:Schema.Types.ObjectId, ref:'Item', required:true },
  lotId :{ type:Schema.Types.ObjectId,                 required:true },
  qty   :Number,
  uom   :{ type:String, default:'ea' }
},{ _id:false });

const outputLotSchema = new Schema({
  lotNumber:String,
  qty      :Number,
  uom      :{ type:String, default:'ea' }
},{ _id:false });

const componentSchema = new Schema({
  itemId:Schema.Types.ObjectId,
  amount:Number,
  unit  :String
},{ _id:false });

const batchSchema = new Schema({
  /* link back to the template file */
  fileId   :{ type:Schema.Types.ObjectId, ref:'File', required:true, index:true },

  /* auto-increments **per file** (see pre-hook) */
  runNumber:{ type:Number, default:1 },

  /* operator overlay / signed copy */
  overlayPng:String,
  overlayHistory: [String],
  signedPdf :{ data:Buffer, contentType:String },

  status:{ type:String, enum:['In Progress', 'Review', 'Completed'], default:'In Progress' },

  /* ───── snapshot (optional) ───── */
  snapshot:{
    enabled:{ type:Boolean, default:true },          // turn off if you wish
    productRef :Schema.Types.ObjectId,
    solutionRef:Schema.Types.ObjectId,
    recipeQty  :Number,
    recipeUnit :String,
    components :[componentSchema]
  },

  /* inventory movement */
  inputs    :[usageSchema],          // lots consumed
  outputLot : outputLotSchema,       // lot produced

  signedBy:String,
  signedAt:Date
},{ timestamps:true });

/* auto-increment runNumber for this File only */
batchSchema.pre('validate', async function (next) {
  if (!this.isNew) return next();
  const last = await mongoose.model('Batch')
    .findOne({ fileId:this.fileId })
    .sort({ runNumber:-1 })
    .select('runNumber')
    .lean();
  this.runNumber = last ? last.runNumber + 1 : 1;
  next();
});

export default mongoose.models.Batch || mongoose.model('Batch', batchSchema);
