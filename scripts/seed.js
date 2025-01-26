/**
 * scripts/seed.js
 *
 * Run this script with:
 *   node scripts/seed.js
 * 
 * It will connect to MongoDB, remove old data, and insert new sample items.
 */
import dotenv from "dotenv"
import "dotenv/config"

import connectMongoDB from "../lib/mongo/index.js"    // or the correct path to your connect file
import Product from "../models/Product.js"
import Chemical from "../models/Chemical.js"

// Top-level await if your environment supports it, or wrap in a main() function
await main()

async function main() {
  try {
    await connectMongoDB()

    // Remove old data to start fresh
    // await Product.deleteMany({})
    // await Chemical.deleteMany({})

    // Create sample products
    const p1 = await Product.create({
      CatalogNumber: "1000",
      ProductName: "Gen III",
      Lots: [
        {
          LotNumber: "G3-LotA",
          Quantity: 100,
          ExpirationDate: new Date("2024-12-31"),
        },
        {
          LotNumber: "G3-LotB",
          Quantity: 200,
          ExpirationDate: new Date("2025-06-30"),
        },
      ],
    })

    const p2 = await Product.create({
      CatalogNumber: "2000",
      ProductName: "Eco MicroPlate",
      Lots: [
        {
          LotNumber: "Eco-10",
          Quantity: 50,
        },
      ],
    })

    // Create sample chemicals
    const c1 = await Chemical.create({
      BiologNumber: "24-000001",
      ChemicalName: "Acetic Acid",
      CASNumber: "64-19-7",
      Location: "Room Temperature",
      Lots: [
        { LotNumber: "AA-01", Quantity: 10 },
        { LotNumber: "AA-02", Quantity: 5 },
      ],
    })

    const c2 = await Chemical.create({
      BiologNumber: "24-000002",
      ChemicalName: "Lactic Acid",
      CASNumber: "50-21-5",
      Location: "Fridge",
      Lots: [
        { LotNumber: "LA-01", Quantity: 20 },
      ],
    })

    console.log("Seeding complete! 🍀")
    process.exit(0)
  } catch (err) {
    console.error("Seeding error:", err)
    process.exit(1)
  }
}

