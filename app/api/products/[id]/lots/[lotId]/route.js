// app/api/products/[id]/lots/[lotId]/route.js

import connectMongoDB from "@lib/index.js";
import Product from "@/models/Product";
import { NextResponse } from "next/server";
import { revalidatePath } from 'next/cache'; // Import revalidatePath for On-Demand Revalidation

// Force dynamic route handling
export const dynamic = "force-dynamic";

/**
 * Helper function to extract `id` and `lotId` asynchronously
 * @param {Object} context - The Next.js route context
 * @returns {Object} - An object containing `id` and `lotId`
 * @throws Will throw an error if `id` or `lotId` is missing
 */
const getIdsFromContext = async (context) => {
  const { id, lotId } = await context.params;
  if (!id) {
    throw new Error("Product ID is missing in the route parameters.");
  }
  if (!lotId) {
    throw new Error("Lot ID is missing in the route parameters.");
  }
  return { id, lotId };
};

/**
 * PUT /api/products/[id]/lots/[lotId]
 *
 * Partially updates a specific lot within a product.
 * Expects a JSON body like:
 *  {
 *    "LotNumber": "G3-LotC",
 *    "Quantity": 75,
 *    "ExpirationDate": "2025-01-31",
 *    "isAvailable": true
 *  }
 *
 * Returns the updated product document with formatted ExpirationDate fields.
 * Triggers On-Demand Revalidation for GET /api/products and GET /api/products/[id].
 */
export async function PUT(request, context) {
  try {
    // Extract `id` and `lotId` from context
    const { id, lotId } = await getIdsFromContext(context);

    // Parse the request body
    const body = await request.json(); // e.g., { LotNumber, Quantity, ExpirationDate, isAvailable }

    // Connect to MongoDB
    await connectMongoDB();

    // Find the product by ID
    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json(
        { message: "Product not found" },
        { status: 404 }
      );
    }

    // Find the specific lot to update
    const lot = product.Lots.id(lotId);
    if (!lot) {
      return NextResponse.json(
        { message: "Lot not found" },
        { status: 404 }
      );
    }

    // Update the lot fields if they are provided in the request body
    if (body.LotNumber !== undefined) lot.LotNumber = body.LotNumber;
    if (body.Quantity !== undefined) lot.Quantity = body.Quantity;

    if (body.ExpirationDate !== undefined) {
      if (typeof body.ExpirationDate === "string") {
        const val = body.ExpirationDate.trim().toLowerCase();
        if (val === "n/a" || val === "na" || val === "") {
          // Interpret as no date
          lot.ExpirationDate = undefined;
        } else {
          // Parse as a valid date
          lot.ExpirationDate = new Date(body.ExpirationDate);
        }
      } else {
        lot.ExpirationDate = body.ExpirationDate;
      }
    }

    if (body.isAvailable !== undefined) lot.isAvailable = body.isAvailable;

    // Save the updated product
    await product.save();

    // Convert to plain object and include virtuals
    const doc = product.toObject({ virtuals: true });

    // Format the lots' expiration dates
    if (Array.isArray(doc.Lots)) {
      doc.Lots = doc.Lots.map((lt) => {
        let expirationDate;

        if (
          lt.calculatedExpirationDate instanceof Date &&
          !isNaN(lt.calculatedExpirationDate)
        ) {
          expirationDate = lt.calculatedExpirationDate
            .toISOString()
            .split("T")[0];
        } else if (
          lt.ExpirationDate instanceof Date &&
          !isNaN(lt.ExpirationDate)
        ) {
          expirationDate = new Date(lt.ExpirationDate)
            .toISOString()
            .split("T")[0];
        } else {
          expirationDate = "N/A"; // Fallback if both dates are invalid
        }

        return {
          ...lt,
          ExpirationDate: expirationDate,
        };
      });
    }

    // Create response with Cache-Control header to prevent caching of PUT responses
    const response = NextResponse.json(doc, { status: 200 });
    response.headers.set("Cache-Control", "no-store"); // Do not cache PUT responses

    // Trigger On-Demand Revalidation for GET /api/products and GET /api/products/[id]
    await revalidatePath('/api/products');
    await revalidatePath(`/api/products/${id}`);

    return response;
  } catch (err) {
    console.error("Error updating lot:", err);
    return NextResponse.json(
      { message: "Failed to update lot", details: err.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/products/[id]/lots/[lotId]
 *
 * Removes a specific lot from a product's Lots array.
 *
 * Returns a success message and the updated product document with formatted ExpirationDate fields.
 * Triggers On-Demand Revalidation for GET /api/products and GET /api/products/[id].
 */
export async function DELETE(request, context) {
  try {
    // Extract `id` and `lotId` from context
    const { id, lotId } = await getIdsFromContext(context);

    // Connect to MongoDB
    await connectMongoDB();

    // Find the product by ID
    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json(
        { message: "Product not found" },
        { status: 404 }
      );
    }

    // Remove the lot with the specified `lotId`
    const lotIndex = product.Lots.findIndex(
      (lot) => lot._id.toString() === lotId
    );

    if (lotIndex === -1) {
      return NextResponse.json(
        { message: "Lot not found" },
        { status: 404 }
      );
    }

    product.Lots.splice(lotIndex, 1); // Remove the lot

    // Save the updated product
    await product.save();

    // Convert to plain object and include virtuals
    const doc = product.toObject({ virtuals: true });

    // Format the lots' expiration dates
    if (Array.isArray(doc.Lots)) {
      doc.Lots = doc.Lots.map((lot) => {
        let expirationDate;

        if (
          lot.calculatedExpirationDate instanceof Date &&
          !isNaN(lot.calculatedExpirationDate)
        ) {
          expirationDate = lot.calculatedExpirationDate
            .toISOString()
            .split("T")[0];
        } else if (
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

    // Create response with Cache-Control header to prevent caching of DELETE responses
    const response = NextResponse.json(
      { message: "Lot deleted successfully", product: doc },
      { status: 200 }
    );
    response.headers.set("Cache-Control", "no-store"); // Do not cache DELETE responses

    // Trigger On-Demand Revalidation for GET /api/products and GET /api/products/[id]
    await revalidatePath('/api/products');
    await revalidatePath(`/api/products/${id}`);

    return response;
  } catch (err) {
    console.error("Error deleting lot:", err);
    return NextResponse.json(
      { message: "Failed to delete lot", error: err.message },
      { status: 500 }
    );
  }
}
