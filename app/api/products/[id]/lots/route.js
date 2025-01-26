// app/api/products/[id]/lots/route.js
import connectMongoDB from "@lib/mongo/index.js";
import Product from "@/models/Product";
import { NextResponse } from "next/server";

// Force dynamic if needed
export const dynamic = "force-dynamic";

/**
 * POST => Add a new lot to the product's Lots array
 * JSON body e.g. { "LotNumber": "G3-LotC", "Quantity": 50, "ExpirationDate": "2024-12-31", "isAvailable": true }
 */
export async function POST(request, context) {
  try {
    const params = await context.params; // Await params to ensure proper handling
    const { id } = params;

    await connectMongoDB();

    const body = await request.json(); // { LotNumber, Quantity, ExpirationDate, isAvailable }

    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json({ message: "Product not found" }, { status: 404 });
    }

    // Push new lot with isAvailable field
    product.Lots.push({
      LotNumber: body.LotNumber ?? "NewLot",
      Quantity: body.Quantity ?? 0,
      ExpirationDate: body.ExpirationDate ?? null,
      isAvailable: body.isAvailable ?? false, // Default to false if not provided
    });

    await product.save();

    // Optionally format each lot's date
    const doc = product.toObject();
    doc.Lots = doc.Lots.map((lot) => {
      if (lot.ExpirationDate) {
        lot.ExpirationDate = new Date(lot.ExpirationDate).toISOString().split("T")[0];
      }
      return lot;
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error("Error adding new lot:", err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
