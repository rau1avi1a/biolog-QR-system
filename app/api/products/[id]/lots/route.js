// app/api/products/[id]/lots/route.js

import connectMongoDB from "@lib/mongo/index.js";
import Product from "@/models/Product";
import { NextResponse } from "next/server";
import { revalidatePath } from 'next/cache'; // Import revalidatePath for On-Demand Revalidation

// Force dynamic route handling
export const dynamic = "force-dynamic";

/**
 * Helper function to extract `id` asynchronously
 * @param {Object} context - The Next.js route context
 * @returns {string} - The product ID
 * @throws Will throw an error if `id` is missing
 */
const getIdFromContext = async (context) => {
  const { id } = await context.params;
  if (!id) {
    throw new Error("Product ID is missing in the route parameters.");
  }
  return id;
};

/**
 * POST /api/products/[id]/lots
 *
 * Adds a new lot to the product's Lots array.
 * Expects a JSON body like:
 *  {
 *    "LotNumber": "G3-LotC",
 *    "Quantity": 50,
 *    "ExpirationDate": "2024-12-31",
 *    "isAvailable": true
 *  }
 *
 * Returns the updated product document with formatted ExpirationDate fields.
 * Triggers On-Demand Revalidation for both GET /api/products and GET /api/products/[id].
 */
export async function POST(request, context) {
  try {
    const id = await getIdFromContext(context); // Await params
    const body = await request.json(); // Parse request body

    await connectMongoDB(); // Connect to MongoDB

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

    await product.save(); // Save the updated product

    // Convert to plain object and include virtuals
    const doc = product.toObject({ virtuals: true });

    // Format the lots' expiration dates
    if (Array.isArray(doc.Lots)) {
      doc.Lots = doc.Lots.map((lot) => {
        let expirationDate;

        // Use `calculatedExpirationDate` if it exists and is valid
        if (
          lot.calculatedExpirationDate instanceof Date &&
          !isNaN(lot.calculatedExpirationDate)
        ) {
          expirationDate = lot.calculatedExpirationDate
            .toISOString()
            .split("T")[0];
        }
        // Use `ExpirationDate` if it exists and is valid
        else if (
          lot.ExpirationDate instanceof Date &&
          !isNaN(lot.ExpirationDate)
        ) {
          expirationDate = new Date(lot.ExpirationDate)
            .toISOString()
            .split("T")[0];
        } else {
          expirationDate = "N/A"; // Fallback if both dates are invalid
        }

        return {
          ...lot,
          ExpirationDate: expirationDate,
        };
      });
    }

    // Create response with Cache-Control header to prevent caching of POST responses
    const response = NextResponse.json(doc, { status: 201 });
    response.headers.set("Cache-Control", "no-store"); // Do not cache POST responses

    // Trigger On-Demand Revalidation for GET /api/products and GET /api/products/[id]
    await revalidatePath('/api/products');
    await revalidatePath(`/api/products/${id}`);

    return response;
  } catch (err) {
    console.error("Error adding new lot:", err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
