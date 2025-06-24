// models/File.js - Updated to include NetSuite import metadata
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
    components : [{                       
      itemId :{ type:Schema.Types.ObjectId, ref:'Item' },
      amount :Number,
      unit   :String,
      // NEW: Store NetSuite import data for each component
      netsuiteData: {
        itemId: String,           // NetSuite item internal ID
        itemRefName: String,      // NetSuite item reference name  
        ingredient: String,       // NetSuite ingredient name
        bomQuantity: Number,      // BOM quantity from NetSuite
        componentYield: Number,   // Component yield percentage
        units: String,            // NetSuite unit ID
        lineId: Number,           // BOM line ID
        bomComponentId: Number,   // BOM component ID
        itemSource: String,       // Item source (Stock, etc.)
        type: { type: String, default: 'netsuite' }
      },
      _id:false
    }],

    /* NEW: NetSuite import metadata at file level */
    netsuiteImportData: {
      bomId: String,              // NetSuite BOM ID
      bomName: String,            // NetSuite BOM name
      revisionId: String,         // NetSuite BOM revision ID
      revisionName: String,       // NetSuite BOM revision name
      importedAt: Date,           // When the BOM was imported
      solutionNetsuiteId: String, // NetSuite ID of the solution
      lastSyncAt: Date,           // Last time we synced with NetSuite
      _id: false
    },

    /* immutable master PDF */
    pdf:{
      data:Buffer,
      contentType:{ type:String, default:'application/pdf' }
    }
  },
  { timestamps:true }
);

export default mongoose.models.File || mongoose.model('File', fileSchema);