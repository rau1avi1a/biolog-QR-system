// scripts/migrate-chemical.js
import "dotenv/config";
import connectMongoDB from "@/lib/index";      // adjust the path
import Chemical      from "@/models/Chemical";
import { Item }      from "@/models/Item";

async function migrate(chemId) {
  await connectMongoDB();

  const chem = await Chemical.findById(chemId).lean();
  if (!chem) {
    console.error("Chemical not found:", chemId);
    process.exit(1);
  }

  // Build the Item document with the same _id
  const newItem = new Item({
    _id:          chem._id,               // preserve the same ID
    sku:          chem.BiologNumber,
    displayName:  chem.ChemicalName,
    itemType:     "chemical",
    uom:          "ea",
    lotTracked:   true,
    qtyOnHand:    chem.Lots.reduce((s, l) => s + l.Quantity, 0),
    casNumber:    chem.CASNumber,
    location:     chem.Location,
    Lots:         chem.Lots.map((l) => ({
      LotNumber: l.LotNumber,
      Quantity:  l.Quantity
    }))
  });

  await newItem.save();
  console.log("✅ Migrated chemical → Item:", chemId);
  process.exit(0);
}

// Usage: node migrate-chemical.js 679b000fa384d84d8612d9bc
migrate(process.argv[2]);
