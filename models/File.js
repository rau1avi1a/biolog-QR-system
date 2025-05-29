import mongoose from 'mongoose';
const { Schema } = mongoose;


const fileSchema = new Schema(
  {
    fileName   : { type:String, required:true, index:true },
    description: String,
    folderId   : { type:Schema.Types.ObjectId, ref:'Folder', default:null },

    /* default recipe metadata (inherited by each Batch) */
    productRef : { type:Schema.Types.ObjectId, ref:'Item', default:null },
    solutionRef: { type:Schema.Types.ObjectId, ref:'Item', default:null },
    recipeQty  : Number,
    recipeUnit : String,
    components : [{                       // <— was “chemicalsUsed”
      itemId :{ type:Schema.Types.ObjectId, ref:'Item' },
      amount :Number,
      unit   :String,
      _id:false
    }],


    /* immutable master PDF */
    pdf:{
      data:Buffer,
      contentType:{ type:String, default:'application/pdf' }
    }
  },
  { timestamps:true }
);

export default mongoose.models.File || mongoose.model('File', fileSchema);
