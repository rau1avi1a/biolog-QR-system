import mongoose, { Schema } from "mongoose";

const catalogNumberFormats = {
    74221: "AMMDDYY#",
    74222: "AMMDDYY#",
    74224: "AMMDDYY#",
    74225: "AMMDDYY#",
    74226: "AMMDDYY#",
    74227: "AMMDDYY#",
    74228: "AMMDDYY#",
    74351: "AMMDDYY#",
    74352: "AMMDDYY#",
    74353: "AMMDDYY#",
    74354: "AMMDDYY#",

    3415: "AMMDDYY",
    3426: "AMMDDYY",
    3427: "AMMDDYY",
    3440: "AMMDDYY",
    3441: "AMMDDYY",
    72007: "AMMDDYY",
  
    72301: "DDMMYY#",
    72302: "DDMMYY#",
  
    72303: "MMDDYY#",
  };
  
// The subdoc schema
const lotSchema = new Schema({
  LotNumber: { type: String, required: true },
  Quantity: { type: Number, required: true, min: 0 },
  ExpirationDate: { type: Date, required: false },
  isAvailable: { type: Boolean, required: false, default: true },
});

// The product schema
const productSchema = new Schema(
  {
    CatalogNumber: { type: String, required: true, index: true },
    ProductName: { type: String, required: true, index: true },
    Lots: { type: [lotSchema], default: [] },
    ShelfLife: { type: Number, required: false, default: 12 },
  },
  { timestamps: true,
    strict: false
   }
);

// ---- VIRTUALS ------------------------------------------------------------

// For the entire product (summing available lots)
productSchema.virtual("totalQuantity").get(function () {
  return this.Lots.filter((lot) => lot.isAvailable).reduce(
    (sum, lot) => sum + lot.Quantity,
    0
  );
});

// For each subdoc lot, we define a virtual "calculatedExpirationDate"
lotSchema.virtual("calculatedExpirationDate").get(function () {
    // console.log("Calculating expiration date for lot:", this.LotNumber);
  
    // Check for manually set ExpirationDate
    if (this.ExpirationDate) {
    //   console.log("Using manually set ExpirationDate:", this.ExpirationDate);
      return this.ExpirationDate;
    }
  
    const lot = this.LotNumber?.toString();
    const productShelfLife = this.parent()?.ShelfLife; // Shelf life in months
    const catalogNum = this.parent()?.CatalogNumber;
  
    // console.log("LotNumber:", lot);
    // console.log("ShelfLife (months):", productShelfLife);
    // console.log("CatalogNumber:", catalogNum);
  
    if (!lot || !productShelfLife) {
    //   console.warn("Missing lot number or shelf life:", { lot, productShelfLife });
      return null;
    }
  
    // Determine lot format based on catalog number
    const lotFormat = catalogNumberFormats[catalogNum] || "TTMMDD#";
    // console.log("Determined lot format:", lotFormat);
  
    let year, month, day;
  
    // Parse lot number based on format
    if (lotFormat === "TTMMDD#") {
      if (/^\d{7}$/.test(lot)) {
        const tt = parseInt(lot.slice(0, 2), 10);
        year = tt + 2000 - 14; // Subtract 14 to adjust year
        month = parseInt(lot.slice(2, 4), 10) - 1;
        day = parseInt(lot.slice(4, 6), 10);
      } else {
        // console.warn("Invalid TTMMDD# format for lot:", lot);
        return null;
      }
    } else if (lotFormat === "YYMMDD#") {
      if (/^\d{7}$/.test(lot)) {
        year = parseInt(lot.slice(0, 2), 10) + 2000;
        month = parseInt(lot.slice(2, 4), 10) - 1;
        day = parseInt(lot.slice(4, 6), 10);
      } else {
        // console.warn("Invalid YYMMDD# format for lot:", lot);
        return null;
      }
    } else if (lotFormat === "AMMDDYY") {
        if (/^[A-Z]\d{6}$/.test(lot)) {
          // Ignore the leading letter and parse the date
          month = parseInt(lot.slice(1, 3), 10) - 1; // Extract MM
          day = parseInt(lot.slice(3, 5), 10);       // Extract DD
          year = parseInt(lot.slice(5, 7), 10) + 2000; // Extract YY and convert to full year
        } else {
        //   console.warn("Invalid AMMDDYY format for lot:", lot);
          return null;
        }
    } else if (lotFormat === "AMMDDYY#") {
        if (/^[A-Z]\d{6}\d?$/.test(lot)) {
            // Ignore the leading letter and parse the date
            month = parseInt(lot.slice(1, 3), 10) - 1; // Extract MM (0-indexed for JS Date)
            day = parseInt(lot.slice(3, 5), 10);       // Extract DD
            year = parseInt(lot.slice(5, 7), 10) + 2000; // Extract YY and convert to full year
        } else {
            // console.warn("Invalid AMMDDYY# format for lot:", lot);
            return null;
        }    
    } else if (lotFormat === "DDMMYY#") {
      if (/^\d{8}$/.test(lot)) {
        day = parseInt(lot.slice(0, 2), 10);
        month = parseInt(lot.slice(2, 4), 10) - 1;
        year = parseInt(lot.slice(4, 6), 10) + 2000;
      } else {
        // console.warn("Invalid DDMMYY# format for lot:", lot);
        return null;
      }
    } else if (lotFormat === "MMDDYY#") {
      if (/^\d{8}$/.test(lot)) {
        month = parseInt(lot.slice(0, 2), 10) - 1;
        day = parseInt(lot.slice(2, 4), 10);
        year = parseInt(lot.slice(4, 6), 10) + 2000;
      } else {
        // console.warn("Invalid MMDDYY# format for lot:", lot);
        return null;
      }
    } else {
    //   console.warn("Unsupported lot format:", lotFormat);
      return null;
    }
  
    // console.log("Parsed date values:", { year, month, day });
  
    const manufactureDate = new Date(year, month, day);
    if (isNaN(manufactureDate.getTime())) {
    //   console.warn("Invalid manufacture date:", { year, month, day });
      return null;
    }
  
    // Add shelf life to the manufacture date
    const expirationDate = new Date(manufactureDate);
    expirationDate.setMonth(expirationDate.getMonth() + productShelfLife);
  
    // console.log("Final calculated expiration date:", expirationDate);
    return expirationDate;
  });

// ---- PRE-SAVE HOOK ON THE PARENT SCHEMA -----------------------------------
/**
 * Because we have an array of subdocuments, we can't rely on `lotSchema.pre('save')`.
 * We use `productSchema.pre('save')` to iterate each lot. If no ExpirationDate is set,
 * we fill it with the `calculatedExpirationDate`.
 */
productSchema.pre("save", function (next) {
  // 'this' is the Product doc
  if (!this.Lots) return next();

  this.Lots.forEach((lot) => {
    // If ExpirationDate is already manually set, do nothing
    if (!lot.ExpirationDate) {
      const calc = lot.calculatedExpirationDate; // read the virtual
      if (calc instanceof Date && !isNaN(calc)) {
        lot.ExpirationDate = calc;
      }
    }
  });

  next();
});

// If You Also Want to Update on PUT Requests
// When you do a PUT that modifies or creates new lots, Mongoose will again run the parent doc’s pre('save') hook if you do:
// const product = await Product.findById(id);
// // modify product.Lots array...
// await product.save(); // triggers the hook

// Ensure virtuals appear in JSON
productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });
lotSchema.set("toJSON", { virtuals: true });
lotSchema.set("toObject", { virtuals: true });

const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);

export default Product;
