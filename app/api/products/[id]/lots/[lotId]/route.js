import connectMongoDB from "@lib/mongo/index.js";
import Product from "@/models/Product";
import { NextResponse } from "next/server";

// Force dynamic if needed
export const dynamic = "force-dynamic";

// PUT => partial update a single lot (like changing Quantity, ExpirationDate, isAvailable, etc.)
export async function PUT(request, {params}) {
  try {
    const { id, lotId } = params;

    const body = await request.json(); // e.g. { LotNumber, Quantity, ExpirationDate, isAvailable }
    await connectMongoDB();

    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json({ message: "Product not found" }, { status: 404 });
    }

    // Find the lot to update
    const lot = product.Lots.id(lotId);
    if (!lot) {
      return NextResponse.json({ message: "Lot not found" }, { status: 404 });
    }

    // Update the lot with new values
    if (body.LotNumber !== undefined) lot.LotNumber = body.LotNumber;
    if (body.Quantity !== undefined) lot.Quantity = body.Quantity;

    if (body.ExpirationDate !== undefined) {
      if (typeof body.ExpirationDate === "string") {
        const val = body.ExpirationDate.trim().toLowerCase();
        if (val === "n/a" || val === "na" || val === "") {
          // Interpret as no date
          lot.ExpirationDate = undefined;
        } else {
          // Parse as real date
          lot.ExpirationDate = new Date(body.ExpirationDate);
        }
      } else {
        lot.ExpirationDate = body.ExpirationDate;
      }
    }

    if (body.isAvailable !== undefined) lot.isAvailable = body.isAvailable;

    await product.save();

    // Optionally format each lot's date
    const doc = product.toObject();
    doc.Lots = doc.Lots.map((lt) => {
      if (lt.ExpirationDate) {
        lt.ExpirationDate = new Date(lt.ExpirationDate)
          .toISOString()
          .split("T")[0];
      }
      return lt;
    });

    return NextResponse.json(doc, { status: 200 });
  } catch (err) {
    console.error("Error updating lot:", err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

// DELETE => Remove a specific lot from a product's Lots array
export async function DELETE(request, {params}) {
    try {
      const { id, lotId } = params;
  
      await connectMongoDB();
  
      // Find the product by ID
      const product = await Product.findById(id);
      if (!product) {
        return NextResponse.json({ message: "Product not found" }, { status: 404 });
      }
  
      // Filter out the lot with the specified lotId
      product.Lots = product.Lots.filter((lot) => lot._id.toString() !== lotId);
  
      // Save the updated product
      await product.save();
  
      // Format `ExpirationDate` for all lots before sending back
      const doc = product.toObject();
      doc.Lots = doc.Lots.map((lot) => {
        if (lot.ExpirationDate) {
          lot.ExpirationDate = new Date(lot.ExpirationDate)
            .toISOString()
            .split("T")[0]; // Format to YYYY-MM-DD
        }
        return lot;
      });
  
      return NextResponse.json({ message: "Lot deleted successfully", product: doc });
    } catch (err) {
      console.error("Error deleting lot:", err);
      return NextResponse.json(
        { message: "Failed to delete lot", error: err.message },
        { status: 500 }
      );
    }
  }
  
